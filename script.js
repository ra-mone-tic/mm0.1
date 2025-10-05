// ===== MeowMap: карта событий =====
// MapLibre + список событий + нижний поисковый бар

// Кастомный контрол навигации без кнопки компаса
class CustomNavigationControl {
  constructor() {
    this._container = null;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    // Кнопка увеличения масштаба
    const zoomInButton = this._createButton('zoom-in', 'Увеличить масштаб', () => {
      this._map.zoomIn();
    });

    // Кнопка уменьшения масштаба
    const zoomOutButton = this._createButton('zoom-out', 'Уменьшить масштаб', () => {
      this._map.zoomOut();
    });

    this._container.appendChild(zoomInButton);
    this._container.appendChild(zoomOutButton);

    return this._container;
  }

  onRemove() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._map = undefined;
  }

  _createButton(className, title, fn) {
    const button = document.createElement('button');
    button.className = `maplibregl-ctrl-${className}`;
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);

    // Добавляем иконки с правильным стилем
    if (className === 'zoom-in') {
      button.innerHTML = '<span style="font-size: 18px; line-height: 1; font-weight: bold;">+</span>';
    } else if (className === 'zoom-out') {
      button.innerHTML = '<span style="font-size: 18px; line-height: 1; font-weight: bold;">−</span>';
    }

    button.addEventListener('click', fn);

    return button;
  }
}

const JSON_URL = 'events.json';
const CACHE_URL = 'geocode_cache.json';
const REGION_BBOX = [19.30, 54.00, 23.10, 55.60];

const MAP_OPTIONS = {
  container: 'map',
  style: {
    version: 8,
    sources: {
      positron: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        bounds: REGION_BBOX,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }
    },
    layers: [
      { id: 'positron', type: 'raster', source: 'positron' }
    ]
  },
  center: [20.45, 54.71],
  zoom: 10,
  antialias: false,
  maxZoom: 17,
  maxBounds: [
    [REGION_BBOX[0], REGION_BBOX[1]],
    [REGION_BBOX[2], REGION_BBOX[3]]
  ],
  renderWorldCopies: false
};

const DEVICE_TODAY = new Date().toISOString().slice(0, 10);

// Функции транслитерации
function transliterateToRussian(text) {
  const translitMap = {
    'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е', 'yo': 'ё', 'zh': 'ж',
    'z': 'з', 'i': 'и', 'y': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
    'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'f': 'ф', 'kh': 'х', 'ts': 'ц',
    'ch': 'ч', 'sh': 'ш', 'sch': 'щ', '': 'ъ', 'y': 'ы', '': 'ь', 'e': 'э', 'yu': 'ю',
    'ya': 'я', 'ye': 'е', 'yi': 'й', 'h': 'х', 'c': 'к', 'w': 'в', 'q': 'к',
    'A': 'А', 'B': 'Б', 'V': 'В', 'G': 'Г', 'D': 'Д', 'E': 'Е', 'Yo': 'Ё', 'Zh': 'Ж',
    'Z': 'З', 'I': 'И', 'Y': 'Й', 'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н', 'O': 'О',
    'P': 'П', 'R': 'Р', 'S': 'С', 'T': 'Т', 'U': 'У', 'F': 'Ф', 'Kh': 'Х', 'Ts': 'Ц',
    'Ch': 'Ч', 'Sh': 'Ш', 'Sch': 'Щ', '': 'Ъ', 'Y': 'Ы', '': 'Ь', 'E': 'Э', 'Yu': 'Ю',
    'Ya': 'Я', 'Ye': 'Е', 'Yi': 'Й', 'H': 'Х', 'C': 'К', 'W': 'В', 'Q': 'К'
  };

  return text.replace(/yo|zh|kh|ts|ch|sh|sch|y|ye|yi|a|b|v|g|d|e|f|h|i|k|l|m|n|o|p|r|s|t|u|w|q|y|z/gi, match => {
    return translitMap[match.toLowerCase()] || match;
  });
}

function transliterateToEnglish(text) {
  const translitMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya', 'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
    'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh',
    'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E',
    'Ю': 'Yu', 'Я': 'Ya'
  };

  return text.split('').map(char => translitMap[char] || char).join('');
}

// Расширенные варианты транслитерации
function generateTransliterations(text) {
  const results = new Set([text]);

  // Базовые транслитерации
  if (/[а-яё]/i.test(text)) {
    results.add(transliterateToEnglish(text));
  }

  if (/[a-z]/i.test(text)) {
    results.add(transliterateToRussian(text));
  }

  return Array.from(results);
}

