import React, { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationPanel from './NotificationPanel';
import './NotificationBell.css';

const NotificationBell: React.FC = () => {
  const {
    unreadCount,
    notifications,
    loading,
    hasMore,
    loadFirstPage,
    loadMore,
    markRead,
    markAllRead,
    removeOne,
    removeAll,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        await loadFirstPage();
      } catch {
        // hata akışını bozmasın, kullanıcı tekrar açabilir
      }
    }
  };

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className={`notification-bell__button${unreadCount > 0 ? ' has-unread' : ''}`}
        aria-label={
          unreadCount > 0
            ? `Bildirimler: ${unreadCount} okunmamış`
            : 'Bildirimler'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-bell__badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          notifications={notifications}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onDelete={removeOne}
          onDeleteAll={removeAll}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

export default NotificationBell;
