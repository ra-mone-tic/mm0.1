/**
 * MeowMap Map Module
 * Handles MapLibre GL map initialization and controls
 */

import { MAP_OPTIONS, CONTROLS, SELECTORS, CLASSES, DURATIONS } from './constants.js';
import { debounce, bindKeyboardActivation, sanitizeHtml } from './utils.js';

/**
 * Custom navigation control for MapLibre
 */
class CustomNavigationControl {
  constructor() {
    this._container = null;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    // Zoom in button
    const zoomInButton = this._createButton('zoom-in', 'Увеличить масштаб', () => {
      this._map.zoomIn();
    });

    // Zoom out button
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

    // Add icons
    if (className === 'zoom-in') {
      button.innerHTML = '<span style="font-size: 18px; line-height: 1; font-weight: bold;">+</span>';
    } else if (className === 'zoom-out') {
      button.innerHTML = '<span style="font-size: 18px; line-height: 1; font-weight: bold;">−</span>';
    }

    button.addEventListener('click', fn);

    return button;
  }
}

/**
 * Map state and markers management
 */
class MapManager {
  constructor() {
    this.map = null;
    this.markers = [];
    this.markerById = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the map
   * @returns {Promise} Promise that resolves when map is ready
   */
  async init() {
    return new Promise((resolve, reject) => {
      const mapContainer = document.getElementById(SELECTORS.map);

      if (!window.maplibregl || !maplibregl.supported()) {
        mapContainer.innerHTML = '<p style="padding:16px; font-family: \'NTSomic\', Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">MapLibre требует поддержки WebGL. Обновите браузер или включите аппаратное ускорение.</p>';
        reject(new Error('MapLibre is not supported'));
        return;
      }

      this.map = new maplibregl.Map(MAP_OPTIONS);

      this.map.on('error', event => {
        console.error('Map style load error', event.error);
        reject(event.error);
      });

      this.map.on('load', () => {
        this._setupControls();
        this._setupResizeHandler();
        this.isInitialized = true;
        resolve(this.map);
      });
    });
  }

  /**
   * Setup map controls
   * @private
   */
  _setupControls() {
    // Add navigation control
    this.map.addControl(new CustomNavigationControl(), 'top-right');

    // Add geolocation control
    this.map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      showUserLocation: true,
      labelText: 'Найти моё местоположение',
      noLocationText: 'Геолокация недоступна',
      searchingText: 'Поиск местоположения...',
      foundText: 'Моё местоположение'
    }), 'top-right');

    // Setup geolocate button descriptions
    this._setupGeolocateButton();

    // Disable rotation
    this.map.dragRotate.disable();
    this.map.touchZoomRotate.disableRotation();
  }

  /**
   * Setup geolocate button dynamic descriptions
   * @private
   */
  _setupGeolocateButton() {
    const selectors = [
      '.maplibregl-ctrl-geolocate button',
      '.maplibregl-ctrl-geolocate',
      '[aria-label="Show my location"]',
      'button[title="Show my location"]'
    ];

    const setupButton = () => {
      for (const selector of selectors) {
        const button = document.querySelector(selector);
        if (button) {
          this._updateGeolocateButtonDescription(button);

          // Observe class changes
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                this._updateGeolocateButtonDescription(button);
              }
            });
          });

          observer.observe(button, {
            attributes: true,
            attributeFilter: ['class']
          });

          console.log('Кнопка геолокации настроена');
          return;
        }
      }

      // Retry if not found
      setTimeout(setupButton, 100);
      setTimeout(setupButton, 500);
      setTimeout(setupButton, 1000);
    };

    this.map.on('load', () => setTimeout(setupButton, 100));
  }

  /**
   * Update geolocate button description based on state
   * @param {HTMLElement} button - Button element
   * @private
   */
  _updateGeolocateButtonDescription(button) {
    if (!button) return;

    const currentAriaLabel = button.getAttribute('aria-label');
    const currentTitle = button.getAttribute('title');

    const isDisabled = button.disabled || button.classList.contains('maplibregl-ctrl-geolocate-disabled');
    const isActive = button.classList.contains('maplibregl-ctrl-geolocate-active');
    const isLoading = button.classList.contains('maplibregl-ctrl-geolocate-waiting');

    let newAriaLabel = '';
    let newTitle = '';

    if (isDisabled) {
      newAriaLabel = 'Геолокация недоступна';
      newTitle = 'Геолокация недоступна';
    } else if (isLoading) {
      newAriaLabel = 'Поиск местоположения...';
      newTitle = 'Поиск местоположения...';
    } else if (isActive) {
      newAriaLabel = 'Моё местоположение';
      newTitle = 'Моё местоположение';
    } else {
      newAriaLabel = 'Определить текущее местоположение на карте';
      newTitle = 'Определить текущее местоположение на карте';
    }

    if (currentAriaLabel !== newAriaLabel) {
      button.setAttribute('aria-label', newAriaLabel);
    }
    if (currentTitle !== newTitle) {
      button.setAttribute('title', newTitle);
    }
  }

  /**
   * Setup resize handler
   * @private
   */
  _setupResizeHandler() {
    const resizeViewport = debounce(() => {
      if (this.map) {
        this.map.resize();
      }
    }, DURATIONS.debounce);

    window.addEventListener('resize', resizeViewport);
  }

  /**
   * Clear all markers from map
   */
  clearMarkers() {
    this.markers.forEach(marker => marker.remove());
    this.markers.length = 0;
    this.markerById.clear();
  }

  /**
   * Close all open popups
   */
  closeAllPopups() {
    this.markers.forEach(marker => {
      const popup = marker.getPopup();
      if (popup && popup.isOpen()) {
        marker.togglePopup();
      }
    });
  }

  /**
   * Add marker for event
   * @param {Object} event - Event data
   * @param {Function} onShare - Share callback
   */
  addMarker(event, onShare) {
    const popup = new maplibregl.Popup({
      offset: 24,
      closeButton: false,
      className: 'animated-popup'
    })
      .setHTML(this._createPopupContent(event, onShare));

    const marker = new maplibregl.Marker({ color: '#22d3ee' })
      .setLngLat([event.lon, event.lat])
      .setPopup(popup)
      .addTo(this.map);

    this.markers.push(marker);
    this.markerById.set(event.id, marker);

    // Setup popup expand/collapse
    this._setupPopupHandlers(popup, event);
  }

  /**
   * Create popup HTML content
   * @param {Object} event - Event data
   * @param {Function} onShare - Share callback
   * @returns {string} HTML content
   * @private
   */
  _createPopupContent(event, onShare) {
    const shareButton = `
      <button class="share-btn"
        type="button"
        onclick="window.copyShareLink('${event.id}')"
        style="
          position: absolute;
          right: 8px;
          bottom: 8px;
          padding: 7px 11px;
          background: #d2cde7;
          color: black;
          border: none;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 500;
          font-family: var(--font-ui);
          cursor: pointer;
          z-index: 11;
          transition: background var(--fx-fast);
          box-shadow: var(--shadow-sm);
          outline: none;
        "
        onmouseover="this.style.background='color-mix(in srgb, #d2cde7 90%, black)'"
        onmouseout="this.style.background='#d2cde7'"
      >Поделиться</button>`;

    let postText = event.text || '';
    postText = postText.replace(/#[^\s#]+/g, '').trim();
    postText = postText.replace(/^.*\n/, '').trim();

    const isLong = postText.length > 90;
    const expandButton = isLong ? `<button class="expand-btn"
      type="button"
      style="
        position: absolute;
        bottom: 8px;
        left: 8px;
        padding: 7px 11px;
        background: #d2cde7;
        color: black;
        border: none;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 500;
        font-family: var(--font-ui);
        cursor: pointer;
        z-index: 11;
        transition: background var(--fx-fast);
        box-shadow: var(--shadow-sm);
        outline: none;
      "
      onmouseover="this.style.background='color-mix(in srgb, #d2cde7 90%, black)'"
      onmouseout="this.style.background='#d2cde7'"
    >Узнать больше</button>` : '';

    return `
      <div class="popup-content" style="font-family:var(--font-ui);padding-bottom:60px;">
        <div><strong>${sanitizeHtml(event.title)}</strong></div>
        <div style="color:var(--text-1);">${sanitizeHtml(event.location)}</div>
        <div style="color:var(--text-1);">${sanitizeHtml(event.dateLabel)}</div>
        <div class="popup-text" style="margin:8px 0 -29px 0;max-height:72px;overflow-y:scroll;position:relative;">
          ${sanitizeHtml(postText).replace(/\n/g, '<br>')}
        </div>
        <div class="popup-text-full" style="display:none;max-height:200px;overflow:auto;margin:8px 0 -29px 0;">${sanitizeHtml(postText).replace(/\n/g, '<br>')}</div>
        <div style="position:absolute;bottom:6px;left:6px;right:6px;display:flex;justify-content:space-between;gap:6px;">
          ${expandButton.replace('position: absolute; bottom: 8px; left: 8px;', 'position: relative;')}
          ${shareButton.replace('position: absolute; right: 8px; bottom: 8px;', 'position: relative;')}
        </div>
      </div>
    `;
  }

  /**
   * Setup popup expand/collapse handlers
   * @param {maplibregl.Popup} popup - Popup instance
   * @param {Object} event - Event data
   * @private
   */
  _setupPopupHandlers(popup, event) {
    let expanded = false;

    popup.on('open', () => {
      const popupEl = popup.getElement();
      if (!popupEl) return;

      const expandBtn = popupEl.querySelector('.expand-btn');
      if (expandBtn) {
        expandBtn.onclick = () => this._togglePopupText(popupEl);
      }
    });

    popup.on('close', () => {
      const popupEl = popup.getElement();
      if (!popupEl) return;

      // Animate close
      const content = popupEl.querySelector('.popup-content');
      if (content) {
        content.style.opacity = '0';
      }

      // Reset state after animation
      setTimeout(() => {
        const mainText = popupEl.querySelector('.popup-text');
        const fullText = popupEl.querySelector('.popup-text-full');
        if (mainText && fullText) {
          mainText.style.display = 'block';
          fullText.style.display = 'none';
          expanded = false;
        }
      }, 300);
    });
  }

  /**
   * Toggle popup text expansion
   * @param {HTMLElement} popupEl - Popup element
   * @private
   */
  _togglePopupText(popupEl) {
    const mainText = popupEl.querySelector('.popup-text');
    const fullText = popupEl.querySelector('.popup-text-full');

    if (!mainText || !fullText) return;

    const isExpanded = fullText.style.display === 'block';

    if (isExpanded) {
      mainText.style.display = 'block';
      fullText.style.display = 'none';
    } else {
      mainText.style.display = 'none';
      fullText.style.display = 'block';
    }
  }

  /**
   * Render markers for specific date
   * @param {string} dateStr - Date string
   * @param {Object} options - Options
   * @returns {Array} Events for the date
   */
  renderDay(dateStr, options = {}) {
    const { recenter = true } = options;

    if (!dateStr) {
      this.clearMarkers();
      return [];
    }

    this.clearMarkers();

    // This will be called from main module with events data
    // For now return empty array
    return [];
  }

  /**
   * Fly to event location
   * @param {number} lon - Longitude
   * @param {number} lat - Latitude
   * @param {number} zoom - Zoom level
   */
  flyTo(lon, lat, zoom = 14) {
    if (this.map) {
      this.map.flyTo({ center: [lon, lat], zoom });
    }
  }

  /**
   * Open popup for event
   * @param {string} eventId - Event ID
   */
  openPopup(eventId) {
    const marker = this.markerById.get(eventId);
    if (marker) {
      marker.togglePopup();
    }
  }

  /**
   * Get marker by event ID
   * @param {string} eventId - Event ID
   * @returns {maplibregl.Marker|null} Marker instance
   */
  getMarker(eventId) {
    return this.markerById.get(eventId) || null;
  }
}

// Export singleton instance
export const mapManager = new MapManager();
