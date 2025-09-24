// ===== MeowMap: карта событий =====
// MapLibre + список событий + нижний поисковый бар

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
function generateExtendedTransliterations(text) {
  const results = new Set([text]);

  // Базовые транслитерации
  if (/[а-яё]/i.test(text)) {
    results.add(transliterateToEnglish(text));
  }

  if (/[a-z]/i.test(text)) {
    results.add(transliterateToRussian(text));
  }

  // Дополнительные варианты для английского -> русский
  if (/[a-z]/i.test(text)) {
    const extendedRussianMap = {
      'a': ['а', 'я'], 'e': ['е', 'э', 'и'], 'i': ['и', 'й'], 'o': ['о', 'а'],
      'u': ['у', 'ю', 'ю'], 'y': ['ы', 'й', 'и'], 'c': ['к', 'с'], 'g': ['г', 'ж'],
      'h': ['х', 'г'], 'j': ['дж', 'ж'], 'k': ['к'], 'q': ['к'], 'v': ['в'],
      'w': ['в'], 'x': ['кс', 'х'], 'z': ['з', 'ж']
    };

    let extendedText = text.toLowerCase();
    Object.entries(extendedRussianMap).forEach(([eng, rusVariants]) => {
      if (rusVariants.length > 1) {
        rusVariants.forEach(variant => {
          const variantText = extendedText.replace(new RegExp(eng, 'g'), variant);
          if (variantText !== extendedText) {
            results.add(variantText);
          }
        });
      }
    });
  }

  // Дополнительные варианты для русского -> английский
  if (/[а-яё]/i.test(text)) {
    const extendedEnglishMap = {
      'а': ['a', 'ya'], 'е': ['e', 'ye', 'ie'], 'э': ['e'], 'и': ['i', 'y'],
      'й': ['y', 'i'], 'о': ['o'], 'у': ['u', 'yu'], 'ы': ['y'], 'ю': ['yu', 'u'],
      'я': ['ya', 'a'], 'к': ['k', 'c'], 'г': ['g', 'h'], 'ж': ['zh', 'j'],
      'з': ['z'], 'х': ['kh', 'h'], 'ц': ['ts', 'c'], 'ч': ['ch'], 'ш': ['sh'],
      'щ': ['sch', 'sh'], 'ф': ['f'], 'в': ['v', 'w'], 'п': ['p'], 'р': ['r'],
      'с': ['s'], 'т': ['t'], 'л': ['l'], 'м': ['m'], 'н': ['n'], 'б': ['b'],
      'д': ['d']
    };

    let extendedText = text.toLowerCase();
    Object.entries(extendedEnglishMap).forEach(([rus, engVariants]) => {
      if (engVariants.length > 1) {
        engVariants.forEach(variant => {
          const variantText = extendedText.replace(new RegExp(rus, 'g'), variant);
          if (variantText !== extendedText) {
            results.add(variantText);
          }
        });
      }
    });
  }

  return Array.from(results);
}

function generateTransliterations(text) {
  return generateExtendedTransliterations(text);
}

function getEventDateLabel(dateStr) {
  if (dateStr === DEVICE_TODAY) return 'Сегодня';
  if (!dateStr) return '';
  // Преобразуем yyyy-mm-dd в dd.mm.yy для единого формата
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const day = parseInt(m[3]);
    const month = parseInt(m[2]);
    const year = m[1].slice(-2); // берем только последние 2 цифры года
    return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
  }
  return dateStr;
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

// Функция для группировки событий по дням недели
function groupEventsByDayOfWeek(events) {
  const groups = new Map();

  events.forEach(event => {
    const dayOfWeek = getDayOfWeekFromDate(event.date);
    if (dayOfWeek === -1) return;

    const dayName = getDayOfWeekName(dayOfWeek);
    if (!groups.has(dayName)) {
      groups.set(dayName, []);
    }
    groups.get(dayName).push(event);
  });

  return groups;
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

map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  showUserLocation: true
}), 'top-right');

map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

const dateInput = document.getElementById('event-date');
const listContainer = document.getElementById('upcoming');
const archiveButton = document.getElementById('toggleArchive');
const sidebar = document.getElementById('sidebar');
const burger = document.getElementById('burger');
const logo = document.getElementById('logo');
const closeBtn = document.getElementById('closeSidebar');
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
      <div style="color:var(--text-1);">${getEventDateLabel(event.date)}</div>
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

