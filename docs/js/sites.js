let sites = [];
let pendingMapSelection = null;

const siteModalElement = document.getElementById('siteModal');
const mapError = document.getElementById('siteMapError');
const selectedLatText = document.getElementById('selectedLatText');
const selectedLngText = document.getElementById('selectedLngText');

function showMapMessage(message, type = 'danger') {
  if (!mapError) {
    alert(message);
    return;
  }

  mapError.className = `alert alert-${type} py-2 mb-3`;
  mapError.textContent = message;
  mapError.classList.remove('d-none');
}

function clearMapMessage() {
  mapError?.classList.add('d-none');
}

function updateCoordinateDisplay(selection) {
  selectedLatText.textContent = selection ? selection.latitude.toFixed(7) : '--';
  selectedLngText.textContent = selection ? selection.longitude.toFixed(7) : '--';
}

function initializeMapForModal() {
  clearMapMessage();

  try {
    SiteMapPicker.ensureMap('siteMap', updateCoordinateDisplay);

    if (pendingMapSelection) {
      SiteMapPicker.setSelection(
        pendingMapSelection.latitude,
        pendingMapSelection.longitude,
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

  pendingMapSelection = {
    latitude: Number(x.latitude),
    longitude: Number(x.longitude)
  };

  bootstrap.Modal.getOrCreateInstance(siteModalElement).show();
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
  pendingMapSelection = null;
  clearMapMessage();
  updateCoordinateDisplay(null);
};

siteModalElement.addEventListener('shown.bs.modal', initializeMapForModal);

document.getElementById('useCurrentLocationBtn').onclick = () => {
  clearMapMessage();

  try {
    SiteMapPicker.ensureMap('siteMap', updateCoordinateDisplay);
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

saveSiteBtn.onclick = async () => {
  clearMapMessage();

  const id = siteId.value;
  const name = siteName.value.trim();
  const radius = Number(siteRadius.value);
  const accuracy = Number(siteAccuracy.value);
  const selection = SiteMapPicker.getSelection();

  if (!name) {
    alert('من فضلك أدخل اسم الموقع.');
    return;
  }

  if (!selection) {
    showMapMessage('من فضلك حدد موقع العمل على الخريطة أولاً.');
    return;
  }

  if (!Number.isFinite(selection.latitude) || selection.latitude < -90 || selection.latitude > 90 ||
      !Number.isFinite(selection.longitude) || selection.longitude < -180 || selection.longitude > 180) {
    showMapMessage('الإحداثيات المحددة غير صحيحة.');
    return;
  }

  if (!Number.isFinite(radius) || radius < 1 || !Number.isFinite(accuracy) || accuracy < 1) {
    alert('من فضلك أدخل قيم صحيحة للنطاق ودقة GPS.');
    return;
  }

  const body = {
    name,
    description: siteDescription.value.trim() || null,
    latitude: selection.latitude,
    longitude: selection.longitude,
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

    bootstrap.Modal.getInstance(siteModalElement)?.hide();
    pendingMapSelection = null;
    await loadSites();
  } catch (error) {
    console.error(error);
    const message = error?.data?.message || 'تعذر حفظ موقع العمل.';
    showMapMessage(message);
  }
};

loadSites();