import api from './api';
import { TaskComment, TaskCommentRequest } from '../types/TaskComment';

export const taskCommentService = {
  list: async (taskId: number): Promise<TaskComment[]> => {
    const response = await api.get<TaskComment[]>(`/tasks/${taskId}/comments`);
    return response.data;
  },

  create: async (taskId: number, request: TaskCommentRequest): Promise<TaskComment> => {
    const response = await api.post<TaskComment>(`/tasks/${taskId}/comments`, request);
    return response.data;
  },

  update: async (commentId: number, request: TaskCommentRequest): Promise<TaskComment> => {
    const response = await api.put<TaskComment>(`/comments/${commentId}`, request);
    return response.data;
  },

  delete: async (commentId: number): Promise<void> => {
    await api.delete(`/comments/${commentId}`);
  },
};