function extractTimeFromText(text) {
  if (!text) return null;

  // Ищем время в форматах: "18:00", "18:00-22:00"
  // Используем более строгие паттерны, чтобы не путать с датами dd.mm
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,  // 18:00 - 22:00 (только с двоеточием)
    /(\d{1,2}):(\d{2})/   // 18:00 (только с двоеточием)
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match.length === 5) {
        // Формат с диапазоном времени
        const startHour = parseInt(match[1]);
        const startMin = parseInt(match[2]);
        const endHour = parseInt(match[3]);
        const endMin = parseInt(match[4]);

        // Проверяем, что это действительно время, а не дата
        // Часы должны быть 00-23, минуты 00-59
        if (startHour >= 0 && startHour <= 23 &&
            startMin >= 0 && startMin <= 59 &&
            endHour >= 0 && endHour <= 23 &&
            endMin >= 0 && endMin <= 59) {
          return {
            full: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}-${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
            start: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`,
            end: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
            hasEndTime: true
          };
        }
      } else if (match.length === 3) {
        // Формат с одним временем
        const hour = parseInt(match[1]);
        const min = parseInt(match[2]);

        // Проверяем, что это действительно время, а не дата
        // Часы должны быть 00-23, минуты 00-59
        if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
          return {
            full: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
            start: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
            end: null,
            hasEndTime: false
          };
        }
      }
    }
  }

  return null;
}

function getEventDateLabel(dateStr, eventText = null, showTimeAgo = false) {
  const timeStr = eventText ? extractTimeFromText(eventText) : null;

  if (dateStr === DEVICE_TODAY) {
    let result = '<span style="font-weight: bold; font-style: italic;">Сегодня</span>';

    if (timeStr) {
      result += ` <span style="font-style: italic;">${timeStr.full}</span>`;
    }

    // Если нужно показать "Закончилось n часов назад"
    if (showTimeAgo && timeStr && timeStr.hasEndTime) {
      const timeAgoText = getTimeAgoText(dateStr, timeStr.end, timeStr.start);
      if (timeAgoText) {
        result += `<br><span style="font-size: 11px; color: var(--text-2);">${timeAgoText}</span>`;
      }
    }

    return result;
  }
  if (!dateStr) return '';

  // Преобразуем yyyy-mm-dd в dd.mm.yy для единого формата
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const day = parseInt(m[3]);
    const month = parseInt(m[2]);
    const year = m[1].slice(-2); // берем только последние 2 цифры года
    const formattedDate = `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;

    let result = `<span style="font-weight: bold; font-style: italic;">${formattedDate}</span>`;

    if (timeStr) {
      result += ` <span style="font-style: italic;">${timeStr.full}</span>`;
    }

    // Если нужно показать "Закончилось n часов назад" для любого дня
    if (showTimeAgo && timeStr && timeStr.hasEndTime) {
      const timeAgoText = getTimeAgoText(dateStr, timeStr.end, timeStr.start);
      if (timeAgoText) {
        result += `<br><span style="font-size: 11px; color: var(--text-2);">${timeAgoText}</span>`;
      }
    }

    return result;
  }
  return `<span style="font-weight: bold; font-style: italic;">${dateStr}</span>`;
}

// Функция для получения названий дней недели на русском
function getDayOfWeekName(dayIndex) {
  const daysOfWeek = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return daysOfWeek[dayIndex] || '';
}

// Функция для получения дня недели по дате
function getDayOfWeekFromDate(dateStr) {
  if (!dateStr) return -1;
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay(); // 0 - воскресенье, 1 - понедельник, ..., 6 - суббота
}

// Функция для расчета времени окончания события с датой
function getTimeAgoText(eventDateStr, endTimeStr, startTimeStr) {
  if (!endTimeStr || !eventDateStr) return '';

  // Рассчитываем точное время окончания с учётом даты и переноса через полночь
  let endDateStr = eventDateStr;
  const startHour = startTimeStr ? parseInt(startTimeStr.split(':')[0]) : 0;
  const endHour = parseInt(endTimeStr.split(':')[0]);
  if (endHour < startHour) {
    // Событие заканчивается на следующий день
    const date = new Date(eventDateStr);
    date.setDate(date.getDate() + 1);
    endDateStr = date.toISOString().slice(0, 10);
  }

  const endTime = new Date(endDateStr + 'T' + endTimeStr + ':00');
  const now = new Date();

  // Если событие ещё не закончилось, возвращаем пустую строку
  if (endTime > now) return '';

  const diffInMs = now - endTime;
  const hours = Math.ceil(diffInMs / (1000 * 60 * 60));

  if (hours === 1) return 'Закончилось 1 час назад';
  if (hours < 5) return `Закончилось ${hours} часа назад`;
  return `Закончилось ${hours} часов назад`;
}



const mapContainer = document.getElementById('map');
if (!window.maplibregl || !maplibregl.supported()) {
  mapContainer.innerHTML = '<p style="padding:16px;">MapLibre требует поддержки WebGL. Обновите браузер или включите аппаратное ускорение.</p>';
  throw new Error('MapLibre is not supported in this environment');
}

const map = new maplibregl.Map(MAP_OPTIONS);

let styleErrorShown = false;
map.on('error', event => {
  if (styleErrorShown) return;
  styleErrorShown = true;
  console.error('Map style load error', event.error);
});

map.addControl(new CustomNavigationControl(), 'top-right');
map.addControl(new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  showUserLocation: true,
  labelText: 'Найти моё местоположение',
  noLocationText: 'Геолокация недоступна',
  searchingText: 'Поиск местоположения...',
  foundText: 'Моё местоположение'
}), 'top-right');

