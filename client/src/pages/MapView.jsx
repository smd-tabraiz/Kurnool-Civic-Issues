import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { getCategoryIcon } from '../utils/helpers';
import api from '../services/api';

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const statusColors = { pending: '#ef4444', 'in-progress': '#3b82f6', resolved: '#22c55e' };

export default function MapView() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const res = await api.get('/issues/map');
        setIssues(res.data.data);
      } catch (e) {}
      setLoading(false);
    };
    fetchMapData();
  }, []);

  // Kurnool center coordinates
  const center = [15.8281, 78.0373];

  return (
    <div className="main-content page-enter">
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>📍 Issue Map</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        View all reported issues across Kurnool district on the map
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span> Pending
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span> In Progress
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span> Resolved
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{issues.length} issues on map</span>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="map-container">
          <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {issues.map(issue => (
              issue.location?.coordinates?.lat && issue.location?.coordinates?.lng && (
                <Marker
                  key={issue._id}
                  position={[issue.location.coordinates.lat, issue.location.coordinates.lng]}
                  icon={createIcon(statusColors[issue.status] || '#6366f1')}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>{getCategoryIcon(issue.issueType)} {issue.title}</h4>
                      <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>{issue.location.area}</p>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 12,
                        background: issue.status === 'pending' ? '#fef2f2' : issue.status === 'in-progress' ? '#eff6ff' : '#f0fdf4',
                        color: statusColors[issue.status],
                      }}>{issue.status}</span>
                      <br />
                      <Link to={`/issue/${issue._id}`} style={{ fontSize: 12, color: '#6366f1', display: 'inline-block', marginTop: 6 }}>
                        View Details →
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
