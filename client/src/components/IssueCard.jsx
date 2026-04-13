import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThumbsUp, MessageCircle, Share2, MapPin, Clock } from 'lucide-react';
import { getInitials, timeAgo, getCategoryIcon, getImageUrl } from '../utils/helpers';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

export default function IssueCard({ issue, onUpdate }) {
  const { user } = useAuth();
  const socket = useSocket();
  const [upvoting, setUpvoting] = useState(false);
  const hasUpvoted = issue.upvotes?.includes(user?._id);

  const handleUpvote = (e) => {
    e.preventDefault();
    if (upvoting || !user) return;
    setUpvoting(true);
    
    socket.emit('toggle_upvote', { issueId: issue._id, userId: user._id }, (res) => {
      if (res && res.success) {
        if (onUpdate) onUpdate(issue._id, res.data);
      }
      setUpvoting(false);
    });
  };

  const handleShare = (e) => {
    e.preventDefault();
    if (navigator.share) {
      navigator.share({ title: issue.title, url: `${window.location.origin}/issue/${issue._id}` });
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/issue/${issue._id}`);
    }
  };

  const statusClass = issue.status === 'pending' ? 'badge-pending' : issue.status === 'in-progress' ? 'badge-in-progress' : 'badge-resolved';

  return (
    <Link to={`/issue/${issue._id}`} style={{ textDecoration: 'none' }}>
      <div className="issue-card">
        <div className="issue-card-header">
          <div className="issue-user">
            <div className="issue-user-avatar">{getInitials(issue.reportedBy?.name)}</div>
            <div className="issue-user-info">
              <h4>{issue.reportedBy?.name || 'Anonymous'}</h4>
              <p><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {timeAgo(issue.createdAt)} · <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {issue.location?.area}</p>
            </div>
          </div>
          <span className={`badge-status ${statusClass}`}>{issue.status?.replace('-', ' ')}</span>
        </div>

        <div className="issue-card-body">
          <h3 className="issue-title">{issue.title}</h3>
          <p className="issue-desc">
            {(issue.originalDescription || issue.description)?.length > 200 
              ? (issue.originalDescription || issue.description).slice(0, 200) + '...' 
              : (issue.originalDescription || issue.description)}
          </p>

          {issue.image && <img src={getImageUrl(issue.image)} alt={issue.title} className="issue-image" loading="lazy" />}

          <div className="issue-meta">
            <span className={`badge-category badge-${issue.issueType}`}>
              {getCategoryIcon(issue.issueType)} {issue.issueType}
            </span>
            {(issue.priority === 'high' || issue.priority === 'urgent') && (
              <span className={`badge-priority badge-${issue.priority}`}>🚨 {issue.priority}</span>
            )}
          </div>
        </div>

        <div className="issue-card-footer">
          <div className="issue-actions">
            <button className={`action-btn ${hasUpvoted ? 'upvoted' : ''}`} onClick={handleUpvote}>
              <ThumbsUp size={16} /> {issue.upvoteCount || 0}
            </button>
            <span className="action-btn">
              <MessageCircle size={16} /> {issue.commentCount || 0}
            </span>
            <button className="action-btn" onClick={handleShare}>
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
