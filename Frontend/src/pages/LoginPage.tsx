import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../App.css';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<'ldap' | 'standard'>('standard');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password, loginType);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left decorative panel — hidden on mobile */}
      <div className="login-panel-left" aria-hidden="true">
        <div className="login-brand-mark">
          <span className="login-logo-icon">T</span>
          <span className="login-logo-name">TORA</span>
        </div>
        <div className="login-hero">
          <h2 className="login-hero-title">
            Takımınızın işlerini<br />tek yerden yönetin
          </h2>
          <p className="login-hero-body">
            Görev yönetimi, proje takibi ve ekip koordinasyonu — hepsi bir arada.
          </p>
        </div>
        <ul className="login-feature-list">
          <li>Gerçek zamanlı görev takibi</li>
          <li>Kanban, takvim ve liste görünümleri</li>
          <li>Gelişmiş filtreleme ve global arama</li>
        </ul>
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      {/* Right form panel */}
      <div className="login-panel-right">
        <div className="login-form-wrap">
          <div className="login-form-header">
            <h1 className="login-form-title">Giriş Yap</h1>
            <p className="login-form-sub">Hesabınıza erişmek için bilgilerinizi girin.</p>
          </div>

          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab ${loginType === 'ldap' ? 'active' : ''}`}
              onClick={() => setLoginType('ldap')}
            >
              LDAP
            </button>
            <button
              type="button"
              className={`login-tab ${loginType === 'standard' ? 'active' : ''}`}
              onClick={() => setLoginType('standard')}
            >
              Standard
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                Kullanıcı Adı
              </label>
              <input
                id="username"
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="kullaniciadi"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Parola
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

