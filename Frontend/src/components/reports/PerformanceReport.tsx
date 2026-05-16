import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { PerformancePeriod } from '../../types/Report';

interface Props {
  teamId?: number;
  startDate?: string;
  endDate?: string;
}

const COLORS = {
  created:   '#89b4fa',
  completed: '#a6e3a1',
  cancelled: '#f38ba8',
};

const BarChart: React.FC<{ data: PerformancePeriod[] }> = ({ data }) => {
  if (data.length === 0) return <div className="report-empty">Veri yok</div>;

  const maxVal = Math.max(...data.map(d => d.created), 1);
  const barW = 20;
  const gap = 10;
  const groupW = barW * 3 + gap * 2 + 16;
  const chartH = 180;
  const paddingLeft = 36;
  const paddingBottom = 40;
  const svgW = paddingLeft + data.length * groupW + 20;
  const svgH = chartH + paddingBottom + 10;

  const yScale = (v: number) => chartH - (v / maxVal) * (chartH - 10);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * maxVal));

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(svgW, 400)} height={svgH} style={{ display: 'block' }}>
        {/* Y axis ticks */}
        {yTicks.map(tick => {
          const y = yScale(tick) + 10;
          return (
            <g key={tick}>
              <line x1={paddingLeft - 4} y1={y} x2={svgW - 10} y2={y}
                stroke="var(--ctp-surface0)" strokeWidth={1} />
              <text x={paddingLeft - 6} y={y + 4} textAnchor="end"
                fontSize={10} fill="var(--ctp-subtext0)">{tick}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = paddingLeft + i * groupW;
          const bars = [
            { key: 'created',   v: d.created,   color: COLORS.created },
            { key: 'completed', v: d.completed, color: COLORS.completed },
            { key: 'cancelled', v: d.cancelled, color: COLORS.cancelled },
          ];
          return (
            <g key={d.period}>
              {bars.map((b, bi) => {
                const bx = x + bi * (barW + gap);
                const by = yScale(b.v) + 10;
                const bh = chartH - (by - 10);
                return (
                  <g key={b.key}>
                    <rect x={bx} y={by} width={barW} height={Math.max(bh, 0)}
                      fill={b.color} rx={3} opacity={0.85} />
                    {b.v > 0 && (
                      <text x={bx + barW / 2} y={by - 3} textAnchor="middle"
                        fontSize={9} fill="var(--ctp-subtext1)">{b.v}</text>
                    )}
                  </g>
                );
              })}
              {/* X label */}
              <text
                x={x + groupW / 2 - 8}
                y={chartH + 24}
                textAnchor="middle"
                fontSize={10}
                fill="var(--ctp-subtext0)"
                transform={`rotate(-30, ${x + groupW / 2 - 8}, ${chartH + 24})`}
              >
                {d.period}
              </text>
            </g>
          );
        })}

        {/* X axis line */}
        <line x1={paddingLeft} y1={chartH + 10} x2={svgW - 10} y2={chartH + 10}
          stroke="var(--ctp-surface1)" strokeWidth={1} />
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
        {Object.entries(COLORS).map(([key, color]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ctp-subtext1)' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color, display: 'inline-block' }} />
            {key === 'created' ? 'Oluşturulan' : key === 'completed' ? 'Tamamlanan' : 'İptal'}
          </span>
        ))}
      </div>
    </div>
  );
};

const PerformanceReport: React.FC<Props> = ({ teamId, startDate, endDate }) => {
  const [data, setData] = useState<PerformancePeriod[]>([]);
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportService.getPerformance({ teamId, period, startDate, endDate })
      .then(setData)
      .finally(() => setLoading(false));
  }, [teamId, period, startDate, endDate]);

  const totals = data.reduce(
    (acc, d) => ({ created: acc.created + d.created, completed: acc.completed + d.completed, cancelled: acc.cancelled + d.cancelled }),
    { created: 0, completed: 0, cancelled: 0 }
  );

  return (
    <div className="report-section">
      <div className="report-section-header">
        <h3 className="report-section-title">Performans Raporu</h3>
        <div className="report-controls">
          <button className={`filter-btn ${period === 'monthly' ? 'active' : ''}`} onClick={() => setPeriod('monthly')}>Aylık</button>
          <button className={`filter-btn ${period === 'weekly'  ? 'active' : ''}`} onClick={() => setPeriod('weekly')}>Haftalık</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="report-summary-row">
        {[
          { label: 'Toplam Oluşturulan', value: totals.created,   color: '#89b4fa' },
          { label: 'Tamamlanan',         value: totals.completed, color: '#a6e3a1' },
          { label: 'İptal Edilen',       value: totals.cancelled, color: '#f38ba8' },
        ].map(c => (
          <div key={c.label} className="report-mini-card" style={{ borderLeftColor: c.color }}>
            <div className="report-mini-value" style={{ color: c.color }}>{c.value}</div>
            <div className="report-mini-label">{c.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="report-loading"><div className="loading-spinner" /><span>Yükleniyor...</span></div>
      ) : (
        <div className="report-chart-card">
          <BarChart data={data} />
        </div>
      )}

      {/* Data table */}
      {!loading && data.length > 0 && (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Dönem</th>
                <th>Oluşturulan</th>
                <th>Tamamlanan</th>
                <th>İptal</th>
                <th>Devam Eden</th>
                <th>Test</th>
                <th>Açık</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{row.created}</td>
                  <td style={{ color: '#a6e3a1' }}>{row.completed}</td>
                  <td style={{ color: '#f38ba8' }}>{row.cancelled}</td>
                  <td style={{ color: '#89b4fa' }}>{row.inProgress}</td>
                  <td style={{ color: '#cba6f7' }}>{row.testing}</td>
                  <td style={{ color: '#f9e2af' }}>{row.open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PerformanceReport;
