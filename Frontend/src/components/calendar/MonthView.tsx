import React from 'react';
import { Task } from '../../types/Task';
import { getMonthName, getSeasonForMonth, getSeasonColor } from '../../utils/dateUtils';
import './MonthView.css';

interface MonthViewProps {
  tasks: Task[];
  onMonthClick: (month: number) => void;
  selectedYear: number;
}

const MonthView: React.FC<MonthViewProps> = ({ tasks, onMonthClick, selectedYear }) => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const isCurrentYear = selectedYear === currentYear;

  const getTaskCountForMonth = (month: number) => {
    return tasks.filter(
      (task) => new Date(task.startDate).getMonth() + 1 === month
    ).length;
  };

  const getStatusCountForMonth = (month: number, status: string) => {
    return tasks.filter(
      (task) =>
        new Date(task.startDate).getMonth() + 1 === month &&
        task.status === status
    ).length;
  };

  return (
    <div className="month-grid">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
        const taskCount = getTaskCountForMonth(month);
        const openCount = getStatusCountForMonth(month, 'OPEN');
        const inProgressCount = getStatusCountForMonth(month, 'IN_PROGRESS');
        const completedCount = getStatusCountForMonth(month, 'COMPLETED');
        const season = getSeasonForMonth(month);
        const isCurrentMonth = isCurrentYear && month === currentMonth;
        const seasonColor = getSeasonColor(season, isCurrentMonth);
        const completedPercent = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

        return (
          <div
            key={month}
            className={`month-card ${isCurrentMonth ? 'current-month' : ''}`}
            onClick={() => onMonthClick(month)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onMonthClick(month)}
            aria-label={`${getMonthName(month)} — ${taskCount} iş`}
          >
            <div className="month-accent-bar" style={{ background: seasonColor }} />
            <div className="month-card-inner">
              <div className="month-header-row">
                <span className="month-name">{getMonthName(month)}</span>
                {isCurrentMonth && <span className="month-badge">Bu Ay</span>}
              </div>

              <div className="month-count-row">
                <span className="month-count-number">{taskCount}</span>
                <span className="month-count-unit">iş</span>
              </div>

              {taskCount > 0 && (
                <div className="month-progress-row">
                  <div className="month-progress-track">
                    <div
                      className="month-progress-fill"
                      style={{ width: `${completedPercent}%` }}
                    />
                  </div>
                  <span className="month-progress-pct">{completedPercent}%</span>
                </div>
              )}

              <div className="month-pills">
                <span className="mpill mpill-open">
                  <span className="mpill-dot" />
                  {openCount} Açık
                </span>
                <span className="mpill mpill-prog">
                  <span className="mpill-dot" />
                  {inProgressCount} Devam
                </span>
                <span className="mpill mpill-done">
                  <span className="mpill-dot" />
                  {completedCount} Tamam
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MonthView;

