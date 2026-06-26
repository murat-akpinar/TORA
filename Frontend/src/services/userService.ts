import api from './api';
import { User } from '../types/User';
import { Task } from '../types/Task';

export interface Session {
  id: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

const refreshHeader = () => {
  const rt = localStorage.getItem('refreshToken');
  return rt ? { headers: { 'X-Refresh-Token': rt } } : undefined;
};

export const userService = {
  getAllUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/auth/users');
    return response.data;
  },

  getMyTasks: async (): Promise<Task[]> => {
    const response = await api.get<Task[]>('/users/me/tasks');
    return response.data;
  },

  updateProfile: async (fullName: string): Promise<void> => {
    await api.put('/users/me/profile', { fullName });
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await api.put('/users/me/password', { oldPassword, newPassword });
  },

  getSessions: async (): Promise<Session[]> => {
    const response = await api.get<Session[]>('/users/me/sessions', refreshHeader());
    return response.data;
  },

  revokeSession: async (id: number): Promise<void> => {
    await api.delete(`/users/me/sessions/${id}`);
  },

  logoutOtherSessions: async (): Promise<number> => {
    const response = await api.post<{ removed: number }>(
      '/users/me/sessions/logout-others', undefined, refreshHeader());
    return response.data.removed;
  },
};

