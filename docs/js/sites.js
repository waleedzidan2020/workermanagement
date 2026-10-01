let sites = [];
let selectedSiteLocation = null;
let mapDraftSelection = null;
let returnToSiteModal = false;

const siteModalElement = document.getElementById('siteModal');
const mapPickerModalElement = document.getElementById('mapPickerModal');
const siteModal = bootstrap.Modal.getOrCreateInstance(siteModalElement);
const mapPickerModal = bootstrap.Modal.getOrCreateInstance(mapPickerModalElement);

const mapError = document.getElementById('siteMapError');
const siteLocationValidation = document.getElementById('siteLocationValidation');
const selectedLatText = document.getElementById('selectedLatText');
const selectedLngText = document.getElementById('selectedLngText');
const mapSelectedLatText = document.getElementById('mapSelectedLatText');
const mapSelectedLngText = document.getElementById('mapSelectedLngText');
const openMapPickerText = document.getElementById('openMapPickerText');

function cloneSelection(selection) {
  return selection ? {
    latitude: Number(selection.latitude),
    longitude: Number(selection.longitude)
  } : null;
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
  mapSelectedLatText.textContent = selection ? selection.latitude.toFixed(7) : '--';
  mapSelectedLngText.textContent = selection ? selection.longitude.toFixed(7) : '--';
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

    SiteMapPicker.invalidateSize();
  } catch (error) {
    console.error(error);
    showMapMessage('تعذر تحميل الخريطة. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
  }
}

function openMapPicker() {
  mapDraftSelection = cloneSelection(selectedSiteLocation);
  returnToSiteModal = true;
  clearMapMessage();

  siteModalElement.addEventListener('hidden.bs.modal', () => {
    mapPickerModal.show();
  }, { once: true });

  siteModal.hide();
}

async function loadSites() {
  try {
    const r = await apiRequest('/api/admin/sites?page=1&pageSize=100');
    sites = r.data?.items || r.data || [];

    sitesBody.innerHTML = sites.map(x => `
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

  siteId.value = x.id;
  siteName.value = x.name;
  siteDescription.value = x.description || '';
  siteRadius.value = x.allowedRadiusMeters;
  siteAccuracy.value = x.maxAllowedAccuracyMeters;
  siteActive.checked = x.isActive;

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

addSiteBtn.onclick = () => {
  siteId.value = '';
  siteName.value = '';
  siteDescription.value = '';
  siteRadius.value = 100;
  siteAccuracy.value = 50;
  siteActive.checked = true;

  selectedSiteLocation = null;
  mapDraftSelection = null;
  clearSiteLocationValidation();
  updateSiteLocationSummary();
};

document.getElementById('openMapPickerBtn').onclick = openMapPicker;

mapPickerModalElement.addEventListener('shown.bs.modal', initializeMapPicker);

mapPickerModalElement.addEventListener('hidden.bs.modal', () => {
  if (!returnToSiteModal) return;

  returnToSiteModal = false;
  siteModal.show();
});

document.getElementById('useCurrentLocationBtn').onclick = () => {
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
};

document.getElementById('confirmMapSelectionBtn').onclick = () => {
  const selection = SiteMapPicker.getSelection();

  if (!selection) {
    showMapMessage('من فضلك حدد موقع العمل على الخريطة أولاً.');
    return;
  }

  selectedSiteLocation = cloneSelection(selection);
  updateSiteLocationSummary();
  returnToSiteModal = true;
  mapPickerModal.hide();
};

saveSiteBtn.onclick = async () => {
  clearSiteLocationValidation();

  const id = siteId.value;
  const name = siteName.value.trim();
  const radius = Number(siteRadius.value);
  const accuracy = Number(siteAccuracy.value);

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

  if (!Number.isFinite(radius) || radius < 1 || !Number.isFinite(accuracy) || accuracy < 1) {
    alert('من فضلك أدخل قيم صحيحة للنطاق ودقة GPS.');
    return;
  }

  const body = {
    name,
    description: siteDescription.value.trim() || null,
    latitude: selectedSiteLocation.latitude,
    longitude: selectedSiteLocation.longitude,
    allowedRadiusMeters: radius,
    maxAllowedAccuracyMeters: accuracy,
    isActive: siteActive.checked
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
};

loadSites();