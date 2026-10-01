let sites = [];
let selectedSiteLocation = null;
let mapDraftSelection = null;
let isSwitchingToMap = false;
let isReturningToSite = false;

const siteModalElement = document.getElementById('siteModal');
const mapPickerModalElement = document.getElementById('mapPickerModal');
const siteModal = bootstrap.Modal.getOrCreateInstance(siteModalElement);
const mapPickerModal = bootstrap.Modal.getOrCreateInstance(mapPickerModalElement);

const sitesBodyElement = document.getElementById('sitesBody');
const addSiteButton = document.getElementById('addSiteBtn');
const saveSiteButton = document.getElementById('saveSiteBtn');
const openMapPickerButton = document.getElementById('openMapPickerBtn');
const useCurrentLocationButton = document.getElementById('useCurrentLocationBtn');
const confirmMapSelectionButton = document.getElementById('confirmMapSelectionBtn');

const siteIdInput = document.getElementById('siteId');
const siteNameInput = document.getElementById('siteName');
const siteDescriptionInput = document.getElementById('siteDescription');
const siteRadiusInput = document.getElementById('siteRadius');
const siteAccuracyInput = document.getElementById('siteAccuracy');
const siteActiveInput = document.getElementById('siteActive');

const mapError = document.getElementById('siteMapError');
const siteLocationValidation = document.getElementById('siteLocationValidation');
const selectedLatText = document.getElementById('selectedLatText');
const selectedLngText = document.getElementById('selectedLngText');
const mapSelectedLatText = document.getElementById('mapSelectedLatText');
const mapSelectedLngText = document.getElementById('mapSelectedLngText');
const openMapPickerText = document.getElementById('openMapPickerText');

function cloneSelection(selection) {
  return selection
    ? {
        latitude: Number(selection.latitude),
        longitude: Number(selection.longitude)
      }
    : null;
}

function showMapMessage(message, type = 'danger') {
  mapError.className = `alert alert-${type} py-2 mt-3 mb-0`;
  mapError.textContent = message;
  mapError.classList.remove('d-none');
}

function clearMapMessage() {
  mapError.classList.add('d-none');
}

function showSiteLocationValidation(message) {
  siteLocationValidation.textContent = message;
  siteLocationValidation.classList.remove('d-none');
}

function clearSiteLocationValidation() {
  siteLocationValidation.classList.add('d-none');
}

function updateSiteLocationSummary() {
  const hasLocation = !!selectedSiteLocation;

  selectedLatText.textContent = hasLocation
    ? selectedSiteLocation.latitude.toFixed(7)
    : '--';

  selectedLngText.textContent = hasLocation
    ? selectedSiteLocation.longitude.toFixed(7)
    : '--';

  openMapPickerText.textContent = hasLocation
    ? 'تعديل الموقع على الخريطة'
    : 'تحديد الموقع على الخريطة';

  if (hasLocation) {
    clearSiteLocationValidation();
  }
}

function updateMapDraftDisplay(selection) {
  mapSelectedLatText.textContent = selection
    ? selection.latitude.toFixed(7)
    : '--';

  mapSelectedLngText.textContent = selection
    ? selection.longitude.toFixed(7)
    : '--';
}