// Функция для обновления описания кнопки геолокации в зависимости от её состояния
function updateGeolocateButtonDescription(button) {
  if (!button) return;

  const currentAriaLabel = button.getAttribute('aria-label');
  const currentTitle = button.getAttribute('title');

  // Проверяем текущее состояние кнопки по её классам и атрибутам
  const isDisabled = button.disabled || button.classList.contains('maplibregl-ctrl-geolocate-disabled');
  const isActive = button.classList.contains('maplibregl-ctrl-geolocate-active');
  const isLoading = button.classList.contains('maplibregl-ctrl-geolocate-waiting');

  let newAriaLabel = '';
  let newTitle = '';

  if (isDisabled) {
    // Геолокация недоступна
    newAriaLabel = 'Геолокация недоступна';
    newTitle = 'Геолокация недоступна';
  } else if (isLoading) {
    // Идет поиск местоположения
    newAriaLabel = 'Поиск местоположения...';
    newTitle = 'Поиск местоположения...';
  } else if (isActive) {
    // Местоположение найдено
    newAriaLabel = 'Моё местоположение';
    newTitle = 'Моё местоположение';
  } else {
    // Обычное состояние - кнопка для определения локации
    newAriaLabel = 'Определить текущее местоположение на карте';
    newTitle = 'Определить текущее местоположение на карте';
  }

  // Обновляем атрибуты только если они изменились
  if (currentAriaLabel !== newAriaLabel) {
    button.setAttribute('aria-label', newAriaLabel);
  }
  if (currentTitle !== newTitle) {
    button.setAttribute('title', newTitle);
  }
}

// Функция для поиска и настройки кнопки геолокации
function setupGeolocateButton() {
  const selectors = [
    '.maplibregl-ctrl-geolocate button',
    '.maplibregl-ctrl-geolocate',
    '[aria-label="Show my location"]',
    'button[title="Show my location"]'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button) {
      // Устанавливаем начальное описание
      updateGeolocateButtonDescription(button);

      // Наблюдаем за изменениями классов кнопки
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            updateGeolocateButtonDescription(button);
          }
        });
      });

      observer.observe(button, {
        attributes: true,
        attributeFilter: ['class']
      });

      console.log('Кнопка геолокации настроена с динамическими описаниями');
      return;
    }
  }

  // Если кнопка не найдена сразу, ждем немного и пробуем снова
  setTimeout(setupGeolocateButton, 100);
  setTimeout(setupGeolocateButton, 500);
  setTimeout(setupGeolocateButton, 1000);
}

// Вызываем функцию после загрузки карты
map.on('load', () => {
  setTimeout(setupGeolocateButton, 100);
});

map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

const dateInput = document.getElementById('event-date');
const listContainer = document.getElementById('upcoming');
const archiveButton = document.getElementById('toggleArchive');
const sidebar = document.getElementById('sidebar');
const burger = document.getElementById('burger');
const logo = document.getElementById('logo');

const bottomBar = document.getElementById('bottomBar');
const searchInput = document.getElementById('global-search');
const searchPanel = document.getElementById('search-panel');
const searchResults = document.getElementById('search-results');
const searchEmpty = document.getElementById('search-empty');
const searchLabel = document.getElementById('search-label');
const searchClear = document.getElementById('search-clear');
const searchHandle = searchPanel ? searchPanel.querySelector('.search-panel__handle') : null;
const copyToast = document.getElementById('copy-toast');

let allEvents = [];
let upcomingEvents = [];
let archiveEvents = [];
let showingArchive = false;
let searchDragStartY = null;
let searchPanelOpen = false;
let copyToastTimer = null;

// Кэш координат
let geocodeCache = {};
let cacheLoaded = false;

