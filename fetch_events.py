#!/usr/bin/env python3
"""
MeowAfisha · fetch_events.py
Улучшено с обработкой ошибок и логированием
- Каскадный геокодинг: ArcGIS → Yandex → Nominatim
- Кэш: geocode_cache.json (коммитим для экономии квот API)
- Логирование: stdout + опционально geocode_log.json с GEOCODE_SAVE_LOG=1
- Ограничения скорости: min_delay_seconds на провайдера (env)
"""

import os
import re
import time
import json
import sys
import logging
from pathlib import Path

# Опциональная загрузка .env для локальной разработки
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import pandas as pd
from geopy.geocoders import ArcGIS, Yandex, Nominatim
from geopy.extra.rate_limiter import RateLimiter
import geopy.exc

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
if not logger.handlers:
    logger.addHandler(handler)

# ─────────── НАСТРОЙКА ───────────
TOKEN = os.getenv("VK_TOKEN")  # Обязательный секрет VK
DOMAIN = os.getenv("VK_DOMAIN", "meowafisha")
MAX_POSTS = int(os.getenv("VK_MAX_POSTS", "50"))
BATCH = 100
WAIT_REQ = float(os.getenv("VK_WAIT_REQ", "1.1"))  # пауза между wall.get (~1 rps)
YEAR_DEFAULT = os.getenv("YEAR_DEFAULT", "2025")

# Задержки между запросами геокодинга (секунды)
DEFAULT_DELAYS = {
    'ARCGIS': float(os.getenv("ARCGIS_MIN_DELAY", "1.0")),
    'YANDEX': float(os.getenv("YANDEX_MIN_DELAY", "1.0")),
    'NOMINATIM': float(os.getenv("NOMINATIM_MIN_DELAY", "1.0"))
}

# Опциональный вывод лога в файл
GEOCODE_SAVE_LOG = os.getenv("GEOCODE_SAVE_LOG", "1") == "1"

OUTPUT_JSON = Path("events.json")
CACHE_FILE = Path("geocode_cache.json")
LOG_FILE = Path("geocode_log.json")

# ─────────── УТИЛИТЫ ───────────
def init_session() -> requests.Session:
    """Создать сессию requests с логикой повтора."""
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

session = init_session()

# Инициализация геокодеров
arcgis = ArcGIS(timeout=10)
yandex = Yandex(api_key=os.getenv("YANDEX_KEY"), timeout=10, user_agent="meowafisha-script") if os.getenv("YANDEX_KEY") else None
nominatim_url = os.getenv("NOMINATIM_URL", "").strip()
if nominatim_url:
    nominatim = Nominatim(user_agent=os.getenv("NOMINATIM_USER_AGENT", "meowafisha-bot"), timeout=10, domain=nominatim_url)
else:
    nominatim = Nominatim(user_agent=os.getenv("NOMINATIM_USER_AGENT", "meowafisha-bot"), timeout=10)

# Ограничители скорости (осторожные 1 запрос/с на сервис)
arcgis_geocode = RateLimiter(arcgis.geocode, min_delay_seconds=DEFAULT_DELAYS['ARCGIS']) if arcgis else None
yandex_geocode = RateLimiter(yandex.geocode, min_delay_seconds=DEFAULT_DELAYS['YANDEX']) if yandex else None
nominatim_geocode = RateLimiter(nominatim.geocode, min_delay_seconds=DEFAULT_DELAYS['NOMINATIM']) if nominatim else None

GEOCODERS = [
    {"name": "ArcGIS", "func": arcgis_geocode},
    {"name": "Yandex", "func": yandex_geocode},
    {"name": "Nominatim", "func": nominatim_geocode},
]

# Временный лог геокодинга (адрес → {'arcgis':..., 'yandex':..., 'nominatim':...})
geolog = {}
geocache = {}
original_cache = {}

def log_geocoding(addr: str, provider: str, success: bool, detail: str = ""):
    """Расширенное логирование со структурными уровнями."""
    msg = f"[{provider:9}] {'OK ' if success else 'N/A'} | {addr}"
    if detail:
        msg += f" → {detail}"

    level = logging.INFO if success else logging.WARNING
    logger.log(level, msg)

    # Сохранить в geolog для JSON экспорта
    if addr not in geolog:
        geolog[addr] = {}
    geolog[addr][provider] = {"success": success, "detail": detail}

def load_cache() -> dict:
    """Загрузить кэш геокодинга из файла с обработкой ошибок."""
    if not CACHE_FILE.exists():
        logger.info("Файл кэша не найден, начинаем с чистого")
        return {}

    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            cache = json.load(f)
        logger.info(f"Кэш загружен: {len(cache)} адресов")
        return cache
    except (json.JSONDecodeError, IOError) as e:
        logger.warning(f"Не удалось загрузить кэш: {e}, начинаем с чистого")
        return {}

