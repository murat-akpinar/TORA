import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationService } from '../services/notificationService';
import { AppNotification } from '../types/Notification';
import { useAuth } from './useAuth';

interface UseNotificationsResult {
  unreadCount: number;
  notifications: AppNotification[];
  loading: boolean;
  hasMore: boolean;
  loadFirstPage: () => Promise<void>;
  loadMore: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  removeOne: (id: number) => Promise<void>;
  removeAll: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000;
const PAGE_SIZE = 20;

export const useNotifications = (): UseNotificationsResult => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pollTimerRef = useRef<number | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const count = await notificationService.unreadCount();
      setUnreadCount(count);
    } catch {
      // Polling sessiz hata
    }
  }, [isAuthenticated]);

  const loadFirstPage = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await notificationService.list(0, PAGE_SIZE);
      setNotifications(data.content);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadMore = useCallback(async () => {
    if (!isAuthenticated) return;
    if (page + 1 >= totalPages) return;
    setLoading(true);
    try {
      const next = page + 1;
      const data = await notificationService.list(next, PAGE_SIZE);
      setNotifications((prev) => [...prev, ...data.content]);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, page, totalPages]);

  const markRead = useCallback(async (id: number) => {
    const updated = await notificationService.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationService.markAllRead();
    setNotifications((prev) =>
      prev.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);
  }, []);

  const removeOne = useCallback(async (id: number) => {
    await notificationService.delete(id);
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && !target.isRead) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== id);
    });
  }, []);

  const removeAll = useCallback(async () => {
    await notificationService.deleteAll();
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // İlk yüklemede unread sayısını çek + polling başlat
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }
    refreshUnread();
    pollTimerRef.current = window.setInterval(refreshUnread, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isAuthenticated, refreshUnread]);

  return {
    unreadCount,
    notifications,
    loading,
    hasMore: page + 1 < totalPages,
    loadFirstPage,
    loadMore,
    refreshUnread,
    markRead,
    markAllRead,
    removeOne,
    removeAll,
  };
};
