import { TaskStatus, Priority } from './Task';

export interface TaskSearchResult {
  id: number;
  title: string;
  status: TaskStatus;
  priority?: Priority;
  teamId: number;
  teamName: string;
  teamColor?: string;
  teamIcon?: string;
  startDate: string;
  endDate: string;
}

export interface ProjectSearchResult {
  id: number;
  name: string;
  description?: string;
  status: string;
}

export interface UserSearchResult {
  id: number;
  fullName: string;
  username: string;
  roles: string[];
}

export interface SearchResult {
  tasks: TaskSearchResult[];
  projects: ProjectSearchResult[];
  users: UserSearchResult[];
}

export interface SavedFilter {
  id: number;
  name: string;
  filterJson: string;
  createdAt: string;
}

export interface FilterState {
  statuses: string[];
  priorities: string[];
  labelIds: number[];
  assigneeId: number | null;
}

export const emptyFilter = (): FilterState => ({
  statuses: [],
  priorities: [],
  labelIds: [],
  assigneeId: null,
});