def save_cache(cache: dict, force: bool = False) -> None:
    """Сохранить кэш геокодинга на диск."""
    if cache == original_cache and not force:
        logger.info("Кэш не изменился, пропускаем сохранение")
        return

    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        logger.info(f"Кэш сохранен: {len(cache)} адресов")
    except IOError as e:
        logger.error(f"Не удалось сохранить кэш: {e}")

def geocode_addr(addr: str) -> tuple:
    """Каскадный геокодинг с обработкой ошибок."""
    if not addr or not addr.strip():
        logger.warning("Предоставлен пустой адрес")
        return (None, None)

    addr = addr.strip()

    # Сначала проверить кэш
    if addr in geocache:
        cached_coords = geocache[addr]
        if cached_coords != [None, None]:
            logger.info(f"[CACHE    ] HIT | {addr} → {cached_coords[0]:.6f},{cached_coords[1]:.6f}")
            return tuple(cached_coords)
        else:
            logger.info(f"[CACHE    ] HIT | {addr} → координаты не найдены")

    # Попытаться использовать сервисы геокодинга
    for provider in GEOCODERS:
        name, func = provider["name"], provider["func"]
        if not func:
            log_geocoding(addr, name, False, "key not configured")
            continue

        try:
            loc = func(addr)
            if loc:
                coords = [loc.latitude, loc.longitude]
                geocache[addr] = coords
                log_geocoding(addr, name, True, f"{coords[0]:.6f},{coords[1]:.6f}")
                return tuple(coords)
            else:
                log_geocoding(addr, name, False, "no result")
        except requests.exceptions.RequestException as e:
            log_geocoding(addr, name, False, f"HTTP error: {e}")
        except geopy.exc.GeopyError as e:
            log_geocoding(addr, name, False, f"Geocoding error: {e}")
        except Exception as e:
            log_geocoding(addr, name, False, f"Unexpected error: {e}")

    # Все геокодеры не удались
    geocache[addr] = [None, None]
    logger.warning(f"Все геокодеры не удались для: {addr}")
    return (None, None)

def vk_wall(offset: int, attempts: int = 3):
    """Получить посты стены VK с обработкой ошибок и повторами."""
    params = {
        'domain': DOMAIN,
        'offset': offset,
        'count': BATCH,
        'access_token': TOKEN,
        'v': '5.199'
    }

    for attempt in range(1, attempts + 1):
        try:
            r = session.get("https://api.vk.ru/method/wall.get", params=params, timeout=20)
            r.raise_for_status()

            data = r.json()
            if 'error' in data:
                raise RuntimeError(f"VK API error: {data['error']}")

            return data['response']['items']

        except requests.exceptions.Timeout:
            logger.warning(f"VK request timeout (attempt {attempt}/{attempts})")
        except requests.exceptions.RequestException as e:
            logger.error(f"VK request failed (attempt {attempt}/{attempts}): {e}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON from VK (attempt {attempt}/{attempts}): {e}")
        except KeyError as e:
            logger.error(f"Unexpected VK response format (attempt {attempt}/{attempts}): {e}")

        if attempt < attempts:
            sleep_time = WAIT_REQ * attempt  # progressive backoff
            logger.info(f"Retrying in {sleep_time:.1f}s...")
            time.sleep(sleep_time)

    raise RuntimeError(f"Failed to fetch VK data after {attempts} attempts")

CITY_WORDS = r"(калининград|гурьевск|светлогорск|янтарный|зеленоградск|пионерский|балтийск|поселок|пос\.|г\.)"

def extract(text: str):
    """Извлечь данные события из текста поста VK."""
    if not text:
        return None

    # Попробовать разные паттерны даты
    date_patterns = [
        r"\b(\d{2})\.(\d{2})\b",  # DD.MM
        r"\b(\d{2})/(\d{2})\b",   # DD/MM
        r"\b(\d{1,2})\.(\d{1,2})\b",  # D.M или DD.MM
    ]

    date_match = None
    for pattern in date_patterns:
        date_match = re.search(pattern, text)
        if date_match:
            break

    # Попробовать разные маркеры местоположения
    loc_patterns = [
        r"📍\s*(.+)",      # 📍
        r"📍\s*([^📍\n]+)", # 📍 до следующего эмодзи или новой строки
        r"место[:\s]*(.+)", # "место:"
        r"адрес[:\s]*(.+)", # "адрес:"
    ]

    loc_match = None
    for pattern in loc_patterns:
        loc_match = re.search(pattern, text, re.I)
        if loc_match:
            break

    if not (date_match and loc_match):
        logger.debug(f"No date or location found in post: {text[:100]}...")
        return None

    date = f"{YEAR_DEFAULT}-{date_match.group(2).zfill(2)}-{date_match.group(1).zfill(2)}"
    loc = loc_match.group(1).split('➡️')[0].split('\n')[0].strip()

    # Добавить город если отсутствует
    if not re.search(CITY_WORDS, loc, re.I):
        loc += ", Калининград"

    # Заголовок: строка с датой без "DD.MM |"
    lines = text.split('\n')
    title = ""
    for line in lines:
        if re.search(r"\b\d{1,2}[./]\d{1,2}\b", line):
            title = re.sub(r"^\s*\d{1,2}[./]\d{1,2}\s*\|\s*", "", line).strip()
            break

    # Если заголовок пустой, взять первую строку
    if not title:
        title = lines[0].strip() if lines else "Событие"

    return {
        'title': title,
        'date': date,
        'location': loc,
        'text': text
    }

