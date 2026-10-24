// API Configuration
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Utility for formatting
export const formatError = (err) => {
  if (err.response && err.response.data && err.response.data.error) {
    return err.response.data.error;
  }
  return err.message || 'Error de conexión con el servidor';
};

// Generate a stable, deterministic device fingerprint.
// Does NOT use randomness — the same device/browser always produces the same fingerprint.
// Persists in localStorage, sessionStorage and a long-lived cookie so it
// survives individual storage clears.
function _simpleHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function _buildFingerprintString() {
  const nav = navigator;
  const scr = screen;

  // Canvas fingerprint (hardware/driver-level rendering differences)
  let canvasHash = '0';
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('AsistTrack🔐', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('AsistTrack🔐', 4, 17);
    canvasHash = _simpleHash(c.toDataURL());
  } catch (_) { /* canvas blocked — ok */ }

  const signals = [
    nav.userAgent,
    nav.language || nav.languages?.join(',') || '',
    nav.platform,
    `${scr.width}x${scr.height}`,
    `${scr.availWidth}x${scr.availHeight}`,
    String(scr.colorDepth),
    String(scr.pixelDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(nav.hardwareConcurrency || ''),
    String(nav.deviceMemory || ''),
    String(nav.maxTouchPoints || '0'),
    canvasHash,
  ].join('|');

  return `dev_${_simpleHash(signals)}`;
}

function _saveFingerprintAllStorages(fp) {
  try { localStorage.setItem('device_fingerprint', fp); } catch (_) {}
  try { sessionStorage.setItem('device_fingerprint', fp); } catch (_) {}
  // Long-lived cookie (365 days) as last-resort persistence
  try {
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    document.cookie = `dfp=${fp};expires=${exp.toUTCString()};path=/;SameSite=Strict`;
  } catch (_) {}
}

function _loadFingerprintFromAnyStorage() {
  try {
    const ls = localStorage.getItem('device_fingerprint');
    if (ls) return ls;
  } catch (_) {}
  try {
    const ss = sessionStorage.getItem('device_fingerprint');
    if (ss) return ss;
  } catch (_) {}
  try {
    const match = document.cookie.match(/(?:^|;\s*)dfp=([^;]+)/);
    if (match) return match[1];
  } catch (_) {}
  return null;
}

export const getDeviceFingerprint = () => {
  // Try to recover from any available storage first
  let fp = _loadFingerprintFromAnyStorage();

  // If not found (first time ever, or all storages cleared), compute deterministically
  if (!fp) {
    fp = _buildFingerprintString();
  }

  // Always persist in all storages (re-syncs if some were cleared)
  _saveFingerprintAllStorages(fp);

  return fp;
};

// Main API client
export const api = {
  async fetch(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    
    const headers = {
      'Content-Type': 'application/json',
      // x-device-fingerprint removed — no device restriction
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized (token expired)
      if (response.status === 401 && !options._retry) {
        const refreshToken = localStorage.getItem('refresh_token');
        const userStr = localStorage.getItem('user');
        
        if (refreshToken && userStr) {
          const user = JSON.parse(userStr);
          try {
            // Try to refresh
            const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken, userId: user.id })
            });

            if (refreshRes.ok) {
              const data = await refreshRes.json();
              localStorage.setItem('access_token', data.accessToken);
              
              // Retry original request
              return this.fetch(endpoint, { ...options, _retry: true });
            }
          } catch (e) {
            console.error('Failed to refresh token', e);
          }
        }
        
        // If refresh failed or no refresh token, logout
        if (window.location.pathname !== '/' && !window.location.pathname.includes('login')) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
      }

      const contentType = response.headers.get('content-type');
      let data;
      
      // Handle file downloads
      if (contentType && (contentType.includes('application/pdf') || contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))) {
        const blob = await response.blob();
        return { ok: response.ok, status: response.status, blob };
      }

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const error = new Error(data.error || 'API Error');
        error.response = { data, status: response.status };
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  get(endpoint) {
    return this.fetch(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.fetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
  },

  put(endpoint, body) {
    return this.fetch(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  },

  delete(endpoint) {
    return this.fetch(endpoint, { method: 'DELETE' });
  }
};

// UI Helpers
export const showAlert = (containerId, message, type = 'danger') => {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `
    <div class="alert alert-${type}">
      ${message}
    </div>
  `;
  
  // Auto dismiss after 5 seconds if success
  if (type === 'success') {
    setTimeout(() => {
      container.innerHTML = '';
    }, 5000);
  }
};

export const clearAlert = (containerId) => {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';
};

// Get device name safely
export const getDeviceName = () => {
  if (/android/i.test(navigator.userAgent)) return 'Android Device';
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return 'iOS Device';
  if (/windows/i.test(navigator.userAgent)) return 'Windows PC';
  if (/mac/i.test(navigator.userAgent)) return 'Mac';
  if (/linux/i.test(navigator.userAgent)) return 'Linux PC';
  return 'Unknown Device';
};