function updateBottomBarOffset() {
  if (!bottomBar) {
    document.documentElement.style.setProperty('--search-panel-offset', '0px');
    return;
  }
  const offset = bottomBar.offsetHeight;
  document.documentElement.style.setProperty('--search-panel-offset', `${offset}px`);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const resizeViewport = debounce(() => {
  map.resize();
  updateBottomBarOffset();
}, 120);

map.on('load', () => setTimeout(resizeViewport, 120));
window.addEventListener('resize', resizeViewport);
updateBottomBarOffset();

const markers = [];
const markerById = new Map();

function clearMarkers() {
  markers.forEach(marker => marker.remove());
  markers.length = 0;
  markerById.clear();
}

function formatLocation(location) {
  if (!location) return '';
  return location.replace(/,?\s*Калининград\s*$/i, '');
}

// Функции для работы с кэшем координат
function loadGeocodeCache() {
  return fetch(CACHE_URL)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(cache => {
      geocodeCache = cache;
      cacheLoaded = true;
      console.log(`Кэш координат загружен: ${Object.keys(cache).length} адресов`);
      return cache;
    })
    .catch(error => {
      console.error('Ошибка загрузки кэша координат:', error);
      geocodeCache = {};
      cacheLoaded = true;
      return {};
    });
}

function getCoordinatesFromCache(location) {
  if (!cacheLoaded || !location) return null;

  // Нормализуем адрес для поиска
  const normalizedLocation = location.trim();

  // Ищем точное совпадение
  if (geocodeCache[normalizedLocation]) {
    return geocodeCache[normalizedLocation];
  }

  // Ищем частичное совпадение (если адрес содержит Калининград)
  for (const [cachedLocation, coordinates] of Object.entries(geocodeCache)) {
    if (normalizedLocation.includes(cachedLocation) || cachedLocation.includes(normalizedLocation)) {
      return coordinates;
    }
  }

  return null;
}

function updateEventCoordinates(event) {
  // Если у события уже есть координаты, используем их
  if (event.lat && event.lon) {
    return event;
  }

  // Ищем координаты в кэше
  const coordinates = getCoordinatesFromCache(event.location);
  if (coordinates) {
    event.lat = coordinates[0];
    event.lon = coordinates[1];
    console.log(`Найдены координаты для "${event.location}": [${coordinates[0]}, ${coordinates[1]}]`);
  } else {
    console.warn(`Координаты не найдены для "${event.location}"`);
  }

  return event;
}

function popupTemplate(event) {
  const shareButton = `
    <button class="share-btn"
      type="button"
      title="Скопировать ссылку"
      onclick="window.copyShareLink('${event.id}')"
      style="position:absolute;right:16px;bottom:8px;border:var(--border);background:var(--surface-2);border-radius:var(--radius-xs);padding:4px 6px;cursor:pointer;font-size:14px;line-height:1;color:var(--text-0);z-index:10;"
    >🔗</button>`;

  // Текст поста (без хештегов, даты и заголовка)
  let postText = event.text || '';
  postText = postText.replace(/#[^\s#]+/g, '').trim();
  postText = postText.replace(/^.*\n/, '').trim();

  // Показываем только первые 90 символов в свернутом виде
  const COLLAPSED_LIMIT = 90;
  const isLong = postText.length > COLLAPSED_LIMIT;
  const shortText = isLong ? postText.slice(0, COLLAPSED_LIMIT) : postText;

  // Новая ручка - только одна полоска внизу
  const handle = isLong ? '<div class="popup-handle" style="position:absolute;bottom:0;left:0;right:0;height:8px;cursor:pointer;z-index:5;display:flex;align-items:center;justify-content:center;"><div style="width:46px;height:5px;border-radius:999px;background:color-mix(in srgb, var(--text-1) 25%, transparent);"></div></div>' : '';

  return `
    <div style="position:relative;padding:8px 8px 28px 8px;min-width:220px;max-width:320px;">
      <div><strong>${event.title}</strong></div>
      <div>${formatLocation(event.location)}</div>
      <div style="color:var(--text-1);">${getEventDateLabel(event.date, event.text)}</div>
      <div class="popup-text" style="margin:8px 0 0 0;max-height:72px;overflow:hidden;position:relative;">
        <span class="popup-text-short">${shortText}${isLong ? '…' : ''}</span>
      </div>
      <div class="popup-text-full" style="display:none;max-height:160px;overflow:auto;margin:8px 0 0 0;">${postText.replace(/\n/g, '<br>')}</div>
      ${handle}
      ${shareButton}
    </div>
  `;
}

function addMarker(event) {
  const popup = new maplibregl.Popup({ offset: 24, closeButton: false }).setHTML(popupTemplate(event));
  const marker = new maplibregl.Marker().setLngLat([event.lon, event.lat]).setPopup(popup).addTo(map);
  markers.push(marker);
  markerById.set(event.id, marker);

  // popup expand/collapse logic
  let popupState = { expanded: false };

  function toggleText(popupEl) {
    const shortText = popupEl.querySelector('.popup-text-short');
    const fullText = popupEl.querySelector('.popup-text-full');
    const handle = popupEl.querySelector('.popup-handle');

    if (!shortText || !fullText) return;

    if (popupState.expanded) {
      // Свернуть
      shortText.style.display = 'inline';
      fullText.style.display = 'none';
      popupState.expanded = false;
    } else {
      // Развернуть
      shortText.style.display = 'none';
      fullText.style.display = 'block';
      popupState.expanded = true;
    }
  }

  popup.on('open', () => {
    const popupEl = popup.getElement();
    if (!popupEl) return;

    const handle = popupEl.querySelector('.popup-handle');
    if (handle) {
      handle.onclick = () => toggleText(popupEl);
    }
  });

  popup.on('close', () => {
    const popupEl = popup.getElement();
    if (!popupEl) return;

    // Сбрасываем состояние при закрытии
    const shortText = popupEl.querySelector('.popup-text-short');
    const fullText = popupEl.querySelector('.popup-text-full');
    if (shortText && fullText) {
      shortText.style.display = 'inline';
      fullText.style.display = 'none';
      popupState.expanded = false;
    }
  });
}

function makeEventId(event) {
  const source = `${event.date}|${event.title}|${event.lat}|${event.lon}`;
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) + hash) + source.charCodeAt(i);
  }
  return `e${(hash >>> 0).toString(16)}`;
}

