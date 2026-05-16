export interface PerformancePeriod {
  period: string;
  created: number;
  completed: number;
  cancelled: number;
  inProgress: number;
  testing: number;
  open: number;
  total: number;
}

export interface UnitComparison {
  teamId: number;
  teamName: string;
  teamColor: string;
  teamIcon: string;
  total: number;
  completed: number;
  open: number;
  inProgress: number;
  testing: number;
  cancelled: number;
  completionRate: number;
}

export interface UserProductivity {
  userId: number;
  userName: string;
  assigned: number;
  completed: number;
  cancelled: number;
  open: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
}

export interface ProcessDurationItem {
  label: string;
  avgDays: number;
  count: number;
}

export interface ProcessDuration {
  avgDaysToComplete: number;
  minDays: number;
  maxDays: number;
  completedCount: number;
  byPriority: ProcessDurationItem[];
  byTeam: ProcessDurationItem[];
}

export interface SubtaskReportItem {
  id: number;
  title: string;
  completed: boolean;
  startDate: string | null;
  endDate: string | null;
  assignee: string | null;
}

export interface TaskListReportItem {
  id: number;
  title: string;
  teamName: string;
  projectName: string | null;
  priority: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  assignees: string;
  subtaskTotal: number;
  subtaskCompleted: number;
  subtasks: SubtaskReportItem[];
}
