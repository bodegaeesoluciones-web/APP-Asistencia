import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { Search, Filter, RefreshCw, X, MapPin, MonitorSmartphone, Calendar, Camera } from 'lucide-react';

export default function AttendanceMatrix({ users }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Photo Modal
  const [photoModal, setPhotoModal] = useState({ open: false, data: null });

  // Sort
  const [sortConfig, setSortConfig] = useState({ key: 'local_time', direction: 'desc' });

  // Fetch data
  const fetchData = async () => {
    // If no date range is set, default to today for real-time monitoring
    const today = new Date().toISOString().split('T')[0];
    const sDate = dateRange.start || today;
    const eDate = dateRange.end || today;

    try {
      const res = await api.getAttendance(sDate, eDate);
      if (res.success) {
        setAttendance(res.data);
      }
    } catch (e) {
      console.error('Error fetching attendance:', e);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [dateRange.start, dateRange.end]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // Process data to merge Entry and Exit if needed, or show all records?
  // User asked for: Columns: Name, Cédula, Cargo, Fecha, Hora de entrada, Hora de salida, Estado, Distancia, IP, Dispositivo, Evidencia.
  // Wait, if a row shows entry and exit, we need to merge records by user and date.
  // But each record has its own distance, IP, device, and evidence!
  // It's better to show EACH RECORD as a row (Tipo: Entrada/Salida), OR merge them and show arrays?
  // Usually, if we show "Hora de entrada" and "Hora de salida" on the same row, it's grouped by user and date.
  // Let's group by user & date.
  
  const processedData = useMemo(() => {
    const map = new Map();

    attendance.forEach(rec => {
      const date = rec.local_time.split('T')[0];
      const key = `${rec.user_name || rec.user_id}_${date}`;
      
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: rec.user_name || 'Desconocido',
          cedula: rec.cedula || '--',
          position: rec.user_position || 'Técnico',
          date: date,
          entry_time: null,
          exit_time: null,
          status: 'Ausente',
          distance: rec.latitude ? `Lat: ${rec.latitude.toFixed(4)}, Lng: ${rec.longitude.toFixed(4)}` : '--',
          ip_address: rec.ip_address || '--',
          device_name: rec.device_name || '--',
          photo_entry: null,
          photo_exit: null,
          is_valid: true,
          rejection_reason: null
        });
      }

      const row = map.get(key);
      const timeStr = new Date(rec.local_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      
      if (rec.type === 'entry') {
        row.entry_time = timeStr;
        row.photo_entry = rec.photo_url;
        row.is_valid = row.is_valid && rec.is_valid;
        if (!rec.is_valid) row.rejection_reason = rec.rejection_reason;
        
        // Update IP/Device/Distance to the entry one if available
        if (rec.ip_address) row.ip_address = rec.ip_address;
        if (rec.device_name) row.device_name = rec.device_name;
      } else {
        row.exit_time = timeStr;
        row.photo_exit = rec.photo_url;
      }

      row.status = row.entry_time && !row.exit_time ? 'Presente' : row.entry_time && row.exit_time ? 'Completado' : 'Ausente';
      if (!row.is_valid) row.status = 'Tardanza/Fuera Rango';
    });

    let result = Array.from(map.values());

    // Search
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(s) || r.cedula.toLowerCase().includes(s));
    }

    // Filters
    if (filterRole !== 'All') {
      result = result.filter(r => r.position === filterRole);
    }
    if (filterStatus !== 'All') {
      result = result.filter(r => r.status === filterStatus);
    }

    // Sorting
    result.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [attendance, searchTerm, filterRole, filterStatus, sortConfig]);


  const openPhoto = (url, type, row) => {
    if (!url || url === '-') return;
    setPhotoModal({
      open: true,
      data: { url, type, ...row }
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Top Bar: Search and Filters */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o cédula..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}
            />
          </div>
          
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '0.65rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
            <option value="All" style={{color: 'black'}}>Todos los Estados</option>
            <option value="Presente" style={{color: 'black'}}>Presente</option>
            <option value="Completado" style={{color: 'black'}}>Completado</option>
            <option value="Tardanza/Fuera Rango" style={{color: 'black'}}>Tardanza/Fuera Rango</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Desde:</label>
            <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hasta:</label>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }} />
          </div>
          <button className="btn" onClick={() => { setDateRange({start:'', end:''}); fetchData(); }} style={{ background: 'rgba(255,255,255,0.1)' }}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', zIndex: 1, borderBottom: '2px solid rgba(255, 255, 255, 0.1)' }}>
              <tr>
                <th onClick={() => handleSort('name')} style={{ padding: '1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Colaborador {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th onClick={() => handleSort('cedula')} style={{ padding: '1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Cédula</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Cargo</th>
                <th onClick={() => handleSort('date')} style={{ padding: '1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Fecha</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Entrada</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Salida</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Estado</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Geo/IP/Disp</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Evidencias</th>
              </tr>
            </thead>
            <tbody>
              {loading && processedData.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw className="spinner" size={24} /></td></tr>
              ) : processedData.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron registros.</td></tr>
              ) : (
                processedData.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{row.name}</td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{row.cedula}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.position}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{new Date(row.date).toLocaleDateString('es-ES')}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: row.entry_time ? '#10b981' : 'var(--text-muted)' }}>{row.entry_time || '--:--'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: row.exit_time ? '#f59e0b' : 'var(--text-muted)' }}>{row.exit_time || '--:--'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`badge ${row.status.includes('Presente') || row.status.includes('Completado') ? 'badge-success' : 'badge-danger'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={12}/> {row.distance}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}><MonitorSmartphone size={12}/> {row.ip_address}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      {row.photo_entry && row.photo_entry !== '-' && (
                        <div 
                          onClick={() => openPhoto(row.photo_entry, 'Entrada', row)}
                          style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-color)', position: 'relative' }}
                        >
                          <img src={row.photo_entry} alt="Entrada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', fontSize: '0.55rem', textAlign: 'center', padding: '1px' }}>IN</div>
                        </div>
                      )}
                      {row.photo_exit && row.photo_exit !== '-' && (
                        <div 
                          onClick={() => openPhoto(row.photo_exit, 'Salida', row)}
                          style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-color)', position: 'relative' }}
                        >
                          <img src={row.photo_exit} alt="Salida" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', fontSize: '0.55rem', textAlign: 'center', padding: '1px' }}>OUT</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Modal */}
      {photoModal.open && photoModal.data && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '900px', display: 'flex', overflow: 'hidden', maxHeight: '90vh' }}>
            
            <div style={{ flex: '1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <img src={photoModal.data.url} alt="Evidencia" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>

            <div style={{ width: '300px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'rgba(25, 25, 35, 0.95)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Camera size={20} color="var(--primary)"/>
                  Evidencia
                </h3>
                <button onClick={() => setPhotoModal({ open: false, data: null })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Colaborador</div>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{photoModal.data.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{photoModal.data.cedula} - {photoModal.data.position}</div>
                </div>
                
                <hr style={{ borderColor: 'var(--border-color)', margin: 0 }} />

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Marcación</div>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem', color: photoModal.data.type === 'Entrada' ? '#10b981' : '#f59e0b' }}>{photoModal.data.type}</div>
                  <div style={{ fontSize: '0.9rem' }}>{new Date(photoModal.data.date).toLocaleDateString('es-ES')} a las {photoModal.data.type === 'Entrada' ? photoModal.data.entry_time : photoModal.data.exit_time}</div>
                </div>

                <hr style={{ borderColor: 'var(--border-color)', margin: 0 }} />

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Ubicación y Dispositivo</div>
                  <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}><MapPin size={14}/> {photoModal.data.distance}</div>
                  <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MonitorSmartphone size={14}/> IP: {photoModal.data.ip_address}</div>
                </div>
                
                {photoModal.data.rejection_reason && (
                   <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.85rem' }}>
                     <strong>Advertencia:</strong> {photoModal.data.rejection_reason}
                   </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
