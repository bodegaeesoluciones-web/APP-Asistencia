// API Configuration
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Utility for formatting
export const formatError = (err) => {
  if (err.response && err.response.data && err.response.data.error) {
    return err.response.data.error;
  }
  return err.message || 'Error de conexión con el servidor';
};

// Generate a simple device fingerprint
export const getDeviceFingerprint = async () => {
  // Check if we already have one stored
  let fp = localStorage.getItem('device_fingerprint');
  if (fp) return fp;

  // Generate a simple fingerprint based on browser info
  const navigatorInfo = `${navigator.userAgent}${navigator.language}${navigator.platform}`;
  const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Create a hash (simple implementation for client side)
  const str = `${navigatorInfo}|${screenInfo}|${timezone}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Add some randomness to ensure uniqueness if fingerprint is identical
  const randomStr = Math.random().toString(36).substring(2, 10);
  fp = `dev_${Math.abs(hash)}_${randomStr}`;
  
  localStorage.setItem('device_fingerprint', fp);
  return fp;
};

// Main API client
export const api = {
  async fetch(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const fingerprint = await getDeviceFingerprint();
    
    const headers = {
      'Content-Type': 'application/json',
      'x-device-fingerprint': fingerprint,
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
