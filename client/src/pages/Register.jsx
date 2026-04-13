import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Phone, MapPin, UserPlus } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', location: 'Kurnool City', role: 'user', adminKey: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.phone, form.location, form.role, form.adminKey);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    }
    setLoading(false);
  };

  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">K</div>
          <h1>Create Account</h1>
          <p>Join Kurnool Civic Reporter</p>
        </div>
        {error && <div className="toast error" style={{ marginBottom: 16, minWidth: 'auto' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label"><User size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Full Name</label>
            <input id="reg-name" className="form-input" required placeholder="Your full name" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label"><Mail size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Email</label>
            <input id="reg-email" className="form-input" type="email" required placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label"><Lock size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Password</label>
            <input id="reg-password" className="form-input" type="password" required minLength={6} placeholder="Minimum 6 characters" value={form.password} onChange={e => update('password', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Register as</label>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" name="role" value="user" checked={form.role === 'user'} onChange={() => update('role', 'user')} /> User
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" name="role" value="admin" checked={form.role === 'admin'} onChange={() => update('role', 'admin')} /> Admin
              </label>
            </div>
          </div>

          {form.role === 'admin' && (
            <div className="form-group">
              <label className="form-label"><Lock size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Admin Secret Key</label>
              <input id="admin-key" className="form-input" type="password" required placeholder="Enter specialized key" value={form.adminKey} onChange={e => update('adminKey', e.target.value)} />
              <p className="form-hint">Required for administrative registration</p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label"><Phone size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Phone (optional)</label>
            <input id="reg-phone" className="form-input" type="tel" placeholder="9876543210" value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label"><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Location</label>
            <input id="reg-location" className="form-input" placeholder="Kurnool City" value={form.location} onChange={e => update('location', e.target.value)} />
          </div>
          <button id="reg-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            <UserPlus size={18} /> {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
