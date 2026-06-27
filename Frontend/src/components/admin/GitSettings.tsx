import React, { useEffect, useState } from 'react';
import api from '../../services/api';

interface GitSettingsDTO {
  enabled: boolean;
  secretConfigured: boolean;
  mrOpenedStatus: string | null;
  mrMergedStatus: string | null;
  pushStatus: string | null;
}

// Backend TaskStatus enum değerleriyle eşleşmeli (com.tora.model.enums.TaskStatus).
const STATUS_OPTIONS = ['', 'OPEN', 'IN_PROGRESS', 'TESTING', 'COMPLETED', 'CANCELLED'];
const PLATFORMS = ['github', 'gitlab', 'gitea'];

const GitSettings: React.FC = () => {
  const [s, setS] = useState<GitSettingsDTO | null>(null);
  const [secret, setSecret] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<GitSettingsDTO>('/admin/git/settings').then((r) => setS(r.data));
  }, []);

  if (!s) return <div>Yükleniyor…</div>;

  const save = async () => {
    const r = await api.put<GitSettingsDTO>('/admin/git/settings', {
      enabled: s.enabled,
      webhookSecret: secret || null,
      mrOpenedStatus: s.mrOpenedStatus || null,
      mrMergedStatus: s.mrMergedStatus || null,
      pushStatus: s.pushStatus || null,
    });
    setS(r.data);
    setSecret('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const base = `${window.location.origin}/api/webhooks/git`;

  return (
    <div className="admin-section">
      <h3>Git Entegrasyonu</h3>

      <label>
        <input type="checkbox" checked={s.enabled}
          onChange={(e) => setS({ ...s, enabled: e.target.checked })} /> Etkin
      </label>

      <div>
        <label>Webhook Secret {s.secretConfigured && <em>(tanımlı)</em>}</label>
        <input type="password" value={secret} placeholder={s.secretConfigured ? '••••• (değiştirmek için yaz)' : 'secret'}
          onChange={(e) => setSecret(e.target.value)} />
      </div>

      <div>
        <label>MR/PR açılınca → durum</label>
        <select value={s.mrOpenedStatus || ''} onChange={(e) => setS({ ...s, mrOpenedStatus: e.target.value })}>
          {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o || 'Değiştirme'}</option>)}
        </select>
      </div>
      <div>
        <label>MR/PR merge olunca → durum</label>
        <select value={s.mrMergedStatus || ''} onChange={(e) => setS({ ...s, mrMergedStatus: e.target.value })}>
          {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o || 'Değiştirme'}</option>)}
        </select>
      </div>
      <div>
        <label>Push/commit gelince → durum</label>
        <select value={s.pushStatus || ''} onChange={(e) => setS({ ...s, pushStatus: e.target.value })}>
          {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o || 'Değiştirme'}</option>)}
        </select>
      </div>

      <button onClick={save}>Kaydet</button>
      {saved && <span> ✓ Kaydedildi</span>}

      <div style={{ marginTop: 16 }}>
        <label>Webhook URL'leri (git platformuna girin)</label>
        <ul>
          {PLATFORMS.map((p) => (
            <li key={p}><code>{base}/{p}</code> — secret + JSON content-type</li>
          ))}
        </ul>
        <small>GitHub/Gitea: secret HMAC imzasıdır. GitLab: secret "Secret token" alanına girilir.</small>
      </div>
    </div>
  );
};

export default GitSettings;
