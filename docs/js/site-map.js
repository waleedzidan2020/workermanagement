(function () {
  const DEFAULT_CENTER = [24.0889, 32.8998];
  const DEFAULT_ZOOM = 13;

  let map = null;
  let marker = null;
  let selectedLatitude = null;
  let selectedLongitude = null;
  let onChange = null;

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

    map = L.map(container).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', function (event) {
      setSelection(event.latlng.lat, event.latlng.lng, true);
    });

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
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', function () {
          const point = marker.getLatLng();
          setSelection(point.lat, point.lng, false);
        });
      } else {
        marker.setLatLng([lat, lng]);
      }

      if (centerMap) {
        map.setView([lat, lng], Math.max(map.getZoom(), 16));
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
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
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
    if (map) {
      setTimeout(function () {
        map.invalidateSize();
      }, 0);
    }
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