function initializeMapPicker() {
  clearMapMessage();

  try {
    SiteMapPicker.ensureMap('siteMap', updateMapDraftDisplay);

    if (mapDraftSelection) {
      SiteMapPicker.setSelection(
        mapDraftSelection.latitude,
        mapDraftSelection.longitude,
        true
      );
    } else {
      SiteMapPicker.clearSelection();
    }

    // Leaflet is inside a Bootstrap modal. Recalculate once immediately
    // and once after the modal transition has fully painted.
    SiteMapPicker.invalidateSize();
    setTimeout(() => SiteMapPicker.invalidateSize(), 250);
  } catch (error) {
    console.error('Map initialization failed:', error);
    showMapMessage('تعذر تحميل الخريطة. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
  }
}

function openMapPicker() {
  if (isSwitchingToMap || mapPickerModalElement.classList.contains('show')) {
    return;
  }

  mapDraftSelection = cloneSelection(selectedSiteLocation);
  clearMapMessage();
  updateMapDraftDisplay(mapDraftSelection);
  isSwitchingToMap = true;

  const openAfterSiteClosed = () => {
    siteModalElement.removeEventListener('hidden.bs.modal', openAfterSiteClosed);

    // Let Bootstrap finish removing the first backdrop before opening
    // the second modal. This avoids a stuck backdrop / non-opening modal.
    setTimeout(() => {
      try {
        mapPickerModal.show();
      } finally {
        isSwitchingToMap = false;
      }
    }, 80);
  };

  siteModalElement.addEventListener('hidden.bs.modal', openAfterSiteClosed);
  siteModal.hide();
}

function returnToSiteModal() {
  if (isReturningToSite || siteModalElement.classList.contains('show')) {
    return;
  }

  isReturningToSite = true;

  setTimeout(() => {
    try {
      siteModal.show();
    } finally {
      isReturningToSite = false;
    }
  }, 80);
}

async function loadSites() {
  try {
    const r = await apiRequest('/api/admin/sites?page=1&pageSize=100');
    sites = r.data?.items || r.data || [];

    sitesBodyElement.innerHTML = sites.map(x => `
      <tr>
        <td>${esc(x.name)}</td>
        <td>${x.latitude}</td>
        <td>${x.longitude}</td>
        <td>${x.allowedRadiusMeters}m</td>
        <td>${x.maxAllowedAccuracyMeters}m</td>
        <td>${x.isActive ? 'نشط' : 'غير نشط'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="editSite('${x.id}')">تعديل</button>
          <button class="btn btn-sm btn-outline-danger" onclick="disableSite('${x.id}')">تعطيل</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error(error);
    alert('تعذر تحميل مواقع العمل.');
  }
}

window.editSite = id => {
  const x = sites.find(s => s.id === id);
  if (!x) return;

  siteIdInput.value = x.id;
  siteNameInput.value = x.name;
  siteDescriptionInput.value = x.description || '';
  siteRadiusInput.value = x.allowedRadiusMeters;
  siteAccuracyInput.value = x.maxAllowedAccuracyMeters;
  siteActiveInput.checked = x.isActive;

  selectedSiteLocation = {
    latitude: Number(x.latitude),
    longitude: Number(x.longitude)
  };

  updateSiteLocationSummary();
  siteModal.show();
};

window.disableSite = async id => {
  if (!confirm('تعطيل الموقع؟')) return;

  try {
    await apiRequest('/api/admin/sites/' + id, { method: 'DELETE' });
    await loadSites();
  } catch (error) {
    console.error(error);
    alert('تعذر تعطيل الموقع.');
  }
};

addSiteButton.addEventListener('click', () => {
  siteIdInput.value = '';
  siteNameInput.value = '';
  siteDescriptionInput.value = '';
  siteRadiusInput.value = 100;
  siteAccuracyInput.value = 50;
  siteActiveInput.checked = true;

  selectedSiteLocation = null;
  mapDraftSelection = null;
  clearSiteLocationValidation();
  updateSiteLocationSummary();
});

openMapPickerButton.addEventListener('click', openMapPicker);

mapPickerModalElement.addEventListener('shown.bs.modal', initializeMapPicker);

mapPickerModalElement.addEventListener('hidden.bs.modal', () => {
  returnToSiteModal();
});

useCurrentLocationButton.addEventListener('click', () => {
  clearMapMessage();

  try {
    SiteMapPicker.ensureMap('siteMap', updateMapDraftDisplay);
    SiteMapPicker.useCurrentLocation(
      () => showMapMessage('تم تحديد موقعك الحالي على الخريطة.', 'success'),
      errorCode => {
        const message = errorCode === 'PERMISSION_DENIED'
          ? 'تم رفض إذن الموقع. اسمح للمتصفح بالوصول للموقع ثم أعد المحاولة.'
          : errorCode === 'TIMEOUT'
            ? 'انتهت مهلة تحديد الموقع. حاول مرة أخرى.'
            : errorCode === 'UNSUPPORTED'
              ? 'المتصفح الحالي لا يدعم تحديد الموقع.'
              : 'تعذر الحصول على موقعك الحالي.';

        showMapMessage(message);
      }
    );
  } catch (error) {
    console.error(error);
    showMapMessage('تعذر تحميل الخريطة.');
  }
});

confirmMapSelectionButton.addEventListener('click', () => {
  const selection = SiteMapPicker.getSelection();

  if (!selection) {
    showMapMessage('من فضلك حدد موقع العمل على الخريطة أولاً.');
    return;
  }

  selectedSiteLocation = cloneSelection(selection);
  mapDraftSelection = cloneSelection(selection);
  updateSiteLocationSummary();
  mapPickerModal.hide();
});

saveSiteButton.addEventListener('click', async () => {
  clearSiteLocationValidation();

  const id = siteIdInput.value;
  const name = siteNameInput.value.trim();
  const radius = Number(siteRadiusInput.value);
  const accuracy = Number(siteAccuracyInput.value);

  if (!name) {
    alert('من فضلك أدخل اسم الموقع.');
    return;
  }

  if (!selectedSiteLocation) {
    showSiteLocationValidation('من فضلك حدد موقع العمل من نافذة الخريطة أولاً.');
    return;
  }

  if (
    !Number.isFinite(selectedSiteLocation.latitude) ||
    selectedSiteLocation.latitude < -90 ||
    selectedSiteLocation.latitude > 90 ||
    !Number.isFinite(selectedSiteLocation.longitude) ||
    selectedSiteLocation.longitude < -180 ||
    selectedSiteLocation.longitude > 180
  ) {
    showSiteLocationValidation('الإحداثيات المحددة غير صحيحة.');
    return;
  }

  if (
    !Number.isFinite(radius) ||
    radius < 1 ||
    !Number.isFinite(accuracy) ||
    accuracy < 1
  ) {
    alert('من فضلك أدخل قيم صحيحة للنطاق ودقة GPS.');
    return;
  }

  const body = {
    name,
    description: siteDescriptionInput.value.trim() || null,
    latitude: selectedSiteLocation.latitude,
    longitude: selectedSiteLocation.longitude,
    allowedRadiusMeters: radius,
    maxAllowedAccuracyMeters: accuracy,
    isActive: siteActiveInput.checked
  };

  try {
    await apiRequest(
      id ? '/api/admin/sites/' + id : '/api/admin/sites',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      }
    );

    siteModal.hide();
    selectedSiteLocation = null;
    mapDraftSelection = null;
    await loadSites();
  } catch (error) {
    console.error(error);
    const message = error?.data?.message || 'تعذر حفظ موقع العمل.';
    showSiteLocationValidation(message);
  }
});

loadSites();