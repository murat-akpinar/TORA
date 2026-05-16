import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { UserProductivity } from '../../types/Report';

interface Props {
  teamId?: number;
  startDate?: string;
  endDate?: string;
}

type SortKey = keyof UserProductivity;

const ProductivityMetrics: React.FC<Props> = ({ teamId, startDate, endDate }) => {
  const [data, setData] = useState<UserProductivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('completed');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setLoading(true);
    reportService.getUserProductivity({ teamId, startDate, endDate })
      .then(setData)
      .finally(() => setLoading(false));
  }, [teamId, startDate, endDate]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortAsc ? av - bv : bv - av;
  });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span style={{ marginLeft: 4 }}>{sortAsc ? '↑' : '↓'}</span> : null;

  if (loading) return <div className="report-loading"><div className="loading-spinner" /><span>Yükleniyor...</span></div>;
  if (data.length === 0) return <div className="report-empty">Kullanıcı verisi bulunamadı.</div>;

  const totals = data.reduce((acc, d) => ({
    assigned: acc.assigned + d.assigned,
    completed: acc.completed + d.completed,
    overdue: acc.overdue + d.overdue,
  }), { assigned: 0, completed: 0, overdue: 0 });

  return (
    <div className="report-section">
      <div className="report-section-header">
        <h3 className="report-section-title">Kişisel Verimlilik</h3>
        <span className="report-count-badge">{data.length} kullanıcı</span>
      </div>

      <div className="report-summary-row">
        {[
          { label: 'Toplam Atanan',    value: totals.assigned,  color: '#89b4fa' },
          { label: 'Toplam Tamamlanan', value: totals.completed, color: '#a6e3a1' },
          { label: 'Toplam Gecikmiş',   value: totals.overdue,   color: '#f38ba8' },
        ].map(c => (
          <div key={c.label} className="report-mini-card" style={{ borderLeftColor: c.color }}>
            <div className="report-mini-value" style={{ color: c.color }}>{c.value}</div>
            <div className="report-mini-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Kullanıcı</th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('assigned')}>
                Atanan<SortIcon k="assigned" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('completed')}>
                Tamamlanan<SortIcon k="completed" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('cancelled')}>
                İptal<SortIcon k="cancelled" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('open')}>
                Açık<SortIcon k="open" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('overdue')}>
                Gecikmiş<SortIcon k="overdue" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('completionRate')}>
                Tamamlanma %<SortIcon k="completionRate" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u, i) => (
              <tr key={u.userId}>
                <td style={{ color: 'var(--ctp-subtext0)' }}>{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="member-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                      {u.userName.charAt(0).toUpperCase()}
                    </span>
                    {u.userName}
                  </div>
                </td>
                <td>{u.assigned}</td>
                <td style={{ color: '#a6e3a1', fontWeight: 600 }}>{u.completed}</td>
                <td style={{ color: '#f38ba8' }}>{u.cancelled}</td>
                <td style={{ color: '#f9e2af' }}>{u.open}</td>
                <td style={{ color: u.overdue > 0 ? '#f38ba8' : 'var(--ctp-subtext0)' }}>
                  {u.overdue > 0 ? `⚠ ${u.overdue}` : u.overdue}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, background: 'var(--ctp-surface0)', borderRadius: 4, height: 6, minWidth: 60 }}>
                      <div style={{
                        width: `${u.completionRate}%`, height: '100%', borderRadius: 4,
                        background: u.completionRate >= 75 ? '#a6e3a1' : u.completionRate >= 40 ? '#f9e2af' : '#f38ba8',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36 }}>
                      {u.completionRate.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductivityMetrics;
