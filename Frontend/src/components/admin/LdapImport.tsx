import React, { useState, useEffect } from 'react';
import { ldapService } from '../../services/ldapService';
import { adminService } from '../../services/adminService';
import { ldapSettingsService } from '../../services/ldapSettingsService';
import { LdapUser, Role, LdapSettings, UpdateLdapSettingsRequest, LdapTestRequest, LdapTestResponse } from '../../types/Admin';
import { notify } from '../../utils/notify';
import { extractErrorMessage } from '../../utils/errorMessages';
import './LdapImport.css';

const LdapImport: React.FC = () => {
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<LdapUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<LdapUser | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  
  // LDAP Settings state
  const [ldapSettings, setLdapSettings] = useState<LdapSettings>({
    urls: '',
    base: '',
    username: '',
    userSearchBase: '',
    userSearchFilter: '(uid={0})',
    isEnabled: false,
  });
  const [ldapPassword, setLdapPassword] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<LdapTestResponse | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [connectionTested, setConnectionTested] = useState(() => {
    // localStorage'dan connectionTested durumunu oku
    const saved = localStorage.getItem('ldap_connection_tested');
    return saved === 'true';
  });
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [autoTesting, setAutoTesting] = useState(false);

  useEffect(() => {
    fetchRoles();
    fetchLdapSettings();
  }, []);

  // 6 saatte bir periyodik LDAP bağlantı testi (sayfa açıkken)
  useEffect(() => {
    if (!ldapSettings.isEnabled || !ldapSettings.urls || !ldapSettings.base) return;

    const interval = setInterval(async () => {
      try {
        const result = await ldapSettingsService.testLdapConnectionAuto();
        setConnectionTested(result.success);
        if (!result.success) localStorage.removeItem('ldap_connection_tested');
      } catch {
        setConnectionTested(false);
        localStorage.removeItem('ldap_connection_tested');
      }
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [ldapSettings.isEnabled, ldapSettings.urls, ldapSettings.base]);

  // connectionTested değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (connectionTested) {
      localStorage.setItem('ldap_connection_tested', 'true');
    } else {
      localStorage.removeItem('ldap_connection_tested');
    }
  }, [connectionTested]);

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found');
        return;
      }
      const data = await adminService.getAllRoles();
      setRoles(data);
    } catch (error: any) {
      console.error('Failed to fetch roles:', error);
      const status = error.response?.status;
      if (status === 401) {
        notify.warning('Oturumunuz sona ermiş veya geçersiz. Lütfen tekrar giriş yapın.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (status === 403) {
        notify.error('Bu işlem için yetkiniz yok. Sadece yöneticiler (ADMIN rolü) erişebilir.');
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    setLoading(true);
    setSearchResults([]);
    try {
      const results = await ldapService.searchUsers({ username: searchUsername });
      setSearchResults(results);
      if (results.length === 0) {
        notify.info('Kullanıcı bulunamadı. LDAP ayarlarınızı kontrol edin.');
      }
    } catch (error: any) {
      console.error('LDAP Search Error:', error);
      notify.error(extractErrorMessage(error, 'LDAP araması başarısız oldu.'));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedUser) return;

    try {
      await ldapService.importUser(selectedUser, selectedRoleIds);
      notify.success('Kullanıcı başarıyla import edildi.');
      setSearchResults([]);
      setSelectedUser(null);
      setSelectedRoleIds([]);
      setSearchUsername('');
    } catch (error: any) {
      notify.error(extractErrorMessage(error, 'Import başarısız oldu.'));
    }
  };

  const handleRoleToggle = (roleId: number) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const fetchLdapSettings = async () => {
    try {
      const settings = await ldapSettingsService.getLdapSettings();
      setLdapSettings(settings);

      if (settings.isEnabled && settings.urls && settings.base) {
        setAutoTesting(true);
        try {
          const result = await ldapSettingsService.testLdapConnectionAuto();
          setConnectionTested(result.success);
          if (result.success) {
            localStorage.setItem('ldap_connection_tested', 'true');
          } else {
            localStorage.removeItem('ldap_connection_tested');
          }
        } catch {
          setConnectionTested(false);
          localStorage.removeItem('ldap_connection_tested');
        } finally {
          setAutoTesting(false);
        }
      } else {
        setConnectionTested(false);
        localStorage.removeItem('ldap_connection_tested');
      }
    } catch (error: any) {
      console.error('Failed to fetch LDAP settings:', error);
      setConnectionTested(false);
    }
  };

  const handleTestConnection = async () => {
    if (!ldapSettings.urls || !ldapSettings.base) {
      notify.warning('LDAP URLs ve Base DN alanları zorunludur.');
      return;
    }

    // Form'u aç (eğer kapalıysa)
    if (!isSettingsExpanded) {
      setIsSettingsExpanded(true);
    }

    setTestingConnection(true);
    setTestResult(null);

    try {
      const testRequest: LdapTestRequest = {
        urls: ldapSettings.urls,
        base: ldapSettings.base,
        username: ldapSettings.username || undefined,
        password: testPassword || undefined,
        userSearchBase: ldapSettings.userSearchBase || undefined,
        userSearchFilter: ldapSettings.userSearchFilter || undefined,
      };

      const result = await ldapSettingsService.testLdapConnection(testRequest);
      setTestResult(result);
      setConnectionTested(result.success);
      
      if (result.success) {
        notify.success('LDAP bağlantısı başarılı! Artık kullanıcı import edebilirsiniz.');
        setIsSettingsExpanded(false);
      } else {
        notify.error('LDAP bağlantısı başarısız: ' + result.message);
      }
    } catch (error: any) {
      const errorResponse: LdapTestResponse = {
        success: false,
        message: 'Test başarısız oldu',
        errorDetails: error.response?.data?.error || error.message,
      };
      setTestResult(errorResponse);
      notify.error(extractErrorMessage(error, 'LDAP bağlantı testi başarısız oldu.'));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!ldapSettings.urls || !ldapSettings.base) {
      notify.warning('LDAP URLs ve Base DN alanları zorunludur.');
      return;
    }

    setSavingSettings(true);

    try {
      const updateRequest: UpdateLdapSettingsRequest = {
        urls: ldapSettings.urls,
        base: ldapSettings.base,
        username: ldapSettings.username || undefined,
        password: ldapPassword || undefined, // Only send if provided
        userSearchBase: ldapSettings.userSearchBase || undefined,
        userSearchFilter: ldapSettings.userSearchFilter || undefined,
        isEnabled: ldapSettings.isEnabled || false,
      };

      await ldapSettingsService.updateLdapSettings(updateRequest);
      notify.success('LDAP ayarları başarıyla kaydedildi.');
      setLdapPassword('');
      setTestPassword('');
      await fetchLdapSettings();
      setIsSettingsExpanded(false);
    } catch (error: any) {
      notify.error(extractErrorMessage(error, 'LDAP ayarları kaydedilemedi.'));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="ldap-import">
      <h2>LDAP Kullanıcı Import</h2>

      {/* LDAP Settings Form */}
      <div className="ldap-settings-section">
        <div className="ldap-settings-header">
          <h3>LDAP Bağlantı Ayarları</h3>
          <div className="ldap-settings-header-actions">
            {!isSettingsExpanded && (
              <button
                type="button"
                className="btn-edit"
                onClick={() => setIsSettingsExpanded(true)}
              >
                Düzenle
              </button>
            )}
            {isSettingsExpanded && (
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setIsSettingsExpanded(false);
                  setLdapPassword('');
                  setTestPassword('');
                }}
              >
                Kapat
              </button>
            )}
          </div>
        
        {/* Settings Summary - shown when settings exist and form is collapsed */}
        {!isSettingsExpanded && ldapSettings.urls && (
          <div className="ldap-settings-summary">
            <div className="ldap-summary-item">
              <span className="ldap-summary-label">LDAP URL</span>
              <span className="ldap-summary-value">{ldapSettings.urls}</span>
            </div>
            <div className="ldap-summary-item">
              <span className="ldap-summary-label">Base DN</span>
              <span className="ldap-summary-value">{ldapSettings.base}</span>
            </div>
            <div className="ldap-summary-item">
              <span className="ldap-summary-label">Durum</span>
              <span className={`ldap-status-badge ${ldapSettings.isEnabled ? 'active' : 'inactive'}`}>
                {ldapSettings.isEnabled ? '✓ Aktif' : '○ Pasif'}
              </span>
            </div>
            <div className="ldap-summary-item">
              <span className="ldap-summary-label">Bağlantı</span>
              {autoTesting ? (
                <span className="ldap-status-badge testing">◌ Kontrol ediliyor...</span>
              ) : (
                <span className={`ldap-status-badge ${connectionTested ? 'connected' : 'inactive'}`}>
                  {connectionTested ? '✓ Bağlı' : '○ Bağlantı yok'}
                </span>
              )}
            </div>
            <div className="ldap-summary-item">
              <span className="ldap-summary-label">Şifre</span>
              <span className="ldap-password-indicator saved">
                ✓ Kayıtlı (şifrelenmiş)
              </span>
            </div>
          </div>
        )}</div>
        
        {isSettingsExpanded && (
        <div className="ldap-settings-form">
          <div className="form-group">
            <label>LDAP URLs *</label>
            <input
              type="text"
              value={ldapSettings.urls}
              onChange={(e) => setLdapSettings({ ...ldapSettings, urls: e.target.value })}
              placeholder="ldap://localhost:389"
              required
            />
          </div>

          <div className="form-group">
            <label>Base DN *</label>
            <input
              type="text"
              value={ldapSettings.base}
              onChange={(e) => setLdapSettings({ ...ldapSettings, base: e.target.value })}
              placeholder="dc=example,dc=com"
              required
            />
          </div>

          <div className="form-group">
            <label>Username (Bind DN)</label>
            <input
              type="text"
              value={ldapSettings.username || ''}
              onChange={(e) => setLdapSettings({ ...ldapSettings, username: e.target.value })}
              placeholder="cn=admin,dc=example,dc=com"
            />
          </div>

          <div className="form-group">
            <label>Password (Test için)</label>
            <input
              type="password"
              value={testPassword}
              onChange={(e) => setTestPassword(e.target.value)}
              placeholder="Test bağlantısı için şifre girin"
            />
          </div>

          <div className="form-group">
            <label>Password (Kaydetmek için)</label>
            <input
              type="password"
              value={ldapPassword}
              onChange={(e) => setLdapPassword(e.target.value)}
              placeholder="Ayarları kaydetmek için şifre girin"
            />
            <small className="form-hint">Şifre şifrelenerek saklanacaktır</small>
          </div>

          <div className="form-group">
            <label>User Search Base</label>
            <input
              type="text"
              value={ldapSettings.userSearchBase || ''}
              onChange={(e) => setLdapSettings({ ...ldapSettings, userSearchBase: e.target.value })}
              placeholder="ou=users,dc=example,dc=com"
            />
          </div>

          <div className="form-group">
            <label>User Search Filter</label>
            <input
              type="text"
              value={ldapSettings.userSearchFilter || '(uid={0})'}
              onChange={(e) => setLdapSettings({ ...ldapSettings, userSearchFilter: e.target.value })}
              placeholder="(uid={0})"
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ldapSettings.isEnabled || false}
                onChange={(e) => setLdapSettings({ ...ldapSettings, isEnabled: e.target.checked })}
              />
              LDAP'i Aktif Et
            </label>
          </div>

          <div className="ldap-settings-actions">
            <button
              type="button"
              className="btn-test"
              onClick={handleTestConnection}
              disabled={testingConnection || !ldapSettings.urls || !ldapSettings.base}
            >
              {testingConnection ? 'Test Ediliyor...' : 'Test Bağlantı'}
            </button>
            <button
              type="button"
              className="btn-save"
              onClick={handleSaveSettings}
              disabled={savingSettings || !ldapSettings.urls || !ldapSettings.base}
            >
              {savingSettings ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </button>
          </div>

          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
              <strong>{testResult.success ? '✓ Başarılı' : '✗ Başarısız'}</strong>
              <p>{testResult.message}</p>
              {testResult.errorDetails && (
                <details>
                  <summary>Detaylar</summary>
                  <pre>{testResult.errorDetails}</pre>
                </details>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* LDAP User Search */}
      <div className="ldap-search-section">
        <h3>LDAP Kullanıcı Arama</h3>

        {autoTesting && (
          <div className="connection-checking">
            <p>◌ LDAP bağlantısı kontrol ediliyor, lütfen bekleyin...</p>
          </div>
        )}
        {!connectionTested && !autoTesting && (
          <div className="connection-warning">
            <p>⚠️ LDAP bağlantısı kurulamadı. Lütfen bağlantı ayarlarını kontrol edin.</p>
          </div>
        )}

        <form onSubmit={handleSearch} className="search-form">
          <div className="form-group">
            <label>Kullanıcı Adı Ara</label>
            <div className="search-input-group">
              <input
                type="text"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                placeholder="Kullanıcı adı girin"
                required
                disabled={!connectionTested || autoTesting}
              />
              <button type="submit" disabled={loading || !connectionTested || autoTesting}>
                {loading ? 'Aranıyor...' : 'Ara'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {searchResults.length > 0 && (
        <div className="search-results">
          <h3>Bulunan Kullanıcılar</h3>
          {searchResults.map((user, index) => (
            <div
              key={index}
              className={`result-item ${selectedUser === user ? 'selected' : ''}`}
              onClick={() => setSelectedUser(user)}
            >
              <div className="result-info">
                <strong>{user.fullName || user.username}</strong>
                <div className="result-details">
                  <span>Kullanıcı: {user.username}</span>
                  {user.email && <span>Email: {user.email}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedUser && (
        <div className="import-section">
          <h3>Import Ayarları</h3>
          <div className="selected-user">
            <strong>{selectedUser.fullName || selectedUser.username}</strong>
            <p>Kullanıcı Adı: {selectedUser.username}</p>
            {selectedUser.email && <p>Email: {selectedUser.email}</p>}
          </div>

          <div className="form-group">
            <label>Roller (Varsayılan: YAZILIMCI)</label>
            <div className="checkbox-group">
              {roles.map((role) => (
                <label key={role.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => handleRoleToggle(role.id)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>

          <button className="btn-import" onClick={handleImport}>
            Import Et
          </button>
        </div>
      )}
    </div>
  );
};

export default LdapImport;

