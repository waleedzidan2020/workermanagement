(function () {
  const DEFAULT_CENTER = [24.0889, 32.8998];
  const DEFAULT_ZOOM = 14;

  let map = null;
  let marker = null;
  let selectedLatitude = null;
  let selectedLongitude = null;
  let onChange = null;
  let resizeObserver = null;

  function isValidCoordinate(lat, lng) {
    return Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180;
  }

  function notify() {
    if (typeof onChange === 'function') {
      onChange(getSelection());
    }
  }

  function osmUrl(coords) {
    return `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
  }

  function osmDeUrl(coords) {
    return `https://tile.openstreetmap.de/${coords.z}/${coords.x}/${coords.y}.png`;
  }

  function hotUrl(coords) {
    return `https://a.tile.openstreetmap.fr/hot/${coords.z}/${coords.x}/${coords.y}.png`;
  }

  function esriImageryUrl(coords) {
    return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`;
  }

  function esriImageryBackupUrl(coords) {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`;
  }

  const FallbackTileLayer = L.TileLayer.extend({
    initialize: function (urlFactory, options) {
      this._urlFactory = urlFactory;
      L.TileLayer.prototype.initialize.call(this, '', options);
    },

    createTile: function (coords, done) {
      const tile = document.createElement('img');
      tile.alt = '';
      tile.setAttribute('role', 'presentation');
      tile.decoding = 'async';

      const sources = this._urlFactory(coords);
      let index = 0;
      let completed = false;

      const finish = function (error) {
        if (completed) return;
        completed = true;
        done(error || null, tile);
      };

      tile.onload = function () {
        finish(null);
      };

      tile.onerror = function () {
        index += 1;

        if (index < sources.length) {
          tile.src = sources[index];
          return;
        }

        finish(new Error('MAP_TILE_LOAD_FAILED'));
      };

      tile.src = sources[index];
      return tile;
    }
  });

  function createBaseLayers() {
    const resilientStreetMap = new FallbackTileLayer(
      function (coords) {
        return [
          osmUrl(coords),
          osmDeUrl(coords),
          hotUrl(coords)
        ];
      },
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
        keepBuffer: 8,
        updateWhenIdle: false,
        updateWhenZooming: true,
        detectRetina: false
      }
    );

    const esriStreetMap = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri',
        keepBuffer: 8,
        updateWhenIdle: false,
        updateWhenZooming: true
      }
    );

    const resilientSatellite = new FallbackTileLayer(
      function (coords) {
        return [
          esriImageryUrl(coords),
          esriImageryBackupUrl(coords),
          osmUrl(coords),
          osmDeUrl(coords)
        ];
      },
      {
        maxZoom: 19,
        attribution: 'Imagery &copy; Esri; fallback &copy; OpenStreetMap contributors',
        keepBuffer: 8,
        updateWhenIdle: false,
        updateWhenZooming: true,
        detectRetina: false
      }
    );

    return {
      defaultLayer: resilientStreetMap,
      choices: {
        'OpenStreetMap — أساسي': resilientStreetMap,
        'شوارع Esri': esriStreetMap,
        'قمر صناعي': resilientSatellite
      }
    };
  }

  function attachResizeHandling(container) {
    if (!window.ResizeObserver || resizeObserver) {
      return;
    }

    resizeObserver = new ResizeObserver(function () {
      if (!map) return;

      requestAnimationFrame(function () {
        map.invalidateSize({ pan: false, animate: false });
      });
    });

    resizeObserver.observe(container);
  }

  function ensureMap(containerId, changeHandler) {
    onChange = changeHandler || onChange;

    if (map) {
      return map;
    }

    if (!window.L) {
      throw new Error('LEAFLET_UNAVAILABLE');
    }

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error('MAP_CONTAINER_MISSING');
    }

    map = L.map(container, {
      zoomControl: true,
      preferCanvas: true,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    const layers = createBaseLayers();
    layers.defaultLayer.addTo(map);

    L.control.layers(layers.choices, null, {
      position: 'topleft',
      collapsed: true
    }).addTo(map);

    L.control.scale({
      position: 'bottomleft',
      imperial: false
    }).addTo(map);

    map.on('click', function (event) {
      setSelection(event.latlng.lat, event.latlng.lng, true);
    });

    map.on('baselayerchange', function () {
      invalidateSize();
    });

    attachResizeHandling(container);
    return map;
  }

  function setSelection(latitude, longitude, centerMap) {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!isValidCoordinate(lat, lng)) {
      throw new Error('INVALID_COORDINATES');
    }

    selectedLatitude = lat;
    selectedLongitude = lng;

    if (map) {
      if (!marker) {
        marker = L.marker([lat, lng], {
          draggable: true,
          autoPan: true
        }).addTo(map);

        marker.on('dragend', function () {
          const point = marker.getLatLng();
          setSelection(point.lat, point.lng, false);
        });
      } else {
        marker.setLatLng([lat, lng]);
      }

      if (centerMap) {
        map.setView([lat, lng], Math.max(map.getZoom(), 17), {
          animate: false
        });
      }
    }

    notify();
  }

  function clearSelection() {
    selectedLatitude = null;
    selectedLongitude = null;

    if (map && marker) {
      map.removeLayer(marker);
      marker = null;
    }

    if (map) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: false });
    }

    notify();
  }

  function getSelection() {
    if (!isValidCoordinate(selectedLatitude, selectedLongitude)) {
      return null;
    }

    return {
      latitude: selectedLatitude,
      longitude: selectedLongitude
    };
  }

  function invalidateSize() {
    if (!map) return;

    [0, 100, 250, 500, 900].forEach(function (delay) {
      setTimeout(function () {
        if (!map) return;
        map.invalidateSize({ pan: false, animate: false });
      }, delay);
    });
  }

  function useCurrentLocation(onSuccess, onError) {
    if (!navigator.geolocation) {
      onError?.('UNSUPPORTED');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setSelection(lat, lng, true);
        onSuccess?.(getSelection());
      },
      function (error) {
        const code = error.code === error.PERMISSION_DENIED
          ? 'PERMISSION_DENIED'
          : error.code === error.TIMEOUT
            ? 'TIMEOUT'
            : 'POSITION_UNAVAILABLE';

        onError?.(code);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  }

  window.SiteMapPicker = {
    ensureMap,
    setSelection,
    clearSelection,
    getSelection,
    invalidateSize,
    useCurrentLocation
  };
})();