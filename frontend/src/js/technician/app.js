import { api, showAlert, clearAlert, formatError } from '../api.js';
import { logout } from '../auth.js';
import { getGPSLocation, getWiFiSSID } from '../gps.js';
let currentGPS = null;
let wifiConfirmed = false;
let authorizedSsidSettings = 'EESOLUCIONES_BASE'; // Will be fetched from backend if possible or assumed

document.addEventListener('DOMContentLoaded', async () => {
  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName');
  if (!userId) {
    window.location.href = '/';
    return;
  }

  document.getElementById('userName').textContent = userName || 'Técnico';

  // Real-time clock
  setInterval(() => {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('currentDate').textContent = now.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, 1000);

  // Initial loads
  await loadTodayHistory();

  // Auto-start validation on login (once per session)
  if (!sessionStorage.getItem('auto_attendance_marked')) {
    sessionStorage.setItem('auto_attendance_marked', 'true');
    startValidationFlow();
  }

  // Event Listeners
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  document.getElementById('btnMarkAttendance').addEventListener('click', startValidationFlow);
  
  document.getElementById('nav-home').addEventListener('click', (e) => {
    e.preventDefault();
    switchView('home');
  });
  
  document.getElementById('nav-history').addEventListener('click', (e) => {
    e.preventDefault();
    openHistoryModal();
  });

  document.getElementById('closeHistoryModal').addEventListener('click', () => {
    document.getElementById('historyModal').classList.remove('show');
  });

  document.getElementById('wifiConfirmCheck').addEventListener('change', (e) => {
    wifiConfirmed = e.target.checked;
    const icon = document.querySelector('#val-wifi .validation-icon');
    const text = document.getElementById('val-wifi-text');
    
    if (wifiConfirmed) {
      icon.className = 'validation-icon success';
      icon.innerHTML = '<i data-lucide="check-circle"></i>';
      text.textContent = 'Confirmado manualmente';
      text.classList.remove('text-danger');
      text.classList.add('text-success');
      
      // If GPS is also done, execute attendance
      if (currentGPS) {
        processAttendance();
      }
    } else {
      icon.className = 'validation-icon error';
      icon.innerHTML = '<i data-lucide="x-circle"></i>';
      text.textContent = 'Requiere confirmación';
      text.classList.remove('text-success');
      text.classList.add('text-danger');
    }
    lucide.createIcons();
  });
});

function switchView(view) {
  document.getElementById('view-home').classList.add('hidden');
  document.getElementById('view-scanner').classList.add('hidden');
  
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  if (view === 'home') {
    document.getElementById('view-home').classList.remove('hidden');
    document.getElementById('nav-home').classList.add('active');
  } else if (view === 'scanner') {
    document.getElementById('view-scanner').classList.remove('hidden');
  }
}

async function loadTodayHistory() {
  try {
    const data = await api.get('/attendance/today');
    const list = document.getElementById('todayHistoryList');
    const badge = document.getElementById('currentStatusBadge');
    
    list.innerHTML = '';
    
    if (!data.records || data.records.length === 0) {
      list.innerHTML = '<li class="text-center text-muted p-3">No hay registros hoy</li>';
      badge.textContent = 'Estado: Sin marcar entrada';
      badge.className = 'badge bg-secondary';
      return;
    }

    // Determine current status based on last VALID record
    const validRecords = data.records.filter(r => r.is_valid);
    if (validRecords.length > 0) {
      const lastValid = validRecords[validRecords.length - 1];
      if (lastValid.type === 'entry') {
        badge.textContent = 'Estado: Trabajando (Entrada registrada)';
        badge.className = 'badge bg-success';
      } else {
        badge.textContent = 'Estado: Salida registrada';
        badge.className = 'badge bg-warning';
      }
    } else {
      badge.textContent = 'Estado: Sin asistencia válida';
      badge.className = 'badge bg-danger';
    }

    // Render list
    data.records.forEach(r => {
      const li = document.createElement('li');
      li.className = `history-item ${r.is_valid ? (r.type === 'entry' ? 'entry' : 'exit') : 'invalid'}`;
      
      const time = new Date(r.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const typeStr = r.type === 'entry' ? 'Entrada' : 'Salida';
      const statusIcon = r.is_valid ? '<i data-lucide="check-circle" class="text-success"></i>' : '<i data-lucide="x-circle" class="text-danger"></i>';
      
      li.innerHTML = `
        <div class="history-details">
          <span class="history-time">${time} - ${typeStr}</span>
          ${!r.is_valid ? `<span class="history-date text-danger">Rechazado: ${r.rejection_reason}</span>` : ''}
        </div>
        <div>${statusIcon}</div>
      `;
      list.appendChild(li);
    });
    
    lucide.createIcons();
  } catch (err) {
    console.error('Error loading today history', err);
  }
}

async function startValidationFlow() {
  switchView('scanner');
  clearAlert('validationAlertContainer');
  document.getElementById('wifiConfirmContainer').classList.add('hidden');
  
  // Reset UI
  currentGPS = null;
  wifiConfirmed = false;
  document.getElementById('wifiConfirmCheck').checked = false;
  
  const gpsIcon = document.querySelector('#val-gps .validation-icon');
  const gpsText = document.getElementById('val-gps-text');
  gpsIcon.className = 'validation-icon pending';
  gpsIcon.innerHTML = '<i data-lucide="loader" class="spinner-sm"></i>';
  gpsText.textContent = 'Obteniendo coordenadas...';
  gpsText.className = 'text-muted';
  
  const wifiIcon = document.querySelector('#val-wifi .validation-icon');
  const wifiText = document.getElementById('val-wifi-text');
  wifiIcon.className = 'validation-icon pending';
  wifiIcon.innerHTML = '<i data-lucide="loader" class="spinner-sm"></i>';
  wifiText.textContent = 'Verificando red...';
  wifiText.className = 'text-muted';
  
  lucide.createIcons();

  // 1. Get GPS
  try {
    currentGPS = await getGPSLocation();
    gpsIcon.className = 'validation-icon success';
    gpsIcon.innerHTML = '<i data-lucide="check-circle"></i>';
    gpsText.textContent = `Lat: ${currentGPS.latitude.toFixed(5)}, Lng: ${currentGPS.longitude.toFixed(5)} (Precisión: ${Math.round(currentGPS.accuracy)}m)`;
    gpsText.className = 'text-success';
  } catch (err) {
    gpsIcon.className = 'validation-icon error';
    gpsIcon.innerHTML = '<i data-lucide="x-circle"></i>';
    gpsText.textContent = err.message;
    gpsText.className = 'text-danger';
    showAlert('validationAlertContainer', `GPS Error: ${err.message}. Asegúrese de tener el GPS encendido y permisos otorgados.`);
    lucide.createIcons();
    return; // Stop flow
  }
  
  lucide.createIcons();

  // 2. Check WiFi (Web fallback)
  try {
    const ssid = await getWiFiSSID();
    if (ssid) {
      // Very rare on web, but if supported:
      if (ssid === authorizedSsidSettings) {
        wifiConfirmed = true;
        wifiIcon.className = 'validation-icon success';
        wifiIcon.innerHTML = '<i data-lucide="check-circle"></i>';
        wifiText.textContent = `Conectado a ${ssid}`;
        wifiText.className = 'text-success';
        processAttendance();
      } else {
        wifiIcon.className = 'validation-icon error';
        wifiIcon.innerHTML = '<i data-lucide="x-circle"></i>';
        wifiText.textContent = `Red incorrecta (${ssid})`;
        wifiText.className = 'text-danger';
        showAlert('validationAlertContainer', `Debe estar conectado a la red oficial. Red actual: ${ssid}`);
      }
      lucide.createIcons();
    } else {
      // Web default: Ask user to confirm
      wifiIcon.className = 'validation-icon pending';
      wifiIcon.innerHTML = '<i data-lucide="alert-circle"></i>';
      wifiText.textContent = 'Requiere confirmación manual';
      wifiText.className = 'text-warning';
      document.getElementById('wifiConfirmContainer').classList.remove('hidden');
      lucide.createIcons();
    }
  } catch (err) {
    // Should not happen with our fallback
    console.error(err);
  }
}

async function processAttendance() {
  try {
    showAlert('alertContainer', 'Procesando validación de asistencia...', 'info');
    switchView('home');
    
    // Determine SSID to send. If web fallback, send the expected one so backend validates via IP instead
    const ssidToSend = wifiConfirmed ? authorizedSsidSettings : '';

    const data = await api.post('/attendance/mark', {
      latitude: currentGPS.latitude,
      longitude: currentGPS.longitude,
      gpsAccuracy: currentGPS.accuracy,
      wifiSsid: ssidToSend
    });

    showAlert('alertContainer', data.message, 'success');
    await loadTodayHistory();

  } catch (err) {
    console.error('Attendance mark error:', err);
    let msg = formatError(err);
    if (err.data && err.data.reasons && err.data.reasons.length > 0) {
      msg = `Asistencia rechazada. Motivos:<br>- ${err.data.reasons.join('<br>- ')}`;
    }
    showAlert('alertContainer', msg, 'danger');
    await loadTodayHistory();
  }
}

// History Modal
let historyOffset = 0;
const historyLimit = 20;

async function openHistoryModal() {
  document.getElementById('historyModal').classList.add('show');
  document.getElementById('fullHistoryList').innerHTML = '<li class="text-center text-muted">Cargando...</li>';
  historyOffset = 0;
  await loadMoreHistory(true);
}

async function loadMoreHistory(reset = false) {
  try {
    const data = await api.get(`/attendance/history?limit=${historyLimit}&offset=${historyOffset}`);
    const list = document.getElementById('fullHistoryList');
    
    if (reset) list.innerHTML = '';
    
    if (data.records.length === 0 && reset) {
      list.innerHTML = '<li class="text-center text-muted p-3">No hay registros históricos</li>';
      document.getElementById('historyLoadMoreContainer').classList.add('hidden');
      return;
    }

    data.records.forEach(r => {
      const li = document.createElement('li');
      li.className = `history-item ${r.is_valid ? (r.type === 'entry' ? 'entry' : 'exit') : 'invalid'}`;
      
      const date = new Date(r.timestamp).toLocaleDateString('es-PE');
      const time = new Date(r.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const typeStr = r.type === 'entry' ? 'Entrada' : 'Salida';
      const statusIcon = r.is_valid ? '<i data-lucide="check-circle" class="text-success"></i>' : '<i data-lucide="x-circle" class="text-danger"></i>';
      
      li.innerHTML = `
        <div class="history-details">
          <span class="history-time">${time} - ${typeStr}</span>
          <span class="history-date">${date}</span>
          ${!r.is_valid ? `<span class="history-date text-danger mt-1" style="font-size:0.75rem">Rechazo: ${r.rejection_reason}</span>` : ''}
        </div>
        <div>${statusIcon}</div>
      `;
      list.appendChild(li);
    });
    
    lucide.createIcons();

    if (data.records.length < historyLimit) {
      document.getElementById('historyLoadMoreContainer').classList.add('hidden');
    } else {
      document.getElementById('historyLoadMoreContainer').classList.remove('hidden');
      document.getElementById('btnLoadMoreHistory').onclick = () => {
        historyOffset += historyLimit;
        loadMoreHistory();
      };
    }
  } catch (err) {
    console.error('Error loading history', err);
    if (reset) document.getElementById('fullHistoryList').innerHTML = '<li class="text-center text-danger">Error al cargar historial</li>';
  }
}
