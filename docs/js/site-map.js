(function () {
  const DEFAULT_CENTER = [32.8998, 24.0889]; // [longitude, latitude]
  const DEFAULT_ZOOM = 13.5;
  const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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

  function attachResizeHandling(container) {
    if (!window.ResizeObserver || resizeObserver) {
      return;
    }

    resizeObserver = new ResizeObserver(function () {
      if (!map) return;

      requestAnimationFrame(function () {
        map.resize();
      });
    });

    resizeObserver.observe(container);
  }

  function ensureMap(containerId, changeHandler) {
    onChange = changeHandler || onChange;

    if (map) {
      return map;
    }

    if (!window.maplibregl) {
      throw new Error('MAPLIBRE_UNAVAILABLE');
    }

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error('MAP_CONTAINER_MISSING');
    }

    map = new maplibregl.Map({
      container: containerId,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: true,
      cooperativeGestures: false,
      renderWorldCopies: false
    });

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      'top-left'
    );

    map.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 120,
        unit: 'metric'
      }),
      'bottom-left'
    );

    map.on('click', function (event) {
      setSelection(event.lngLat.lat, event.lngLat.lng, true);
    });

    map.on('load', function () {
      invalidateSize();
    });

    map.on('error', function (event) {
      // MapLibre may emit transient resource errors while retrying.
      // Keep the picker usable and log details for diagnostics.
      console.warn('Map resource warning:', event?.error || event);
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
        marker = new maplibregl.Marker({
          draggable: true
        })
          .setLngLat([lng, lat])
          .addTo(map);

        marker.on('dragend', function () {
          const point = marker.getLngLat();
          setSelection(point.lat, point.lng, false);
        });
      } else {
        marker.setLngLat([lng, lat]);
      }

      if (centerMap) {
        map.jumpTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 16.5)
        });
      }
    }

    notify();
  }

  function clearSelection() {
    selectedLatitude = null;
    selectedLongitude = null;

    if (marker) {
      marker.remove();
      marker = null;
    }

    if (map) {
      map.jumpTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM
      });
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

    [0, 80, 180, 350, 700].forEach(function (delay) {
      setTimeout(function () {
        if (!map) return;
        map.resize();
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