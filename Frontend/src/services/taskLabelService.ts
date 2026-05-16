import api from './api';
import { TaskLabel } from '../types/Task';

export const taskLabelService = {
  search: async (teamId: number, search?: string): Promise<TaskLabel[]> => {
    const params = new URLSearchParams({ teamId: String(teamId) });
    if (search && search.trim()) params.set('search', search.trim());
    const res = await api.get(`/task-labels?${params}`);
    return res.data;
  },
};
