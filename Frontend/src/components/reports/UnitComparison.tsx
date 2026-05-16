import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { UnitComparison } from '../../types/Report';

interface Props {
  startDate?: string;
  endDate?: string;
}

const UnitComparison: React.FC<Props> = ({ startDate, endDate }) => {
  const [data, setData] = useState<UnitComparison[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportService.getUnitComparison({ startDate, endDate })
      .then(setData)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) return <div className="report-loading"><div className="loading-spinner" /><span>Yükleniyor...</span></div>;
  if (data.length === 0) return <div className="report-empty">Birim verisi bulunamadı.</div>;

  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="report-section">
      <div className="report-section-header">
        <h3 className="report-section-title">Birim Karşılaştırma</h3>
        <span className="report-count-badge">{data.length} birim</span>
      </div>

      <div className="unit-comparison-list">
        {data.map(unit => (
          <div key={unit.teamId} className="unit-row">
            <div className="unit-row-header">
              <div className="unit-name-group">
                {unit.teamIcon && <span className="unit-icon">{unit.teamIcon}</span>}
                <span className="unit-name" style={{ color: unit.teamColor || 'var(--ctp-text)' }}>
                  {unit.teamName}
                </span>
              </div>
              <div className="unit-stats-inline">
                <span className="unit-stat-pill" style={{ background: 'rgba(166,227,161,0.15)', color: '#a6e3a1' }}>
                  {unit.completed} tamamlandı
                </span>
                <span className="unit-stat-pill" style={{ background: 'rgba(137,180,250,0.15)', color: '#89b4fa' }}>
                  {unit.total} toplam
                </span>
                <span className="unit-rate-badge">
                  %{unit.completionRate.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Stacked bar */}
            <div className="unit-bar-track">
              {unit.total > 0 && (
                <>
                  <div className="unit-bar-seg" title={`Tamamlanan: ${unit.completed}`}
                    style={{ width: `${(unit.completed / maxTotal) * 100}%`, background: '#a6e3a1' }} />
                  <div className="unit-bar-seg" title={`Test: ${unit.testing}`}
                    style={{ width: `${(unit.testing / maxTotal) * 100}%`, background: '#cba6f7' }} />
                  <div className="unit-bar-seg" title={`Devam Eden: ${unit.inProgress}`}
                    style={{ width: `${(unit.inProgress / maxTotal) * 100}%`, background: '#89b4fa' }} />
                  <div className="unit-bar-seg" title={`Açık: ${unit.open}`}
                    style={{ width: `${(unit.open / maxTotal) * 100}%`, background: '#f9e2af' }} />
                  <div className="unit-bar-seg" title={`İptal: ${unit.cancelled}`}
                    style={{ width: `${(unit.cancelled / maxTotal) * 100}%`, background: '#6c7086' }} />
                </>
              )}
            </div>

            {/* Detail row */}
            <div className="unit-detail-row">
              {[
                { label: 'Açık',      value: unit.open,       color: '#f9e2af' },
                { label: 'Devam',     value: unit.inProgress, color: '#89b4fa' },
                { label: 'Test',      value: unit.testing,    color: '#cba6f7' },
                { label: 'İptal',     value: unit.cancelled,  color: '#f38ba8' },
              ].map(s => (
                <span key={s.label} className="unit-detail-item">
                  <span className="unit-detail-dot" style={{ background: s.color }} />
                  {s.label}: <strong>{s.value}</strong>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UnitComparison;
