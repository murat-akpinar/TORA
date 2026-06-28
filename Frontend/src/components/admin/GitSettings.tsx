import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import './GitSettings.css';

interface GitSettingsDTO {
  enabled: boolean;
  secretConfigured: boolean;
  mrOpenedStatus: string | null;
  mrMergedStatus: string | null;
  branchStatus: string | null;
}

// Backend TaskStatus enum değerleriyle eşleşmeli (com.tora.model.enums.TaskStatus).
const STATUS_OPTIONS = ['', 'OPEN', 'IN_PROGRESS', 'TESTING', 'COMPLETED', 'CANCELLED'];
const PLATFORMS = ['github', 'gitlab', 'gitea'];

const GitIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M6 21V9a9 9 0 0 0 9 9" />
  </svg>
);

const GitSettings: React.FC = () => {
  const [s, setS] = useState<GitSettingsDTO | null>(null);
  const [secret, setSecret] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.get<GitSettingsDTO>('/admin/git/settings').then((r) => setS(r.data));
  }, []);

  if (!s) return <div className="loading">Yükleniyor…</div>;

  const save = async () => {
    const r = await api.put<GitSettingsDTO>('/admin/git/settings', {
      enabled: s.enabled,
      webhookSecret: secret || null,
      mrOpenedStatus: s.mrOpenedStatus || null,
      mrMergedStatus: s.mrMergedStatus || null,
      branchStatus: s.branchStatus || null,
    });
    setS(r.data);
    setSecret('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const base = `${window.location.origin}/api/webhooks/git`;

  const copy = (url: string, platform: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(platform);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const statusField = (
    label: string,
    value: string | null,
    onChange: (v: string) => void,
  ) => (
    <div className="git-field">
      <label>{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {STATUS_OPTIONS.map((o) => (
          <option key={o} value={o}>{o || 'Değiştirme'}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="git-settings">
      <div className="git-settings-header">
        <h2><GitIcon /> Git Entegrasyonu</h2>
        <label className="git-toggle">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => setS({ ...s, enabled: e.target.checked })}
          />
          <span className="track" />
          <span className="git-toggle-label">{s.enabled ? 'Etkin' : 'Devre dışı'}</span>
        </label>
      </div>
      <p className="git-settings-sub">
        Git platformlarından gelen webhook olaylarını görev durumlarına bağlayın.
      </p>

      <div className="git-grid">
        <div className="git-field full">
          <label>
            Webhook Secret
            {s.secretConfigured && <span className="tag">tanımlı</span>}
          </label>
          <input
            type="password"
            value={secret}
            placeholder={s.secretConfigured ? '••••• (değiştirmek için yaz)' : 'secret'}
            onChange={(e) => setSecret(e.target.value)}
          />
          <span className="hint">HMAC imza doğrulaması için kullanılır.</span>
        </div>

        {statusField('MR/PR açılınca → durum', s.mrOpenedStatus, (v) => setS({ ...s, mrOpenedStatus: v }))}
        {statusField('MR/PR merge olunca → durum', s.mrMergedStatus, (v) => setS({ ...s, mrMergedStatus: v }))}
        {statusField('Dal oluşturulunca → durum', s.branchStatus, (v) => setS({ ...s, branchStatus: v }))}
      </div>

      <div className="git-actions">
        <button className="btn-save" onClick={save}>Kaydet</button>
        {saved && <span className="git-saved">✓ Kaydedildi</span>}
      </div>

      <div className="git-webhooks">
        <div className="git-webhooks-title">Webhook URL'leri</div>
        <p className="git-webhooks-sub">Bu adresleri git platformunuzun webhook ayarlarına girin.</p>

        <div className="git-webhook-list">
          {PLATFORMS.map((p) => {
            const url = `${base}/${p}`;
            return (
              <div key={p} className="git-webhook-row">
                <span className={`git-platform ${p}`}>
                  <span className="dot" /> {p}
                </span>
                <span className="git-webhook-url" title={url}>{url}</span>
                <button
                  className={`git-copy ${copied === p ? 'copied' : ''}`}
                  onClick={() => copy(url, p)}
                >
                  {copied === p ? '✓ Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            );
          })}
        </div>

        <small className="git-note">
          Tüm platformlarda <code>JSON</code> content-type kullanın.
          GitHub / Gitea: secret HMAC imzası olarak gönderilir.
          GitLab: secret <code>Secret token</code> alanına girilir.
        </small>
      </div>
    </div>
  );
};

export default GitSettings;
