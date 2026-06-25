import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Users, UserCheck, UserX, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';

export default function LiveDashboard({ users, stats }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchTodayData = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await api.getAttendance(today, today);
      if (res.success) {
        setAttendance(res.data);
      }
    } catch (e) {
      console.error('Error fetching today attendance:', e);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  useEffect(() => {
    fetchTodayData();
    const interval = setInterval(fetchTodayData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Compute daily metrics from attendance
  const uniqueUsersToday = new Set(attendance.map(a => a.user_id || a.user_name)).size;
  const totalUsers = users.length;
  const absentUsers = Math.max(0, totalUsers - uniqueUsersToday);
  const entries = attendance.filter(a => a.type === 'entry').length;
  const exits = attendance.filter(a => a.type === 'exit').length;
  const lates = attendance.filter(a => a.type === 'entry' && !a.is_valid).length;

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];
  const pieData = [
    { name: 'Presentes', value: uniqueUsersToday },
    { name: 'Ausentes', value: absentUsers }
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto', paddingBottom: '2rem' }}>
      
      {/* Top Cards KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Total Colaboradores</span>
            <Users size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>{totalUsers}</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Presentes Hoy</span>
            <UserCheck size={20} color="var(--success)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success)' }}>{uniqueUsersToday}</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Ausentes</span>
            <UserX size={20} color="var(--danger)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--danger)' }}>{absentUsers}</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Marcaciones (E/S)</span>
            <Clock size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>{entries} / {exits}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Main Chart */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '600' }}>Tendencia Semanal de Asistencia</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPresentes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                />
                <Area type="monotone" dataKey="presentes" stroke="var(--primary)" fillOpacity={1} fill="url(#colorPresentes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart / Extra Stats */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '600' }}>Distribución de Hoy</h3>
          <div style={{ flex: 1, minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--success)' : 'var(--danger)'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={24} color="var(--danger)" />
            <div>
              <div style={{ fontWeight: '600', color: 'var(--danger)' }}>{lates} Llegadas Tardías</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registradas hoy fuera de rango/hora</div>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
