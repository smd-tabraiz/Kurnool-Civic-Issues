import { useState, useEffect } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { FileText, Clock, TrendingUp, CheckCircle, AlertTriangle, Trash2, Eye, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCategoryIcon, timeAgo, getImageUrl } from '../utils/helpers';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function AdminDashboard() {
  const socket = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null); // stores issueId being confirmed
  const [confirmSpam, setConfirmSpam] = useState(null);
  const [filter, setFilter] = useState({ status: 'all', page: 1 });
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filteredIssues = priorityFilter === 'all'
    ? issues
    : issues.filter(i => i.priority === priorityFilter);

  useEffect(() => { 
    fetchIssues();
    fetchAnalytics(); 
    
    if (socket) {
      // Listen for real-time updates from other admins or AI
      socket.on('statusUpdate', fetchIssues);
      socket.on('newIssue', fetchIssues);
      socket.on('issueUpdated', fetchIssues);
      socket.on('issueDeleted', fetchIssues);
      
      return () => {
        socket.off('statusUpdate', fetchIssues);
        socket.off('newIssue', fetchIssues);
        socket.off('issueUpdated', fetchIssues);
        socket.off('issueDeleted', fetchIssues);
      };
    }
  }, [filter, socket]);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/issues/analytics');
      setAnalytics(res.data.data);
    } catch (e) {}
    setLoading(false);
  };

  const fetchIssues = async () => {
    try {
      const res = await api.get('/issues', { 
        params: { 
          status: filter.status === 'all' ? undefined : filter.status,
          page: filter.page,
          limit: 100 // High limit for admin
        } 
      });
      if (res.data.success) {
        setIssues(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch issues:', e);
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Title', 'Category', 'Location', 'Status', 'Priority', 'Upvotes'];
    
    const csvData = filteredIssues.map(i => [
      i._id, 
      `"${i.title.replace(/"/g, '""')}"`, 
      i.issueType, 
      `"${i.location?.area || ''}"`, 
      i.status, 
      i.priority, 
      i.upvoteCount
    ]);
    
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kurnool_issues_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handleStatusUpdate = async (issueId, status) => {
    if (!user) return;
    try {
      const formData = new FormData();
      formData.append('status', status);
      formData.append('message', `Admin ${user.name} updated status to ${status}`);
      
      const res = await api.put(`/issues/${issueId}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        fetchIssues();
      } else {
        alert('Failed: ' + res.data.message);
      }
    } catch (e) {
      console.error('Update failed:', e);
      alert('Failed: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleDelete = async (issueId) => {
    console.log('handleDelete confirmed for:', issueId);
    try {
      const res = await api.delete(`/issues/${issueId}`);
      if (res.data.success) {
        setConfirmDelete(null);
        fetchIssues();
        fetchAnalytics();
      } else {
        alert('Failed to delete: ' + (res.data.message || 'Unknown error'));
      }
    } catch (e) {
      console.error('Delete failed:', e);
      alert('Error deleting issue: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleSpam = async (issueId) => {
    console.log('handleSpam confirmed for:', issueId);
    try {
      await api.put(`/issues/${issueId}/spam`);
      setConfirmSpam(null);
      fetchIssues();
    } catch (e) {}
  };

  if (loading) return <div className="main-content"><div className="loading-center"><div className="spinner" /></div></div>;

  const ov = analytics?.overview || {};
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const categoryChartData = {
    labels: (analytics?.categoryStats || []).map(c => c._id),
    datasets: [{
      data: (analytics?.categoryStats || []).map(c => c.count),
      backgroundColor: ['#f59e0b', '#eab308', '#06b6d4', '#ec4899', '#84cc16', '#8b5cf6'],
      borderWidth: 0,
    }],
  };

  const locationChartData = {
    labels: (analytics?.locationStats || []).map(l => l._id).slice(0, 10),
    datasets: [{
      label: 'Issues',
      data: (analytics?.locationStats || []).map(l => l.count).slice(0, 10),
      backgroundColor: 'rgba(99, 102, 241, 0.7)',
      borderRadius: 8,
    }],
  };

  // Ensure 6 months are always populated with 0 if no data
  const populatedTrends = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const existing = (analytics?.monthlyTrends || []).find(t => t._id.month === m && t._id.year === y);
    populatedTrends.push({ month: m, year: y, count: existing ? existing.count : 0 });
  }

  const trendData = {
    labels: populatedTrends.map(t => months[t.month - 1] + ' ' + t.year),
    datasets: [{
      label: 'Issues reported',
      data: populatedTrends.map(t => t.count),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
    }],
  };

  const chartOptions = { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };

  return (
    <div className="main-content page-enter">
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>📊 Admin Dashboard</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Manage and monitor civic issues across Kurnool district</p>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab-item ${tab === 'issues' ? 'active' : ''}`} onClick={() => setTab('issues')}>Manage Issues</button>
        <button className={`tab-item ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
      </div>

      {tab === 'overview' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon total"><FileText size={24} /></div><div><div className="stat-value">{ov.total || 0}</div><div className="stat-label">Total Issues</div></div></div>
            <div className="stat-card"><div className="stat-icon pending"><Clock size={24} /></div><div><div className="stat-value">{ov.pending || 0}</div><div className="stat-label">Pending</div></div></div>
            <div className="stat-card"><div className="stat-icon progress"><TrendingUp size={24} /></div><div><div className="stat-value">{ov.inProgress || 0}</div><div className="stat-label">In Progress</div></div></div>
            <div className="stat-card"><div className="stat-icon resolved"><CheckCircle size={24} /></div><div><div className="stat-value">{ov.resolved || 0}</div><div className="stat-label">Resolved</div></div></div>
          </div>

          {/* Priority Risk Filter */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} style={{ color: 'var(--status-pending)' }} /> Filter by Risk Level
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { key: 'all', label: '🔵 All Issues', color: 'var(--accent)' },
                { key: 'urgent', label: '🔴 Urgent', color: '#dc2626' },
                { key: 'high', label: '🟠 High', color: '#ea580c' },
                { key: 'medium', label: '🟡 Medium', color: '#ca8a04' },
                { key: 'low', label: '🟢 Low', color: '#16a34a' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setPriorityFilter(p.key)}
                  className="btn btn-sm"
                  style={{
                    background: priorityFilter === p.key ? p.color : 'var(--bg-primary)',
                    color: priorityFilter === p.key ? '#fff' : 'var(--text-primary)',
                    border: `1.5px solid ${priorityFilter === p.key ? p.color : 'var(--border)'}`,
                    fontWeight: 600,
                  }}
                >
                  {p.label}
                  {p.key !== 'all' && (
                    <span style={{
                      background: priorityFilter === p.key ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                      padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: 12, marginLeft: 4,
                    }}>
                      {(analytics?.priorityStats || []).find(s => s._id === p.key)?.count || 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Priority Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { key: 'urgent', label: 'Urgent', icon: '🚨', color: '#dc2626', bg: '#fef2f2' },
                { key: 'high', label: 'High Risk', icon: '⚠️', color: '#ea580c', bg: '#fff7ed' },
                { key: 'medium', label: 'Medium', icon: '📋', color: '#ca8a04', bg: '#fefce8' },
                { key: 'low', label: 'Low', icon: '✅', color: '#16a34a', bg: '#f0fdf4' },
              ].map(p => {
                const count = (analytics?.priorityStats || []).find(s => s._id === p.key)?.count || 0;
                return (
                  <div key={p.key} onClick={() => setPriorityFilter(p.key)} style={{
                    padding: '16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    background: priorityFilter === p.key ? p.bg : 'var(--bg-primary)',
                    border: priorityFilter === p.key ? `2px solid ${p.color}` : '2px solid transparent',
                    transition: 'all 0.2s', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 24 }}>{p.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: p.color }}>{count}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{p.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Filtered Issues List */}
            {filteredIssues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
                No {priorityFilter === 'all' ? '' : priorityFilter} issues found
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {filteredIssues.map(i => (
                  <div key={i._id} onClick={() => navigate(`/issue/${i._id}`)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 16px', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', borderRadius: 'var(--radius-sm)', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span>{getCategoryIcon(i.issueType)} {i.issueType}</span>
                        <span>📍 {i.location?.area}</span>
                        <span>👍 {i.upvoteCount} upvotes</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <span className={`badge-status ${i.status === 'pending' ? 'badge-pending' : i.status === 'in-progress' ? 'badge-in-progress' : 'badge-resolved'}`}>
                        {i.status?.replace('-', ' ')}
                      </span>
                      <span className={`badge-priority badge-${i.priority}`} style={{
                        background: i.priority === 'urgent' ? '#fef2f2' : i.priority === 'high' ? '#fff7ed' : i.priority === 'medium' ? '#fefce8' : '#f0fdf4',
                        color: i.priority === 'urgent' ? '#dc2626' : i.priority === 'high' ? '#ea580c' : i.priority === 'medium' ? '#ca8a04' : '#16a34a',
                        border: `1px solid ${i.priority === 'urgent' ? '#fecaca' : i.priority === 'high' ? '#fed7aa' : i.priority === 'medium' ? '#fde68a' : '#bbf7d0'}`,
                      }}>
                        {i.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
              Showing {filteredIssues.length} of {issues.length} issues
            </div>
          </div>
        </>
      )}

      {tab === 'issues' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'pending', 'in-progress', 'resolved'].map(s => (
                <button key={s} className={`btn btn-sm ${filter.status === s ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilter({ ...filter, status: s })}>{s === 'all' ? 'All' : s.replace('-', ' ')}</button>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={exportToCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> Export to CSV
            </button>
          </div>

          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 700 }}>Proof</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 700 }}>Title</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 700 }} className="hide-mobile">Type</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 700 }} className="hide-tablet">Location</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 700 }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 700 }} className="hide-mobile">Priority</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 700 }} className="hide-mobile">Upvotes</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 700 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(i => {
                  const sc = i.status === 'pending' ? 'badge-pending' : i.status === 'in-progress' ? 'badge-in-progress' : 'badge-resolved';
                  return (
                    <tr key={i._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px' }}>
                        {i.image ? (
                          <img src={getImageUrl(i.image)} alt="proof" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10 }}>No pic</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div>{i.title}</div>
                        <div className="show-mobile" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{i.issueType} • {i.location?.area}</div>
                      </td>
                      <td style={{ padding: '12px 8px' }} className="hide-mobile"><span className={`badge-category badge-${i.issueType}`}>{getCategoryIcon(i.issueType)} {i.issueType}</span></td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }} className="hide-tablet">{i.location?.area}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className={`badge-status ${sc}`}>
                          {i.status?.replace('-', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }} className="hide-mobile">
                        <span className={`badge-priority badge-${i.priority}`} style={{
                          background: i.priority === 'urgent' ? '#fef2f2' : i.priority === 'high' ? '#fff7ed' : i.priority === 'medium' ? '#fefce8' : '#f0fdf4',
                          color: i.priority === 'urgent' ? '#dc2626' : i.priority === 'high' ? '#ea580c' : i.priority === 'medium' ? '#ca8a04' : '#16a34a',
                          border: `1px solid ${i.priority === 'urgent' ? '#fecaca' : i.priority === 'high' ? '#fed7aa' : i.priority === 'medium' ? '#fde68a' : '#bbf7d0'}`,
                        }}>
                          {i.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }} className="hide-mobile">{i.upvoteCount}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {i.status === 'pending' && (
                            <button className="btn btn-sm" onClick={() => handleStatusUpdate(i._id, 'in-progress')} 
                              style={{ padding: '4px 8px', background: '#3b82f6', color: '#fff', fontSize: 12, border: 'none' }} title="Start Work">
                              In Progress
                            </button>
                          )}
                          {i.status !== 'resolved' && (
                            <button className="btn btn-sm" onClick={() => handleStatusUpdate(i._id, 'resolved')} 
                              style={{ padding: '4px 8px', background: '#22c55e', color: '#fff', fontSize: 12, border: 'none' }} title="1-Click Resolve">
                              <CheckCircle size={14} style={{ marginRight: 4 }} /> Resolve
                            </button>
                          )}
                          <button className="icon-btn" onClick={() => navigate(`/issue/${i._id}`)} title="View Detail"><Eye size={16} /></button>
                          {confirmSpam === i._id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', animation: 'fadeIn 0.2s' }}>
                              <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 11, background: 'var(--cat-road)', color: '#fff' }} onClick={(e) => { e.stopPropagation(); handleSpam(i._id); }}>Confirm Spam</button>
                              <button className="btn btn-sm btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setConfirmSpam(null); }}>Cancel</button>
                            </div>
                          ) : (
                            <button className="icon-btn hide-mobile" onClick={(e) => { e.stopPropagation(); setConfirmSpam(i._id); }} title="Mark spam" style={{ color: 'var(--cat-road)', cursor: 'pointer' }}><AlertTriangle size={16} /></button>
                          )}
                          
                          {confirmDelete === i._id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', animation: 'fadeIn 0.2s' }}>
                              <button className="btn btn-sm btn-danger" style={{ padding: '2px 8px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); handleDelete(i._id); }}>Confirm</button>
                              <button className="btn btn-sm btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}>Cancel</button>
                            </div>
                          ) : (
                            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setConfirmDelete(i._id); }} title="Delete" style={{ color: 'var(--status-pending)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="charts-grid">
          <div className="chart-card">
            <h3>📊 Issues by Category</h3>
            <div style={{ maxWidth: 300, margin: '0 auto' }}>
              <Doughnut data={categoryChartData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
            </div>
          </div>
          <div className="chart-card">
            <h3>📍 Issues by Location (Top 10)</h3>
            <Bar data={locationChartData} options={chartOptions} />
          </div>
          <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
            <h3>📈 Monthly Trends</h3>
            <Line data={trendData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
