export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DUE_SOON'
  | 'COMMENT_MENTION'
  | 'COMMENT_ON_TASK';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string | null;
  relatedTaskId: number | null;
  relatedTaskTitle: string | null;
  relatedCommentId: number | null;
  actorUserId: number | null;
  actorUsername: string | null;
  actorFullName: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  content: AppNotification[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  unreadCount: number;
}