function showCopyToast() {
  if (!copyToast) return;
  copyToast.hidden = false;
  copyToast.classList.add('is-visible');
  window.clearTimeout(copyToastTimer);
  copyToastTimer = window.setTimeout(() => {
    copyToast.classList.remove('is-visible');
    copyToastTimer = window.setTimeout(() => {
      if (!copyToast.classList.contains('is-visible')) {
        copyToast.hidden = true;
      }
    }, 200);
  }, 2000);
}

window.copyShareLink = async function copyShareLink(id) {
  const url = new URL(window.location.href);
  url.searchParams.set('event', id);
  const shareUrl = url.toString();

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      showCopyToast();
    } else {
      // Fallback для старых браузеров
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (successful) {
        showCopyToast();
      } else {
        throw new Error('Команда копирования не удалась');
      }
    }
  } catch (error) {
    console.error('Не удалось скопировать ссылку:', error);

    // Показываем уведомление об ошибке
    if (copyToast) {
      copyToast.textContent = 'Не удалось скопировать ссылку';
      copyToast.style.background = 'var(--surface-1)';
      copyToast.style.color = 'var(--text-0)';
      showCopyToast();

      // Возвращаем исходный текст через 3 секунды
      setTimeout(() => {
        copyToast.textContent = 'Ссылка скопирована';
      }, 3000);
    }
  }
};

function renderDay(dateStr, { recenter = true } = {}) {
  if (!dateStr || !allEvents.length) {
    clearMarkers();
    return [];
  }

  clearMarkers();
  const todays = allEvents.filter(event => event.date === dateStr);
  todays.forEach(addMarker);

  if (recenter && todays.length > 0) {
    map.flyTo({ center: [todays[0].lon, todays[0].lat], zoom: todays.length > 1 ? 12 : 14 });
  }

  return todays;
}

