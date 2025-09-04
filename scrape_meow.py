# Python 3.10+
import os, re, time, json
from pathlib import Path

import requests
import pandas as pd
from geopy.geocoders import ArcGIS
from geopy.extra.rate_limiter import RateLimiter

# ─────────── НАСТРОЙКИ ───────────
TOKEN        = os.getenv("VK_TOKEN")                 # добавить секрет в GitHub → Settings → Secrets → Actions
DOMAIN       = os.getenv("VK_DOMAIN", "meowafisha")  # паблик ВК
MAX_POSTS    = int(os.getenv("VK_MAX_POSTS", "2000"))
BATCH        = 100
WAIT_REQ     = 1.1                                   # VK ~1 rps
WAIT_GEO     = 1.0                                   # ArcGIS ≈1000/сутки
YEAR_DEFAULT = os.getenv("YEAR_DEFAULT", "2025")

OUTPUT_JSON  = Path("events.json")                   # раздаётся Pages
CACHE_FILE   = Path("geocode_cache.json")            # коммитим кэш — экономим лимит

assert TOKEN, "VK_TOKEN не задан"

vk_url = "https://api.vk.com/method/wall.get"
geo = RateLimiter(ArcGIS(timeout=10).geocode, min_delay_seconds=WAIT_GEO)

# Кэш адрес→[lat, lon]
if CACHE_FILE.exists():
    geocache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
else:
    geocache = {}

def vk_wall(offset: int):
    params = dict(domain=DOMAIN, offset=offset, count=BATCH,
                  access_token=TOKEN, v="5.199")
    r = requests.get(vk_url, params=params, timeout=20)
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"VK API error: {data['error']}")
    return data["response"]["items"]

CITY_WORDS = r"(калининград|гурьевск|светлогорск|янтарный|балтийск|пионерский|зеленоградск|поселок|посёлок|город|пгт|деревня|село|станция)"

def extract(text: str):
    m_date = re.search(r"\b(\d{2})\.(\d{2})\b", text)
    m_loc  = re.search(r"📍\s*(.+)", text)
    if not (m_date and m_loc):
        return None

    date  = f"{YEAR_DEFAULT}-{m_date.group(2)}-{m_date.group(1)}"
    loc   = m_loc.group(1).split('➡️')[0].strip()
    if not re.search(CITY_WORDS, loc, re.I):
        loc += ", Калининград"

    first_line = text.split('\n', 1)[0]
    title = re.sub(r"^\s*\d{2}\.\d{2}\s*\|\s*", "", first_line).strip()

    return dict(title=title, date=date, location=loc)

def geocode(addr: str):
    if addr in geocache:
        return geocache[addr]
    try:
        g = geo(addr)
        if g:
            geocache[addr] = [g.latitude, g.longitude]
        else:
            print(f"[Геокодер] Не удалось получить координаты для адреса: {addr}")
            geocache[addr] = [None, None]
    except Exception as e:
        print(f"[Геокодер] Ошибка при геокодировании адреса '{addr}': {e}")
        geocache[addr] = [None, None]
    return geocache[addr]

# ─────────── СБОР ПОСТОВ ───────────
records, off = [], 0
while off < MAX_POSTS:
    items = vk_wall(off)
    if not items:
        break
    for it in items:
        text = it.get("text") or ""
        evt = extract(text)
        if evt:
            records.append(evt)
    off += BATCH
    time.sleep(WAIT_REQ)

print("Анонсов найдено:", len(records))
if not records:
    OUTPUT_JSON.write_text("[]", encoding="utf-8")
    raise SystemExit(0)

df = pd.DataFrame(records).drop_duplicates(subset=["title", "date", "location"])

# ─────────── ГЕОКОДИНГ ───────────
from concurrent.futures import ThreadPoolExecutor

def geocode_wrapper(addr):
    return geocode(addr)

with ThreadPoolExecutor(max_workers=8) as executor:
    results = list(executor.map(geocode_wrapper, df["location"]))

lats, lons = zip(*results)
df["lat"] = lats
df["lon"] = lons

bad_cnt = int(df["lat"].isna().sum())
df = df.dropna(subset=["lat", "lon"])
# Очищаем кэш от ошибочных записей ([None, None])
clean_geocache = {k: v for k, v in geocache.items() if v != [None, None]}
CACHE_FILE.write_text(json.dumps(clean_geocache, ensure_ascii=False, indent=2), encoding="utf-8")

print("✅  events.json создан/обновлён")
# ─────────── СОХРАНЕНИЕ ───────────
df = df[["title","date","location","lat","lon"]].sort_values("date")
OUTPUT_JSON.write_text(df.to_json(orient="records", force_ascii=False, indent=2), encoding="utf-8")
CACHE_FILE.write_text(json.dumps(geocache, ensure_ascii=False, indent=2), encoding="utf-8")

print("✅  events.json создан/обновлён")
