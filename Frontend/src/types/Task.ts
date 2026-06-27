export enum TaskStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  TESTING = 'TESTING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface TaskLabel {
  id: number;
  name: string;
  color: string;
  teamId: number;
}

export enum Priority {
  NORMAL = 'NORMAL',  // Normal
  HIGH = 'HIGH',      // Yüksek
  URGENT = 'URGENT',  // Acil
}

export enum SlaStatus {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  BREACHED = 'BREACHED',
  MET = 'MET',
}

export interface Subtask {
  id: number;
  title: string;
  content?: string;
  startDate?: string;
  endDate?: string;
  assigneeId?: number;
  assigneeName?: string;
  isCompleted: boolean;
}

// Tamamlanınca otomatik açılacak takip görevi (zincir)
export interface TaskChain {
  id?: number;
  title: string;
  content?: string;
  targetTeamId: number;
  targetTeamName?: string;
  targetProjectId?: number;
  priority?: Priority;
  durationDays: number;
  assigneeIds?: number[];
  triggeredAt?: string;
}

export interface Task {
  id: number;
  title: string;
  content?: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  priority?: Priority;
  labels?: TaskLabel[];
  teamId: number;
  teamName: string;
  teamColor?: string;
  teamIcon?: string;
  projectId?: number;
  projectName?: string;
  projectManagerId?: number;
  createdById: number;
  createdByName: string;
  assigneeIds: number[];
  assigneeNames: string[];
  subtasks: Subtask[];
  slaStatus?: SlaStatus;
  slaDueAt?: string;
  chains?: TaskChain[];
  spawnedFromTaskId?: number;
  spawnedFromTitle?: string;
}

export interface CreateTaskRequest {
  title: string;
  content?: string;
  startDate: string;
  endDate: string;
  status?: TaskStatus;
  priority?: Priority;
  teamId: number;
  projectId?: number;
  assigneeIds?: number[];
  labelIds?: number[];
  newLabelNames?: string[];
  subtasks?: CreateSubtaskRequest[];
  chains?: TaskChain[];
}

export interface CreateSubtaskRequest {
  title: string;
  content?: string;
  startDate?: string;
  endDate?: string;
  assigneeId?: number;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
  changeReason?: string;
}

