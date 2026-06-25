import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Users, BarChart3, UserCircle2, LogOut, PlusCircle, Download, Settings, Edit2, X, ClipboardList } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from './api';
import Login from './Login';
import './App.css';
import AttendanceMatrix from './components/AttendanceMatrix';
import CryptoJS from 'crypto-js';
import UserManagement from './components/UserManagement';
import LiveDashboard from './components/LiveDashboard';
import ReportsModule from './components/ReportsModule';
import PlanillaAsistencia from './components/PlanillaAsistencia';

// Logo SVG de AsistTrack
function AsistTrackLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="95" stroke="#2563EB" strokeWidth="10" fill="white"/>
      <path d="M 100 30 A 45 45 0 0 1 145 75" stroke="#2563EB" strokeWidth="8" strokeLinecap="round" fill="none"/>
      <line x1="100" y1="55" x2="100" y2="78" stroke="#1E3A8A" strokeWidth="6" strokeLinecap="round"/>
      <line x1="100" y1="78" x2="122" y2="88" stroke="#1E3A8A" strokeWidth="6" strokeLinecap="round"/>
      <circle cx="100" cy="78" r="4" fill="#1E3A8A"/>
      <circle cx="85" cy="75" r="14" fill="#1E3A8A"/>
      <path d="M 58 112 Q 58 92 85 92 Q 112 92 112 112" fill="#1E3A8A"/>
      <path d="M 112 100 L 122 115 L 142 90" stroke="#10B981" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!api.accessToken);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [time, setTime] = useState(new Date());

  // Data states
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Dashboard stats
  const [stats, setStats] = useState({ presentes: 0, ausentes: 0, tardanzas: 0, chartData: [] });

  // Form States
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', username: '', password: '', role: 'technician', mobile_number: '', position: '' });
  const [editingUser, setEditingUser] = useState(null);
  
  const [adminProfile, setAdminProfile] = useState({ fullName: api.user?.full_name || '', password: '' });
  const [reportDates, setReportDates] = useState({ startDate: '', endDate: '' });

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auth expiration listener
  useEffect(() => {
    const handleExpired = () => setIsAuthenticated(false);
    window.addEventListener('auth_expired', handleExpired);
    return () => window.removeEventListener('auth_expired', handleExpired);
  }, []);

  const hasAttemptedAutoLogin = useRef(false);

  // Check for saved encrypted credentials on mount
  useEffect(() => {
    if (!isAuthenticated && !hasAttemptedAutoLogin.current) {
      const savedCreds = localStorage.getItem('techCredentials');
      if (savedCreds) {
        try {
          const bytes = CryptoJS.AES.decrypt(savedCreds, 'asisttrack_secure_key_2026');
          const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
          if (decryptedData && decryptedData.accessToken) {
            api.saveSession(decryptedData);
            // Ensure userId is set so _refresh() works correctly
            if (decryptedData.user?.id) {
              api.userId = String(decryptedData.user.id);
              sessionStorage.setItem('user_id', api.userId);
            }
            setIsAuthenticated(true);
          }
        } catch (e) {
          console.error('Failed to decrypt local credentials', e);
          // Clear corrupted credentials so they don't loop
          localStorage.removeItem('techCredentials');
        }
      }
      hasAttemptedAutoLogin.current = true;
    }
  }, [isAuthenticated]);

  // Fetch Data
  const loadHistory = async () => {
    try {
      const data = await api.getHistory();
      setHistory(data);
      
      // Calculate Stats for Today
      const today = new Date().toISOString().split('T')[0];
      let presentes = 0, tardanzas = 0;
      
      const chartMap = {};
      
      data.forEach(item => {
        if (!item.timestamp) return;
        const itemDate = item.timestamp.split('T')[0];
        if (itemDate === today && item.type === 'entry') {
          presentes++;
          if (!item.is_valid) tardanzas++;
        }
        
        // Build chart data (last 7 days grouped)
        if (!chartMap[itemDate]) chartMap[itemDate] = { name: itemDate.slice(-5), presentes: 0, ausentes: 0, tardanzas: 0 };
        if (item.type === 'entry') {
          chartMap[itemDate].presentes++;
          if (!item.is_valid) chartMap[itemDate].tardanzas++;
        }
      });
      
      // Sorting and slicing to 7 days
      const chartData = Object.values(chartMap).slice(0, 7).reverse();
      
      setStats({ presentes, ausentes: Math.max(0, users.length - presentes), tardanzas, chartData });
    } catch (e) {
      console.error(e);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory();
      loadUsers();
      // Polling every 30 seconds
      const poll = setInterval(() => {
        loadHistory();
      }, 30000);
      return () => clearInterval(poll);
    }
  }, [isAuthenticated, activeTab]);

  const handleLogout = () => {
    api.clearSession();
    setIsAuthenticated(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await api.createUser(newUser);
    if (res.success) {
      alert('Técnico agregado exitosamente');
      setNewUser({ full_name: '', username: '', password: '', role: 'technician', mobile_number: '', position: '' });
      setShowNewUser(false);
      loadUsers();
    } else {
      alert('Error: ' + res.message);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    const res = await api.updateUser(editingUser.id, {
      fullName: editingUser.full_name,
      mobileNumber: editingUser.mobile_number,
      position: editingUser.position,
      status: editingUser.status,
      password: editingUser.password || undefined
    });
    if (res.success) {
      alert('Datos actualizados exitosamente');
      setEditingUser(null);
      loadUsers();
    } else {
      alert('Error: ' + res.message);
    }
  };

  const handleUpdateAdmin = async (e) => {
    e.preventDefault();
    const res = await api.updateUser(api.user.id, {
      fullName: adminProfile.fullName,
      password: adminProfile.password || undefined
    });
    if (res.success) {
      alert('Perfil administrativo actualizado correctamente.');
      setAdminProfile({ ...adminProfile, password: '' });
      api.user.full_name = adminProfile.fullName;
      localStorage.setItem('user_info', JSON.stringify(api.user));
    } else {
      alert('Error: ' + res.message);
    }
  };

  const handleExport = async () => {
    const success = await api.exportExcel(reportDates.startDate, reportDates.endDate);
    if (!success) alert('Error al descargar el reporte Excel.');
  };

  // Guardar credenciales en el dispositivo
  const handleSaveDevice = () => {
    try {
      const data = {
        accessToken: api.accessToken,
        refreshToken: api.refreshToken,
        user: api.user,
      };
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), 'asisttrack_secure_key_2026').toString();
      localStorage.setItem('techCredentials', encrypted);
      alert('Credenciales guardadas en el dispositivo de forma segura para acceso futuro.');
    } catch (e) {
      console.error(e);
      alert('Error al guardar credenciales.');
    }
  };


  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar glass-panel animate-fade-in" style={{ borderLeft: 'none', borderTop: 'none', borderBottom: 'none', borderRadius: 0, width: '260px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '3rem' }}>
          <AsistTrackLogo size={42} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '0.5px', lineHeight: 1.2 }}>
              <span style={{ color: 'white', fontWeight: '700' }}>Asist</span><span style={{ color: '#2563EB', fontWeight: '700' }}>Track</span>
            </h2>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>EESOLUCIONES</div>
          </div>
        </div>

        <nav className="nav-menu" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: activeTab === 'dashboard' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'dashboard' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)' }}
          >
            <LayoutDashboard size={20} />
            <span style={{ fontWeight: '500' }}>Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: activeTab === 'attendance' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'attendance' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)' }}
          >
            <BarChart3 size={20} />
            <span style={{ fontWeight: '500' }}>Asistencias</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'technicians' ? 'active' : ''}`}
            onClick={() => setActiveTab('technicians')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: activeTab === 'technicians' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'technicians' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)' }}
          >
            <Users size={20} />
            <span style={{ fontWeight: '500' }}>Colaboradores</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'planilla' ? 'active' : ''}`}
            onClick={() => setActiveTab('planilla')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: activeTab === 'planilla' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'planilla' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)' }}
          >
            <ClipboardList size={20} />
            <span style={{ fontWeight: '500' }}>Planilla</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: activeTab === 'reports' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'reports' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)' }}
          >
            <BarChart3 size={20} />
            <span style={{ fontWeight: '500' }}>Reportes</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'exports' ? 'active' : ''}`}
            onClick={() => setActiveTab('exports')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: activeTab === 'exports' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'exports' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)' }}
          >
            <Download size={20} />
            <span style={{ fontWeight: '500' }}>Exportaciones</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: activeTab === 'settings' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'settings' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)' }}
          >
            <Settings size={20} />
            <span style={{ fontWeight: '500' }}>Configuración</span>
          </button>
        </nav>

        <div className="user-profile glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', marginTop: 'auto', marginBottom: '1rem' }}>
          <UserCircle2 size={36} color="var(--primary)" />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{api.user?.full_name?.split(' ')[0] || 'Admin'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Administrador</div>
          </div>
        </div>

        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
          <LogOut size={18} />
          <span style={{ fontWeight: '600' }}>Cerrar Sesión</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="animate-fade-in">
          <div>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
              {activeTab === 'dashboard' && 'Panel de Control Principal'}
              {activeTab === 'attendance' && 'Control de Asistencias'}
              {activeTab === 'technicians' && 'Gestión de Colaboradores'}
              {activeTab === 'planilla' && 'Planilla de Asistencia Quincenal'}
              {activeTab === 'reports' && 'Reportes Estadísticos'}
              {activeTab === 'exports' && 'Exportación de Datos'}
              {activeTab === 'settings' && 'Configuración del Sistema'}
            </h1>
            <p style={{ margin: 0 }}>{time.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {activeTab === 'dashboard' && (
               <div className="badge badge-success" style={{ padding: '0.5rem 1rem' }}>
                 <span style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
                 Conectado en vivo a Render
               </div>
            )}
            <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'monospace', letterSpacing: '1px', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              {time.toLocaleTimeString()}
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <LiveDashboard users={users} stats={stats} />
        )}

        {activeTab === 'technicians' && (
          <UserManagement users={users} setUsers={setUsers} />
        )}

        {activeTab === 'exports' && (
          <div className="animate-fade-in glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
              <Download size={40} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Generar Reporte Consolidado</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
              Descarga un archivo Excel con todos los registros detallados de asistencia, tardanzas y ausencias de todo el personal almacenado en la base de datos de Render.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fecha Inicio (Opcional)</label>
                  <input type="date" value={reportDates.startDate} onChange={e => setReportDates({...reportDates, startDate: e.target.value})} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }} />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fecha Fin (Opcional)</label>
                  <input type="date" value={reportDates.endDate} onChange={e => setReportDates({...reportDates, endDate: e.target.value})} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }} />
               </div>
            </div>

            <button className="btn btn-primary" style={{ fontSize: '1.1rem', padding: '1rem 2.5rem' }} onClick={handleExport}>
               📥 Descargar Excel Ahora
            </button>
          </div>
        )}
        
        {activeTab === 'planilla' && (
          <PlanillaAsistencia users={users} />
        )}

        {activeTab === 'reports' && (
          <ReportsModule users={users} />
        )}
          {activeTab === 'attendance' && (
            <AttendanceMatrix users={users} />
          )}
        {activeTab === 'settings' && (
          <div className="animate-fade-in glass-panel" style={{ padding: '3rem', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem' }}>
               <UserCircle2 size={64} color="var(--primary)" />
               <div>
                 <button className="btn btn-secondary" style={{ marginLeft: '1rem' }} onClick={handleSaveDevice}>Guardar en dispositivo</button>
                 <p style={{ color: 'var(--text-muted)', margin: 0 }}>Gestiona tus credenciales y configuración</p>
               </div>
            </div>
            
            <form onSubmit={handleUpdateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               <div>
                 <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Nombre Completo</label>
                 <input required type="text" value={adminProfile.fullName} onChange={e => setAdminProfile({...adminProfile, fullName: e.target.value})} style={{ width: '100%', padding: '0.85rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '1rem' }} />
               </div>
               
               <div>
                 <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Cambiar Contraseña</label>
                 <input type="password" placeholder="Deja en blanco para no cambiar" value={adminProfile.password} onChange={e => setAdminProfile({...adminProfile, password: e.target.value})} style={{ width: '100%', padding: '0.85rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '1rem' }} />
               </div>

               <button type="submit" className="btn btn-primary" style={{ padding: '1rem', marginTop: '1rem' }}>
                 Guardar Configuración
               </button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