function renderEventList(list) {
  if (!listContainer) return;

  listContainer.innerHTML = '';
  if (!list.length) {
    listContainer.textContent = showingArchive ? 'Архив пуст' : 'Нет ближайших событий';
    return;
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayEvents = list.filter(event => event.date === todayStr);

  // Если есть события на сегодня, создаем раздел "Сегодня"
  if (todayEvents.length > 0) {
    // Создаем заголовок раздела "Сегодня"
    const todayHeader = document.createElement('div');
    todayHeader.className = 'day-section-header';
    todayHeader.style.cssText = `
      margin: 16px 0 8px 0;
      padding: 4px 8px;
      background: color-mix(in srgb, var(--brand) 10%, var(--surface-2));
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--brand);
      border-left: 3px solid var(--brand);
    `;
    todayHeader.textContent = 'Сегодня';
    listContainer.appendChild(todayHeader);

    // Добавляем события на сегодня
    todayEvents.forEach(event => {
      const item = document.createElement('div');
      item.className = 'item';
      item.dataset.eventId = event.id;
      item.dataset.eventDate = event.date;
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      item.innerHTML = `<strong>${event.title}</strong><br>${formatLocation(event.location)}`;

      const activate = () => {
        focusEventOnMap(event);
      };

      item.addEventListener('click', activate);
      item.addEventListener('keydown', evt => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          activate();
        }
      });
      listContainer.appendChild(item);
    });
  }

  // Группируем остальные события по дням недели
  const otherEvents = list.filter(event => event.date !== todayStr);
  const groupedEvents = groupEventsByDayOfWeek(otherEvents);

  // Определяем порядок дней недели (начиная с сегодняшнего дня)
  const todayIndex = today.getDay();
  const orderedDays = [];

  // Добавляем дни начиная с сегодняшнего
  for (let i = 0; i < 7; i++) {
    const dayIndex = (todayIndex + i) % 7;
    const dayName = getDayOfWeekName(dayIndex);
    if (groupedEvents.has(dayName)) {
      orderedDays.push(dayName);
    }
  }

  // Если есть события на другие дни (например, если мы в архиве), добавляем их
  groupedEvents.forEach((events, dayName) => {
    if (!orderedDays.includes(dayName)) {
      orderedDays.push(dayName);
    }
  });

  // Рендерим события по группам
  orderedDays.forEach(dayName => {
    const dayEvents = groupedEvents.get(dayName);
    if (!dayEvents || dayEvents.length === 0) return;

    // Создаем заголовок раздела
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'day-section-header';
    sectionHeader.style.cssText = `
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

    // Если это сегодня, выделяем заголовок
    const isToday = dayName === getDayOfWeekName(todayIndex);
    if (isToday) {
      sectionHeader.style.color = 'var(--brand)';
      sectionHeader.style.background = 'color-mix(in srgb, var(--brand) 10%, var(--surface-2))';
    }

    sectionHeader.textContent = dayName;
    listContainer.appendChild(sectionHeader);

    // Добавляем события для этого дня
    dayEvents.forEach(event => {
      const item = document.createElement('div');
      item.className = 'item';
      item.dataset.eventId = event.id;
      item.dataset.eventDate = event.date;
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      item.innerHTML = `<strong>${event.title}</strong><br>${formatLocation(event.location)}<br><i>${getEventDateLabel(event.date)}</i>`;

      const activate = () => {
        focusEventOnMap(event);
      };

      item.addEventListener('click', activate);
      item.addEventListener('keydown', evt => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          activate();
        }
      });
      listContainer.appendChild(item);
    });
  });
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
    item.innerHTML = `<strong>${event.title}</strong><span>${event.location}</span><span>${getEventDateLabel(event.date)}</span>`;

    const activate = () => {
      ensureListForEvent(event);
      focusEventOnMap(event);
      closeSearchPanel();
    };

    item.addEventListener('click', activate);
    item.addEventListener('keydown', evt => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        activate();
        return;
      }
      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        const next = item.nextElementSibling || searchResults.firstElementChild;
        if (next) {
          next.focus();
        }
      }
      if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        const prev = item.previousElementSibling;
        if (prev) {
          prev.focus();
        } else if (searchInput) {
          searchInput.focus();
        }
      }
      if (evt.key === 'Escape') {
        closeSearchPanel();
        searchInput?.focus();
      }
    });

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

const toggleSidebar = () => sidebar?.classList.toggle('open');
const closeSidebarPanel = () => sidebar?.classList.remove('open');

burger?.addEventListener('click', toggleSidebar);
closeBtn?.addEventListener('click', closeSidebarPanel);

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
bindKeyboardActivation(closeBtn, closeSidebarPanel);

document.addEventListener('click', event => {
  if (sidebar?.classList.contains('open') && !sidebar.contains(event.target) && event.target !== burger && event.target !== logo) {
    closeSidebarPanel();
  }
});

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
    upcomingEvents = events.filter(event => event.date >= DEVICE_TODAY);
    archiveEvents = events.filter(event => event.date < DEVICE_TODAY);

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