function highlightEventInSidebar(eventId, { scroll = true } = {}) {
  if (!listContainer) return;
  listContainer.querySelectorAll('.item.is-active').forEach(el => el.classList.remove('is-active'));
  if (!eventId) return;
  const target = listContainer.querySelector(`[data-event-id="${eventId}"]`);
  if (target) {
    target.classList.add('is-active');
    if (scroll) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

function highlightFirstByDate(dateStr) {
  if (!dateStr) {
    highlightEventInSidebar(null);
    return;
  }
  const candidate = listContainer?.querySelector(`.item[data-event-date="${dateStr}"]`);
  if (candidate) {
    highlightEventInSidebar(candidate.dataset.eventId, { scroll: false });
  } else {
    highlightEventInSidebar(null);
  }
}

function updateArchiveButtonLabel() {
  if (!archiveButton) return;
  archiveButton.textContent = showingArchive ? 'Назад' : 'Архив';
}

function createSectionHeader(title, isToday = false, isTomorrow = false) {
  const header = document.createElement('div');
  header.className = 'day-section-header';
  header.style.cssText = `
    margin: 16px 0 8px 0;
    padding: 4px 8px;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-1);
    border-left: 3px solid var(--brand);
  `;

  if (isToday) {
    header.style.cssText += `
      color: var(--brand);
      background: color-mix(in srgb, var(--brand) 10%, var(--surface-2));
    `;
  } else if (isTomorrow) {
    header.style.cssText += `
      color: var(--text-1);
      background: var(--surface-2);
    `;
  }

  header.textContent = title;
  return header;
}

function createEventItem(event, showTimeAgo = false) {
  const item = document.createElement('div');
  item.className = 'item';
  item.dataset.eventId = event.id;
  item.dataset.eventDate = event.date;
  item.setAttribute('role', 'button');
  item.tabIndex = 0;
  item.innerHTML = `<strong>${event.title}</strong><br>${formatLocation(event.location)}<br><i>${getEventDateLabel(event.date, event.text, showTimeAgo)}</i>`;

  return item;
}

function renderEventList(list) {
  if (!listContainer) return;

  listContainer.innerHTML = '';
  if (!list.length) {
    listContainer.textContent = showingArchive ? 'Архив пуст' : 'Нет ближайших событий';
    return;
  }

  // Если показываем архив, то просто сортируем по дате от новых к старым без группировки
  if (showingArchive) {
    const sortedEvents = list.sort((a, b) => b.date.localeCompare(a.date));
    sortedEvents.forEach(event => listContainer.appendChild(createEventItem(event)));
    return;
  }

  // Логика для предстоящих событий (не архив)
  const now = new Date();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const filteredTodayEvents = allEvents.filter(event => event.date === todayStr).filter(event => {
    const timeInfo = event.text ? extractTimeFromText(event.text) : null;
    if (!timeInfo || !timeInfo.hasEndTime) return true;
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const endTimeStr = timeInfo.end;
    const endMatch = endTimeStr.match(/(\d{1,2}):(\d{2})/);
    if (!endMatch) return true;
    const endHour = parseInt(endMatch[1]);
    const endMin = parseInt(endMatch[2]);
    let endTimeInMinutes = endHour * 60 + endMin;
    const startMatch = timeInfo.start.match(/(\d{1,2}):(\d{2})/);
    if (startMatch && endHour < parseInt(startMatch[1])) {
      endTimeInMinutes += 24 * 60;
    }
    if (currentTime < endTimeInMinutes) return true;
    return (currentTime - endTimeInMinutes) <= 6 * 60;
  });

  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const recentPastEvents = allEvents.filter(event => {
    if (event.date >= todayStr) return false;
    const timeInfo = event.text ? extractTimeFromText(event.text) : null;
    if (!timeInfo || !timeInfo.hasEndTime) return false;
    let endDateStr = event.date;
    const startMatch = timeInfo.start.match(/(\d{1,2}):(\d{2})/);
    const startHour = startMatch ? parseInt(startMatch[1]) : 0;
    const endMatch = timeInfo.end.match(/(\d{1,2}):(\d{2})/);
    if (!endMatch) return false;
    const endHour = parseInt(endMatch[1]);
    if (endHour < startHour) {
      const date = new Date(event.date);
      date.setDate(date.getDate() + 1);
      endDateStr = date.toISOString().slice(0, 10);
    }
    const endTime = new Date(endDateStr + 'T' + timeInfo.end + ':00');
    return endTime > sixHoursAgo;
  });

  const combinedTodayEvents = [...filteredTodayEvents, ...recentPastEvents].sort((a, b) => a.date.localeCompare(b.date));
  const tomorrowEvents = list.filter(event => event.date === tomorrowStr);
  const otherEvents = list.filter(event => event.date !== todayStr && event.date !== tomorrowStr);

  // Добавляем разделы с событиями
  if (combinedTodayEvents.length > 0) {
    listContainer.appendChild(createSectionHeader('Сегодня', true));
    combinedTodayEvents.forEach(event => {
      const timeInfo = event.text ? extractTimeFromText(event.text) : null;
      const showTimeAgo = timeInfo && timeInfo.hasEndTime && getTimeAgoText(event.date, timeInfo.end, timeInfo.start);
      listContainer.appendChild(createEventItem(event, showTimeAgo));
    });
  }

  if (tomorrowEvents.length > 0) {
    listContainer.appendChild(createSectionHeader('Завтра'));
    tomorrowEvents.forEach(event => listContainer.appendChild(createEventItem(event)));
  }

  if (otherEvents.length > 0) {
    const sortedEvents = otherEvents.sort((a, b) => a.date.localeCompare(b.date));
    let lastDayName = '';
    const todayIndex = today.getDay();

    sortedEvents.forEach(event => {
      const dayOfWeek = getDayOfWeekFromDate(event.date);
      const dayName = getDayOfWeekName(dayOfWeek);

      if (dayName !== lastDayName) {
        listContainer.appendChild(createSectionHeader(dayName, dayOfWeek === todayIndex));
        lastDayName = dayName;
      }

      listContainer.appendChild(createEventItem(event));
    });
  }
}

function ensureListForEvent(eventData) {
  if (!archiveButton) return;
  const needsArchive = eventData.date < DEVICE_TODAY;
  if (needsArchive !== showingArchive) {
    showingArchive = needsArchive;
    updateArchiveButtonLabel();
    renderEventList(showingArchive ? archiveEvents : upcomingEvents);
  }
}

function focusEventOnMap(eventData) {
  if (!eventData) return;

  if (dateInput) {
    dateInput.value = eventData.date;
  }

  renderDay(eventData.date, { recenter: false });
  highlightEventInSidebar(eventData.id);

  setTimeout(() => {
    const marker = markerById.get(eventData.id);
    if (marker) {
      map.flyTo({ center: [eventData.lon, eventData.lat], zoom: 14 });
      marker.togglePopup();
    }
    sidebar?.classList.remove('open');
  }, 120);
}

function renderSearchResults(query = '') {
  if (!searchResults || !searchEmpty) return;

  const normalized = query.trim().toLowerCase();
  searchResults.innerHTML = '';

  if (!allEvents.length) {
    searchEmpty.textContent = 'Данные загружаются…';
    searchEmpty.hidden = false;
    return;
  }

  let matches;
  if (!normalized) {
    matches = upcomingEvents.slice(0, 6);
    if (!matches.length) {
      matches = allEvents.slice(0, 6);
    }
    if (searchLabel) {
      searchLabel.textContent = 'Подсказки';
    }
  } else {
    // Генерируем все варианты транслитерации для запроса
    const searchVariants = generateTransliterations(query);

    matches = allEvents.filter(event => {
      // Создаем поисковую строку из названия и места проведения события
      const eventText = `${event.title} ${event.location}`.toLowerCase();

      // Проверяем, соответствует ли событие любому варианту транслитерации запроса
      return searchVariants.some(variant => {
        const normalizedVariant = variant.trim().toLowerCase();
        return eventText.includes(normalizedVariant);
      });
    });

    if (searchLabel) {
      searchLabel.textContent = 'Результаты';
    }
  }

  if (!matches.length) {
    searchEmpty.textContent = 'Ничего не найдено';
    searchEmpty.hidden = false;
    return;
  }

  searchEmpty.hidden = true;

  matches.forEach(event => {
    const item = document.createElement('li');
    item.dataset.eventId = event.id;
    item.setAttribute('role', 'option');
    item.tabIndex = 0;
    item.innerHTML = `<strong>${event.title}</strong><span>${event.location}</span><span>${getEventDateLabel(event.date, event.text)}</span>`;

    searchResults.appendChild(item);
  });
}

function openSearchPanel() {
  if (!searchPanel || searchPanelOpen) return;
  updateBottomBarOffset();
  searchPanel.classList.add('open');
  searchPanel.setAttribute('aria-hidden', 'false');
  searchPanelOpen = true;
  renderSearchResults(searchInput?.value ?? '');
  resizeViewport();
}

function closeSearchPanel({ blur = true } = {}) {
  if (!searchPanel || !searchPanelOpen) {
    if (blur && searchInput) {
      searchInput.blur();
    }
    return;
  }
  searchPanel.classList.remove('open');
  searchPanel.setAttribute('aria-hidden', 'true');
  searchPanelOpen = false;
  if (blur && searchInput) {
    searchInput.blur();
  }
  resizeViewport();
}

function toggleSearchClearButton() {
  if (!searchClear || !searchInput) return;
  if (searchInput.value.trim()) {
    searchClear.classList.add('is-visible');
  } else {
    searchClear.classList.remove('is-visible');
  }
}

if (archiveButton) {
  archiveButton.addEventListener('click', () => {
    if (!allEvents.length) return;
    showingArchive = !showingArchive;
    updateArchiveButtonLabel();
    renderEventList(showingArchive ? archiveEvents : upcomingEvents);
    highlightFirstByDate(dateInput?.value);
  });
}

if (dateInput) {
  dateInput.addEventListener('change', event => {
    const rawValue = event.target.value;
    if (!rawValue) return;
    const normalized = new Date(rawValue).toISOString().slice(0, 10);
    event.target.value = normalized;
    renderDay(normalized);
    highlightFirstByDate(normalized);
  });
}

if (searchInput) {
  searchInput.addEventListener('focus', () => {
    openSearchPanel();
    toggleSearchClearButton();
  });
  searchInput.addEventListener('input', event => {
    toggleSearchClearButton();
    if (searchPanelOpen) {
      renderSearchResults(event.target.value);
    }
  });
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeSearchPanel();
    }
    if (event.key === 'ArrowDown') {
      const firstItem = searchResults?.firstElementChild;
      if (firstItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }
  });
}

