/**
 * Admin Dashboard — App.js
 * Handles all admin panel functionality:
 * Dashboard KPIs, User CRUD, History, Reports, Devices, Settings
 */

import { api } from '../api.js';
import { checkAuth, logout } from '../auth.js';

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let histPage = 0;
const AUDIT_LIMIT = 20;
const HIST_LIMIT = 20;
let auditPage = 0;

let currentView = 'dashboard';
let dashboardRefreshInterval = null;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard — admin only
  const user = await checkAuth('admin');
  if (!user) return;

  document.getElementById('adminName').textContent = user.full_name || user.fullName || 'Administrador';

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Clock
  setInterval(updateClock, 1000);
  updateClock();

  // Nav
  setupNavigation();

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('¿Deseas cerrar sesión?')) logout();
  });

  // Load initial view
  await loadView('dashboard');
});

// ─────────────────────────────────────────────
// CLOCK
// ─────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.getElementById('clockDisplay');
  if (el) el.textContent = timeStr;
}

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.sidebar-link[data-view]').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view) await switchView(view);
    });
  });
}

async function switchView(view) {
  // Stop dashboard refresh if leaving
  if (currentView === 'dashboard' && dashboardRefreshInterval) {
    clearInterval(dashboardRefreshInterval);
    dashboardRefreshInterval = null;
  }

  currentView = view;

  // Update active link
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.sidebar-link[data-view="${view}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    users: 'Gestión de Técnicos',
    history: 'Historial Global',
    reports: 'Reportes',
    devices: 'Dispositivos',
    settings: 'Configuración del Sistema',
    audit: 'Auditoría',
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[view] || view;

  // Show section
  document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
  const section = document.getElementById(`view-${view}`);
  if (section) section.classList.remove('hidden');

  // Load data
  await loadView(view);
}

async function loadView(view) {
  switch (view) {
    case 'dashboard':
      await loadDashboard();
      // Auto-refresh every 30 seconds
      dashboardRefreshInterval = setInterval(loadDashboard, 30000);
      break;
    case 'users':
      await loadUsers();
      setupUserForm();
      break;
    case 'history':
      histPage = 0;
      await loadHistory();
      setupHistoryControls();
      break;
    case 'reports':
      setupReportForm();
      break;
    case 'devices':
      await loadDevices();
      break;
    case 'settings':
      await loadSettings();
      setupSettingsForm();
      break;
    case 'audit':
      auditPage = 0;
      await loadAuditLog();
      break;
  }
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await api.get('/admin/dashboard');
    animateCounter('dash-total', data.totalTechnicians);
    animateCounter('dash-present', data.presentNow);
    animateCounter('dash-late', data.lateArrivals);
    animateCounter('dash-absent', data.absentNow);
    setEl('dash-entries', data.entriesToday);
    setEl('dash-exits', data.exitsToday);
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  const steps = 20;
  let step = 0;
  const interval = setInterval(() => {
    step++;
    el.textContent = Math.round(start + (diff * step / steps));
    if (step >= steps) {
      el.textContent = target;
      clearInterval(interval);
    }
  }, 30);
}

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="text-center"><span class="spinner spinner-sm"></span> Cargando...</td></tr>`;

  try {
    const data = await api.get('/admin/users');
    if (!data.users || data.users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay técnicos registrados</td></tr>`;
      return;
    }

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><code>${escHtml(u.username)}</code></td>
        <td>${escHtml(u.full_name)}</td>
        <td>${escHtml(u.position || '—')}</td>
        <td>${escHtml(u.mobile_number || '—')}</td>
        <td>
          <span class="badge ${u.status === 'active' ? 'bg-success' : (u.status === 'deleted' ? 'bg-danger' : 'bg-secondary')}">
            ${u.status === 'active' ? 'Activo' : (u.status === 'deleted' ? 'Eliminado' : 'Inactivo')}
          </span>
        </td>
        <td>
          <span class="badge bg-info">${u.role === 'admin' ? 'Admin' : 'Técnico'}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary mr-1" onclick="openEditUser('${u.id}', '${escHtml(u.username)}', '${escHtml(u.full_name)}', '${escHtml(u.mobile_number || '')}', '${escHtml(u.position || '')}', '${u.status}')">
            Editar
          </button>
          <button class="btn btn-sm btn-outline-warning mr-1" onclick="resetUserDevice('${u.id}', '${escHtml(u.full_name)}')">
            Reset
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.id}', '${escHtml(u.full_name)}')">
            Eliminar
          </button>
        </td>
      </tr>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error al cargar técnicos</td></tr>`;
  }
}

function setupUserForm() {
  const btnNew = document.getElementById('btnNewUser');
  if (btnNew) {
    btnNew.onclick = () => openNewUser();
  }

  const form = document.getElementById('userForm');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      await saveUser();
    };
  }
}

function openNewUser() {
  document.getElementById('userModalTitle').textContent = 'Nuevo Técnico';
  document.getElementById('userId').value = '';
  document.getElementById('u_username').value = '';
  document.getElementById('u_fullname').value = '';
  document.getElementById('u_password').value = '';
  document.getElementById('u_mobile').value = '';
  document.getElementById('u_position').value = '';
  document.getElementById('u_username').disabled = false;
  document.getElementById('pwdHelp').classList.add('hidden');
  document.getElementById('statusGroup').style.display = 'none';
  document.getElementById('userFormAlert').innerHTML = '';
  document.getElementById('userModal').classList.add('active');
}

window.openEditUser = function(id, username, fullName, mobile, position, status) {
  document.getElementById('userModalTitle').textContent = 'Editar Técnico';
  document.getElementById('userId').value = id;
  document.getElementById('u_username').value = username;
  document.getElementById('u_username').disabled = true;
  document.getElementById('u_fullname').value = fullName;
  document.getElementById('u_password').value = '';
  document.getElementById('u_mobile').value = mobile;
  document.getElementById('u_position').value = position;
  document.getElementById('u_status').value = status;
  document.getElementById('pwdHelp').classList.remove('hidden');
  document.getElementById('statusGroup').style.display = 'block';
  document.getElementById('userFormAlert').innerHTML = '';
  document.getElementById('userModal').classList.add('active');
};

window.closeUserModal = function() {
  document.getElementById('userModal').classList.remove('active');
};

async function saveUser() {
  const alertEl = document.getElementById('userFormAlert');
  const btnSave = document.getElementById('btnSaveUser');
  const id = document.getElementById('userId').value;
  const isNew = !id;

  const payload = {
    username: document.getElementById('u_username').value.trim(),
    fullName: document.getElementById('u_fullname').value.trim(),
    password: document.getElementById('u_password').value,
    mobileNumber: document.getElementById('u_mobile').value.trim(),
    position: document.getElementById('u_position').value.trim(),
  };

  if (!isNew) {
    payload.status = document.getElementById('u_status').value;
  }

  if (!payload.fullName) {
    alertEl.innerHTML = alertHtml('El nombre completo es requerido', 'warning');
    return;
  }

  if (isNew && (!payload.username || !payload.password)) {
    alertEl.innerHTML = alertHtml('Usuario y contraseña son requeridos para nuevos técnicos', 'warning');
    return;
  }

  btnSave.disabled = true;
  alertEl.innerHTML = '';

  try {
    if (isNew) {
      await api.post('/admin/users', payload);
    } else {
      await api.put(`/admin/users/${id}`, payload);
    }

    closeUserModal();
    await loadUsers();
  } catch (err) {
    alertEl.innerHTML = alertHtml(err.message || 'Error al guardar técnico', 'danger');
  } finally {
    btnSave.disabled = false;
  }
}

// ─────────────────────────────────────────────
// RESET USER DEVICE
// ─────────────────────────────────────────────
window.resetUserDevice = async function(id, userName) {
  if (!confirm(`¿Estás seguro de resetear el dispositivo del técnico ${userName}? Esto permitirá que se registre desde un nuevo dispositivo.`)) return;

  try {
    await api.delete(`/admin/users/${id}/devices`);
    alert(`✅ Dispositivo de ${userName} reseteado correctamente.`);
  } catch (err) {
    alert(err.message || 'Error al resetear dispositivo del usuario');
  }
};

// ─────────────────────────────────────────────
// DELETE USER
// ─────────────────────────────────────────────
window.deleteUser = async function(id, userName) {
  if (!confirm(`¿Estás seguro de ELIMINAR permanentemente al técnico ${userName}? Esta acción no se puede deshacer.`)) return;

  try {
    await api.delete(`/admin/users/${id}`);
    alert(`✅ Técnico ${userName} eliminado correctamente.`);
    await loadUsers();
  } catch (err) {
    alert(err.message || 'Error al eliminar el usuario');
  }
};

window.wipeDatabase = async function() {
  if (!confirm(`⚠️ ¡ALERTA MÁXIMA!\n\nEstás a punto de borrar TODA la base de datos (técnicos, dispositivos, historial, asistencias).\nTodo quedará en cero.\n\n¿Estás 100% seguro de querer continuar?`)) return;
  if (!confirm(`Última confirmación: ¿Borrar la base de datos completa?`)) return;

  try {
    const res = await fetch('/api/wipe-db');
    if (!res.ok) throw new Error('Falló al contactar al servidor');
    alert(`✅ ¡Base de datos limpiada correctamente! El usuario admin fue restablecido.\n\nEl sistema se reiniciará para aplicar los cambios.`);
    window.location.reload();
  } catch (err) {
    alert(`❌ Error al limpiar la base de datos: ${err.message}`);
  }
};

// ─────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────
async function loadHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center"><span class="spinner spinner-sm"></span></td></tr>`;

  try {
    const data = await api.get(`/admin/history?limit=${HIST_LIMIT}&offset=${histPage * HIST_LIMIT}`);
    const records = data.history || [];

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin registros</td></tr>`;
    } else {
      tbody.innerHTML = records.map(r => {
        const dt = new Date(r.timestamp);
        const typeLabel = r.type === 'entry'
          ? '<span class="badge bg-success">Entrada</span>'
          : '<span class="badge bg-secondary">Salida</span>';
        const statusLabel = r.is_valid
          ? '<span class="badge bg-success">Válido</span>'
          : '<span class="badge bg-danger">Rechazado</span>';

        return `
          <tr>
            <td>${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}</td>
            <td>${escHtml(r.user_name || '—')}</td>
            <td>${typeLabel}</td>
            <td>${statusLabel}</td>
            <td style="font-size: 0.8rem; color: #666;">${escHtml(r.rejection_reason || '—')}</td>
          </tr>
        `;
      }).join('');
    }

    document.getElementById('histPageInfo').textContent = `Página ${histPage + 1}`;
    document.getElementById('btnHistPrev').disabled = histPage === 0;
    document.getElementById('btnHistNext').disabled = records.length < HIST_LIMIT;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar historial</td></tr>`;
  }
}