def main():
    """Основной обработчик с полной обработкой ошибок."""
    logger.info(f"VK_TOKEN present: {bool(TOKEN)}")
    logger.info(f"DOMAIN: {DOMAIN}")
    if not TOKEN:
        logger.critical("VK_TOKEN не задан (секрет репозитория или .env требуется)")
        sys.exit(1)

    try:
        logger.info("Запуск обработки событий...")

        # Загрузить существующие события
        existing_events = []
        if OUTPUT_JSON.exists():
            try:
                existing_events = json.loads(OUTPUT_JSON.read_text(encoding='utf-8'))
                logger.info(f"Загружено {len(existing_events)} существующих событий")
            except Exception as e:
                logger.warning(f"Не удалось загрузить существующие события: {e}")

        # Создать set ключей для проверки дубликатов
        existing_keys = set()
        for event in existing_events:
            key = f"{event['date']}|{event['title']}|{event['location']}"
            existing_keys.add(key)

        # Загрузить кэш
        global geocache, original_cache, geolog
        geocache = load_cache()
        original_cache = geocache.copy()
        geolog = {}

        # Собрать посты
        records, offset = [], 0
        logger.info(f"Загружаем до {MAX_POSTS} постов из группы VK '{DOMAIN}'")

        while offset < MAX_POSTS:
            try:
                items = vk_wall(offset)
                if not items:
                    logger.info("Больше постов не найдено")
                    break

                for item in items:
                    text = item.get("text") or ""
                    logger.debug(f"Processing post: {text[:200]}...")
                    event = extract(text)
                    if event:
                        # Проверить, новое ли событие
                        event_key = f"{event['date']}|{event['title']}|{event['location']}"
                        if event_key not in existing_keys:
                            records.append(event)
                            existing_keys.add(event_key)  # Добавить в set чтобы не дублировать в рамках одного запуска
                        else:
                            logger.debug(f"Событие уже существует: {event['title']}")

                offset += BATCH

                if offset < MAX_POSTS:
                    time.sleep(WAIT_REQ)

            except Exception as e:
                logger.error(f"Не удалось обработать батч с смещением {offset}: {e}")
                break

        logger.info(f"Извлечено {len(records)} событий")

        if not records:
            logger.warning("Новые события не найдены, сохраняем существующие")
            # Не перезаписываем файл, оставляем существующие события
            return

        # Дедупликация и сортировка
        df = pd.DataFrame(records).drop_duplicates()
        logger.info(f"После дедупликации: {len(df)} уникальных событий")

        # Геокодинг с отслеживанием прогресса
        lats, lons = [], []
        processed = 0

        for addr in df["location"]:
            if processed % 10 == 0:
                logger.info(f"Прогресс геокодинга: {processed}/{len(df)}")

            lat, lon = geocode_addr(addr)
            lats.append(lat)
            lons.append(lon)
            processed += 1

        df["lat"] = lats
        df["lon"] = lons

        # Сообщить о пропущенных координатах
        missing = df[df["lat"].isna()]
        missing_count = len(missing)
        if missing_count > 0:
            missing_addrs = ", ".join(sorted(set(missing["location"].tolist())))
            logger.warning(f"Отсутствуют координаты для {missing_count} адресов: {missing_addrs[:800]}{'...' if len(missing_addrs) > 800 else ''}")

        # Фильтровать события без координат
        df = df.dropna(subset=["lat", "lon"])
        logger.info(f"Финальный датасет: {len(df)} новых событий с координатами")

        # Объединить с существующими событиями
        new_events = df[["title", "date", "location", "lat", "lon", "text"]].to_dict('records')
        all_events = existing_events + new_events

        # Сортировать по дате
        all_events.sort(key=lambda x: x['date'])

        logger.info(f"Общий датасет: {len(all_events)} событий ({len(existing_events)} существующих + {len(new_events)} новых)")

        # Сохранить результат
        OUTPUT_JSON.write_text(
            json.dumps(all_events, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

        # Сохранить кэш
        save_cache(geocache)

        # Сохранить детальный лог если включено
        if GEOCODE_SAVE_LOG:
            try:
                LOG_FILE.write_text(json.dumps(geolog, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception as e:
                logger.error(f"Не удалось сохранить лог геокодинга: {e}")

        logger.info("Обработка событий завершена успешно")

    except Exception as e:
        logger.critical(f"Критическая ошибка в main: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # Всегда закрывать сессию
        session.close()
        logger.info("Сессия закрыта")

if __name__ == "__main__":
    main()
