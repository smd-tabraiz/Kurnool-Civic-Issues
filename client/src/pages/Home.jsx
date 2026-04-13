import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import IssueCard from '../components/IssueCard';
import { Search, PlusCircle, AlertTriangle, TrendingUp, CheckCircle, Clock, Globe, User, Crown, Award } from 'lucide-react';
import api from '../services/api';

export default function Home() {
  const { user } = useAuth();
  const socket = useSocket();
  const [issues, setIssues] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({ search: '', issueType: 'all', status: 'all', location: '', sort: '-createdAt' });
  const [viewScope, setViewScope] = useState('all');
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0 });

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (filters.search) params.set('search', filters.search);
      if (filters.issueType !== 'all') params.set('issueType', filters.issueType);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.location) params.set('location', filters.location);
      if (filters.sort) params.set('sort', filters.sort);
      if (viewScope === 'mine' && user?._id) params.set('reportedBy', user._id);

      const res = await api.get(`/issues?${params}`);
      setIssues(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [page, filters, viewScope, user]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/issues/analytics');
      setStats(res.data.data.overview);
    } catch (e) { /* ignore */ }
    
    try {
      const lbRes = await api.get('/auth/leaderboard');
      setLeaderboard(lbRes.data.data || []);
    } catch (e) {}
  };

  useEffect(() => { fetchIssues(); }, [fetchIssues]);
  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    if (socket) {
      socket.on('newIssue', (issue) => {
        setIssues(prev => [issue, ...prev]);
      });
      socket.on('issueDeleted', ({ issueId }) => {
        setIssues(prev => prev.filter(i => i._id !== issueId));
      });
      socket.on('statusUpdate', (data) => {
        setIssues(prev => prev.map(i => i._id === data.issueId ? { ...i, status: data.status } : i));
      });
      socket.on('issueUpdated', (data) => {
        fetchStats(); // Update stats if priority or major changes occur
        
        setIssues(prev => prev.map(i => {
           if (i._id === data.issueId) {
              const newUpvotes = data.hasUpvoted ? [...(i.upvotes || []), user?._id] : (i.upvotes || []).filter(u => u !== user?._id);
              return { ...i, upvoteCount: data.upvoteCount, priority: data.priority, upvotes: newUpvotes };
           }
           return i;
        }));
      });
      
      return () => { 
        socket.off('newIssue'); 
        socket.off('issueDeleted'); 
        socket.off('statusUpdate');
        socket.off('issueUpdated');
      };
    }
  }, [socket]);

  const handleUpvoteUpdate = (issueId, data) => {
    setIssues(prev => prev.map(i => {
      if (i._id === issueId) {
        const upvotes = data.hasUpvoted
          ? [...(i.upvotes || []), user._id]
          : (i.upvotes || []).filter(id => id !== user._id);
        return { ...i, upvoteCount: data.upvoteCount, upvotes, priority: data.priority };
      }
      return i;
    }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="main-content page-enter">
      {/* Hero Section */}
      <div className="hero-section">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1>🏛️ Kurnool Civic Reporter</h1>
          <p>Empowering citizens of Kurnool district to report and track civic issues. Together, let's build a better community.</p>
          <Link to="/report" className="btn btn-primary btn-lg" id="hero-report-btn">
            <PlusCircle size={18} /> Report an Issue
          </Link>
          <div className="hero-stats">
            <div><div className="hero-stat-value">{stats.total || 0}</div><div className="hero-stat-label">Total Issues</div></div>
            <div><div className="hero-stat-value">{stats.pending || 0}</div><div className="hero-stat-label">Pending</div></div>
            <div><div className="hero-stat-value">{stats.inProgress || 0}</div><div className="hero-stat-label">In Progress</div></div>
            <div><div className="hero-stat-value">{stats.resolved || 0}</div><div className="hero-stat-label">Resolved</div></div>
          </div>
        </div>
      </div>
      
      {/* Scope Tabs */}
      <div className="tab-bar" style={{ marginTop: 24, marginBottom: 16 }}>
        <button className={`tab-item ${viewScope === 'all' ? 'active' : ''}`} onClick={() => { setViewScope('all'); setPage(1); }}>
          <Globe size={16} /> Globally Reported
        </button>
        <button className={`tab-item ${viewScope === 'mine' ? 'active' : ''}`} onClick={() => { setViewScope('mine'); setPage(1); }}>
          <User size={16} /> My Reports
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} />
          <input id="search-input" placeholder="Search issues..." value={filters.search} onChange={e => handleFilterChange('search', e.target.value)} />
        </div>
        <select id="filter-type" className="filter-select" value={filters.issueType} onChange={e => handleFilterChange('issueType', e.target.value)}>
          <option value="all">All Types</option>
          <option value="road">🛣️ Road</option>
          <option value="power">⚡ Power</option>
          <option value="water">💧 Water</option>
          <option value="health">🏥 Health</option>
          <option value="sanitation">🧹 Sanitation</option>
          <option value="other">📋 Other</option>
        </select>
        <select id="filter-status" className="filter-select" value={filters.status} onChange={e => handleFilterChange('status', e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">🔴 Pending</option>
          <option value="in-progress">🔵 In Progress</option>
          <option value="resolved">🟢 Resolved</option>
        </select>
        <select id="filter-sort" className="filter-select" value={filters.sort} onChange={e => handleFilterChange('sort', e.target.value)}>
          <option value="-createdAt">✨ Latest Updates</option>
          <option value="-upvoteCount">🔥 Top Voted</option>
          <option value="createdAt">⏳ Oldest First</option>
        </select>
      </div>

      {/* Main Grid Layout for Feed and Leaderboard */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Left Column: Feed */}
        <div style={{ flex: '1 1 500px', minWidth: 0 }}>
          {loading ? (
            <div className="skeleton-feed">
              {[1,2,3].map(n => (
                <div key={n} className="issue-card skeleton-card" style={{ padding: 24, paddingBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div className="skeleton-avatar" style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--border)' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ width: '40%', height: 16, background: 'var(--border)', borderRadius: 4, marginBottom: 8 }}></div>
                      <div style={{ width: '20%', height: 12, background: 'var(--border)', borderRadius: 4 }}></div>
                    </div>
                  </div>
                  <div style={{ width: '80%', height: 20, background: 'var(--border)', borderRadius: 4, marginBottom: 12 }}></div>
                  <div style={{ width: '100%', height: 16, background: 'var(--border)', borderRadius: 4, marginBottom: 8 }}></div>
                  <div style={{ width: '90%', height: 16, background: 'var(--border)', borderRadius: 4, marginBottom: 16 }}></div>
                  <div style={{ width: '100%', height: 180, background: 'var(--border)', borderRadius: 12 }}></div>
                </div>
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle size={64} />
              <h3>No issues found</h3>
              <p>Be the first to report an issue in your area!</p>
              <Link to="/report" className="btn btn-primary" style={{ marginTop: 16 }}><PlusCircle size={16} /> Report Issue</Link>
            </div>
          ) : (
            <>
              {issues.map(issue => (
                <IssueCard key={issue._id} issue={issue} onUpdate={handleUpvoteUpdate} />
              ))}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                  <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                  <span style={{ padding: '8px 16px', fontSize: 14, color: 'var(--text-muted)' }}>Page {page} of {pagination.pages}</span>
                  <button className="btn btn-secondary btn-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Column: Civic Leaderboard */}
        <div style={{ flex: '0 0 300px', width: '100%' }} className="hide-mobile hide-tablet">
          <div className="card" style={{ position: 'sticky', top: 24, padding: '20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ padding: 8, background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '50%' }}>
                <Award size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Civic Champions</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              Top citizens earning Civic Karma points by actively reporting verified problems in Kurnool.
            </p>
            
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                No points awarded yet.<br />Be the first!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {leaderboard.map((userObj, idx) => (
                  <div key={userObj._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: idx !== leaderboard.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: idx <= 2 ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>
                        {idx === 0 ? <Crown size={14} /> : `#${idx + 1}`}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{userObj.name.split(' ')[0]}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {userObj.location?.split(',')[0]}</div>
                      </div>
                    </div>
                    <div style={{ background: 'var(--status-resolved-bg)', color: 'var(--status-resolved)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      {userObj.civicPoints} pts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
