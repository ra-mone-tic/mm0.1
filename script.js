// ===== MeowMap: карта событий =====
// MapLibre + список событий + нижний поисковый бар

const JSON_URL = 'events.json';
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

function getEventDateLabel(dateStr) {
  if (dateStr === DEVICE_TODAY) return 'Сегодня';
  if (!dateStr) return '';
  // Преобразуем yyyy-mm-dd в dd.mm.yyyy
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return dateStr;
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
  // Убираем город Калининград, если он есть в конце
  if (!location) return '';
  return location.replace(/,?\s*Калининград\s*$/i, '');
}

function popupTemplate(event) {
  const shareButton = `
    <button class="share-btn"
      type="button"
      title="Скопировать ссылку"
      onclick="copyShareLink('${event.id}')"
      style="position:absolute;right:8px;bottom:6px;border:var(--border);background:var(--surface-2);border-radius:var(--radius-xs);padding:4px 6px;cursor:pointer;font-size:14px;line-height:1;color:var(--text-0);"
    >🔗</button>`;

  // Текст поста (без хештегов)
  let postText = event.text || '';
  postText = postText.replace(/#[^\s#]+/g, '').trim();
  const shortText = postText.length > 180 ? postText.slice(0, 180) + '…' : postText;
  const expandable = postText.length > 180;

  return `
    <div style="position:relative;padding:8px 8px 28px 8px;min-width:220px;max-width:320px;">
      <div><strong>${event.title}</strong></div>
      <div>${formatLocation(event.location)}</div>
      <div style="color:var(--text-1);">${getEventDateLabel(event.date)}</div>
      <div class="popup-text" style="margin:8px 0 0 0;max-height:72px;overflow:hidden;position:relative;">
        <span class="popup-text-short">${shortText}</span>
        ${expandable ? `<span class="popup-text-expand" style="color:var(--brand);cursor:pointer;">Развернуть</span>` : ''}
      </div>
      <div class="popup-text-full" style="display:none;max-height:160px;overflow:auto;margin:8px 0 0 0;">${postText}</div>
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
  popup.on('open', () => {
    const popupEl = popup.getElement();
    if (!popupEl) return;
    const expandBtn = popupEl.querySelector('.popup-text-expand');
    if (expandBtn) {
      expandBtn.onclick = () => {
        popupEl.querySelector('.popup-text-short').style.display = 'none';
        expandBtn.style.display = 'none';
        popupEl.querySelector('.popup-text-full').style.display = 'block';
      };
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
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    showCopyToast();
  } catch (error) {
    console.error('Не удалось скопировать ссылку', error);
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

  list.forEach(event => {
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.eventId = event.id;
    item.dataset.eventDate = event.date;
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.innerHTML = `<strong>${event.title}</strong><br>${event.location}<br><i>${getEventDateLabel(event.date)}</i>`;

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
    matches = allEvents.filter(event => {
      const haystack = `${event.title} ${event.location}`.toLowerCase();
      return haystack.includes(normalized);
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

fetch(JSON_URL)
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
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
      const first = events.find(event => event.date >= DEVICE_TODAY)?.date ?? events[0].date;
      dateInput.value = first;
      renderDay(first);
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
