/**
 * auth.js — Helpers de autenticación reutilizables
 * Usado por technician/app.js, admin/app.js
 */
import { api } from './api.js';

// Storage keys
const KEYS = {
  token: 'access_token',
  refresh: 'refresh_token',
  user: 'user',
  deviceFp: 'device_fingerprint',
};

/**
 * Checks if user is authenticated and has the required role.
 * If not, redirects to login.
 * @param {string|null} requiredRole - 'admin', 'technician', or null (any)
 * @returns {object|null} user object or null
 */
export async function checkAuth(requiredRole = null) {
  const token = localStorage.getItem(KEYS.token);
  const userStr = localStorage.getItem(KEYS.user);

  if (!token || !userStr) {
    redirectToLogin();
    return null;
  }

  let user;
  try {
    user = JSON.parse(userStr);
  } catch {
    redirectToLogin();
    return null;
  }

  // Role check
  if (requiredRole && user.role !== requiredRole) {
    // Redirect to correct page
    if (user.role === 'admin') {
      window.location.href = '/src/pages/admin/index.html';
    } else {
      window.location.href = '/src/pages/technician/index.html';
    }
    return null;
  }

  // Verify token is still valid (optional lightweight check)
  try {
    const me = await api.get('/api/auth/me');
    // Update stored user data
    localStorage.setItem(KEYS.user, JSON.stringify(me.user));
    return me.user;
  } catch (err) {
    // Token may be expired, try refresh
    const refreshToken = localStorage.getItem(KEYS.refresh);
    if (refreshToken) {
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken, userId: user.id }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem(KEYS.token, data.accessToken);
          return user; // Return cached user
        }
      } catch {}
    }
    redirectToLogin();
    return null;
  }
}

/**
 * Logs the user out and redirects to login.
 */
export async function logout() {
  try {
    const refreshToken = localStorage.getItem(KEYS.refresh);
    if (refreshToken) {
      await api.post('/api/auth/logout', { refreshToken }).catch(() => {});
    }
  } finally {
    clearAuthStorage();
    window.location.href = '/';
  }
}

/**
 * Returns the stored user object or null.
 */
export function getStoredUser() {
  try {
    const str = localStorage.getItem(KEYS.user);
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
}

/**
 * Returns the stored access token.
 */
export function getToken() {
  return localStorage.getItem(KEYS.token);
}

function clearAuthStorage() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

function redirectToLogin() {
  clearAuthStorage();
  window.location.href = '/';
}

// ─── Login page logic (only runs on pages with loginForm) ───
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return; // Only run on login page

  // If already logged in, redirect
  const token = localStorage.getItem(KEYS.token);
  const userStr = localStorage.getItem(KEYS.user);
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      redirectByRole(user.role);
    } catch {
      clearAuthStorage();
    }
  }
});

function redirectByRole(role) {
  if (role === 'admin') {
    window.location.href = '/src/pages/admin/index.html';
  } else {
    window.location.href = '/src/pages/technician/index.html';
  }
}
