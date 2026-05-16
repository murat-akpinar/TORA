import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppNotification, NotificationType } from '../../types/Notification';
import LoadingSpinner from '../common/LoadingSpinner';
import { useToast } from '../common/Toast';
import { extractErrorMessage } from '../../utils/errorMessages';
import './NotificationPanel.css';

interface NotificationPanelProps {
  notifications: AppNotification[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onDeleteAll: () => Promise<void>;
  onClose: () => void;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  TASK_ASSIGNED: 'İş Atandı',
  TASK_STATUS_CHANGED: 'Durum Değişti',
  TASK_DUE_SOON: 'Son Tarih Yaklaşıyor',
  COMMENT_MENTION: 'Bahsedildiniz',
  COMMENT_ON_TASK: 'Yeni Yorum',
};

const TYPE_ICONS: Record<NotificationType, string> = {
  TASK_ASSIGNED: '◎',
  TASK_STATUS_CHANGED: '↻',
  TASK_DUE_SOON: '!',
  COMMENT_MENTION: '@',
  COMMENT_ON_TASK: '✎',
};

const formatTime = (iso: string): string => {
  // Backend LocalDateTime has no timezone suffix → treat as UTC
  const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  const created = new Date(normalized);
  const diffMs = Date.now() - created.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return created.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  loading,
  hasMore,
  onLoadMore,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onDeleteAll,
  onClose,
}) => {
  const navigate = useNavigate();
  const toast = useToast();

  const handleClick = async (n: AppNotification) => {
    try {
      if (!n.isRead) {
        await onMarkRead(n.id);
      }
      if (n.relatedTaskId) {
        // Takvim sayfasında ?taskId=... parametresini yakalayıp TaskModal'ı açıyoruz.
        navigate(`/?taskId=${n.relatedTaskId}`);
        onClose();
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Bildirim güncellenemedi.'));
    }
  };

  const handleMarkAll = async () => {
    try {
      await onMarkAllRead();
      toast.success('Tüm bildirimler okundu olarak işaretlendi.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Bildirimler güncellenemedi.'));
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onDelete(id);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Bildirim silinemedi.'));
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Tüm bildirimleri silmek istediğinize emin misiniz?')) return;
    try {
      await onDeleteAll();
      toast.success('Tüm bildirimler silindi.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Bildirimler silinemedi.'));
    }
  };

  return (
    <div
      className="notification-panel"
      role="dialog"
      aria-label="Bildirim listesi"
    >
      <header className="notification-panel__header">
        <h3>Bildirimler</h3>
        <div className="notification-panel__header-actions">
          <button
            type="button"
            className="notification-panel__action"
            onClick={handleMarkAll}
            disabled={notifications.every((n) => n.isRead)}
          >
            Tümünü okundu yap
          </button>
          <button
            type="button"
            className="notification-panel__action notification-panel__action--danger"
            onClick={handleDeleteAll}
            disabled={notifications.length === 0}
          >
            Hepsini sil
          </button>
        </div>
      </header>

      <div className="notification-panel__list" role="list">
        {loading && notifications.length === 0 ? (
          <LoadingSpinner size="sm" showLabel label="Bildirimler yükleniyor..." />
        ) : notifications.length === 0 ? (
          <div className="notification-panel__empty">Henüz bildirim yok.</div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              role="listitem"
              type="button"
              className={`notification-item${n.isRead ? ' notification-item--read' : ' notification-item--unread'}`}
              onClick={() => handleClick(n)}
            >
              <span
                className={`notification-item__icon notification-item__icon--${n.type.toLowerCase()}`}
                aria-hidden="true"
              >
                {TYPE_ICONS[n.type]}
              </span>
              <div className="notification-item__body">
                <div className="notification-item__top">
                  <span className="notification-item__type">{TYPE_LABELS[n.type]}</span>
                  <span className="notification-item__time">{formatTime(n.createdAt)}</span>
                </div>
                <div className="notification-item__title">{n.title}</div>
                {n.message && <div className="notification-item__message">{n.message}</div>}
                {n.relatedTaskTitle && (
                  <div className="notification-item__task">📌 {n.relatedTaskTitle}</div>
                )}
              </div>
              <button
                type="button"
                className="notification-item__delete"
                onClick={(e) => handleDelete(n.id, e)}
                aria-label="Bildirimi sil"
              >
                ×
              </button>
            </button>
          ))
        )}
      </div>

      {hasMore && (
        <footer className="notification-panel__footer">
          <button
            type="button"
            className="notification-panel__load-more"
            onClick={() => onLoadMore()}
            disabled={loading}
          >
            {loading ? 'Yükleniyor...' : 'Daha fazla yükle'}
          </button>
        </footer>
      )}
    </div>
  );
};

export default NotificationPanel;
