import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, FileText, Upload, Send, Locate, Camera, Mic, Square, Volume2 } from 'lucide-react';
import { kurnoolLocations, getCategoryIcon } from '../utils/helpers';
import api from '../services/api';

export default function ReportIssue() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', issueType: '', area: '', lat: '', lng: '' });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [listening, setListening] = useState(null); // 'title' or 'description'
  const [speaking, setSpeaking] = useState(false);
  const [speechLang, setSpeechLang] = useState('te-IN'); // Default to Telugu for better local support
  const [duplicateMatch, setDuplicateMatch] = useState(null);

  useEffect(() => {
    const checkDupes = async () => {
      if (form.title?.length > 10 && form.area) {
        try {
          const res = await api.get(`/issues/check-duplicate?title=${encodeURIComponent(form.title)}&area=${encodeURIComponent(form.area)}`);
          if (res.data.isDuplicate) {
            setDuplicateMatch(res.data.match);
          } else {
            setDuplicateMatch(null);
          }
        } catch(e) {}
      } else {
        setDuplicateMatch(null);
      }
    };
    const timer = setTimeout(checkDupes, 800);
    return () => clearTimeout(timer);
  }, [form.title, form.area]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const startDictation = (field) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = speechLang; // 'te-IN' handles Telugu & Tanglish significantly better
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { setListening(field); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      update(field, form[field] ? `${form[field]} ${transcript}` : transcript);
    };
    recognition.onerror = () => { setError('Microphone error or permission denied.'); setListening(null); };
    recognition.onend = () => { setListening(null); };
    recognition.start();
  };

  const readAloud = () => {
    if (!form.title && !form.description) {
      setError('Nothing to read aloud.');
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const textToRead = `Issue Title: ${form.title}. Description: ${form.description}.`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    
    // Hunt for high-quality Google neural voices (which sound like real humans)
    const voices = window.speechSynthesis.getVoices();
    let bestVoice = voices.find(v => v.name.includes('Google Telugu'));
    if (!bestVoice) bestVoice = voices.find(v => v.name.includes('Google UK English') || v.name.includes('Google US English'));
    if (!bestVoice) bestVoice = voices.find(v => v.lang === speechLang || v.lang === 'en-IN');
    if (bestVoice) utterance.voice = bestVoice;
    
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return; }
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toString();
        const lng = pos.coords.longitude.toString();
        
        update('lat', lat);
        update('lng', lng);
        
        try {
          // Reverse Geocoding via standard OSM API
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          
          if (data && data.address) {
            // Find the most specific local landmark/area available
            const detectedArea = data.address.neighbourhood || data.address.suburb || data.address.village || data.address.city_district || data.name || data.address.town || data.address.city;
            
            if (detectedArea) {
              const district = data.address.state_district || data.address.county || '';
              // Format cleanly: "Area Name, District"
              const fullArea = `${detectedArea}${district ? `, ${district}` : ''}`.replace(/,\s*$/, '');
              update('area', fullArea);
            }
          }
        } catch (e) {
          console.error("Geocoding failed", e);
        }
        
        setLocating(false);
      },
      (err) => { 
        console.error("Geolocation error:", err);
        setError(`Unable to get location: ${err.message}`); 
        setLocating(false); 
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const geocodeArea = async (areaName) => {
    if (!areaName || areaName.length < 3) return;
    
    setLocating(true);
    try {
      // Direct geocoding: Area name + Kurnool + Andhra Pradesh for high accuracy
      const query = encodeURIComponent(`${areaName}, Kurnool, Andhra Pradesh, India`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        update('lat', data[0].lat);
        update('lng', data[0].lon);
        console.log(`Geocoded ${areaName} to:`, data[0].lat, data[0].lon);
      } else {
        // Clear if not found to avoid "stale" coords
        update('lat', '');
        update('lng', '');
      }
    } catch (e) {
      console.error("Direct geocoding failed", e);
    }
    setLocating(false);
  };

  const [priorityResult, setPriorityResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.area) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
      if (image) formData.append('image', image);

      const res = await api.post('/issues', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

      // Show AI priority analysis for 3 seconds
      if (res.data.priorityAnalysis) {
        setPriorityResult(res.data.priorityAnalysis);
        setTimeout(() => navigate('/'), 3500);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit issue');
    }
    setLoading(false);
  };

  const categories = [
    { value: 'road', label: 'Road', icon: '🛣️', desc: 'Potholes, damaged roads' },
    { value: 'power', label: 'Power', icon: '⚡', desc: 'Outages, damaged lines' },
    { value: 'water', label: 'Water', icon: '💧', desc: 'Supply issues, leaks' },
    { value: 'health', label: 'Health', icon: '🏥', desc: 'Healthcare access' },
    { value: 'sanitation', label: 'Sanitation', icon: '🧹', desc: 'Waste, drainage' },
    { value: 'other', label: 'Other', icon: '📋', desc: 'Other civic issues' },
  ];

  return (
    <div className="main-content page-enter">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>📝 Report an Issue</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Help improve Kurnool district by reporting civic issues in your area.</p>

        <div style={{ background: 'var(--accent-light)', borderLeft: '4px solid var(--accent)', padding: '16px', borderRadius: '4px var(--radius-md) var(--radius-md) 4px', marginBottom: 32 }}>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>
            💡 <strong>Pro Tip:</strong> Feel free to type your issue in pure Telugu, Tanglish, or English. Our smart system automatically translates and categorizes everything for the admin!
          </p>
        </div>

        {error && <div className="toast error" style={{ marginBottom: 16, minWidth: 'auto' }}>{error}</div>}

        {/* AI Priority Analysis Result */}
        {priorityResult && (
          <div style={{
            padding: 24, borderRadius: 'var(--radius-lg)', marginBottom: 24,
            background: priorityResult.priority === 'urgent' ? 'linear-gradient(135deg, #fef2f2, #fee2e2)' :
              priorityResult.priority === 'high' ? 'linear-gradient(135deg, #fff7ed, #ffedd5)' :
              priorityResult.priority === 'medium' ? 'linear-gradient(135deg, #fefce8, #fef9c3)' :
              'linear-gradient(135deg, #f0fdf4, #dcfce7)',
            border: `2px solid ${
              priorityResult.priority === 'urgent' ? '#dc2626' :
              priorityResult.priority === 'high' ? '#ea580c' :
              priorityResult.priority === 'medium' ? '#ca8a04' : '#16a34a'
            }`,
            textAlign: 'center', animation: 'slideDown 0.4s ease-out',
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>
              {priorityResult.priority === 'urgent' ? '🚨' : priorityResult.priority === 'high' ? '⚠️' : priorityResult.priority === 'medium' ? '📋' : '✅'}
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
              ✅ Issue Submitted Successfully!
            </h3>
            <div style={{
              display: 'inline-block', padding: '4px 16px', borderRadius: 'var(--radius-full)',
              fontWeight: 700, fontSize: 14, marginBottom: 8, letterSpacing: 1,
              background: priorityResult.priority === 'urgent' ? '#dc2626' :
                priorityResult.priority === 'high' ? '#ea580c' :
                priorityResult.priority === 'medium' ? '#ca8a04' : '#16a34a',
              color: '#fff',
            }}>
              AI Priority: {priorityResult.priority.toUpperCase()}
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
              {priorityResult.message}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Redirecting to feed...</p>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: priorityResult.priority === 'urgent' ? '#dc2626' :
                  priorityResult.priority === 'high' ? '#ea580c' :
                  priorityResult.priority === 'medium' ? '#ca8a04' : '#16a34a',
                animation: 'progressBar 3.5s linear forwards',
              }} />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* AI Duplicate Detection Modual */}
          {duplicateMatch && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '16px 20px', borderRadius: 'var(--radius-md)', marginBottom: 24, animation: 'slideDown 0.3s ease-out' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ background: '#fef3c7', color: '#d97706', padding: 8, borderRadius: '50%' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: 16, color: '#92400e', fontWeight: 700, margin: '0 0 4px 0' }}>Similar Issue Detected!</h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#b45309', lineHeight: 1.5 }}>
                    We noticed an open issue very similar to yours in <strong>{form.area}</strong>. 
                    Someone might have already reported this!
                  </p>
                  
                  <div style={{ background: 'white', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid #fef3c7' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{duplicateMatch.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status: <span style={{ color: 'var(--status-progress)', fontWeight: 600 }}>{duplicateMatch.status}</span> • Upvotes: {duplicateMatch.upvoteCount || 0}</div>
                    
                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                      <Link to={`/issue/${duplicateMatch._id}`} className="btn btn-sm btn-secondary" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#b45309' }}>View Issue & Upvote Instead</Link>
                      <button type="button" className="btn btn-sm" onClick={() => setDuplicateMatch(null)} style={{ background: 'transparent', color: '#b45309', padding: '0 8px' }}>Ignore, mine is different</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category Selection */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 16, marginBottom: 16 }}>1. Select Issue Category</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              {categories.map(cat => (
                <button type="button" key={cat.value}
                  onClick={() => update('issueType', cat.value)}
                  style={{
                    padding: '16px 12px', borderRadius: 'var(--radius-md)',
                    border: form.issueType === cat.value ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: form.issueType === cat.value ? 'var(--accent-light)' : 'var(--bg-primary)',
                    textAlign: 'center', cursor: 'pointer', transition: '0.2s',
                  }}>
                  <div style={{ fontSize: 28 }}>{cat.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{cat.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.desc}</div>
                </button>
              ))}
            </div>
              <p className="form-hint" style={{ marginTop: 16 }}>Or leave empty for auto-classification based on your description (AI-powered)</p>
            </div>
          </div>

          {/* Issue Details */}
          <div className="card" style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ fontSize: 16, marginBottom: 16 }}>2. Issue Details</label>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ fontWeight: 500, margin: 0 }}><FileText size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Title *</label>
                <button type="button" onClick={() => listening === 'title' ? {} : startDictation('title')} className="icon-btn" style={{ width: 28, height: 28, background: listening === 'title' ? 'var(--status-pending-bg)' : 'var(--bg-primary)', color: listening === 'title' ? 'var(--status-pending)' : 'var(--accent)' }} title="Dictate Title">
                  {listening === 'title' ? <Square size={14} /> : <Mic size={14} />}
                </button>
              </div>
              <input id="issue-title" className="form-input" required placeholder="Brief title of the issue (e.g. Water pipe leaking)" value={form.title} onChange={e => update('title', e.target.value)} maxLength={150} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ fontWeight: 500, margin: 0 }}>Description *</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" onClick={() => setSpeechLang(prev => prev === 'te-IN' ? 'en-IN' : 'te-IN')} className="btn btn-sm" style={{ padding: '4px 8px', fontSize: 11, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} title="Toggle Dictation Language">
                    {speechLang === 'te-IN' ? 'తెలుగు/Tanglish' : 'English'}
                  </button>
                  <button type="button" onClick={() => listening === 'description' ? {} : startDictation('description')} className="icon-btn" style={{ width: 28, height: 28, background: listening === 'description' ? 'var(--status-pending-bg)' : 'var(--bg-primary)', color: listening === 'description' ? 'var(--status-pending)' : 'var(--accent)' }} title="Dictate Description">
                    {listening === 'description' ? <Square size={14} /> : <Mic size={14} />}
                  </button>
                  <button type="button" onClick={readAloud} className="icon-btn" style={{ width: 28, height: 28, background: speaking ? 'var(--status-progress-bg)' : 'var(--bg-primary)', color: speaking ? 'var(--status-progress)' : 'var(--text-secondary)' }} title="Read Aloud">
                    {speaking ? <Square size={14} /> : <Volume2 size={14} />}
                  </button>
                </div>
              </div>
              <textarea id="issue-desc" className="form-textarea" required placeholder="Describe the issue in detail. You can use Telugu or English... Include severity and how it affects the community." value={form.description} onChange={e => update('description', e.target.value)} maxLength={2000} />
              <p className="form-hint" style={{ textAlign: 'right' }}>{form.description.length}/2000 characters</p>
            </div>
          </div>

          {/* Location Details */}
          <div className="card" style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ fontSize: 16, marginBottom: 16 }}>3. Location & Evidence</label>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 500 }}><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Area / Location *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                  <input 
                    id="issue-area" 
                    className="form-input" 
                    required 
                    placeholder="Type area or auto-detect" 
                    style={{ width: '100%' }} 
                    value={form.area} 
                    onChange={e => {
                      update('area', e.target.value);
                      // Clear stale coords when typing manually
                      if (form.lat || form.lng) {
                        update('lat', '');
                        update('lng', '');
                      }
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
                  />
                  {showDropdown && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
                      maxHeight: 200, overflowY: 'auto', zIndex: 1000
                    }}>
                      {kurnoolLocations
                        .filter(loc => loc.toLowerCase().includes(form.area.toLowerCase()))
                        .map(loc => (
                          <div 
                            key={loc}
                            onClick={() => { 
                              update('area', loc); 
                              setShowDropdown(false);
                              geocodeArea(loc); // Automatically fetch coordinates for the selected place
                            }}
                            style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14 }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {loc}
                          </div>
                      ))}
                      {kurnoolLocations.filter(loc => loc.toLowerCase().includes(form.area.toLowerCase())).length === 0 && (
                        <div style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 14 }}>No matches found</div>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-secondary" onClick={detectLocation} disabled={locating} style={{ flexShrink: 0 }}>
                  <Locate size={16} /> {locating ? 'Detecting...' : 'Detect GPS'}
                </button>
              </div>
              {form.lat && form.lng && !locating && (
                <div style={{ marginTop: 8, padding: '4px 12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8, display: 'inline-block' }}>
                  <p className="form-hint" style={{ color: 'var(--status-resolved)', margin: 0, fontWeight: 600 }}>✅ GPS coordinates locked for this area</p>
                </div>
              )}
              {locating && (
                <div style={{ marginTop: 8, padding: '4px 12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, display: 'inline-block' }}>
                  <p className="form-hint" style={{ color: 'var(--accent)', margin: 0, fontWeight: 600 }}>🔍 Finding location on map...</p>
                </div>
              )}
            </div>

            {/* Image Upload */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 500 }}><Camera size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Photo Evidence <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Highly recommended)</span></label>
              <label htmlFor="issue-image" className={`file-upload-zone ${preview ? 'has-file' : ''}`}>
                {preview ? (
                  <img src={preview} alt="Preview" className="file-preview" style={{ margin: '0 auto' }} />
                ) : (
                  <>
                    <Upload size={32} style={{ color: 'var(--accent)', opacity: 0.8, marginBottom: 12 }} />
                    <p style={{ fontWeight: 700, fontSize: 15 }}>Click to upload a clear photo</p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>A clear photo helps admins resolve the issue faster.<br/>(JPG, PNG or WebP, max 5MB)</p>
                  </>
                )}
              </label>
              <input id="issue-image" type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
            </div>
          </div>

          <div style={{ position: 'sticky', bottom: 24, zIndex: 10 }}>
            <button id="submit-issue" type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', boxShadow: '0 8px 30px rgba(99,102,241,0.5)', padding: '16px', fontSize: 16 }}>
              <Send size={20} /> {loading ? 'Submitting & Analyzing...' : 'Submit Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