if (searchClear) {
  searchClear.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    toggleSearchClearButton();
    renderSearchResults('');
    searchInput.focus();
  });
}

if (searchHandle) {
  searchHandle.addEventListener('click', () => closeSearchPanel());
}

if (searchPanel) {
  searchPanel.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') {
      searchDragStartY = null;
      return;
    }
    if (event.target.closest('#search-results')) {
      searchDragStartY = null;
      return;
    }
    searchDragStartY = event.clientY;
  });

  searchPanel.addEventListener('pointermove', event => {
    if (searchDragStartY === null || event.pointerType !== 'touch') return;
    const delta = event.clientY - searchDragStartY;
    if (delta > 80) {
      searchDragStartY = null;
      closeSearchPanel();
    }
  });

  const resetDrag = () => {
    searchDragStartY = null;
  };
  searchPanel.addEventListener('pointerup', resetDrag);
  searchPanel.addEventListener('pointercancel', resetDrag);
}

document.addEventListener('pointerdown', event => {
  if (!searchPanelOpen) return;
  if (searchPanel?.contains(event.target) || bottomBar?.contains(event.target)) {
    return;
  }
  closeSearchPanel();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && searchPanelOpen) {
    closeSearchPanel();
    searchInput?.focus();
  }
});

const toggleSidebar = () => {
  if (!sidebar?.classList.contains('open')) {
    // Сайдбар закрыт, будет открыт — закрываем все открытые попапы
    markers.forEach(marker => marker.getPopup()?.remove());
  }
  sidebar?.classList.toggle('open');
};
const closeSidebarPanel = () => sidebar?.classList.remove('open');

burger?.addEventListener('click', toggleSidebar);

function bindKeyboardActivation(element, handler) {
  if (!element) return;
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  });
}

bindKeyboardActivation(burger, toggleSidebar);

document.addEventListener('click', event => {
  if (sidebar?.classList.contains('open') && !sidebar.contains(event.target) && event.target !== burger && event.target !== logo) {
    closeSidebarPanel();
  }
});

// Делегированные обработчики кликов для списка событий
if (listContainer) {
  listContainer.addEventListener('click', event => {
    const item = event.target.closest('.item');
    if (!item) return;
    const eventData = allEvents.find(ev => ev.id === item.dataset.eventId);
    if (eventData) {
      focusEventOnMap(eventData);
      highlightEventInSidebar(eventData.id);
    }
  });

  listContainer.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target.closest('.item');
    if (!item) return;
    event.preventDefault();
    const eventData = allEvents.find(ev => ev.id === item.dataset.eventId);
    if (eventData) {
      focusEventOnMap(eventData);
      highlightEventInSidebar(eventData.id);
    }
  });
}

