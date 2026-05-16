import api from './api';
import { AppNotification, NotificationPage } from '../types/Notification';

export const notificationService = {
  list: async (page = 0, size = 20): Promise<NotificationPage> => {
    const response = await api.get<NotificationPage>(`/notifications?page=${page}&size=${size}`);
    return response.data;
  },

  unreadCount: async (): Promise<number> => {
    const response = await api.get<{ unreadCount: number }>(`/notifications/unread-count`, {
      // Polling sırasında oluşan beklenmedik hatalarla global toast spamlanmasın
      headers: { 'X-Silent-Error': 'true' },
    });
    return response.data.unreadCount;
  },

  markRead: async (id: number): Promise<AppNotification> => {
    const response = await api.put<AppNotification>(`/notifications/${id}/read`);
    return response.data;
  },

  markAllRead: async (): Promise<number> => {
    const response = await api.put<{ updated: number }>(`/notifications/read-all`);
    return response.data.updated;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/notifications/${id}`);
  },

  deleteAll: async (): Promise<number> => {
    const response = await api.delete<{ removed: number }>(`/notifications`);
    return response.data.removed;
  },
};
