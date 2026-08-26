const API_BASE_URL = "https://workers.somee.com";

async function apiRequest(path, options = {}) {
  const isAdmin = path.startsWith('/api/admin/');
  const isLogin = path === '/api/admin/auth/login';
  const headers = { ...(options.headers || {}) };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(API_BASE_URL + path, {
    mode: 'cors',
    credentials: isAdmin ? 'include' : 'omit',
    ...options,
    headers
  });

  let result = null;
  try { result = await response.json(); } catch (_) {}

  if (response.status === 401 && isAdmin && !isLogin) {
    window.location.href = 'login.html';
    throw { status: 401, data: result };
  }

  if (!response.ok) {
    throw { status: response.status, data: result };
  }

  return result;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '\"':'&quot;'
  }[c]));
}

function localTime(value) {
  return value ? new Date(value).toLocaleTimeString('ar-EG', {
    hour:'2-digit',
    minute:'2-digit'
  }) : '--';
}
