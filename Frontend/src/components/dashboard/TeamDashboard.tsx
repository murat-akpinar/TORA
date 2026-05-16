import React, { useEffect, useState } from 'react';
import { DashboardDetails } from '../../types/Dashboard';
import { dashboardService } from '../../services/dashboardService';
import './TeamDashboard.css';

interface TeamDashboardProps {
  teamId?: number;
  startDate?: string;
  endDate?: string;
}

// Donut Chart bileşeni
interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  title: string;
  segments: DonutSegment[];
  size?: number;
}

const DonutChart: React.FC<DonutChartProps> = ({ title, segments, size = 180 }) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div className="donut-chart-wrapper">
        <h4 className="donut-title">{title}</h4>
        <div className="donut-empty">Veri yok</div>
      </div>
    );
  }

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const strokeWidth = 28;

  // Segment'lerin offset'lerini hesapla
  let accumulatedOffset = 0;
  const segmentData = segments
    .filter(s => s.value > 0)
    .map(s => {
      const percent = s.value / total;
      const dashArray = circumference * percent;
      const dashOffset = -accumulatedOffset;
      accumulatedOffset += dashArray;
      return { ...s, percent, dashArray, dashOffset };
    });

  return (
    <div className="donut-chart-wrapper">
      <h4 className="donut-title">{title}</h4>
      <div className="donut-chart-container">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--ctp-surface0)"
            strokeWidth={strokeWidth}
          />
          {/* Data segments */}
          {segmentData.map((seg, idx) => (
            <circle
              key={idx}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
              className="donut-segment"
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: `${center}px ${center}px`,
                animationDelay: `${idx * 0.15}s`
              }}
            />
          ))}
          {/* Center text */}
          <text x={center} y={center - 8} textAnchor="middle" className="donut-center-value">
            {total}
          </text>
          <text x={center} y={center + 14} textAnchor="middle" className="donut-center-label">
            Toplam
          </text>
        </svg>
      </div>
      <div className="donut-legend">
        {segmentData.map((seg, idx) => (
          <div key={idx} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ backgroundColor: seg.color }} />
            <span className="donut-legend-label">{seg.label}</span>
            <span className="donut-legend-value">{seg.value}</span>
            <span className="donut-legend-percent">({(seg.percent * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeamDashboard: React.FC<TeamDashboardProps> = ({ teamId, startDate, endDate }) => {
  const [details, setDetails] = useState<DashboardDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const data = teamId
          ? await dashboardService.getTeamDashboardDetails(teamId, startDate, endDate)
          : await dashboardService.getAllTeamsDashboardDetails(startDate, endDate);
        setDetails(data);
      } catch (error) {
        console.error('Failed to fetch dashboard details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [teamId, startDate, endDate]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  }

  if (!details || !details.stats) {
    return <div className="error">Veri yüklenemedi</div>;
  }

  const stats = details.stats;

  const total = stats.totalOpen + stats.totalInProgress + (stats.totalTesting || 0) + stats.totalCompleted + stats.totalCancelled;

  const statCards = [
    {
      key: 'progress',
      label: 'Devam Eden İşler',
      value: stats.totalInProgress,
      icon: '🔄',
      color: '#89b4fa',
      bgColor: 'rgba(137, 180, 250, 0.1)'
    },
    {
      key: 'testing',
      label: 'Test Aşamasında',
      value: stats.totalTesting || 0,
      icon: '🧪',
      color: '#cba6f7',
      bgColor: 'rgba(203, 166, 247, 0.1)'
    },
    {
      key: 'completed',
      label: 'Tamamlanan İşler',
      value: stats.totalCompleted,
      icon: '✅',
      color: '#a6e3a1',
      bgColor: 'rgba(166, 227, 161, 0.1)'
    },
    {
      key: 'open',
      label: 'Açık İşler',
      value: stats.totalOpen,
      icon: '📋',
      color: '#f9e2af',
      bgColor: 'rgba(249, 226, 175, 0.1)'
    },
    {
      key: 'cancelled',
      label: 'İptal Edilen',
      value: stats.totalCancelled,
      icon: '❌',
      color: '#6c7086',
      bgColor: 'rgba(108, 112, 134, 0.1)'
    },
  ];

  const overallSegments: DonutSegment[] = [
    { label: 'Tamamlanan', value: stats.totalCompleted, color: '#a6e3a1' },
    { label: 'Test Aşamasında', value: stats.totalTesting || 0, color: '#cba6f7' },
    { label: 'Devam Eden', value: stats.totalInProgress, color: '#89b4fa' },
    { label: 'Açık', value: stats.totalOpen, color: '#f9e2af' },
    { label: 'İptal', value: stats.totalCancelled, color: '#6c7086' },
  ];

  const completionSegments: DonutSegment[] = [
    { label: 'Tamamlanan', value: stats.totalCompleted, color: '#a6e3a1' },
    { label: 'Tamamlanmayan', value: total - stats.totalCompleted, color: '#45475a' },
  ];

  const problemSegments: DonutSegment[] = [
    { label: 'İptal', value: stats.totalCancelled, color: '#f38ba8' },
    { label: 'Diğer', value: stats.totalCompleted + (stats.totalTesting || 0) + stats.totalInProgress + stats.totalOpen, color: '#a6e3a1' },
  ];

  // Tamamlanma yüzdesi
  const completionPercent = total > 0 ? Math.round((stats.totalCompleted / total) * 100) : 0;

  return (
    <div className="dashboard-container-full">

      {/* Summary badges */}
      <div className="overview-header">
        <div className="overview-summary-badges">
          <div className="summary-badge">
            <span className="badge-value">{total}</span>
            <span className="badge-label">Toplam İş</span>
          </div>
          <div className="summary-badge completion">
            <span className="badge-value">{completionPercent}%</span>
            <span className="badge-label">Tamamlanma</span>
          </div>
        </div>
      </div>

      {/* Modern Stats Cards */}
      <div className="stats-grid">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="stat-card-modern"
            style={{ '--accent-color': card.color, '--bg-color': card.bgColor } as React.CSSProperties}
          >
            <div className="stat-card-header">
              <span className="stat-icon">{card.icon}</span>
              <span className="stat-label-modern">{card.label}</span>
            </div>

            <div className="stat-content">
              <div className="stat-main">
                <span className="stat-value-modern">{card.value.toLocaleString()}</span>
                <span className="stat-unit">Görev</span>
              </div>
              {total > 0 && (
                <div className="stat-percent-bar">
                  <div
                    className="stat-percent-fill"
                    style={{
                      width: `${(card.value / total) * 100}%`,
                      backgroundColor: card.color
                    }}
                  />
                </div>
              )}
            </div>

            <div className="stat-footer">
              <span className="stat-share">
                {total > 0 ? Math.round((card.value / total) * 100) : 0}% toplam içinden
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pie Charts Section */}
      <div className="charts-section">
        <h3 className="section-title">📈 İş Dağılım Grafikleri</h3>
        <div className="charts-grid">
          <div className="chart-card">
            <DonutChart title="Genel İş Dağılımı" segments={overallSegments} size={200} />
          </div>
          <div className="chart-card">
            <DonutChart title="Tamamlanma Durumu" segments={completionSegments} size={200} />
          </div>
          <div className="chart-card">
            <DonutChart title="Problem Analizi" segments={problemSegments} size={200} />
          </div>
        </div>
      </div>

      {/* Total Progress Bar */}
      <div className="total-progress-section">
        <h3>Toplam İş Dağılımı</h3>
        <div className="total-progress-bar">
          <div
            className="progress-segment completed"
            style={{ width: `${total > 0 ? (stats.totalCompleted / total) * 100 : 0}%` }}
            title={`Tamamlanan: ${stats.totalCompleted}`}
          />
          <div
            className="progress-segment in-progress"
            style={{ width: `${total > 0 ? (stats.totalInProgress / total) * 100 : 0}%` }}
            title={`Devam Eden: ${stats.totalInProgress}`}
          />
          <div
            className="progress-segment testing"
            style={{ width: `${total > 0 ? ((stats.totalTesting || 0) / total) * 100 : 0}%` }}
            title={`Test Aşamasında: ${stats.totalTesting || 0}`}
          />
          <div
            className="progress-segment open"
            style={{ width: `${total > 0 ? (stats.totalOpen / total) * 100 : 0}%` }}
            title={`Açık: ${stats.totalOpen}`}
          />
          <div
            className="progress-segment cancelled"
            style={{ width: `${total > 0 ? (stats.totalCancelled / total) * 100 : 0}%` }}
            title={`İptal: ${stats.totalCancelled}`}
          />
        </div>
        <div className="progress-legend">
          <span className="legend-item"><span className="dot completed"></span> Tamamlanan</span>
          <span className="legend-item"><span className="dot testing"></span> Test Aşamasında</span>
          <span className="legend-item"><span className="dot in-progress"></span> Devam Eden</span>
          <span className="legend-item"><span className="dot open"></span> Açık</span>
          <span className="legend-item"><span className="dot cancelled"></span> İptal</span>
        </div>
      </div>

      {/* Leaderboard and Team Members Section */}
      <div className="dashboard-details-section">
        {/* Leaderboards */}
        <div className="leaderboards-container">
          <div className="leaderboard-card">
            <h3 className="leaderboard-title">🏆 En Çok İş Tamamlayanlar</h3>
            {details.topCompleters && details.topCompleters.length > 0 ? (
              <ul className="leaderboard-list">
                {details.topCompleters.map((user, index) => (
                  <li key={user.userId} className="leaderboard-item">
                    <span className={`leaderboard-rank rank-${index + 1}`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </span>
                    <span className="leaderboard-name">{user.userName}</span>
                    <span className="leaderboard-count">{user.count} iş</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-leaderboard">Henüz veri yok</div>
            )}
          </div>

          <div className="leaderboard-card">
            <h3 className="leaderboard-title">❌ En Çok İş İptal Edenler</h3>
            {details.topCancellers && details.topCancellers.length > 0 ? (
              <ul className="leaderboard-list">
                {details.topCancellers.map((user, index) => (
                  <li key={user.userId} className="leaderboard-item">
                    <span className="leaderboard-rank">{index + 1}.</span>
                    <span className="leaderboard-name">{user.userName}</span>
                    <span className="leaderboard-count">{user.count} iş</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-leaderboard">Henüz veri yok</div>
            )}
          </div>
        </div>

        {/* Team Members */}
        <div className="team-members-card">
          <h3 className="team-members-title">👥 Birim Üyeleri</h3>
          {details.teamMembers && details.teamMembers.length > 0 ? (
            <ul className="team-members-list">
              {details.teamMembers.map((member) => (
                <li key={member.userId} className={`team-member-item ${member.isLeader ? 'leader' : ''}`}>
                  <span className="member-avatar">
                    {member.userName.charAt(0).toUpperCase()}
                  </span>
                  <span className="member-name">{member.userName}</span>
                  <span className="member-roles">
                    {member.isLeader && <span className="role-leader">Birim Lideri</span>}
                    {member.teamName && (
                      <>
                        {member.isLeader && ' / '}
                        <span>{member.teamName}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-members">Henüz üye yok</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamDashboard;
