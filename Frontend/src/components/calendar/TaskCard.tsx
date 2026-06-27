import React from 'react';
import { Task, SlaStatus } from '../../types/Task';
import { getStatusColor, getStatusLabel } from '../../utils/statusColors';
import { formatDate } from '../../utils/dateUtils';
import { getDay, parseISO } from 'date-fns';
import './TaskCard.css';

const SLA_META: Record<SlaStatus, { label: string; cls: string }> = {
  [SlaStatus.ON_TRACK]: { label: 'SLA: zamanında', cls: 'sla-ontrack' },
  [SlaStatus.AT_RISK]: { label: 'SLA: riskli', cls: 'sla-atrisk' },
  [SlaStatus.BREACHED]: { label: 'SLA: aşıldı', cls: 'sla-breached' },
  [SlaStatus.MET]: { label: 'SLA ✓', cls: 'sla-met' },
};

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const statusColor = getStatusColor(task.status);
  const statusLabel = getStatusLabel(task.status);
  
  const getPriorityIcon = (priority?: string): string => {
    switch (priority) {
      case 'URGENT':
        return '🔴';
      case 'HIGH':
        return '🟠';
      default:
        return '⚪';
    }
  };
  
  const getPriorityColor = (priority?: string): string => {
    switch (priority) {
      case 'URGENT':
        return '#eba0ac'; // Maroon (daha açık kırmızı)
      case 'HIGH':
        return '#f2cdcd'; // Flamingo (daha açık turuncu)
      default:
        return '#7f849c'; // Overlay1 (daha açık gri)
    }
  };
  
  // Hafta sonu kontrolü
  const taskStart = parseISO(task.startDate);
  const taskEnd = parseISO(task.endDate);
  const hasWeekend = (() => {
    let current = new Date(taskStart);
    while (current <= taskEnd) {
      const dayOfWeek = getDay(current);
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return true;
      }
      current.setDate(current.getDate() + 1);
    }
    return false;
  })();

  return (
    <div
      className={`task-card ${hasWeekend ? 'has-weekend' : ''}`}
      style={{ 
        borderLeftWidth: '4px',
        borderLeftStyle: 'solid',
        borderLeftColor: getPriorityColor(task.priority),
      }}
      onClick={onClick}
    >
      <div className="task-header">
        <div className="task-title-row">
          {task.teamIcon && (
            <span className="team-icon" style={{ color: task.teamColor || 'var(--ctp-text)' }}>
              {task.teamIcon}
            </span>
          )}
          {task.teamColor && !task.teamIcon && (
            <span 
              className="team-color-indicator" 
              style={{ 
                backgroundColor: task.teamColor,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                display: 'inline-block',
                marginRight: '6px'
              }}
            />
          )}
          <span className="priority-icon">{getPriorityIcon(task.priority)}</span>
          <div className="task-title">
            {task.code && (
              <span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.65, marginRight: '5px' }}>
                {task.code}
              </span>
            )}
            {task.title}
          </div>
        </div>
        <div
          className="task-status-badge"
          style={{ backgroundColor: statusColor, color: '#000000' }}
        >
          {statusLabel}
        </div>
      </div>
      {task.content && (
        <div className="task-content">{task.content.substring(0, 100)}...</div>
      )}
      <div className="task-meta">
        <div>
          {formatDate(task.startDate)} - {formatDate(task.endDate)}
        </div>
      </div>
      {task.slaStatus && SLA_META[task.slaStatus] && (
        <div className={`sla-chip ${SLA_META[task.slaStatus].cls}`}>
          {SLA_META[task.slaStatus].label}
        </div>
      )}
      {task.assigneeNames && task.assigneeNames.length > 0 && (
        <div className="task-assignees">
          Atanan: {task.assigneeNames.join(', ')}
        </div>
      )}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="task-subtasks">
          Alt işler: {task.subtasks.length} (
          {task.subtasks.filter((s) => s.isCompleted).length} tamamlandı)
        </div>
      )}
    </div>
  );
};

export default TaskCard;

