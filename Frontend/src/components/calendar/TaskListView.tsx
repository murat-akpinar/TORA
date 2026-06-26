import React, { useMemo, useState, useEffect } from 'react';
import { Task, TaskStatus } from '../../types/Task';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  parseISO,
  addWeeks,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { getStatusColor, getStatusLabel } from '../../utils/statusColors';
import { taskService } from '../../services/taskService';
import { userService } from '../../services/userService';
import { useAuth } from '../../hooks/useAuth';
import { notify } from '../../utils/notify';
import { extractErrorMessage } from '../../utils/errorMessages';
import './TaskListView.css';

export interface TaskListViewProps {
  tasks: Task[];
  month: number;
  year: number;
  selectedWeek?: number;
  weeksInMonth?: number;
  onTaskClick?: (task: Task) => void;
  onBulkComplete?: () => void;
}

const BULK_STATUSES: TaskStatus[] = [
  TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.TESTING, TaskStatus.COMPLETED, TaskStatus.CANCELLED,
];

const AVATAR_BG = ['#cba6f7', '#89b4fa', '#a6e3a1', '#f9e2af', '#eba0ac', '#f5c2e7', '#94e2d5'];

function avatarColorForUserId(id: number): string {
  return AVATAR_BG[Math.abs(id) % AVATAR_BG.length];
}

const PAGE_SIZE = 20;

