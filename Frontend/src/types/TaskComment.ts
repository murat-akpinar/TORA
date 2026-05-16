export interface MentionedUser {
  userId: number;
  username: string;
  fullName: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  authorId: number;
  authorUsername: string;
  authorFullName: string;
  content: string;
  isEdited: boolean;
  mentions: MentionedUser[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskCommentRequest {
  content: string;
}
