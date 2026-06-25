import { UserCircle2, Edit2 } from 'lucide-react';

export default function UserCard({ user, onEdit }) {
  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <UserCircle2 size={30} color="var(--primary)" />
        <div>
          <div style={{ fontWeight: '600' }}>{user.full_name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{user.username}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>
          {user.role === 'admin' ? 'Administrador' : 'Técnico'}
        </div>
        <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => onEdit(user)}>
          <Edit2 size={14} /> Editar
        </button>
      </div>
    </div>
  );
}
