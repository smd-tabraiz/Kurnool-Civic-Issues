import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ThumbsUp, MessageCircle, Share2, MapPin, Clock, Send, ArrowLeft, Trash2, Shield, CheckCircle, Camera } from 'lucide-react';
import { getInitials, timeAgo, formatDate, getCategoryIcon, getImageUrl } from '../utils/helpers';
import api from '../services/api';

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolutionPhoto, setResolutionPhoto] = useState(null);

  useEffect(() => {
    fetchIssue();
    fetchComments();
  }, [id]);

  // Socket-based real-time updates (listening only — push events)
  useEffect(() => {
    if (!socket) return;
    
    const onStatusUpdate = (data) => {
      if (data.issueId === id || data.issueId?.toString() === id) {
        // Re-fetch the full issue so we get populated fields
        fetchIssue();
      }
    };
    
    const onIssueUpdated = (data) => {
      if (data.issueId === id || data.issueId?.toString() === id) {
        setIssue(prev => prev ? ({ ...prev, upvoteCount: data.upvoteCount, priority: data.priority }) : prev);
      }
    };
    
    const onNewComment = (comment) => {
      if (comment.issue === id) {
        setComments(prev => [comment, ...prev]);
        setIssue(prev => prev ? ({ ...prev, commentCount: (prev.commentCount || 0) + 1 }) : prev);
      }
    };
    
    socket.on('statusUpdate', onStatusUpdate);
    socket.on('issueUpdated', onIssueUpdated);
    socket.on('newComment', onNewComment);
    
    return () => {
      socket.off('statusUpdate', onStatusUpdate);
      socket.off('issueUpdated', onIssueUpdated);
      socket.off('newComment', onNewComment);
    };
  }, [id, socket]);

  const fetchIssue = async () => {
    try {
      const res = await api.get(`/issues/${id}`);
      if (res.data.success) {
        setIssue(res.data.data);
      } else {
        navigate('/');
      }
    } catch (e) {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await api.get(`/comments/${id}`);
      if (res.data.success) setComments(res.data.data);
    } catch (e) {}
  };

  const handleUpvote = async () => {
    if (!user) return;
    try {
      const res = await api.put(`/issues/${id}/upvote`);
      if (res.data.success) {
        setIssue(prev => ({
          ...prev,
          upvoteCount: res.data.data.upvoteCount,
          upvotes: res.data.data.hasUpvoted
            ? [...(prev.upvotes || []), user._id]
            : (prev.upvotes || []).filter(uid => uid !== user._id),
          priority: res.data.data.priority,
        }));
      }
    } catch (e) {
      console.error('Upvote failed:', e);
    }
  };

  const handleComment = (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    setSubmitting(true);
    
    socket.emit('add_comment', { issueId: id, userId: user._id, text: commentText, isOfficial: user.role === 'admin' }, (res) => {
      if (res && res.success) {
        setCommentText('');
      }
      setSubmitting(false);
    });
  };

  const handleStatusUpdate = async (status) => {
    // Relying on a fixed system string instead of blocking prompt
    const msg = `Status updated to ${status}`;
    
    console.log(`Sending status update: ${status}`, { msg, resolutionPhoto });
    const formData = new FormData();
    formData.append('status', status);
    formData.append('message', msg);
    
    // Only send the image if we're actually resolving
    if (status === 'resolved' && resolutionPhoto) {
      formData.append('image', resolutionPhoto);
    }
    
    try {
      const res = await api.put(`/issues/${id}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log('Status update response:', res.data);
      if (res.data.success) {
        setIssue(res.data.data);
        if (status === 'resolved') {
          setResolutionPhoto(null);
        }
      } else {
        alert('Status update failed: ' + (res.data.message || 'Unknown error'));
      }
    } catch (e) {
      console.error('Status update failed error:', e);
      alert('Failed to update status: ' + (e.response?.data?.message || e.message));
    }
  };

  if (loading) return <div className="main-content"><div className="loading-center"><div className="spinner" /></div></div>;
  if (!issue) return null;

  const hasUpvoted = issue.upvotes?.includes(user?._id);
  const statusClass = issue.status === 'pending' ? 'badge-pending' : issue.status === 'in-progress' ? 'badge-in-progress' : 'badge-resolved';

  return (
    <div className="main-content page-enter">
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="detail-grid">
        {/* Main Content */}
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div className="issue-user">
                <div className="issue-user-avatar">{getInitials(issue.reportedBy?.name)}</div>
                <div className="issue-user-info">
                  <h4>{issue.reportedBy?.name}</h4>
                  <p><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {timeAgo(issue.createdAt)} · <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {issue.location?.area}</p>
                </div>
              </div>
              <span className={`badge-status ${statusClass}`}>{issue.status?.replace('-', ' ')}</span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>{issue.title}</h1>
            
            {user?.role === 'admin' ? (
              <>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                  <strong>Original Text:</strong> {issue.originalDescription || issue.description}
                </p>
                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>🤖 AI Translated & Classified</p>
                  <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{issue.description}</p>
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {issue.originalDescription || issue.description}
              </p>
            )}

            {issue.image && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>Original Report Image</h4>
                <img src={getImageUrl(issue.image)} alt={issue.title} style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />
              </div>
            )}
            
            {issue.resolvedImage && (
              <div style={{ 
                padding: '20px', 
                background: 'linear-gradient(to bottom right, #f0fdf4, #dcfce7)', 
                border: '3px solid #22c55e', 
                borderRadius: 'var(--radius-lg)', 
                marginBottom: 24,
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.15)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 12px', background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: '0 0 0 8px' }}>VERIFIED FIX</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: '#166534' }}>
                  <div style={{ background: '#22c55e', color: '#fff', padding: 6, borderRadius: '50%' }}>
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Official Resolution Proof</h4>
                    <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Uploaded by municipal authorities</p>
                  </div>
                </div>
                <img 
                  src={getImageUrl(issue.resolvedImage)} 
                  alt="Fixed Issue Proof" 
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} 
                  onLoad={() => console.log('Resolution image loaded successfully:', issue.resolvedImage)}
                  onError={(e) => {
                    console.error('Resolution image failed to load:', issue.resolvedImage);
                    e.target.src = 'https://placehold.co/600x400?text=Proof+Image+Not+Found';
                  }}
                />
              </div>
            )}

            <div className="issue-meta">
              <span className={`badge-category badge-${issue.issueType}`}>{getCategoryIcon(issue.issueType)} {issue.issueType}</span>
              {(issue.priority === 'high' || issue.priority === 'urgent') && (
                <span className={`badge-priority badge-${issue.priority}`}>🚨 {issue.priority}</span>
              )}
              {issue.autoClassified && <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-full)' }}>🧠 AI classified</span>}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className={`action-btn ${hasUpvoted ? 'upvoted' : ''}`} onClick={handleUpvote}>
                <ThumbsUp size={16} /> {issue.upvoteCount || 0} Upvotes
              </button>
              <span className="action-btn"><MessageCircle size={16} /> {issue.commentCount || 0} Comments</span>
              <button className="action-btn" onClick={() => navigator.clipboard.writeText(window.location.href)}>
                <Share2 size={16} /> Share
              </button>
            </div>

            {/* Admin Controls */}
            {user?.role === 'admin' && (
              <div style={{ marginTop: 20, padding: '16px', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14} /> Admin Actions</h4>
                <div className="admin-actions-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', position: 'relative', zIndex: 10 }}>
                  <button className="btn btn-sm" style={{ background: 'var(--status-pending)', color: '#fff', position: 'relative', zIndex: 15 }} onClick={() => handleStatusUpdate('pending')}>Set Pending</button>
                  <button className="btn btn-sm" style={{ background: 'var(--status-progress)', color: '#fff', position: 'relative', zIndex: 15 }} onClick={() => handleStatusUpdate('in-progress')}>Set In Progress</button>
                  <button className="btn btn-sm" style={{ background: 'var(--status-resolved)', color: '#fff', position: 'relative', zIndex: 15 }} onClick={() => handleStatusUpdate('resolved')}>Set Resolved</button>
                  
                  <div style={{ display: 'flex', border: '2px solid var(--status-resolved)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginLeft: 'auto', position: 'relative', zIndex: 15 }}>
                    <label className="btn btn-sm" style={{ background: '#fff', color: 'var(--status-resolved)', borderRadius: 0, margin: 0, borderRight: '1px solid var(--status-resolved)', cursor: 'pointer' }} title="Attach Fixed Photo">
                      <input type="file" accept="image/*" style={{ display: 'none' }} onClick={(e) => { e.stopPropagation(); }} onChange={(e) => setResolutionPhoto(e.target.files[0])} />
                      <Camera size={14} style={{ marginRight: 6 }} /> {resolutionPhoto ? 'Photo Added!' : 'Attach Proof'}
                    </label>
                    <button 
                      className="btn btn-sm" 
                      style={{ background: 'var(--status-resolved)', color: '#fff', borderRadius: 0, opacity: resolutionPhoto ? 1 : 0.7 }} 
                      onClick={() => handleStatusUpdate('resolved')}
                      title={resolutionPhoto ? "Resolve with proof" : "Please attach proof photo first"}
                    >
                      Process with Proof
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="card">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>💬 Comments ({comments.length})</h3>

            <form onSubmit={handleComment} className="comment-box">
              <div className="issue-user-avatar" style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>{getInitials(user?.name)}</div>
              <div className="comment-input-wrap">
                <input placeholder="Write a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !commentText.trim()}>
                  <Send size={14} />
                </button>
              </div>
            </form>

            {comments.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 14 }}>No comments yet. Be the first!</p>
            ) : comments.map(c => (
              <div key={c._id} className="comment-item">
                <div className="issue-user-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{getInitials(c.user?.name)}</div>
                <div className={`comment-body ${c.isOfficial ? 'official' : ''}`}>
                  <div className="comment-author">
                    {c.user?.name} {c.isOfficial && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>• Official Response</span>}
                  </div>
                  <div className="comment-text">{c.text}</div>
                  <div className="comment-time">{timeAgo(c.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="detail-sidebar">
          <div className="card">
            <h3>📍 Location Details</h3>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              <p><strong>Area:</strong> {issue.location?.area}</p>
              <p><strong>District:</strong> {issue.location?.district}</p>
              <p><strong>State:</strong> {issue.location?.state}</p>
              {issue.location?.coordinates?.lat && (
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  📌 {issue.location.coordinates.lat.toFixed(4)}, {issue.location.coordinates.lng.toFixed(4)}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <h3>📋 Status Timeline</h3>
            <div className="timeline">
              {issue.timeline?.map((entry, i) => (
                <div key={i} className="timeline-item">
                  <div className={`timeline-dot ${entry.status}`} />
                  <div className="timeline-content">
                    <h4>{entry.status.replace('-', ' ')}</h4>
                    <p>{entry.message}</p>
                    {entry.image && (
                      <img src={getImageUrl(entry.image)} alt="Resolution update" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginTop: 8, border: '2px solid var(--border)' }} />
                    )}
                    <time>{formatDate(entry.createdAt)}</time>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>📊 Info</h3>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'grid', gap: 8 }}>
              <p><strong>Reported:</strong> {formatDate(issue.createdAt)}</p>
              <p><strong>Category:</strong> {getCategoryIcon(issue.issueType)} {issue.issueType}</p>
              <p><strong>Priority:</strong> {issue.priority}</p>
              <p><strong>Upvotes:</strong> {issue.upvoteCount || 0}</p>
              <p><strong>Comments:</strong> {issue.commentCount || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