// Делегированные обработчики кликов для результатов поиска
if (searchResults) {
  searchResults.addEventListener('click', event => {
    const li = event.target.closest('li');
    if (!li) return;
    const eventData = allEvents.find(ev => ev.id === li.dataset.eventId);
    if (eventData) {
      ensureListForEvent(eventData);
      focusEventOnMap(eventData);
      closeSearchPanel();
    }
  });

  searchResults.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const li = event.target;
      if (!li || li.tagName !== 'LI') return;
      const eventData = allEvents.find(ev => ev.id === li.dataset.eventId);
      if (eventData) {
        ensureListForEvent(eventData);
        focusEventOnMap(eventData);
        closeSearchPanel();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = event.target.nextElementSibling || searchResults.firstElementChild;
      if (next) {
        next.focus();
      }
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = event.target.previousElementSibling;
      if (prev) {
        prev.focus();
      } else if (searchInput) {
        searchInput.focus();
      }
    }
    if (event.key === 'Escape') {
      closeSearchPanel();
      searchInput?.focus();
    }
  });
}

// Загружаем данные последовательно: сначала кэш, затем события
loadGeocodeCache()
  .then(() => {
    return fetch(JSON_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      });
  })
  .then(events => {
    if (!Array.isArray(events) || events.length === 0) {
      if (listContainer) {
        listContainer.textContent = 'Список событий пуст';
      }
      if (dateInput) {
        dateInput.disabled = true;
      }
      if (searchEmpty) {
        searchEmpty.textContent = 'События не найдены';
        searchEmpty.hidden = false;
      }
      return;
    }

    // Обновляем события координатами из кэша
    events.forEach(event => {
      updateEventCoordinates(event);
    });

    events.sort((a, b) => a.date.localeCompare(b.date));
    events.forEach(event => {
      event.id = makeEventId(event);
    });

    allEvents = events;

    // Модифицированная логика разделения событий
    // События сегодняшнего дня без времени окончания или с будущим временем окончания - в upcomingEvents
    // События сегодняшнего дня с интервалом времени, которые уже закончились - в archiveEvents
    // Все остальные события - по старой логике
    upcomingEvents = events.filter(event => {
      if (event.date > DEVICE_TODAY) return true; // Будущие дни - всегда в upcoming
      if (event.date < DEVICE_TODAY) return false; // Прошлые дни - всегда в archive

      // Для сегодняшних событий проверяем время
      if (!event.text) return true; // Без текста - в upcoming

      const timeInfo = extractTimeFromText(event.text);
      if (!timeInfo || !timeInfo.hasEndTime) return true; // Без времени окончания - в upcoming

      // Проверяем, закончилось ли событие
      const timeAgoText = getTimeAgoText(event.date, timeInfo.end, timeInfo.start);
      return !timeAgoText; // Если есть текст "закончилось", то в archive, иначе в upcoming
    });

    archiveEvents = events.filter(event => {
      if (event.date > DEVICE_TODAY) return false; // Будущие дни - не в archive
      if (event.date < DEVICE_TODAY) return true; // Прошлые дни - всегда в archive

      // Для сегодняшних событий проверяем время
      if (!event.text) return false; // Без текста - не в archive

      const timeInfo = extractTimeFromText(event.text);
      if (!timeInfo || !timeInfo.hasEndTime) return false; // Без времени окончания - не в archive

      // Проверяем, закончилось ли событие
      const timeAgoText = getTimeAgoText(event.date, timeInfo.end, timeInfo.start);
      return !!timeAgoText; // Если есть текст "закончилось", то в archive
    });

    if (!upcomingEvents.length && archiveEvents.length) {
      showingArchive = true;
    }

    if (dateInput) {
      dateInput.min = events[0].date;
      dateInput.max = events[events.length - 1].date;
      // По умолчанию всегда устанавливаем текущую дату устройства
      dateInput.value = DEVICE_TODAY;
      renderDay(DEVICE_TODAY);
    }

    updateArchiveButtonLabel();
    renderEventList(showingArchive ? archiveEvents : upcomingEvents);
    highlightFirstByDate(dateInput?.value);

    if (searchEmpty) {
      searchEmpty.textContent = 'Начните вводить запрос';
      searchEmpty.hidden = false;
    }
    renderSearchResults(searchInput?.value ?? '');
    toggleSearchClearButton();

    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('event');
    if (targetId) {
      const target = allEvents.find(event => event.id === targetId);
      if (target) {
        ensureListForEvent(target);
        focusEventOnMap(target);
      }
    }
  })
  .catch(error => {
    console.error('Ошибка загрузки данных', error);
    clearMarkers();
    if (listContainer) {
      listContainer.innerHTML = '';
      listContainer.textContent = 'Ошибка загрузки событий';
    }
    if (dateInput) {
      dateInput.disabled = true;
    }
    if (searchEmpty) {
      searchEmpty.textContent = 'Не удалось загрузить события';
      searchEmpty.hidden = false;
    }
  });
