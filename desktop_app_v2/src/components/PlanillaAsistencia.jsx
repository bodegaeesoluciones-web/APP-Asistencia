import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { RefreshCw, Download, Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns an array of date strings (YYYY-MM-DD) from day 1 to 15 of the given month/year.
 */
function getQuincenaDays(year, month) {
  const days = [];
  for (let d = 1; d <= 15; d++) {
    const date = new Date(year, month, d);
    // month here is 0-indexed; format YYYY-MM-DD
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

function formatDay(dateStr) {
  // "2026-06-05" → "Vie 05"
  const d = new Date(dateStr + 'T12:00:00');
  const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
  return {
    short: dayName.charAt(0).toUpperCase() + dayName.slice(1, 3),
    num: String(d.getDate()).padStart(2, '0'),
    full: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
  };
}

function timeToMinutes(t) {
  if (!t || t === '--:--' || t === '—') return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ─── Planilla Export to CSV ───────────────────────────────────────────────────
function exportToCSV(rows, days, monthLabel) {
  const headers = ['NOMBRE', 'CÉDULA', ...days.flatMap(d => [`ENT ${d.full}`, `SAL ${d.full}`])];
  const csvRows = [headers.join(',')];

  rows.forEach(row => {
    const cells = [
      `"${row.name}"`,
      row.cedula,
      ...days.flatMap(d => {
        const rec = row.days[d.date] || {};
        return [rec.entry || '—', rec.exit || '—'];
      }),
    ];
    csvRows.push(cells.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Planilla_Asistencia_${monthLabel}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PlanillaAsistencia({ users }) {
  const now = new Date();

  // Month/year state (default: current month)
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed

  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const days = useMemo(() => getQuincenaDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const startDate = days[0];
  const endDate = days[days.length - 1];

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  // Fetch attendance for the quincena
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getAttendanceForPlanilla(startDate, endDate);
      if (res.success) setAttendance(res.data);
    } catch (e) {
      console.error('Error fetching planilla data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [viewYear, viewMonth]);

  // Navigate months
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build planilla rows: one row per active user
  const planillaRows = useMemo(() => {
    // Build a lookup: cedula → { date → { entry, exit } }
    const lookup = {};

    attendance.forEach(rec => {
      const dateKey = rec.local_time.split('T')[0];
      const cedula = rec.cedula;
      if (!lookup[cedula]) lookup[cedula] = {};
      if (!lookup[cedula][dateKey]) lookup[cedula][dateKey] = { entry: null, exit: null };

      const timeStr = new Date(rec.local_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

      if (rec.type === 'entry') lookup[cedula][dateKey].entry = timeStr;
      else lookup[cedula][dateKey].exit = timeStr;
    });

    // Build row per user
    return users.map(u => ({
      id: u.id,
      name: u.full_name,
      cedula: u.username,
      position: u.position || '—',
      entry_time: u.entry_time || '07:30',
      exit_time: u.exit_time || '16:30',
      days: lookup[u.username] || {},
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [attendance, users]);

  // Formatted days with day-of-week info
  const formattedDays = useMemo(() => days.map(d => ({ date: d, ...formatDay(d) })), [days]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Top Bar ── */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Month Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', color: 'white', cursor: 'pointer', display: 'flex' }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '200px', justifyContent: 'center' }}>
            <Calendar size={18} color="var(--primary)" />
            <span style={{ fontWeight: '700', fontSize: '1.05rem', textTransform: 'capitalize' }}>
              {monthLabel} — Quincena 1 (1–15)
            </span>
          </div>
          <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', color: 'white', cursor: 'pointer', display: 'flex' }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(16,185,129,0.3)', border: '1px solid #10b981', display: 'inline-block' }} />A tiempo</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(239,68,68,0.3)', border: '1px solid #ef4444', display: 'inline-block' }} />Tardanza</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(107,114,128,0.2)', border: '1px solid rgba(107,114,128,0.4)', display: 'inline-block' }} />Sin registro</span>
          </div>
          <button onClick={fetchData} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.85rem', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <RefreshCw size={15} /> Actualizar
          </button>
          <button
            onClick={() => exportToCSV(planillaRows, formattedDays, monthLabel)}
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px', padding: '0.5rem 0.85rem', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600' }}
          >
            <Download size={15} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* ── Table Panel ── */}
      <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
            <RefreshCw className="spinner" size={24} /> Cargando planilla...
          </div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
            <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', fontSize: '0.8rem' }}>

              {/* ── Head ── */}
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(13, 17, 33, 0.98)', backdropFilter: 'blur(12px)' }}>
                {/* Row 1: Date headers */}
                <tr>
                  <th rowSpan={2} style={{ padding: '0.75rem 1rem', borderBottom: '2px solid rgba(99,102,241,0.3)', borderRight: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left', minWidth: '180px', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Colaborador
                  </th>
                  <th rowSpan={2} style={{ padding: '0.75rem 0.75rem', borderBottom: '2px solid rgba(99,102,241,0.3)', borderRight: '2px solid rgba(99,102,241,0.3)', color: 'var(--text-muted)', textAlign: 'center', minWidth: '90px', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Cédula
                  </th>
                  {formattedDays.map(day => (
                    <th
                      key={day.date}
                      colSpan={2}
                      style={{
                        padding: '0.5rem 0.25rem',
                        borderBottom: '1px solid var(--border-color)',
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                        textAlign: 'center',
                        fontWeight: '700',
                        background: day.isWeekend ? 'rgba(99,102,241,0.07)' : 'transparent',
                        color: day.isWeekend ? 'rgba(165,180,252,0.7)' : 'var(--text-main)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '500' }}>{day.short}</div>
                      <div style={{ fontSize: '0.9rem' }}>{day.num}</div>
                    </th>
                  ))}
                </tr>
                {/* Row 2: ENT/SAL sub-headers */}
                <tr>
                  {formattedDays.map(day => (
                    <React.Fragment key={day.date + '_sub'}>
                      <th style={{ padding: '0.3rem 0.25rem', borderBottom: '2px solid rgba(99,102,241,0.3)', textAlign: 'center', fontSize: '0.62rem', color: '#10b981', fontWeight: '700', letterSpacing: '0.5px', background: day.isWeekend ? 'rgba(99,102,241,0.05)' : 'transparent', minWidth: '46px' }}>ENT</th>
                      <th style={{ padding: '0.3rem 0.25rem', borderBottom: '2px solid rgba(99,102,241,0.3)', borderRight: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: '0.62rem', color: '#f59e0b', fontWeight: '700', letterSpacing: '0.5px', background: day.isWeekend ? 'rgba(99,102,241,0.05)' : 'transparent', minWidth: '46px' }}>SAL</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              {/* ── Body ── */}
              <tbody>
                {planillaRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.07)'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
                  >
                    {/* Name + position */}
                    <td style={{ padding: '0.55rem 1rem', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.82rem' }}>{row.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '1px' }}>
                        <Clock size={10} />
                        {row.entry_time} – {row.exit_time}
                      </div>
                    </td>
                    {/* Cedula */}
                    <td style={{ padding: '0.55rem 0.75rem', borderRight: '2px solid rgba(99,102,241,0.3)', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {row.cedula}
                    </td>

                    {/* Day cells */}
                    {formattedDays.map(day => {
                      const rec = row.days[day.date] || {};
                      const entryMin = timeToMinutes(rec.entry);
                      const limitMin = timeToMinutes(row.entry_time);
                      const isLate = entryMin !== null && limitMin !== null && entryMin > limitMin;
                      const hasEntry = rec.entry != null;
                      const hasExit = rec.exit != null;

                      return (
                        <React.Fragment key={day.date + '_cell'}>
                          {/* Entry cell */}
                          <td style={{
                            padding: '0.35rem 0.2rem',
                            textAlign: 'center',
                            fontSize: '0.72rem',
                            fontWeight: hasEntry ? '600' : '400',
                            color: hasEntry ? (isLate ? '#ef4444' : '#10b981') : 'rgba(255,255,255,0.2)',
                            background: hasEntry
                              ? (isLate ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)')
                              : day.isWeekend ? 'rgba(99,102,241,0.04)' : 'transparent',
                            whiteSpace: 'nowrap',
                          }}>
                            {hasEntry ? rec.entry : '—'}
                          </td>
                          {/* Exit cell */}
                          <td style={{
                            padding: '0.35rem 0.2rem',
                            borderRight: '1px solid rgba(255,255,255,0.04)',
                            textAlign: 'center',
                            fontSize: '0.72rem',
                            fontWeight: hasExit ? '600' : '400',
                            color: hasExit ? '#f59e0b' : 'rgba(255,255,255,0.2)',
                            background: hasExit ? 'rgba(245,158,11,0.06)' : day.isWeekend ? 'rgba(99,102,241,0.04)' : 'transparent',
                            whiteSpace: 'nowrap',
                          }}>
                            {hasExit ? rec.exit : '—'}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}

                {planillaRows.length === 0 && (
                  <tr>
                    <td colSpan={2 + formattedDays.length * 2} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No hay colaboradores activos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals footer */}
      {!loading && (
        <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', marginTop: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.82rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            📋 <strong style={{ color: 'white' }}>{planillaRows.length}</strong> colaboradores
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            📅 Período: <strong style={{ color: 'white' }}>1 al 15 de {monthLabel}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            🟢 Verde = a tiempo &nbsp;|&nbsp; 🔴 Rojo = tardanza &nbsp;|&nbsp; — = sin registro
          </span>
        </div>
      )}
    </div>
  );
}
