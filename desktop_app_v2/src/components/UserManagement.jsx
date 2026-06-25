import React, { useState } from 'react';
import { api } from '../api';
import { Search, Plus, Edit2, Shield, MapPin, X, Smartphone, Clock, Trash2, AlertTriangle } from 'lucide-react';

export default function UserManagement({ users, setUsers }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalData, setModalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resettingDevice, setResettingDevice] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // user to delete

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (user = null) => {
    if (user) {
      setModalData({
        ...user,
        password: '',
        entry_time: user.entry_time || '07:30',
        exit_time: user.exit_time || '16:30',
      });
    } else {
      setModalData({
        username: '',
        password: '',
        full_name: '',
        mobile_number: '',
        position: '',
        status: 'active',
        base_lat: '',
        base_lng: '',
        allowed_radius_m: '',
        entry_time: '07:30',
        exit_time: '16:30',
      });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const isEdit = !!modalData.id;
    let res;

    const payload = { ...modalData };

    const dataToSend = {
      username: payload.username,
      password: payload.password,
      fullName: payload.full_name,
      mobileNumber: payload.mobile_number,
      position: payload.position,
      status: payload.status,
      base_lat: payload.base_lat ? parseFloat(payload.base_lat) : null,
      base_lng: payload.base_lng ? parseFloat(payload.base_lng) : null,
      allowed_radius_m: payload.allowed_radius_m ? parseInt(payload.allowed_radius_m, 10) : null,
      entry_time: payload.entry_time || '07:30',
      exit_time: payload.exit_time || '16:30',
    };

    if (isEdit) {
      if (!dataToSend.password) delete dataToSend.password;
      res = await api.updateUser(modalData.id, dataToSend);
    } else {
      res = await api.createUser(modalData);
    }

    if (res.success) {
      const freshUsers = await api.getUsers();
      setUsers(freshUsers);
      setModalData(null);
    } else {
      alert('Error: ' + res.message);
    }
    setLoading(false);
  };

  // Reset device handler
  const handleResetDevice = async () => {
    if (!modalData?.id) return;
    const confirmed = window.confirm(
      `¿Estás seguro de que quieres resetear el dispositivo de "${modalData.full_name}"?\n\nEl colaborador podrá registrar un nuevo dispositivo en su próximo inicio de sesión.`
    );
    if (!confirmed) return;

    setResettingDevice(true);
    const res = await api.resetUserDevices(modalData.id);
    setResettingDevice(false);

    if (res.success) {
      alert(`✅ ${res.data.message}`);
    } else {
      alert('Error: ' + res.message);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    const res = await api.deleteUser(deleteConfirm.id);
    setLoading(false);
    setDeleteConfirm(null);
    setModalData(null);
    if (res.success) {
      const freshUsers = await api.getUsers();
      setUsers(freshUsers);
    } else {
      alert('Error: ' + res.message);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Top Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar colaborador por nombre o cédula..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}
          />
        </div>

        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} />
          Nuevo Colaborador
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', paddingBottom: '2rem' }} className="custom-scrollbar">
        {filteredUsers.map(user => (
          <div key={user.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 'bold', flexShrink: 0 }}>
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600' }}>{user.full_name}</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>CI: {user.username}</p>
              </div>
              <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                {user.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <hr style={{ borderColor: 'var(--border-color)', margin: 0 }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Cargo</div>
                <div style={{ fontWeight: '500' }}>{user.position || 'No definido'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Móvil</div>
                <div style={{ fontWeight: '500' }}>{user.mobile_number || 'No registrado'}</div>
              </div>
              {/* Horario */}
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.15)' }}>
                <Clock size={13} color="var(--primary)" />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Horario:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#10b981' }}>{user.entry_time || '07:30'}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>–</span>
                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#f59e0b' }}>{user.exit_time || '16:30'}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={12} /> Ubicación Permitida
                </div>
                <div style={{ fontWeight: '500' }}>
                  {user.base_lat && user.base_lng ? (
                    `${user.base_lat}, ${user.base_lng} (${user.allowed_radius_m || 500}m)`
                  ) : (
                    <span style={{ color: 'var(--warning)' }}>Usando configuración global</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleOpenModal(user)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', padding: '0.4rem', color: 'var(--text-main)', cursor: 'pointer', transition: 'var(--transition)' }}
            >
              <Edit2 size={16} />
            </button>

          </div>
        ))}
        {filteredUsers.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            No se encontraron colaboradores que coincidan con la búsqueda.
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-fade-in custom-scrollbar" style={{ width: '100%', maxWidth: '620px', background: 'var(--bg-card)', padding: '2rem', maxHeight: '92vh', overflowY: 'auto' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={20} color="var(--primary)" />
                {modalData.id ? 'Editar Colaborador' : 'Nuevo Colaborador'}
              </h2>
              <button onClick={() => setModalData(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Nombre / Cédula */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre Completo *</label>
                  <input required type="text" value={modalData.full_name} onChange={e => setModalData({ ...modalData, full_name: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cédula / Usuario *</label>
                  <input required type="text" value={modalData.username} onChange={e => setModalData({ ...modalData, username: e.target.value })} disabled={!!modalData.id} style={{ width: '100%', padding: '0.75rem', background: modalData.id ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: modalData.id ? 'var(--text-muted)' : 'white' }} />
                </div>
              </div>

              {/* Cargo / Teléfono */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cargo</label>
                  <input type="text" value={modalData.position || ''} onChange={e => setModalData({ ...modalData, position: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Teléfono Móvil</label>
                  <input type="text" value={modalData.mobile_number || ''} onChange={e => setModalData({ ...modalData, mobile_number: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }} />
                </div>
              </div>

              {/* Contraseña / Estado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contraseña {modalData.id && '(Dejar vacío para no cambiar)'}</label>
                  <input required={!modalData.id} type="password" value={modalData.password} onChange={e => setModalData({ ...modalData, password: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estado</label>
                  <select value={modalData.status || 'active'} onChange={e => setModalData({ ...modalData, status: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                    <option value="active" style={{ color: 'black' }}>Activo</option>
                    <option value="inactive" style={{ color: 'black' }}>Inactivo</option>
                  </select>
                </div>
              </div>

              {/* ── Horario Personalizado ── */}
              <div style={{ padding: '1rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={15} /> Horario de Trabajo
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Define las horas de entrada y salida de este colaborador. Se usarán para detectar tardanzas en la planilla.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>⏰ Hora de Entrada</label>
                    <input
                      type="time"
                      value={modalData.entry_time || '07:30'}
                      onChange={e => setModalData({ ...modalData, entry_time: e.target.value })}
                      style={{ width: '100%', padding: '0.7rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '1rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>🏁 Hora de Salida</label>
                    <input
                      type="time"
                      value={modalData.exit_time || '16:30'}
                      onChange={e => setModalData({ ...modalData, exit_time: e.target.value })}
                      style={{ width: '100%', padding: '0.7rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '1rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Geocerca Específica ── */}
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--primary)' }}>Geocerca Específica (Opcional)</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Si dejas estos campos vacíos, el colaborador utilizará la ubicación y radio global configurados en el sistema.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Latitud Base</label>
                    <input type="number" step="any" value={modalData.base_lat || ''} onChange={e => setModalData({ ...modalData, base_lat: e.target.value })} placeholder="Ej: -2.1234" style={{ width: '100%', padding: '0.65rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Longitud Base</label>
                    <input type="number" step="any" value={modalData.base_lng || ''} onChange={e => setModalData({ ...modalData, base_lng: e.target.value })} placeholder="Ej: -79.1234" style={{ width: '100%', padding: '0.65rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Radio (metros)</label>
                    <input type="number" value={modalData.allowed_radius_m || ''} onChange={e => setModalData({ ...modalData, allowed_radius_m: e.target.value })} placeholder="Ej: 200" style={{ width: '100%', padding: '0.65rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                </div>
              </div>

              {/* ── Resetear Dispositivo (solo en edición) ── */}
              {modalData.id && (
                <div style={{ padding: '1rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Smartphone size={15} /> Dispositivo Registrado
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                    Si el colaborador quiere usar un nuevo celular, resetea su dispositivo aquí. En su próximo inicio de sesión podrá registrar el nuevo dispositivo.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetDevice}
                    disabled={resettingDevice}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '8px', color: '#f59e0b', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', transition: 'all 0.2s' }}
                  >
                    <Smartphone size={16} />
                    {resettingDevice ? 'Reseteando...' : '🔄 Resetear Dispositivo'}
                  </button>
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {/* Botón Eliminar (solo en edición) */}
                {modalData.id && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(modalData)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.2rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: 'var(--danger)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                  >
                    <Trash2 size={16} /> Eliminar Colaborador
                  </button>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                  <button type="button" className="btn" onClick={() => setModalData(null)} style={{ background: 'rgba(255,255,255,0.1)' }}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Guardando...' : 'Guardar Colaborador'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmación de Eliminación ── */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <AlertTriangle size={32} color="var(--danger)" />
            </div>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.2rem' }}>¿Eliminar colaborador?</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Estás a punto de eliminar a:
            </p>
            <p style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '0.5rem' }}>{deleteConfirm.full_name}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '2rem' }}>
              CI: {deleteConfirm.username} · Esta acción es reversible solo desde la base de datos. El historial de asistencia se preservará.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                style={{ padding: '0.75rem 1.5rem', background: 'rgba(239,68,68,0.8)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Trash2 size={16} />
                {loading ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
