// ===== MeowMap: карта событий =====
// MapLibre + список событий

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

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const resizeMap = debounce(() => map.resize(), 120);
map.on('load', () => setTimeout(resizeMap, 120));
window.addEventListener('resize', resizeMap);

const markers = [];
const markerById = new Map();

function clearMarkers() {
  markers.forEach(marker => marker.remove());
  markers.length = 0;
  markerById.clear();
}

function popupTemplate(event) {
  const shareButton = `
    <button class="share-btn"
      type="button"
      title="Скопировать ссылку"
      onclick="copyShareLink('${event.id}')"
      style="position:absolute;right:8px;bottom:6px;border:var(--border);background:var(--surface-2);border-radius:var(--radius-xs);padding:4px 6px;cursor:pointer;font-size:14px;line-height:1;color:var(--text-0);"
    >🔗</button>`;

  return `
    <div style="position:relative;padding:8px 8px 28px 8px;min-width:220px;">
      <div><strong>${event.title}</strong></div>
      <div>${event.location}</div>
      <div style="color:var(--text-1);">${event.date}</div>
      ${shareButton}
    </div>
  `;
}

function addMarker(event) {
  const popup = new maplibregl.Popup({ offset: 24, closeButton: false }).setHTML(popupTemplate(event));
  const marker = new maplibregl.Marker().setLngLat([event.lon, event.lat]).setPopup(popup).addTo(map);
  markers.push(marker);
  markerById.set(event.id, marker);
}

function makeEventId(event) {
  const source = `${event.date}|${event.title}|${event.lat}|${event.lon}`;
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) + hash) + source.charCodeAt(i);
  }
  return `e${(hash >>> 0).toString(16)}`;
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
  } catch (error) {
    console.error('Не удалось скопировать ссылку', error);
  }
};

fetch(JSON_URL)
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  })
  .then(events => {
    if (!Array.isArray(events) || events.length === 0) {
      const wrapper = document.getElementById('upcoming');
      wrapper.textContent = 'Список событий пуст';
      document.getElementById('event-date').disabled = true;
      return;
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    events.forEach(event => {
      event.id = makeEventId(event);
    });

    const input = document.getElementById('event-date');
    input.min = events[0].date;
    input.max = events[events.length - 1].date;

    const today = new Date().toISOString().slice(0, 10);
    const first = events.find(event => event.date >= today)?.date ?? events[0].date;
    input.value = first;

    function render(dateStr) {
      clearMarkers();
      const todays = events.filter(event => event.date === dateStr);
      todays.forEach(addMarker);
      if (todays.length > 0) {
        map.flyTo({ center: [todays[0].lon, todays[0].lat], zoom: 12 });
      }
    }

    const upcoming = events.filter(event => new Date(event.date) >= new Date(today));
    const archive = events.filter(event => new Date(event.date) < new Date(today));
    const listContainer = document.getElementById('upcoming');
    const archiveButton = document.getElementById('toggleArchive');
    let showingArchive = false;

    function renderList(list) {
      listContainer.innerHTML = '';
      if (!list.length) {
        listContainer.textContent = showingArchive ? 'Архив пуст' : 'Нет ближайших событий';
        return;
      }

      list.forEach(event => {
        const item = document.createElement('div');
        item.className = 'item';
        item.dataset.eventId = event.id;
        item.innerHTML = `<strong>${event.title}</strong><br>${event.location}<br><i>${event.date}</i>`;
        item.onclick = () => {
          listContainer.querySelectorAll('.item.is-active').forEach(el => el.classList.remove('is-active'));
          item.classList.add('is-active');
          render(event.date);
          setTimeout(() => {
            const marker = markerById.get(event.id);
            if (marker) {
              map.flyTo({ center: [event.lon, event.lat], zoom: 14 });
              marker.togglePopup();
            }
            document.getElementById('sidebar').classList.remove('open');
          }, 120);
        };
        listContainer.appendChild(item);
      });
    }

    renderList(upcoming);
    render(first);

    if (archiveButton) {
      archiveButton.addEventListener('click', () => {
        showingArchive = !showingArchive;
        archiveButton.textContent = showingArchive ? 'Назад' : 'Архив';
        renderList(showingArchive ? archive : upcoming);
      });
    }

    input.addEventListener('change', event => {
      const value = new Date(event.target.value).toISOString().slice(0, 10);
      render(value);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('event');
    if (targetId) {
      const target = events.find(event => event.id === targetId);
      if (target) {
        if (input.value !== target.date) {
          render(target.date);
        }
        setTimeout(() => {
          const marker = markerById.get(target.id);
          if (marker) {
            map.flyTo({ center: [target.lon, target.lat], zoom: 14 });
            marker.togglePopup();
          }
          const selected = listContainer.querySelector(`[data-event-id="${target.id}"]`);
          if (selected) {
            listContainer.querySelectorAll('.item.is-active').forEach(el => el.classList.remove('is-active'));
            selected.classList.add('is-active');
          }
        }, 150);
      }
    }
  })
  .catch(error => {
    console.error('Ошибка загрузки данных', error);
    clearMarkers();
    const wrapper = document.getElementById('upcoming');
    wrapper.innerHTML = '';
    wrapper.textContent = 'Ошибка загрузки событий';
  });

const sidebar = document.getElementById('sidebar');
const burger = document.getElementById('burger');
const logo = document.getElementById('logo');
const closeBtn = document.getElementById('closeSidebar');

const toggleSidebar = () => sidebar.classList.toggle('open');
const closeSidebar = () => sidebar.classList.remove('open');

burger.addEventListener('click', toggleSidebar);
closeBtn.addEventListener('click', closeSidebar);

function bindKeyboardActivation(element, handler) {
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  });
}

bindKeyboardActivation(burger, toggleSidebar);
bindKeyboardActivation(closeBtn, closeSidebar);

document.addEventListener('click', event => {
  if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && event.target !== burger && event.target !== logo) {
    sidebar.classList.remove('open');
  }
});
