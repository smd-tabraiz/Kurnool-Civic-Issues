export const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatTime = (date) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];
  for (const i of intervals) {
    const count = Math.floor(seconds / i.seconds);
    if (count > 0) return `${count} ${i.label}${count > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getCategoryIcon = (type) => {
  const icons = { road: '🛣️', power: '⚡', water: '💧', health: '🏥', sanitation: '🧹', other: '📋' };
  return icons[type] || '📋';
};

export const getCategoryLabel = (type) => {
  const labels = { road: 'Road & Infrastructure', power: 'Power & Electricity', water: 'Water Supply', health: 'Healthcare', sanitation: 'Sanitation', other: 'Other' };
  return labels[type] || type;
};

export const kurnoolLocations = [
  'Kurnool City', 'Nandyal', 'Adoni', 'Yemmiganur', 'Dhone', 'Nandikotkur',
  'Allagadda', 'Atmakur', 'Kodumur', 'Mantralayam', 'Gudur', 'Pattikonda',
  'Banaganapalle', 'Koilkuntla', 'Srisailam', 'Orvakal', 'Bethamcherla',
  'Velugodu', 'Kallur', 'Krishnagiri', 'Jupadu Bungalow', 'Midthur',
  'C.Belagal', 'Peapully', 'Halaharvi', 'Aspari', 'Gadivemula', 'Devanakonda',
  'Gonegandla', 'Owk', 'Maddikera', 'Uyyalawada', 'Chagalamarri', 'Panyam',
  'Gospadu', 'Dornipadu', 'Nossam', 'Pagidyala', 'Rudravaram', 'Sanjamala',
  'Tuggali', 'Veldurthi', 'Kosigi', 'Kowthalam',
];
export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // Normalize backslashes to forward slashes (fix for Windows paths)
  const normalizedPath = path.replace(/\\/g, '/');
  
  // Ensure the path starts with a slash
  const finalPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  
  return `http://localhost:5000${finalPath}`;
};