function setupHistoryControls() {
  const btnPrev = document.getElementById('btnHistPrev');
  const btnNext = document.getElementById('btnHistNext');

  if (btnPrev) {
    btnPrev.onclick = async () => {
      if (histPage > 0) {
        histPage--;
        await loadHistory();
      }
    };
  }

  if (btnNext) {
    btnNext.onclick = async () => {
      histPage++;
      await loadHistory();
    };
  }
}

// ─────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────
function setupReportForm() {
  const today = new Date().toISOString().split('T')[0];
  const startDate = document.getElementById('repStartDate');
  const endDate = document.getElementById('repEndDate');
  if (startDate && !startDate.value) startDate.value = today;
  if (endDate && !endDate.value) endDate.value = today;

  const btnExcel = document.getElementById('btnExportExcel');
  const btnPdf = document.getElementById('btnExportPdf');

  if (btnExcel) {
    btnExcel.onclick = () => downloadReport('excel');
  }
  if (btnPdf) {
    btnPdf.onclick = () => downloadReport('pdf');
  }
}

function downloadReport(type) {
  const startDate = document.getElementById('repStartDate')?.value;
  const endDate = document.getElementById('repEndDate')?.value;
  const status = document.getElementById('repStatus')?.value;

  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (status) params.set('status', status);

  const token = localStorage.getItem('access_token');
  const endpoint = type === 'excel' ? '/reports/export/excel' : '/reports/export/pdf';
  const url = `${endpoint}?${params.toString()}`;

  // Use fetch to download with auth header
  const btn = type === 'excel' ? document.getElementById('btnExportExcel') : document.getElementById('btnExportPdf');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner spinner-sm"></span> Generando...`;

  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(async res => {
      if (!res.ok) throw new Error('Error al generar reporte');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = type === 'excel' ? 'reporte_asistencia.xlsx' : 'reporte_asistencia.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    })
    .catch(err => {
      alert('Error al descargar reporte: ' + err.message);
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = originalText;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
}

// ─────────────────────────────────────────────
// DEVICES
// ─────────────────────────────────────────────
async function loadDevices() {
  const tbody = document.getElementById('devicesTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center"><span class="spinner spinner-sm"></span></td></tr>`;

  try {
    const data = await api.get('/admin/devices');
    const devices = data.devices || [];

    if (devices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay dispositivos registrados</td></tr>`;
      return;
    }

    tbody.innerHTML = devices.map(d => `
      <tr>
        <td>${escHtml(d.user_name || '—')}</td>
        <td>
          <div>${escHtml(d.device_name || 'Dispositivo')}</div>
          <small class="text-muted" style="font-size: 0.75rem;">${escHtml((d.user_agent || '').substring(0, 60))}...</small>
        </td>
        <td>${escHtml(d.ip_address || '—')}</td>
        <td>${new Date(d.registered_at).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteDevice('${d.id}', '${escHtml(d.user_name || '')}')">
            Eliminar
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar dispositivos</td></tr>`;
  }
}

window.deleteDevice = async function(id, userName) {
  if (!confirm(`¿Eliminar el dispositivo de ${userName}? El técnico podrá registrar un nuevo dispositivo al iniciar sesión.`)) return;

  try {
    await api.delete(`/admin/devices/${id}`);
    await loadDevices();
  } catch (err) {
    alert('Error al eliminar dispositivo: ' + err.message);
  }
};

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
async function loadSettings() {
  try {
    const settings = await api.get('/admin/settings');
    setInputVal('set_base_lat', settings.base_lat);
    setInputVal('set_base_lng', settings.base_lng);
    setInputVal('set_allowed_radius_m', settings.allowed_radius_m);
    setInputVal('set_authorized_ssid', settings.authorized_ssid);
    setInputVal('set_qr_rotation_minutes', settings.qr_rotation_minutes);
    setInputVal('set_late_hour', settings.late_hour);
    setInputVal('set_late_minute', settings.late_minute);
  } catch (err) {
    document.getElementById('settingsAlert').innerHTML = alertHtml('Error al cargar configuración', 'danger');
  }
}

function setupSettingsForm() {
  const form = document.getElementById('settingsForm');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('settingsAlert');
    const btn = document.getElementById('btnSaveSettings');
    btn.disabled = true;
    alertEl.innerHTML = '';

    try {
      await api.put('/api/admin/settings', {
        base_lat: document.getElementById('set_base_lat').value,
        base_lng: document.getElementById('set_base_lng').value,
        allowed_radius_m: document.getElementById('set_allowed_radius_m').value,
        authorized_ssid: document.getElementById('set_authorized_ssid').value,
        qr_rotation_minutes: document.getElementById('set_qr_rotation_minutes').value,
        late_hour: document.getElementById('set_late_hour').value,
        late_minute: document.getElementById('set_late_minute').value,
      });
      alertEl.innerHTML = alertHtml('✅ Configuración guardada correctamente', 'success');
    } catch (err) {
      alertEl.innerHTML = alertHtml(err.message || 'Error al guardar configuración', 'danger');
    } finally {
      btn.disabled = false;
    }
  };
}

// ─────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────
async function loadAuditLog() {
  const view = document.getElementById('view-audit');
  if (!view) return;

  // Create table if not present
  if (!document.getElementById('auditTableBody')) {
    view.innerHTML = `
      <h3 class="mb-3">Auditoría del Sistema</h3>
      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>IP</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody id="auditTableBody">
              <tr><td colspan="5" class="text-center">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card-body p-2 border-top text-center">
          <button class="btn btn-sm btn-outline-primary" id="btnAuditPrev">Anterior</button>
          <span class="mx-2" id="auditPageInfo">Página 1</span>
          <button class="btn btn-sm btn-outline-primary" id="btnAuditNext">Siguiente</button>
        </div>
      </div>
    `;

    document.getElementById('btnAuditPrev').onclick = async () => {
      if (auditPage > 0) { auditPage--; await loadAuditLog(); }
    };
    document.getElementById('btnAuditNext').onclick = async () => {
      auditPage++; await loadAuditLog();
    };
  }

  const tbody = document.getElementById('auditTableBody');
  tbody.innerHTML = `<tr><td colspan="5" class="text-center"><span class="spinner spinner-sm"></span></td></tr>`;

  try {
    const data = await api.get(`/admin/audit?limit=${AUDIT_LIMIT}&offset=${auditPage * AUDIT_LIMIT}`);
    const logs = data.audit || [];

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin registros</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const dt = new Date(l.created_at);
      const badge = l.success
        ? '<span class="badge bg-success">OK</span>'
        : '<span class="badge bg-danger">FAIL</span>';
      return `
        <tr>
          <td style="font-size: 0.85rem;">${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}</td>
          <td>${escHtml(l.user_name || 'Sistema')}</td>
          <td><code style="font-size: 0.8rem;">${escHtml(l.action)}</code></td>
          <td style="font-size: 0.85rem;">${escHtml(l.ip_address || '—')}</td>
          <td>${badge}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('auditPageInfo').textContent = `Página ${auditPage + 1}`;
    document.getElementById('btnAuditPrev').disabled = auditPage === 0;
    document.getElementById('btnAuditNext').disabled = logs.length < AUDIT_LIMIT;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar auditoría</td></tr>`;
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

function setInputVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function alertHtml(msg, type = 'danger') {
  return `<div class="alert alert-${type}" style="margin-top: 0.5rem;">${escHtml(msg)}</div>`;
}
