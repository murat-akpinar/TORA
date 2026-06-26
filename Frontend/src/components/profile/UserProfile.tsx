import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { userService, Session } from '../../services/userService';
import { taskService } from '../../services/taskService';
import { Task, TaskStatus } from '../../types/Task';
import { getStatusLabel } from '../../utils/statusColors';
import { notify } from '../../utils/notify';
import { extractErrorMessage } from '../../utils/errorMessages';
import TaskModal from '../task/TaskModal';
import './UserProfile.css';

const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [openingTaskId, setOpeningTaskId] = useState<number | null>(null);
  const [loginHistory, setLoginHistory] = useState<Array<{ ipAddress: string; attemptTime: string; success: boolean }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [logoutOthersPending, setLogoutOthersPending] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      fetchTasks();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchLoginHistory();
      fetchSessions();
    }
  }, [activeTab]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await userService.getSessions();
      setSessions(data);
    } catch {
      // silently ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  const describeDevice = (userAgent: string | null): string => {
    if (!userAgent) return 'Bilinmeyen cihaz';
    const ua = userAgent;
    const browser =
      /Edg\//.test(ua) ? 'Edge' :
      /OPR\/|Opera/.test(ua) ? 'Opera' :
      /Chrome\//.test(ua) ? 'Chrome' :
      /Firefox\//.test(ua) ? 'Firefox' :
      /Safari\//.test(ua) ? 'Safari' : 'Tarayıcı';
    const os =
      /Windows/.test(ua) ? 'Windows' :
      /Android/.test(ua) ? 'Android' :
      /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
      /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
      /Linux/.test(ua) ? 'Linux' : '';
    return os ? `${browser} · ${os}` : browser;
  };

  const handleRevokeSession = async (id: number) => {
    try {
      await userService.revokeSession(id);
      notify.success('Oturum sonlandırıldı.');
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Oturum sonlandırılamadı.'));
    }
  };

  const handleLogoutOthers = async () => {
    setLogoutOthersPending(true);
    try {
      const removed = await userService.logoutOtherSessions();
      notify.success(removed > 0 ? `${removed} diğer oturum kapatıldı.` : 'Kapatılacak başka oturum yok.');
      await fetchSessions();
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Oturumlar kapatılamadı.'));
    } finally {
      setLogoutOthersPending(false);
    }
  };

  const fetchLoginHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get<Array<{ ipAddress: string; attemptTime: string; success: boolean }>>('/users/me/login-history');
      setLoginHistory(res.data);
    } catch {
      // silently ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await userService.getMyTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const openTask = async (task: Task) => {
    if (openingTaskId !== null) return;
    try {
      setOpeningTaskId(task.id);
      const full = await taskService.getTaskById(task.id);
      setSelectedTask(full);
      setTaskModalOpen(true);
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Görev açılamadı.'));
    } finally {
      setOpeningTaskId(null);
    }
  };

  const handleTaskModalSave = (savedTask: Task) => {
    setTasks((prev) =>
      prev.some((t) => t.id === savedTask.id)
        ? prev.map((t) => (t.id === savedTask.id ? savedTask : t))
        : [...prev, savedTask]
    );
    setSelectedTask(savedTask);
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await taskService.deleteTask(taskId);
      notify.success('İş silindi.');
      setTaskModalOpen(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (error) {
      notify.error(extractErrorMessage(error, 'İş silinemedi.'));
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      notify.warning('İsim boş olamaz.');
      return;
    }

    setUpdating(true);
    try {
      await userService.updateProfile(fullName);
      notify.success('Profil güncellendi.');
      window.location.reload();
    } catch (error: any) {
      notify.error(extractErrorMessage(error, 'Profil güncellenemedi.'));
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      notify.warning('Tüm alanlar doldurulmalıdır.');
      return;
    }

    if (newPassword.length < 6) {
      notify.warning('Yeni parola en az 6 karakter olmalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.warning('Yeni parola ve onay parolası eşleşmiyor.');
      return;
    }

    setChangingPassword(true);
    try {
      await userService.changePassword(oldPassword, newPassword);
      notify.success('Parola değiştirildi.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      notify.error(extractErrorMessage(error, 'Parola değiştirilemedi.'));
    } finally {
      setChangingPassword(false);
    }
  };

  const getRoleLabel = (roles: string[]): string => {
    if (roles.includes('ADMIN')) return 'Yönetici';
    if (roles.includes('BIRIM_AMIRI')) return 'Birim Amiri';
    if (roles.includes('YAZILIMCI')) return 'Yazılımcı';
    if (roles.includes('DEVOPS')) return 'DevOps';
    if (roles.includes('IS_ANALISTI')) return 'İş Analisti';
    if (roles.includes('TESTCI')) return 'Test Uzmanı';
    return roles.join(', ') || 'Kullanıcı';
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'OPEN': return 'badge-open';
      case 'IN_PROGRESS': return 'badge-progress';
      case 'TESTING': return 'badge-testing';
      case 'COMPLETED': return 'badge-completed';
      case 'CANCELLED': return 'badge-cancelled';
      default: return '';
    }
  };

  if (!user) {
    return <div className="loading">Kullanıcı bilgisi yükleniyor...</div>;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'Tünaydın' : 'İyi akşamlar';

  const sortedByStartDesc = [...tasks].sort(
    (a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()
  );
  const sortedByEndAsc = [...tasks].sort(
    (a, b) => new Date(a.endDate || 0).getTime() - new Date(b.endDate || 0).getTime()
  );

  const topTasks = sortedByStartDesc.slice(0, 5);
  const recentTasks = sortedByStartDesc.slice(0, 6);
  const upcomingTasks = sortedByEndAsc
    .filter((task) => task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED)
    .slice(0, 6);

  const projectMap = new Map<string, { total: number; completed: number; atRisk: number }>();
  tasks.forEach((task) => {
    const projectName = task.projectName?.trim() || 'Projesiz';
    const current = projectMap.get(projectName) || { total: 0, completed: 0, atRisk: 0 };
    current.total += 1;
    if (task.status === TaskStatus.COMPLETED) current.completed += 1;
    if (task.status === TaskStatus.CANCELLED) current.atRisk += 1;
    projectMap.set(projectName, current);
  });
  const projectRows = Array.from(projectMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const todayLabel = now.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const getDueLabel = (endDate: string): string => {
    const days = Math.ceil((new Date(endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)} gün gecikti`;
    if (days === 0) return 'Bugün';
    return `${days} gün kaldı`;
  };

  const rowKeyHandlers = (task: Task) => ({
    tabIndex: 0 as const,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void openTask(task);
      }
    },
  });

  return (
    <>
    <div className="user-profile">
      <div className="profile-topbar">
        <div>
          <h2>{greeting}, {user.fullName.toUpperCase()}!</h2>
          <p>{getRoleLabel(user.roles)} · @{user.username}</p>
        </div>
        <div className="profile-topbar-date">{todayLabel}</div>
      </div>

      <div className="profile-header-card compact">
        <div className="avatar-section">
          <div className="avatar">
            {user.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
        </div>
        <div className="tab-switcher">
          <button
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Ayarlar
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          <div className="dashboard-columns top-panels">
            <div className="dashboard-section table-panel">
              <div className="section-header">
                <h3>Görevlerim</h3>
                <span className="section-count">{tasks.length}</span>
              </div>
              <div className="section-content">
                {loading ? (
                  <div className="loading-mini">Yükleniyor...</div>
                ) : topTasks.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <p>Görev bulunamadı</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="tasks-table-v2">
                      <thead>
                        <tr>
                          <th>Görev</th>
                          <th>Proje</th>
                          <th>Durum</th>
                          <th>Bitiş</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topTasks.map((task) => (
                          <tr
                            key={task.id}
                            className="tasks-table-row-clickable"
                            onClick={() => void openTask(task)}
                            {...rowKeyHandlers(task)}
                          >
                            <td className="td-title">{task.title}</td>
                            <td>{task.projectName || '—'}</td>
                            <td>
                              <span className={`status-badge-v2 ${getStatusBadgeClass(task.status)}`}>
                                {getStatusLabel(task.status)}
                              </span>
                            </td>
                            <td className="td-date">
                              {task.endDate ? new Date(task.endDate).toLocaleDateString('tr-TR') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-section table-panel">
              <div className="section-header">
                <h3>Projelerim</h3>
                <span className="section-count">{projectRows.length}</span>
              </div>
              <div className="section-content">
                {loading ? (
                  <div className="loading-mini">Yükleniyor...</div>
                ) : projectRows.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📁</span>
                    <p>Proje bulunamadı</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="tasks-table-v2">
                      <thead>
                        <tr>
                          <th>Proje</th>
                          <th>Görev</th>
                          <th>Riskli</th>
                          <th>Tamamlanan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectRows.map((project) => (
                          <tr key={project.name}>
                            <td className="td-title">{project.name}</td>
                            <td>{project.total}</td>
                            <td>{project.atRisk}</td>
                            <td>{project.completed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dashboard-columns">
            <div className="dashboard-section">
              <div className="section-header">
                <h3>Son Eklenen Görevler</h3>
              </div>
              <div className="section-content">
                {loading ? (
                  <div className="loading-mini">Yükleniyor...</div>
                ) : recentTasks.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📝</span>
                    <p>Görev geçmişi yok</p>
                  </div>
                ) : (
                  <div className="task-cards">
                    {recentTasks.map((task) => (
                      <div
                        key={task.id}
                        className="task-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => void openTask(task)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void openTask(task);
                          }
                        }}
                      >
                        <div className="task-card-header">
                          <span className="task-card-title">{task.title}</span>
                          <span className={`status-mini ${getStatusBadgeClass(task.status)}`}>
                            {getStatusLabel(task.status)}
                          </span>
                        </div>
                        <div className="task-card-footer">
                          <span className="task-date">{task.teamName}</span>
                          <span className="task-date">
                            {task.startDate ? new Date(task.startDate).toLocaleDateString('tr-TR') : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-header">
                <h3>Yaklaşan Bitişler</h3>
              </div>
              <div className="section-content">
                {loading ? (
                  <div className="loading-mini">Yükleniyor...</div>
                ) : upcomingTasks.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">⏳</span>
                    <p>Yaklaşan teslim tarihi yok</p>
                  </div>
                ) : (
                  <div className="task-cards">
                    {upcomingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="task-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => void openTask(task)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void openTask(task);
                          }
                        }}
                      >
                        <div className="task-card-header">
                          <span className="task-card-title">{task.title}</span>
                          <span className="deadline-badge">
                            {task.endDate ? getDueLabel(task.endDate) : '—'}
                          </span>
                        </div>
                        <div className="task-card-footer">
                          <span className="task-date">{task.projectName || 'Projesiz'}</span>
                          <span className={`status-mini ${getStatusBadgeClass(task.status)}`}>
                            {getStatusLabel(task.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dashboard-section full-width">
            <div className="section-header">
              <h3>Tüm Görevler</h3>
              <span className="section-count">{tasks.length}</span>
            </div>
            <div className="section-content">
              {loading ? (
                <div className="loading-mini">Yükleniyor...</div>
              ) : tasks.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📭</span>
                  <p>Size atanmış görev bulunamadı.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="tasks-table-v2">
                    <thead>
                      <tr>
                        <th>Konu</th>
                        <th>Birim</th>
                        <th>Proje</th>
                        <th>Durum</th>
                        <th>Başlangıç</th>
                        <th>Bitiş</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr
                          key={task.id}
                          className="tasks-table-row-clickable"
                          onClick={() => void openTask(task)}
                          {...rowKeyHandlers(task)}
                        >
                          <td className="td-title">{task.title}</td>
                          <td><span className="meta-tag team-tag">{task.teamName}</span></td>
                          <td>{task.projectName || <span className="text-muted">—</span>}</td>
                          <td>
                            <span className={`status-badge-v2 ${getStatusBadgeClass(task.status)}`}>
                              {getStatusLabel(task.status)}
                            </span>
                          </td>
                          <td className="td-date">{task.startDate ? new Date(task.startDate).toLocaleDateString('tr-TR') : '—'}</td>
                          <td className="td-date">{task.endDate ? new Date(task.endDate).toLocaleDateString('tr-TR') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="settings-grid">
            <div className="dashboard-section">
              <div className="section-header">
                <h3>👤 Profil Bilgileri</h3>
              </div>
              <div className="section-content">
                <div className="profile-info">
                  <div className="info-item">
                    <label>Kullanıcı Adı</label>
                    <span>{user.username}</span>
                  </div>
                  <div className="info-item">
                    <label>Email</label>
                    <span>{user.email}</span>
                  </div>
                  <div className="info-item">
                    <label>İsim Soyisim</label>
                    <span>{user.fullName}</span>
                  </div>
                  <div className="info-item">
                    <label>Rol</label>
                    <span className="role-text">{getRoleLabel(user.roles)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-header">
                <h3>✏️ İsim Değiştir</h3>
              </div>
              <div className="section-content">
                <form onSubmit={handleUpdateProfile} className="profile-form">
                  <div className="form-group">
                    <label>Yeni İsim Soyisim</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-submit" disabled={updating}>
                    {updating ? 'Güncelleniyor...' : 'Güncelle'}
                  </button>
                </form>
              </div>
            </div>

            <div className="dashboard-section full-width">
              <div className="section-header">
                <h3>🔒 Parola Değiştir</h3>
              </div>
              <div className="section-content">
                <form onSubmit={handleChangePassword} className="profile-form">
                  <div className="password-fields">
                    <div className="form-group">
                      <label>Eski Parola</label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Yeni Parola</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="form-group">
                      <label>Yeni Parola (Tekrar)</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-submit" disabled={changingPassword}>
                    {changingPassword ? 'Değiştiriliyor...' : 'Parola Değiştir'}
                  </button>
                </form>
              </div>
            </div>
            <div className="dashboard-section full-width">
              <div className="section-header">
                <h3>💻 Aktif Oturumlar</h3>
                {sessions.length > 1 && (
                  <button
                    className="btn-submit btn-inline"
                    onClick={handleLogoutOthers}
                    disabled={logoutOthersPending}
                  >
                    {logoutOthersPending ? 'Kapatılıyor...' : 'Diğer cihazlardan çıkış yap'}
                  </button>
                )}
              </div>
              <div className="section-content">
                {loadingSessions ? (
                  <div className="loading-mini">Yükleniyor...</div>
                ) : sessions.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">💻</span>
                    <p>Aktif oturum bulunamadı</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="tasks-table-v2">
                      <thead>
                        <tr>
                          <th>Cihaz</th>
                          <th>IP Adresi</th>
                          <th>Başlangıç</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.id}>
                            <td className="td-title">{describeDevice(s.userAgent)}</td>
                            <td>{s.ipAddress || '—'}</td>
                            <td className="td-date">
                              {new Date(s.createdAt + 'Z').toLocaleString('tr-TR')}
                            </td>
                            <td>
                              {s.current ? (
                                <span className="status-badge-v2 badge-completed">Bu cihaz</span>
                              ) : (
                                <button
                                  className="session-revoke-btn"
                                  onClick={() => handleRevokeSession(s.id)}
                                >
                                  Sonlandır
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-section full-width">
              <div className="section-header">
                <h3>🔐 Giriş Geçmişi</h3>
              </div>
              <div className="section-content">
                {loadingHistory ? (
                  <div className="loading-mini">Yükleniyor...</div>
                ) : loginHistory.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">🔍</span>
                    <p>Giriş geçmişi bulunamadı</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="tasks-table-v2">
                      <thead>
                        <tr>
                          <th>IP Adresi</th>
                          <th>Tarih / Saat</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginHistory.map((entry, idx) => (
                          <tr key={idx}>
                            <td>{entry.ipAddress}</td>
                            <td className="td-date">
                              {new Date(entry.attemptTime + 'Z').toLocaleString('tr-TR')}
                            </td>
                            <td>
                              <span className={`status-badge-v2 ${entry.success ? 'badge-completed' : 'badge-cancelled'}`}>
                                {entry.success ? 'Başarılı' : 'Başarısız'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>

    <TaskModal
      isOpen={taskModalOpen}
      onClose={() => {
        setTaskModalOpen(false);
        setSelectedTask(null);
      }}
      onSave={handleTaskModalSave}
      onDelete={handleDeleteTask}
      task={selectedTask}
      defaultTeamId={selectedTask?.teamId}
      defaultProjectId={selectedTask?.projectId}
    />
    </>
  );
};

export default UserProfile;
