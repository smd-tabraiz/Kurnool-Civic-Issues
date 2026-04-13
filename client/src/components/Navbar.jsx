import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { getInitials } from '../utils/helpers';
import { Home, PlusCircle, Map, BarChart3, Bell, Sun, Moon, LogOut, User, Menu, X } from 'lucide-react';
import api from '../services/api';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const socket = useSocket();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const dropRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('notification', (notif) => {
        setNotifications(prev => [notif, ...prev]);
        setUnreadCount(c => c + 1);
      });
    }
  }, [socket]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=10');
      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch (e) { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) { /* ignore */ }
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="navbar-logo">K</div>
        <div className="navbar-title">Kurnool <span>Civic</span></div>
      </Link>

      <div className={`navbar-nav ${mobileNav ? 'open' : ''}`}>
        <Link to="/" className={`nav-link ${isActive('/')}`} onClick={() => setMobileNav(false)}>
          <Home size={16} /> Feed
        </Link>
        <Link to="/report" className={`nav-link ${isActive('/report')}`} onClick={() => setMobileNav(false)}>
          <PlusCircle size={16} /> Report
        </Link>
        <Link to="/map" className={`nav-link ${isActive('/map')}`} onClick={() => setMobileNav(false)}>
          <Map size={16} /> Map
        </Link>
        {isAdmin && (
          <Link to="/admin" className={`nav-link ${isActive('/admin')}`} onClick={() => setMobileNav(false)}>
            <BarChart3 size={16} /> Admin
          </Link>
        )}
      </div>

      <div className="navbar-actions">
        <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div ref={notifRef} style={{ position: 'relative' }}>
          <button className="icon-btn" onClick={() => setNotifOpen(!notifOpen)}>
            <Bell size={18} />
            {unreadCount > 0 && <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <div className={`notif-dropdown ${notifOpen ? 'open' : ''}`}>
            <div className="notif-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>}
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                No notifications yet
              </div>
            ) : notifications.map((n, i) => (
              <div key={n._id || i} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                <div className="notif-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  <Bell size={16} />
                </div>
                <div>
                  <div className="notif-title">{n.title || 'Notification'}</div>
                  <div className="notif-msg">{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div ref={dropRef} className="user-menu">
          <div className="user-avatar" onClick={() => setDropdownOpen(!dropdownOpen)}>
            {getInitials(user?.name)}
          </div>
          <div className={`dropdown-menu ${dropdownOpen ? 'open' : ''}`}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{user?.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</div>
              {isAdmin && <span className="badge-status badge-in-progress" style={{ marginTop: '4px', display: 'inline-block' }}>Admin</span>}
            </div>
            <div className="dropdown-divider" />
            <button className="dropdown-item" onClick={() => { logout(); setDropdownOpen(false); }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

        <button className="icon-btn mobile-menu-btn" onClick={() => setMobileNav(!mobileNav)}>
          {mobileNav ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </nav>
  );
}
