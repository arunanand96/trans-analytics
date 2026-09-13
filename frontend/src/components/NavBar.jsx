import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { auth, logout } = useAuth();

  return (
    <div style={styles.bar}>
      <div style={styles.links}>
        <NavLink to="/upload" style={linkStyle}>Upload</NavLink>
        <NavLink to="/review" style={linkStyle}>Review Queue</NavLink>
        <NavLink to="/passengers" style={linkStyle}>Passengers</NavLink>
        <NavLink to="/analytics" style={linkStyle}>Analytics</NavLink>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, color: '#666', marginRight: 12 }}>{auth?.user?.email}</span>
        <button onClick={logout} style={styles.logoutBtn}>Log out</button>
      </div>
    </div>
  );
}

function linkStyle({ isActive }) {
  return {
    marginRight: 20,
    textDecoration: 'none',
    fontWeight: isActive ? 700 : 400,
    color: isActive ? '#111827' : '#6b7280',
  };
}

const styles = {
  bar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    borderBottom: '1px solid #e5e7eb',
    fontFamily: 'sans-serif',
  },
  links: { display: 'flex' },
  logoutBtn: {
    fontSize: 12, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0,
  },
};
