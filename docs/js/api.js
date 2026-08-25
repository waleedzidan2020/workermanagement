const API_BASE_URL = "https://workers.somee.com";
let antiforgeryToken = '';

async function ensureAntiforgeryToken(loginPage = false) {
  const target = loginPage ? '/admin/login' : '/admin/dashboard';
  const response = await fetch(API_BASE_URL + target, {
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
    cache: 'no-store'
  });
  if (!response.ok) throw { status: response.status };
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  antiforgeryToken = doc.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
  if (!antiforgeryToken) throw new Error('Unable to obtain antiforgery token');
  return antiforgeryToken;
}

async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isAdmin = path.startsWith('/api/admin/');
  const isAdminWrite = isAdmin && ['POST','PUT','PATCH','DELETE'].includes(method);
  const isLogin = path === '/api/admin/auth/login';
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  if (isAdminWrite) {
    if (!antiforgeryToken || isLogin) await ensureAntiforgeryToken(isLogin);
    headers['RequestVerificationToken'] = antiforgeryToken;
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
  if (!response.ok) throw { status: response.status, data: result };

  if (isLogin) antiforgeryToken = '';
  return result;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
}
function localTime(value) {
  return value ? new Date(value).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '--';
}
