import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Filter, Calendar } from 'lucide-react';

export default function ReportsModule({ users }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getAttendance(dateRange.start, dateRange.end);
      if (res.success) {
        setHistory(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  // Aggregate Data
  const aggregatedData = React.useMemo(() => {
    const userStats = {};
    users.forEach(u => {
      userStats[u.full_name] = { name: u.full_name, Asistencias: 0, Tardanzas: 0 };
    });

    history.forEach(rec => {
      const name = rec.user_name || 'Desconocido';
      if (!userStats[name]) userStats[name] = { name, Asistencias: 0, Tardanzas: 0 };
      
      if (rec.type === 'entry') {
        userStats[name].Asistencias += 1;
        if (!rec.is_valid) userStats[name].Tardanzas += 1;
      }
    });

    return Object.values(userStats).filter(u => u.Asistencias > 0 || u.Tardanzas > 0).sort((a,b) => b.Asistencias - a.Asistencias);
  }, [history, users]);

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={24} color="var(--primary)" />
          Reportes Visuales
        </h2>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Desde:</label>
            <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hasta:</label>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto' }}>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando datos...</div>
        ) : aggregatedData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay datos para el rango seleccionado.</div>
        ) : (
          <div style={{ width: '100%', height: '400px' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-muted)' }}>Asistencias y Tardanzas por Colaborador</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregatedData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} angle={-45} textAnchor="end" />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="Asistencias" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tardanzas" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        
      </div>
      
    </div>
  );
}
