import { useState } from 'react';
import { api } from './api';

// Logo SVG de AsistTrack recreado fielmente
function AsistTrackLogo({ size = 80 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Círculo exterior azul */}
      <circle cx="100" cy="100" r="95" stroke="#2563EB" strokeWidth="10" fill="white"/>
      {/* Reloj - arco superior */}
      <path d="M 100 30 A 45 45 0 0 1 145 75" stroke="#2563EB" strokeWidth="8" strokeLinecap="round" fill="none"/>
      {/* Manecillas del reloj */}
      <line x1="100" y1="55" x2="100" y2="78" stroke="#1E3A8A" strokeWidth="6" strokeLinecap="round"/>
      <line x1="100" y1="78" x2="122" y2="88" stroke="#1E3A8A" strokeWidth="6" strokeLinecap="round"/>
      {/* Punto centro del reloj */}
      <circle cx="100" cy="78" r="4" fill="#1E3A8A"/>
      {/* Figura de persona */}
      <circle cx="85" cy="75" r="14" fill="#1E3A8A"/>
      <path d="M 58 112 Q 58 92 85 92 Q 112 92 112 112" fill="#1E3A8A"/>
      {/* Checkmark verde */}
      <path d="M 112 100 L 122 115 L 142 90" stroke="#10B981" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      {/* Texto AsistTrack */}
      <text x="100" y="148" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="22" fill="#1E3A8A">Asist</text>
      <text x="134" y="148" textAnchor="start" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="22" fill="#2563EB">Track</text>
      {/* Subtítulo */}
      <text x="100" y="165" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8.5" fill="#64748B" letterSpacing="0.5">MARCA TU ASISTENCIA,</text>
      <text x="100" y="176" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8.5" fill="#64748B" letterSpacing="0.5">IMPULSA TU DÍA</text>
    </svg>
  );
}

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor, ingresa usuario y contraseña');
      return;
    }
    setLoading(true);
    setError('');
    const result = await api.login(username, password);
    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Fondo decorativo */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(37,99,235,0.08)', filter: 'blur(60px)' }}/>
        <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '350px', height: '350px', borderRadius: '50%', background: 'rgba(16,185,129,0.06)', filter: 'blur(60px)' }}/>
      </div>

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem',
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '1.5rem' }}>
          <AsistTrackLogo size={110} />
        </div>

        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.75rem', fontWeight: '700', color: 'white', letterSpacing: '-0.5px' }}>
          Bienvenido a AsistTrack
        </h1>
        <p style={{ margin: '0 0 2rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
          Panel Administrativo · Acceso Seguro
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              color: '#f87171',
              fontSize: '0.85rem',
              textAlign: 'left'
            }}>
              ⚠️ {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Usuario administrador"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '0.9rem 1rem',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '0.95rem',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = '#2563EB'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '0.9rem 1rem',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '0.95rem',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = '#2563EB'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              padding: '1rem',
              background: loading ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #1d4ed8, #2563EB)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 15px rgba(37,99,235,0.3)'
            }}
          >
            {loading ? '⏳ Verificando...' : '🔐 Ingresar al Sistema'}
          </button>
        </form>

        <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
          AsistTrack • EESOLUCIONES © 2025
        </p>
      </div>
    </div>
  );
}
