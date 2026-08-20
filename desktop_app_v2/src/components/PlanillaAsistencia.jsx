import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { formatTimeFromLocalStr } from '../utils/timezone';
import { api } from '../api';
import { RefreshCw, Download, Calendar, ChevronLeft, ChevronRight, Clock, Edit3, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getQuincenaDays(year, month, quincena) {
  const days = [];
  const startDay = quincena === 1 ? 1 : 16;
  const endDay = quincena === 1 ? 15 : new Date(year, month + 1, 0).getDate();
  for (let d = startDay; d <= endDay; d++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

function formatDay(dateStr) {
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
  let timePart = t;
  let modifier = null;
  if (t.includes(' ')) {
    const parts = t.split(' ');
    timePart = parts[0];
    modifier = parts[1];
  }
  let [hStr, mStr] = timePart.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (modifier === 'PM' && h < 12) h += 12;
  if (modifier === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

// Convierte "HH:MM" (24h) a "HH:MM AM/PM"
function to12h(val) {
  if (!val) return '';
  const [hStr, mStr] = val.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return val;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
}

// Calcula el total de horas netas de un colaborador dado su mapa de días
function calcTotal(daysMap, daysList) {
  let totalMinutes = 0;
  daysList.forEach(d => {
    const rec = daysMap[d];
    if (rec && rec.entry && rec.exit) {
      const mEnt = timeToMinutes(rec.entry);
      const mSal = timeToMinutes(rec.exit);
      if (mEnt !== null && mSal !== null) {
        let diff = mSal - mEnt;
        if (diff < 0) diff += 24 * 60;
        if (diff >= 360) diff -= 60; // descontar 1h almuerzo
        totalMinutes += diff;
      }
    }
  });
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

// ─── Export to Excel ──────────────────────────────────────────────────────────
function exportToExcel(rows, days, monthLabel) {
  const C = {
    hdrBg: '1E3A5F', hdrFg: 'FFFFFF',
    subBg: '2563EB', subFg: 'FFFFFF',
    wkndHdr: 'B45309', wkndSub: 'D97706',
    wkndData: 'FFF7ED',
    rowA: 'EFF6FF', rowB: 'FFFFFF',
    nameBg: '1E3A5F', nameFg: 'FFFFFF',
    cedFg: '374151',
    entryFg: '065F46', exitFg: '92400E', emptyFg: 'CBD5E1',
    editedFg: '1D4ED8', // azul para celdas editadas manualmente
    totalBg: 'DBEAFE', totalFg: '1E40AF',
  };

  const border = { style: 'thin', color: { rgb: 'CBD5E1' } };
  const borderThick = { style: 'medium', color: { rgb: '64748B' } };
  const mkBorder = (thick = false) => { const b = thick ? borderThick : border; return { top: b, bottom: b, left: b, right: b }; };
  const mkStyle = (bgHex, fgHex, bold = false, sz = 9, hAlign = 'center', thick = false) => ({
    font: { name: 'Calibri', sz, bold, color: { rgb: fgHex } },
    fill: { patternType: 'solid', fgColor: { rgb: bgHex } },
    alignment: { horizontal: hAlign, vertical: 'center', wrapText: false },
    border: mkBorder(thick),
  });

  const totalCols = 2 + days.length * 2 + 1;
  const AOA = [];
  const styles = [];
  const pushRow = (values, styleRow) => { AOA.push(values); styles.push(styleRow); };

  // Fila 0 — Título
  const titleStyle = mkStyle(C.hdrBg, C.hdrFg, true, 13, 'center', true);
  pushRow([`PLANILLA DE ASISTENCIA — ${monthLabel.toUpperCase()}`, ...Array(totalCols - 1).fill('')],
          [titleStyle, ...Array(totalCols - 1).fill({ ...titleStyle })]);

  // Fila 1 — Nombres de días
  const dayNameVals = ['COLABORADOR', 'CÉDULA'];
  const dayNameStys = [mkStyle(C.hdrBg, C.hdrFg, true, 9, 'left', true), mkStyle(C.hdrBg, C.hdrFg, true, 9, 'center', true)];
  days.forEach(d => {
    const bg = d.isWeekend ? C.wkndHdr : C.hdrBg;
    const s = mkStyle(bg, C.hdrFg, true, 9, 'center', true);
    dayNameVals.push(`${d.short} ${d.num}`, '');
    dayNameStys.push(s, { ...s });
  });
  dayNameVals.push('TOTAL');
  dayNameStys.push(mkStyle(C.hdrBg, C.hdrFg, true, 9, 'center', true));
  pushRow(dayNameVals, dayNameStys);

  // Fila 2 — ENT / SAL
  const subVals = ['', ''];
  const subStys = [mkStyle(C.subBg, C.subFg, true, 8, 'center', true), mkStyle(C.subBg, C.subFg, true, 8, 'center', true)];
  days.forEach(d => {
    const bg = d.isWeekend ? C.wkndSub : C.subBg;
    subVals.push('ENT', 'SAL');
    subStys.push(mkStyle(bg, C.subFg, true, 8, 'center', true), mkStyle(bg, C.subFg, true, 8, 'center', true));
  });
  subVals.push('HORAS');
  subStys.push(mkStyle(C.subBg, C.subFg, true, 8, 'center', true));
  pushRow(subVals, subStys);

  // Filas de datos
  rows.forEach((row, idx) => {
    const rowBg = idx % 2 === 0 ? C.rowA : C.rowB;
    const vals = [row.name, row.cedula];
    const stys = [
      mkStyle(C.nameBg, C.nameFg, true, 9, 'left', true),
      mkStyle(rowBg, C.cedFg, false, 9, 'center', false),
    ];

    days.forEach(d => {
      const rec = row.days[d.date] || {};
      const bg = d.isWeekend ? C.wkndData : rowBg;
      let entVal = rec.entry || '00:00';
      if (entVal === 'Ausente') entVal = 'AUS';
      if (entVal === 'Incapacitado') entVal = 'INC';
      if (entVal === 'Suspendido') entVal = 'SUS';

      let salVal = rec.exit || '00:00';
      if (salVal === 'Ausente') salVal = 'AUS';
      if (salVal === 'Incapacitado') salVal = 'INC';
      if (salVal === 'Suspendido') salVal = 'SUS';

      const entFg = rec._entryEdited ? C.editedFg : (rec.entry ? C.entryFg : C.emptyFg);
      const salFg = rec._exitEdited ? C.editedFg : (rec.exit ? C.exitFg : C.emptyFg);
      vals.push(entVal, salVal);
      stys.push(
        mkStyle(bg, ['AUS','INC','SUS'].includes(entVal) ? 'B91C1C' : entFg, !!rec.entry, 9, 'center', false),
        mkStyle(bg, ['AUS','INC','SUS'].includes(salVal) ? 'B91C1C' : salFg, !!rec.exit, 9, 'center', false)
      );
    });

    vals.push(row.totalHoursStr || '0:00');
    stys.push(mkStyle(C.totalBg, C.totalFg, true, 9, 'center', false));
    pushRow(vals, stys);
  });

  const ws = XLSX.utils.aoa_to_sheet(AOA);
  AOA.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
      if (!ws[addr]) ws[addr] = { t: 's', v: val };
      ws[addr].s = styles[ri][ci];
    });
  });

  ws['!cols'] = [{ wch: 32 }, { wch: 14 }, ...days.flatMap(() => [{ wch: 8 }, { wch: 8 }]), { wch: 12 }];
  ws['!rows'] = [{ hpt: 26 }, { hpt: 22 }, { hpt: 16 }, ...rows.map(() => ({ hpt: 18 }))];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    ...days.map((_, di) => ({ s: { r: 1, c: 2 + di * 2 }, e: { r: 1, c: 3 + di * 2 } })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilla');
  const safeName = monthLabel.replace(/\s+/g, '_').replace(/[^\w_-]/g, '');
  XLSX.writeFile(wb, `Planilla_Asistencia_${safeName}.xlsx`);
}

// ─── Inline Time Cell ────────────────────────────────────────────────────────
function TimeCell({ value, isEdited, color, bg, onSave, type }) {
  const [editing, setEditing] = useState(false);
  const [editMode, setEditMode] = useState('time');
  const [inputVal, setInputVal] = useState('');
  const [statusVal, setStatusVal] = useState('Ausente');
  const inputRef = useRef(null);

  const specialStatuses = ['Ausente', 'Incapacitado', 'Suspendido'];

  const startEdit = useCallback(() => {
    let v24 = '';
    if (value && specialStatuses.includes(value)) {
      setEditMode('status');
      setStatusVal(value);
    } else {
      setEditMode('time');
      if (value) {
        const mins = timeToMinutes(value);
        if (mins !== null) {
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          v24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
      setInputVal(v24);
    }
    setEditing(true);
  }, [value]);

  useEffect(() => {
    if (editing && editMode === 'time' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  }, [editing, editMode]);

  const handleSave = () => {
    setEditing(false);
    if (editMode === 'time' && inputVal) {
      onSave(to12h(inputVal));
    } else if (editMode === 'status' && statusVal) {
      onSave(statusVal);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setEditing(false); }
  };

  const handleBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      handleSave();
    }
  };

  if (editing) {
    return (
      <td style={{ padding: '0.1rem', textAlign: 'center', background: 'rgba(37,99,235,0.12)', border: '1.5px solid #2563EB', position: 'relative', zIndex: 50 }}>
        <div 
          onBlur={handleBlur}
          tabIndex={-1}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center', outline: 'none' }}
        >
          <select 
            value={editMode} 
            onChange={e => { setEditMode(e.target.value); if (e.target.value === 'time') { setInputVal(''); } else { setStatusVal('Ausente'); } }}
            style={{ fontSize: '0.65rem', padding: '0.1rem', background: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '4px', outline: 'none' }}
          >
            <option value="time">Hora</option>
            <option value="status">Estado</option>
          </select>
          
          {editMode === 'time' ? (
            <input
              ref={inputRef}
              type="time"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '72px', background: 'transparent', border: 'none', color: '#93c5fd',
                fontSize: '0.72rem', fontWeight: '700', textAlign: 'center', outline: 'none',
                padding: '0.1rem',
              }}
            />
          ) : (
            <select
              value={statusVal}
              onChange={e => setStatusVal(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ fontSize: '0.65rem', padding: '0.1rem', background: '#1e293b', color: '#f87171', border: '1px solid #334155', borderRadius: '4px', outline: 'none' }}
              autoFocus
            >
              <option value="Ausente">Ausente</option>
              <option value="Incapacitado">Incapacitado</option>
              <option value="Suspendido">Suspendido</option>
            </select>
          )}
        </div>
      </td>
    );
  }

  let displayValue = value || '—';
  if (value === 'Ausente') displayValue = 'AUS';
  if (value === 'Incapacitado') displayValue = 'INC';
  if (value === 'Suspendido') displayValue = 'SUS';

  return (
    <td
      title="Doble clic para editar"
      onDoubleClick={startEdit}
      style={{
        padding: '0.35rem 0.2rem',
        textAlign: 'center',
        fontSize: '0.72rem',
        fontWeight: value ? '600' : '400',
        color: isEdited ? '#60a5fa' : color,
        background: bg,
        whiteSpace: 'nowrap',
        cursor: 'cell',
        position: 'relative',
        userSelect: 'none',
        borderBottom: isEdited ? '1.5px solid #3b82f6' : undefined,
        transition: 'background 0.1s',
      }}
    >
      {displayValue}
      {isEdited && (
        <span style={{
          position: 'absolute', top: 0, right: 1,
          fontSize: '0.45rem', color: '#60a5fa', lineHeight: 1,
        }}>✎</span>
      )}
    </td>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PlanillaAsistencia({ users }) {
  const now = new Date();

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [quincena, setQuincena] = useState(now.getDate() <= 15 ? 1 : 2);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mapa de ediciones manuales: clave = "cedula|date|type" → valor en formato 12h
  const [overrides, setOverrides] = useState({});
  const hasOverrides = Object.keys(overrides).length > 0;

  const days = useMemo(() => getQuincenaDays(viewYear, viewMonth, quincena), [viewYear, viewMonth, quincena]);
  const startDate = days[0];
  const endDate = days[days.length - 1];
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const exportLabel = `${monthLabel} — Q${quincena}`;

  const fetchData = async () => {
    setLoading(true);
    setOverrides({}); // limpiar ediciones al recargar
    try {
      const res = await api.getAttendanceForPlanilla(startDate, endDate);
      if (res.success) setAttendance(res.data);
    } catch (e) {
      console.error('Error fetching planilla data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [viewYear, viewMonth, quincena]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Guardar una edición
  const handleOverride = useCallback(async (cedula, date, type, newVal) => {
    // Actualización optimista local
    setOverrides(prev => ({ ...prev, [`${cedula}|${date}|${type}`]: newVal }));
    // Guardar en backend
    const res = await api.overrideAttendance(cedula, date, type, newVal);
    if (!res.success) {
      alert('Error guardando la asistencia: ' + res.message);
    } else {
      // Recargar datos para confirmar guardado
      fetchData();
    }
  }, []);

  // Build planilla rows (aplicando overrides)
  const planillaRows = useMemo(() => {
    const lookup = {};
    attendance.forEach(rec => {
      const dateKey = rec.local_time.split('T')[0];
      const cedula = rec.cedula;
      if (!lookup[cedula]) lookup[cedula] = {};
      if (!lookup[cedula][dateKey]) lookup[cedula][dateKey] = { entry: null, exit: null, entryEdited: false, exitEdited: false };
      let timeStr = formatTimeFromLocalStr(rec.local_time);
      const rawTimeStr = rec.local_time.split('T')[1].slice(0, 5); // '08:00'
      
      // Override default times (visual only)
      if (rec.type === 'entry' && rawTimeStr >= '07:00' && rawTimeStr <= '07:40') {
        timeStr = '07:30 AM';
      } else if (rec.type === 'exit' && rawTimeStr >= '16:00' && rawTimeStr <= '16:59') {
        timeStr = '04:30 PM';
      }
      if (rec.type === 'entry') {
        lookup[cedula][dateKey].entry = rec.manual_status || timeStr;
        lookup[cedula][dateKey].entryEdited = rec.is_manual_edit;
      } else {
        lookup[cedula][dateKey].exit = rec.manual_status || timeStr;
        lookup[cedula][dateKey].exitEdited = rec.is_manual_edit;
      }
    });

    return users.map(u => {
      const baseDays = lookup[u.username] || {};

      // Aplicar overrides al mapa de días
      const uDays = {};
      days.forEach(d => {
        const base = baseDays[d] || { entry: null, exit: null, entryEdited: false, exitEdited: false };
        const overEntry = overrides[`${u.username}|${d}|entry`];
        const overExit = overrides[`${u.username}|${d}|exit`];
        uDays[d] = {
          entry: overEntry !== undefined ? overEntry : base.entry,
          exit: overExit !== undefined ? overExit : base.exit,
          _entryEdited: overEntry !== undefined || base.entryEdited,
          _exitEdited: overExit !== undefined || base.exitEdited,
        };
      });

      const totalHoursStr = calcTotal(uDays, days);

      return {
        id: u.id,
        name: u.full_name,
        cedula: u.username,
        position: u.position || '—',
        entry_time: u.entry_time || '07:30',
        exit_time: u.exit_time || '16:30',
        days: uDays,
        totalHoursStr,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [attendance, users, days, overrides]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '250px', justifyContent: 'center' }}>
            <Calendar size={18} color="var(--primary)" />
            <span style={{ fontWeight: '700', fontSize: '1.05rem', textTransform: 'capitalize' }}>{monthLabel}</span>
            <select
              value={quincena}
              onChange={e => setQuincena(Number(e.target.value))}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.2rem 0.5rem', color: 'white', cursor: 'pointer', outline: 'none', marginLeft: '0.5rem', fontSize: '0.9rem' }}
            >
              <option value={1} style={{ color: 'black' }}>Q1 (1–15)</option>
              <option value={2} style={{ color: 'black' }}>Q2 (16–Fin)</option>
            </select>
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
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(96,165,250,0.3)', border: '1px solid #60a5fa', display: 'inline-block' }} />Editado</span>
          </div>

          {hasOverrides && (
            <button
              onClick={() => setOverrides({})}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.5rem 0.85rem', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: '600' }}
            >
              <RotateCcw size={14} /> Deshacer ediciones ({Object.keys(overrides).length})
            </button>
          )}

          <button onClick={fetchData} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.85rem', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <RefreshCw size={15} /> Actualizar
          </button>
          <button
            onClick={() => exportToExcel(planillaRows, formattedDays, exportLabel)}
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px', padding: '0.5rem 0.85rem', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600' }}
          >
            <Download size={15} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Aviso edición */}
      <div style={{ marginBottom: '0.75rem', padding: '0.55rem 1rem', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '8px', fontSize: '0.78rem', color: 'rgba(147,197,253,0.9)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Edit3 size={14} style={{ flexShrink: 0 }} />
        <span><strong>Modo edición:</strong> Haz <strong>doble clic</strong> en cualquier hora para editarla. Los cambios se guardarán permanentemente en la base de datos de asistencia.</span>
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
                  <th rowSpan={2} style={{ padding: '0.75rem 0.75rem', borderBottom: '2px solid rgba(99,102,241,0.3)', borderLeft: '2px solid rgba(99,102,241,0.3)', color: 'var(--text-main)', textAlign: 'center', minWidth: '80px', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Horas
                  </th>
                </tr>
                <tr>
                  {formattedDays.map(day => (
                    <React.Fragment key={day.date + '_sub'}>
                      <th style={{ padding: '0.3rem 0.25rem', borderBottom: '2px solid rgba(99,102,241,0.3)', textAlign: 'center', fontSize: '0.62rem', color: '#10b981', fontWeight: '700', letterSpacing: '0.5px', background: day.isWeekend ? 'rgba(99,102,241,0.05)' : 'transparent', minWidth: '52px' }}>ENT ✎</th>
                      <th style={{ padding: '0.3rem 0.25rem', borderBottom: '2px solid rgba(99,102,241,0.3)', borderRight: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: '0.62rem', color: '#f59e0b', fontWeight: '700', letterSpacing: '0.5px', background: day.isWeekend ? 'rgba(99,102,241,0.05)' : 'transparent', minWidth: '52px' }}>SAL ✎</th>
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
                    }}
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

                    {/* Day cells — editables con doble clic */}
                    {formattedDays.map(day => {
                      const rec = row.days[day.date] || {};
                      const entryMin = timeToMinutes(rec.entry);
                      const limitMin = timeToMinutes(row.entry_time);
                      const isLate = entryMin !== null && limitMin !== null && entryMin > limitMin;
                      const hasEntry = !!rec.entry;
                      const hasExit = !!rec.exit;

                      const entryColor = ['Ausente', 'Incapacitado', 'Suspendido'].includes(rec.entry) ? '#f87171' : (hasEntry ? (isLate ? '#ef4444' : '#10b981') : 'rgba(255,255,255,0.2)');
                      const exitColor = ['Ausente', 'Incapacitado', 'Suspendido'].includes(rec.exit) ? '#f87171' : (hasExit ? '#f59e0b' : 'rgba(255,255,255,0.2)');
                      const entryBg = ['Ausente', 'Incapacitado', 'Suspendido'].includes(rec.entry) ? 'rgba(239,68,68,0.08)' : (hasEntry
                        ? (isLate ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)')
                        : day.isWeekend ? 'rgba(99,102,241,0.04)' : 'transparent');
                      const exitBg = ['Ausente', 'Incapacitado', 'Suspendido'].includes(rec.exit) ? 'rgba(239,68,68,0.08)' : (hasExit ? 'rgba(245,158,11,0.06)' : day.isWeekend ? 'rgba(99,102,241,0.04)' : 'transparent');

                      return (
                        <React.Fragment key={day.date + '_cell'}>
                          <TimeCell
                            value={hasEntry ? rec.entry : null}
                            isEdited={rec._entryEdited}
                            color={entryColor}
                            bg={entryBg}
                            type="entry"
                            onSave={val => handleOverride(row.cedula, day.date, 'entry', val)}
                          />
                          <TimeCell
                            value={hasExit ? rec.exit : null}
                            isEdited={rec._exitEdited}
                            color={exitColor}
                            bg={exitBg}
                            type="exit"
                            onSave={val => handleOverride(row.cedula, day.date, 'exit', val)}
                          />
                        </React.Fragment>
                      );
                    })}

                    {/* Total Horas */}
                    <td style={{ padding: '0.55rem 0.75rem', borderLeft: '2px solid rgba(99,102,241,0.3)', textAlign: 'center', fontWeight: '700', fontSize: '0.8rem', color: 'var(--primary)', whiteSpace: 'nowrap', background: 'rgba(99,102,241,0.04)' }}>
                      {row.totalHoursStr}
                    </td>
                  </tr>
                ))}

                {planillaRows.length === 0 && (
                  <tr>
                    <td colSpan={2 + formattedDays.length * 2 + 1} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
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
            📅 Período: <strong style={{ color: 'white' }}>{quincena === 1 ? '1 al 15' : `16 al ${new Date(viewYear, viewMonth + 1, 0).getDate()}`} de {monthLabel}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            🟢 A tiempo &nbsp;|&nbsp; 🔴 Tardanza &nbsp;|&nbsp; 🔵 Editado &nbsp;|&nbsp; — sin registro
          </span>
          <span style={{ color: 'var(--text-muted)', width: '100%' }}>
            ℹ️ Se descuenta 1 hora de almuerzo automáticamente en turnos ≥ 6 horas. Las horas editadas se guardan en la base de datos permanentemente.
          </span>
        </div>
      )}
    </div>
  );
}