const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  month,
  year,
  selectedWeek,
  weeksInMonth,
  onTaskClick,
  onBulkComplete,
}) => {
  const { hasRole } = useAuth();
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [users, setUsers] = useState<{ id: number; fullName: string }[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const canDelete = hasRole('ADMIN') || hasRole('BIRIM_AMIRI');

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [tasks, month, year, selectedWeek]);

  useEffect(() => {
    userService.getAllUsers()
      .then((us) => setUsers(us.map((u) => ({ id: u.id, fullName: u.fullName }))))
      .catch(() => { /* atama listesi yüklenemedi */ });
  }, []);

  const toggleSelect = (taskId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const runBulk = async (req: Parameters<typeof taskService.bulkOperation>[0]) => {
    setBulkBusy(true);
    try {
      const res = await taskService.bulkOperation(req);
      if (res.failed > 0) {
        notify.warning(`${res.succeeded} işlem başarılı, ${res.failed} başarısız.`);
      } else {
        notify.success(`${res.succeeded} görev güncellendi.`);
      }
      setSelectedIds(new Set());
      onBulkComplete?.();
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Toplu işlem başarısız.'));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkStatus = (status: string) => {
    if (!status) return;
    void runBulk({ action: 'STATUS', taskIds: Array.from(selectedIds), status: status as TaskStatus });
  };

  const handleBulkAssign = (assigneeId: string) => {
    if (!assigneeId) return;
    void runBulk({ action: 'ASSIGN', taskIds: Array.from(selectedIds), assigneeId: Number(assigneeId) });
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`${selectedIds.size} görev silinecek. Emin misiniz?`)) return;
    void runBulk({ action: 'DELETE', taskIds: Array.from(selectedIds) });
  };

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const tasksInScope = useMemo(() => {
    let rangeStart: Date;
    let rangeEnd: Date;

    if (selectedWeek && selectedWeek > 0 && weeksInMonth) {
      const firstWeekStart = startOfWeek(monthStart, { locale: tr, weekStartsOn: 1 });
      const weekStart = addWeeks(firstWeekStart, selectedWeek - 1);
      rangeStart = weekStart;
      rangeEnd = endOfWeek(weekStart, { locale: tr, weekStartsOn: 1 });
    } else {
      rangeStart = startOfWeek(monthStart, { locale: tr, weekStartsOn: 1 });
      rangeEnd = endOfWeek(monthEnd, { locale: tr, weekStartsOn: 1 });
    }

    return tasks.filter((t) => {
      const ts = parseISO(t.startDate);
      ts.setHours(0, 0, 0, 0);
      const te = parseISO(t.endDate);
      te.setHours(23, 59, 59, 999);
      return !(te < rangeStart || ts > rangeEnd);
    });
  }, [tasks, month, year, selectedWeek, weeksInMonth]);

  const organizedTasks = useMemo(() => {
    const parentTasks = tasksInScope.filter((t) => !t.subtasks || t.subtasks.length === 0);
    const tasksWithSubtasks = tasksInScope.filter((t) => t.subtasks && t.subtasks.length > 0);
    const result: Array<{ task: Task; level: number; isSubtask: boolean; rowKey: string }> = [];

    tasksWithSubtasks.forEach((parent) => {
      result.push({ task: parent, level: 0, isSubtask: false, rowKey: `p-${parent.id}` });
      if (expandedTasks.has(parent.id)) {
        parent.subtasks?.forEach((subtask, si) => {
          const subtaskAsTask: Task = {
            id: subtask.id || 0,
            title: subtask.title,
            content: subtask.content,
            startDate: subtask.startDate || parent.startDate,
            endDate: subtask.endDate || parent.endDate,
            status: subtask.isCompleted ? TaskStatus.COMPLETED : TaskStatus.IN_PROGRESS,
            labels: parent.labels,
            priority: parent.priority,
            teamId: parent.teamId,
            teamName: parent.teamName,
            teamColor: parent.teamColor,
            teamIcon: parent.teamIcon,
            projectId: parent.projectId,
            projectName: parent.projectName,
            createdById: parent.createdById,
            createdByName: parent.createdByName,
            assigneeIds: subtask.assigneeId ? [subtask.assigneeId] : [],
            assigneeNames: subtask.assigneeName ? [subtask.assigneeName] : [],
            subtasks: [],
          };
          result.push({
            task: subtaskAsTask,
            level: 1,
            isSubtask: true,
            rowKey: `s-${parent.id}-${subtask.id}-${si}`,
          });
        });
      }
    });

    parentTasks.forEach((task) => {
      if (!tasksWithSubtasks.find((t) => t.id === task.id)) {
        result.push({ task, level: 0, isSubtask: false, rowKey: `p-${task.id}` });
      }
    });

    return result;
  }, [tasksInScope, expandedTasks]);

  const toggleExpand = (taskId: number) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const getPriorityLabel = (priority?: string): string => {
    switch (priority) {
      case 'HIGH':
        return 'Yüksek';
      case 'URGENT':
        return 'Acil';
      default:
        return 'Normal';
    }
  };

  const getPriorityClass = (priority?: string): string => {
    switch (priority) {
      case 'URGENT':
        return 'pri-urgent';
      case 'HIGH':
        return 'pri-high';
      default:
        return 'pri-normal';
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const totalPages = Math.ceil(organizedTasks.length / PAGE_SIZE);
  const pagedTasks = organizedTasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const pageParentIds = pagedTasks.filter((r) => !r.isSubtask).map((r) => r.task.id);
  const allPageSelected = pageParentIds.length > 0 && pageParentIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageParentIds.forEach((id) => next.delete(id));
      else pageParentIds.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div className="task-list-view">
      {selectedIds.size > 0 && (
        <div className="task-bulk-bar">
          <span className="task-bulk-count">{selectedIds.size} seçili</span>
          <select
            className="task-bulk-select"
            value=""
            disabled={bulkBusy}
            onChange={(e) => handleBulkStatus(e.target.value)}
          >
            <option value="">Durum değiştir…</option>
            {BULK_STATUSES.map((s) => (
              <option key={s} value={s}>{getStatusLabel(s)}</option>
            ))}
          </select>
          <select
            className="task-bulk-select"
            value=""
            disabled={bulkBusy}
            onChange={(e) => handleBulkAssign(e.target.value)}
          >
            <option value="">Ata (ekle)…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
          {canDelete && (
            <button className="task-bulk-delete" disabled={bulkBusy} onClick={handleBulkDelete}>
              Sil
            </button>
          )}
          <button className="task-bulk-clear" disabled={bulkBusy} onClick={() => setSelectedIds(new Set())}>
            Seçimi temizle
          </button>
        </div>
      )}
      <div className="task-list-scroll">
        <table className="task-list-table">
          <thead>
            <tr>
              <th className="col-select">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAll}
                  aria-label="Tümünü seç"
                />
              </th>
              <th className="col-title">Başlık</th>
              <th className="col-project">Proje</th>
              <th className="col-assignees">Atanan</th>
              <th className="col-type">Tür</th>
              <th className="col-priority">Öncelik</th>
              <th className="col-status">Durum</th>
              <th className="col-date">Başlangıç</th>
              <th className="col-date">Bitiş</th>
            </tr>
          </thead>
          <tbody>
            {organizedTasks.length === 0 ? (
              <tr>
                <td colSpan={9} className="task-list-empty">
                  Bu dönemde gösterilecek iş yok.
                </td>
              </tr>
            ) : (
              pagedTasks.map(({ task, level, isSubtask, rowKey }) => {
                const hasSubtasks = !!(task.subtasks && task.subtasks.length > 0);
                const isExpanded = expandedTasks.has(task.id);

                return (
                  <tr
                    key={rowKey}
                    className={`task-list-row ${isSubtask ? 'is-subtask' : ''} ${!isSubtask && selectedIds.has(task.id) ? 'is-selected' : ''}`}
                    onClick={() => onTaskClick?.(task)}
                  >
                    <td className="col-select" onClick={(e) => e.stopPropagation()}>
                      {!isSubtask && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(task.id)}
                          onChange={() => toggleSelect(task.id)}
                          aria-label="Görevi seç"
                        />
                      )}
                    </td>
                    <td className="col-title">
                      <div
                        className="task-list-title-cell"
                        style={{ paddingLeft: `${level * 20}px` }}
                      >
                        {hasSubtasks && (
                          <button
                            type="button"
                            className="task-list-expand"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(task.id);
                            }}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        )}
                        {task.teamIcon && (
                          <span
                            className="task-list-team-ico"
                            style={{ color: task.teamColor || 'var(--ctp-text)' }}
                          >
                            {task.teamIcon}
                          </span>
                        )}
                        {!task.teamIcon && task.teamColor && (
                          <span
                            className="task-list-team-dot"
                            style={{ backgroundColor: task.teamColor }}
                          />
                        )}
                        <span className="task-list-title-text">{task.title}</span>
                      </div>
                    </td>
                    <td className="col-project">
                      {task.projectName ? (
                        <span className="task-list-project">
                          {task.teamColor && (
                            <span
                              className="task-list-project-dot"
                              style={{ backgroundColor: task.teamColor }}
                            />
                          )}
                          {task.projectName}
                        </span>
                      ) : (
                        <span className="task-list-dash">—</span>
                      )}
                    </td>
                    <td className="col-assignees">
                      {task.assigneeNames && task.assigneeNames.length > 0 ? (
                        <div
                          className="task-list-assignee-stack"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.assigneeNames.map((name, idx) => {
                            const uid = task.assigneeIds?.[idx] ?? idx + 100_000;
                            return (
                              <span
                                key={`${task.id}-asg-${idx}-${uid}`}
                                className="task-list-avatar"
                                style={{ backgroundColor: avatarColorForUserId(uid) }}
                                title={name}
                              >
                                {getInitials(name)}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="task-list-dash">—</span>
                      )}
                    </td>
                    <td className="col-type">
                      {task.labels && task.labels.length > 0 ? (
                        <div className="task-list-labels">
                          {task.labels.map((label) => (
                            <span
                              key={label.id}
                              className="task-list-type-pill"
                              style={{ borderLeft: `3px solid ${label.color}` }}
                              title={label.name}
                            >
                              <span
                                className="task-list-type-dot"
                                style={{ backgroundColor: label.color }}
                              />
                              {label.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="task-list-dash">—</span>
                      )}
                    </td>
                    <td className="col-priority">
                      <span className={`task-list-priority ${getPriorityClass(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </td>
                    <td className="col-status">
                      <span className="task-list-status">
                        <span
                          className="task-list-status-dot"
                          style={{ backgroundColor: getStatusColor(task.status) }}
                        />
                        {getStatusLabel(task.status)}
                      </span>
                    </td>
                    <td className="col-date">
                      {format(parseISO(task.startDate), 'd MMM yyyy', { locale: tr })}
                    </td>
                    <td className="col-date">
                      {format(parseISO(task.endDate), 'd MMM yyyy', { locale: tr })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="task-list-pagination">
          <button
            className="task-list-page-btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`task-list-page-btn${i === page ? ' active' : ''}`}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
          <button
            className="task-list-page-btn"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
          >
            ›
          </button>
          <span className="task-list-page-info">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, organizedTasks.length)} / {organizedTasks.length}
          </span>
        </div>
      )}
    </div>
  );
};

export default TaskListView;
