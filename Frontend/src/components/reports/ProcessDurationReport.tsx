import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { ProcessDuration, ProcessDurationItem } from '../../types/Report';

interface Props {
  teamId?: number;
  startDate?: string;
  endDate?: string;
}

const HBarRow: React.FC<{ item: ProcessDurationItem; maxDays: number }> = ({ item, maxDays }) => (
  <div className="hbar-row">
    <div className="hbar-label">{item.label}</div>
    <div className="hbar-track">
      <div
        className="hbar-fill"
        style={{ width: `${maxDays > 0 ? (item.avgDays / maxDays) * 100 : 0}%` }}
      />
    </div>
    <div className="hbar-value">{item.avgDays.toFixed(1)} gün</div>
    <div className="hbar-count">({item.count})</div>
  </div>
);

const ProcessDurationReport: React.FC<Props> = ({ teamId, startDate, endDate }) => {
  const [data, setData] = useState<ProcessDuration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportService.getProcessDuration({ teamId, startDate, endDate })
      .then(setData)
      .finally(() => setLoading(false));
  }, [teamId, startDate, endDate]);

  if (loading) return <div className="report-loading"><div className="loading-spinner" /><span>Yükleniyor...</span></div>;
  if (!data || data.completedCount === 0) return <div className="report-empty">Tamamlanan iş bulunamadı.</div>;

  const maxPriDays = Math.max(...data.byPriority.map(i => i.avgDays), 1);
  const maxTeamDays = Math.max(...data.byTeam.map(i => i.avgDays), 1);

  return (
    <div className="report-section">
      <div className="report-section-header">
        <h3 className="report-section-title">Süreç Süresi Analizi</h3>
        <span className="report-count-badge">{data.completedCount} tamamlanan iş</span>
      </div>

      {/* Top stat cards */}
      <div className="report-summary-row">
        {[
          { label: 'Ortalama Süre', value: `${data.avgDaysToComplete.toFixed(1)} gün`, color: '#89b4fa' },
          { label: 'En Kısa',      value: `${data.minDays.toFixed(1)} gün`,            color: '#a6e3a1' },
          { label: 'En Uzun',      value: `${data.maxDays.toFixed(1)} gün`,            color: '#f38ba8' },
          { label: 'Tamamlanan',   value: String(data.completedCount),                  color: '#cba6f7' },
        ].map(c => (
          <div key={c.label} className="report-mini-card" style={{ borderLeftColor: c.color }}>
            <div className="report-mini-value" style={{ color: c.color }}>{c.value}</div>
            <div className="report-mini-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="duration-breakdowns">
        {data.byPriority.length > 0 && (
          <div className="report-chart-card">
            <h4 className="report-chart-subtitle">Önceliğe Göre Ortalama Süre</h4>
            <div className="hbar-list">
              {data.byPriority.map(item => (
                <HBarRow key={item.label} item={item} maxDays={maxPriDays} />
              ))}
            </div>
          </div>
        )}

        {data.byTeam.length > 0 && (
          <div className="report-chart-card">
            <h4 className="report-chart-subtitle">Birime Göre Ortalama Süre</h4>
            <div className="hbar-list">
              {data.byTeam.map(item => (
                <HBarRow key={item.label} item={item} maxDays={maxTeamDays} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessDurationReport;
