const API_BASE = 'https://app-asistencia-y3an.onrender.com/api';

// Generar o recuperar Device ID
let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem('deviceId', deviceId);
}

class APIClient {
  constructor() {
    // Primero buscamos en localStorage (sobrevive a recargas)
    // Si no está, fallback a sessionStorage (compatibilidad legacy)
    const ls = localStorage;
    this.accessToken = ls.getItem('access_token') || sessionStorage.getItem('access_token');
    this.refreshToken = ls.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
    this.userId = ls.getItem('user_id') || sessionStorage.getItem('user_id');
    this.user = JSON.parse(ls.getItem('user_info') || sessionStorage.getItem('user_info') || 'null');
    this.refreshPromise = null;
  }

  saveSession(data) {
    this.accessToken = data.accessToken || data.access_token;
    this.refreshToken = data.refreshToken || data.refresh_token;
    this.user = data.user || this.user;
    // Keep userId separately so refresh token calls always have it
    this.userId = this.user?.id ? String(this.user.id) : this.userId;
    // Guardar tokens y user_id persistentes
    const ls = localStorage;
    ls.setItem('access_token', this.accessToken);
    ls.setItem('refresh_token', this.refreshToken);
    if (this.userId) ls.setItem('user_id', this.userId);
    ls.setItem('user_info', JSON.stringify(this.user));
    // Compatibilidad legacy
    sessionStorage.setItem('access_token', this.accessToken);
    sessionStorage.setItem('refresh_token', this.refreshToken);
    if (this.userId) sessionStorage.setItem('user_id', this.userId);
    sessionStorage.setItem('user_info', JSON.stringify(this.user));
  }

  clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.user = null;
    // Eliminar de ambos almacenes
    const ls = localStorage;
    ls.removeItem('access_token');
    ls.removeItem('refresh_token');
    ls.removeItem('user_id');
    ls.removeItem('user_info');
    // Compatibilidad legacy
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('user_info');
    // No borramos techCredentials, sigue siendo permanente
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  async login(username, password) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceFingerprint: deviceId })
      });
      const data = await response.json();
      
      if (response.ok) {
        if (data.user?.role !== 'admin') {
          return { success: false, message: 'Acceso Denegado. Solo administradores pueden ingresar aquí.' };
        }
        this.saveSession(data);
        return { success: true };
      }
      return { success: false, message: data.error || 'Error en credenciales' };
    } catch (e) {
      return { success: false, message: 'Error de red o servidor no disponible' };
    }
  }

  async _refresh() {
    // Need both refreshToken and userId to call the backend
    if (!this.refreshToken || !this.userId) return false;

    // If a refresh is already in progress, wait for it instead of making a duplicate request
    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken, userId: this.userId })
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data.accessToken || data.access_token) {
          this.saveSession(data);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return await this.refreshPromise;
  }

  async request(path, options = {}) {
    options.headers = { ...this.getHeaders(), ...options.headers };
    try {
      let res = await fetch(`${API_BASE}${path}`, options);
      if (res.status === 401) {
        const refreshed = await this._refresh();
        if (refreshed) {
          options.headers = { ...this.getHeaders(), ...options.headers };
          res = await fetch(`${API_BASE}${path}`, options);
        } else {
          this.clearSession();
          window.dispatchEvent(new Event('auth_expired'));
        }
      }
      return res;
    } catch (e) {
      console.error('Request failed', e);
      throw e;
    }
  }

  async getHistory() {
    const res = await this.request('/admin/history');
    if (res.ok) {
      const data = await res.json();
      return data.history || [];
    }
    return [];
  }

  async getUsers() {
    const res = await this.request('/admin/users');
    if (res.ok) {
      const data = await res.json();
      return data.users || [];
    }
    return [];
  }

  async createUser(userData) {
    const payload = {
      username: userData.username,
      password: userData.password,
      fullName: userData.full_name,
      mobileNumber: userData.mobile_number,
      position: userData.position,
      status: userData.status || 'active',
      base_lat: userData.base_lat || null,
      base_lng: userData.base_lng || null,
      allowed_radius_m: userData.allowed_radius_m || null,
      entry_time: userData.entry_time || '07:30',
      exit_time: userData.exit_time || '16:30',
    };
    const res = await this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.ok) return { success: true };
    const err = await res.json();
    return { success: false, message: err.error || 'Error creando usuario' };
  }

  async updateUser(userId, userData) {
    const res = await this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    const err = await res.json();
    return { success: false, message: err.error || 'Error actualizando usuario' };
  }

  async deleteUser(userId) {
    const res = await this.request(`/admin/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    // Try to extract error details from JSON response
    try {
      const err = await res.json();
      return {
        success: false,
        message: err.error || err.message || 'Error eliminando usuario',
        details: err.details,
      };
    } catch {
      // Non‑JSON or network error fallback
      return { success: false, message: 'Error al comunicarse con el servidor' };
    }
  }

  // Reset all registered devices for a user (so they can log in from a new device)
  async resetUserDevices(userId) {
    const res = await this.request(`/admin/users/${userId}/devices`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    const err = await res.json();
    return { success: false, message: err.error || 'Error al resetear dispositivos' };
  }

  async getAttendance(startDate, endDate) {
    let url = '/reports/attendance';
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const res = await this.request(url);
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    const err = await res.json();
    return { success: false, message: err.error || 'Error obteniendo datos' };
  }

  // Get attendance for a specific date range (for planilla)
  async getAttendanceForPlanilla(startDate, endDate) {
    let url = `/reports/attendance?startDate=${startDate}&endDate=${endDate}`;
    const res = await this.request(url);
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    const err = await res.json();
    return { success: false, message: err.error || 'Error obteniendo planilla' };
  }

  async exportExcel(startDate, endDate) {
    let url = '/reports/export/excel';
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const res = await this.request(url, {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_Asistencia_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return true;
    }
    return false;
  }
  async wipeDatabase() {
    // wipe-db is outside /api prefix
    const BASE = API_BASE.replace('/api', '');
    try {
      const res = await fetch(`${BASE}/api/wipe-db`, { headers: this.getHeaders() });
      if (res.ok) return { success: true };
      return { success: false, message: 'Error al limpiar la base de datos' };
    } catch (e) {
      return { success: false, message: 'Error de red: ' + e.message };
    }
  }
}

export const api = new APIClient();
