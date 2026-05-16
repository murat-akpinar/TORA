import React, { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import TeamDashboard from '../components/dashboard/TeamDashboard';
import UnitComparison from '../components/reports/UnitComparison';
import ProductivityMetrics from '../components/reports/ProductivityMetrics';
import { reportService } from '../services/reportService';
import { teamService } from '../services/teamService';
import type { PerformancePeriod, UnitComparison as UnitComparisonReport, UserProductivity } from '../types/Report';
import type { Team } from '../types/Team';
import { useSidebar } from '../hooks/useSidebar';
import './DashboardPage.css';
import './ReportsPage.css';

type Tab = 'overview' | 'units' | 'productivity' | 'export';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview',     label: 'Özet',       icon: '📊' },
  { key: 'units',        label: 'Birimler',    icon: '🏢' },
  { key: 'productivity', label: 'Verimlilik',  icon: '👤' },
  { key: 'export',       label: 'Dışa Aktar',  icon: '📤' },
];

const EXPORT_TYPES = [
  { key: 'performance',     label: 'Performans Raporu' },
  { key: 'unit-comparison', label: 'Birim Karşılaştırma' },
  { key: 'productivity',    label: 'Kişisel Verimlilik' },
];

// jsPDF Helvetica is Latin-1 only — transliterate chars outside that range
function tr(s: string): string {
  return s
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ı/g, 'i').replace(/İ/g, 'I');
}

const DashboardPage: React.FC = () => {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const { isCollapsed, toggleSidebar } = useSidebar();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState('performance');
  const [exportPeriod, setExportPeriod] = useState('monthly');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportTeamId, setExportTeamId] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => { teamService.getAllTeams().then(setTeams).catch(() => {}); }, []);

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateRange = (): { startDate?: string; endDate?: string } => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);
    const referenceEnd = selectedYear === currentYear ? today : yearEnd;
    const endDate = formatDate(referenceEnd);

    switch (filterMode) {
      case 'all':
        return { startDate: formatDate(yearStart), endDate };
      case '1m': { const s = new Date(referenceEnd); s.setMonth(s.getMonth() - 1); return { startDate: formatDate(s), endDate }; }
      case '3m': { const s = new Date(referenceEnd); s.setMonth(s.getMonth() - 3); return { startDate: formatDate(s), endDate }; }
      case '6m': { const s = new Date(referenceEnd); s.setMonth(s.getMonth() - 6); return { startDate: formatDate(s), endDate }; }
      case '1y': { const s = new Date(referenceEnd); s.setFullYear(s.getFullYear() - 1); return { startDate: formatDate(s), endDate }; }
      case 'custom': return customStartDate && customEndDate ? { startDate: customStartDate, endDate: customEndDate } : {};
      default: return {};
    }
  };

  const { startDate, endDate } = getDateRange();
  const effectiveExportStartDate = exportStartDate || startDate;
  const effectiveExportEndDate = exportEndDate || endDate;

  useEffect(() => {
    setExportStartDate(startDate ?? '');
    setExportEndDate(endDate ?? '');
  }, [startDate, endDate]);

  const handleExcelDownload = async () => {
    setExporting(true);
    try {
      await reportService.downloadExcel({
        type: exportType,
        teamId: exportTeamId ?? undefined,
        period: exportPeriod,
        startDate: effectiveExportStartDate,
        endDate: effectiveExportEndDate,
      });
    } finally {
      setExporting(false);
    }
  };

  const handlePdfExport = async () => {
    setExporting(true);
    try {
      const rangeText = effectiveExportStartDate && effectiveExportEndDate
        ? `${effectiveExportStartDate} – ${effectiveExportEndDate}`
        : 'Tum Veriler';
      const generatedAt = new Date().toLocaleString('tr-TR');
      const reportTitle = tr(EXPORT_TYPES.find(t => t.key === exportType)?.label ?? 'Rapor');
      const singleTeamLabel = exportTeamId
        ? tr(teams.find(t => t.id === exportTeamId)?.name ?? '')
        : 'Tum Birimler';
      const fileName = `rapor-${exportType}-${new Date().toISOString().slice(0, 10)}.pdf`;

      const NAVY:      [number, number, number] = [31,  73,  125];
      const BLUE:      [number, number, number] = [46, 117, 182];
      const WHITE:     [number, number, number] = [255, 255, 255];
      const GRAY:      [number, number, number] = [242, 247, 255];
      const GREEN_BG:  [number, number, number] = [226, 239, 218];
      const RED_BG:    [number, number, number] = [255, 204, 204];
      const BLUE_BG:   [number, number, number] = [221, 234, 247];
      const PURPLE_BG: [number, number, number] = [234, 226, 245];
      const YELLOW_BG: [number, number, number] = [255, 242, 204];
      const GREEN_TXT:  [number, number, number] = [55,  92,  50];
      const RED_TXT:    [number, number, number] = [123, 28,  28];
      const BLUE_TXT:   [number, number, number] = [31,  73, 125];
      const PURPLE_TXT: [number, number, number] = [91,  44, 141];
      const YELLOW_TXT: [number, number, number] = [125, 102,  8];

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();
      const margin = 12;

      const drawHeader = (tLabel: string) => {
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, pw, 46, 'F');
        doc.setTextColor(...WHITE);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('TORA İŞ TAKİP SİSTEMİ', margin, 10);
        doc.setFontSize(18);
        doc.text(reportTitle, margin, 22);
        doc.setFontSize(9);
        doc.text(`Birim: ${tLabel}`, margin, 30);
        doc.setFontSize(8);
        doc.text(`Tarih Araligi: ${rangeText}`, margin, 37);
        doc.text(`Olusturulma: ${generatedAt}`, margin + 120, 37);
      };

      const drawKpi = (label: string, value: string | number, color: [number,number,number], x: number, baseY: number) => {
        doc.setFillColor(...color);
        doc.rect(x, baseY, 68, 18, 'F');
        doc.setTextColor(...WHITE);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(String(value), x + 34, baseY + 11, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(tr(label), x + 34, baseY + 16, { align: 'center' });
      };

      const headStyles = {
        fillColor: BLUE, textColor: WHITE,
        fontStyle: 'bold' as const, fontSize: 9, halign: 'center' as const,
      };
      const footStyles = {
        fillColor: NAVY, textColor: WHITE,
        fontStyle: 'bold' as const, fontSize: 9,
      };

      // For performance/productivity: one page per team when "Tüm Birimler" is selected
      const isMultiTeam = exportTeamId === null && exportType !== 'unit-comparison';
      const teamsToRender: { id: number | null; name: string }[] = isMultiTeam
        ? [
            { id: null, name: 'Tum Birimler — Genel Ozet' },
            ...teams.map(t => ({ id: t.id, name: tr(t.name) })),
          ]
        : [{ id: exportTeamId, name: singleTeamLabel }];

      for (let i = 0; i < teamsToRender.length; i++) {
        const { id: tId, name: tLabel } = teamsToRender[i];
        if (i > 0) doc.addPage();
        drawHeader(tLabel);
        let y = 46;

        if (exportType === 'performance') {
          const data: PerformancePeriod[] = await reportService.getPerformance({
            teamId: tId ?? undefined, period: exportPeriod,
            startDate: effectiveExportStartDate, endDate: effectiveExportEndDate,
          });
          const totC  = data.reduce((s, d) => s + d.created, 0);
          const totOk = data.reduce((s, d) => s + d.completed, 0);
          const totX  = data.reduce((s, d) => s + d.cancelled, 0);
          const rate  = totC > 0 ? ((totOk / totC) * 100).toFixed(1) + '%' : '0.0%';
          const kpis: [string, string|number, [number,number,number]][] = [
            ['Toplam Olusturulan', totC,  NAVY],
            ['Tamamlanan',         totOk, [55, 92, 50]],
            ['Iptal Edilen',       totX,  [123, 28, 28]],
            ['Tamamlanma Orani',   rate,  [5, 55, 94]],
          ];
          kpis.forEach(([lbl, val, col], ki) => drawKpi(lbl, val, col, ki * 69 + margin - 4, y));
          y += 22;

          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Donem', 'Olusturulan', 'Tamamlanan', 'Iptal', 'Devam Eden', 'Test', 'Acik', 'Tamamlanma %']],
            body: data.map(d => {
              const r = d.created > 0 ? ((d.completed / d.created) * 100).toFixed(1) + '%' : '0.0%';
              return [tr(d.period), d.created, d.completed, d.cancelled, d.inProgress, d.testing, d.open, r];
            }),
            foot: [['TOPLAM', totC, totOk, totX,
              data.reduce((s,d)=>s+d.inProgress,0),
              data.reduce((s,d)=>s+d.testing,0),
              data.reduce((s,d)=>s+d.open,0), rate]],
            headStyles,
            footStyles,
            alternateRowStyles: { fillColor: GRAY },
            columnStyles: {
              0: { halign: 'left', fontStyle: 'bold' },
              2: { fillColor: GREEN_BG, textColor: GREEN_TXT, fontStyle: 'bold' },
              3: { fillColor: RED_BG,   textColor: RED_TXT,   fontStyle: 'bold' },
              4: { fillColor: BLUE_BG,  textColor: BLUE_TXT  },
              5: { fillColor: PURPLE_BG, textColor: PURPLE_TXT },
              6: { fillColor: YELLOW_BG, textColor: YELLOW_TXT },
              7: { fontStyle: 'bold' },
            },
            styles: { fontSize: 9, cellPadding: 3, valign: 'middle', halign: 'center' },
          });

        } else if (exportType === 'unit-comparison') {
          const data: UnitComparisonReport[] = await reportService.getUnitComparison({
            startDate: effectiveExportStartDate, endDate: effectiveExportEndDate,
          });
          const totAll = data.reduce((s, d) => s + d.total, 0);
          const totOk  = data.reduce((s, d) => s + d.completed, 0);
          const totX   = data.reduce((s, d) => s + d.cancelled, 0);
          const avgR   = data.length > 0
            ? (data.reduce((s, d) => s + d.completionRate, 0) / data.length).toFixed(1) + '%'
            : '0.0%';
          const kpis: [string, string|number, [number,number,number]][] = [
            ['Toplam Birim',    data.length, NAVY],
            ['Toplam Is',       totAll,      [5, 55, 94]],
            ['Tamamlanan',      totOk,       [55, 92, 50]],
            ['Ort. Tamamlanma', avgR,        [55, 92, 50]],
          ];
          kpis.forEach(([lbl, val, col], ki) => drawKpi(lbl, val, col, ki * 69 + margin - 4, y));
          y += 22;

          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['#', 'Birim Adi', 'Toplam', 'Tamamlanan', 'Acik', 'Devam Eden', 'Test', 'Iptal', 'Tamamlanma %']],
            body: data.map((d, idx) => [
              idx + 1, tr(d.teamName), d.total, d.completed, d.open, d.inProgress, d.testing, d.cancelled,
              d.completionRate.toFixed(1) + '%',
            ]),
            foot: [['', 'TOPLAM / ORT.', totAll, totOk, '—', '—', '—', totX, avgR]],
            headStyles,
            footStyles,
            alternateRowStyles: { fillColor: GRAY },
            columnStyles: {
              0: { halign: 'center', fontStyle: 'bold', fillColor: [191, 215, 237] as [number,number,number] },
              1: { halign: 'left',   fontStyle: 'bold' },
              3: { fillColor: GREEN_BG,  textColor: GREEN_TXT,  fontStyle: 'bold' },
              4: { fillColor: YELLOW_BG, textColor: YELLOW_TXT },
              5: { fillColor: BLUE_BG,   textColor: BLUE_TXT   },
              6: { fillColor: PURPLE_BG, textColor: PURPLE_TXT },
              7: { fillColor: RED_BG,    textColor: RED_TXT,    fontStyle: 'bold' },
              8: { fontStyle: 'bold' },
            },
            styles: { fontSize: 9, cellPadding: 3, valign: 'middle', halign: 'center' },
          });

        } else {
          // productivity
          const data: UserProductivity[] = await reportService.getUserProductivity({
            teamId: tId ?? undefined,
            startDate: effectiveExportStartDate, endDate: effectiveExportEndDate,
          });
          const totA    = data.reduce((s, d) => s + d.assigned, 0);
          const totOk   = data.reduce((s, d) => s + d.completed, 0);
          const totLate = data.reduce((s, d) => s + d.overdue, 0);
          const avgR    = data.length > 0
            ? (data.reduce((s, d) => s + d.completionRate, 0) / data.length).toFixed(1) + '%'
            : '0.0%';
          const kpis: [string, string|number, [number,number,number]][] = [
            ['Toplam Kullanici', data.length, NAVY],
            ['Toplam Atanan',    totA,        [5, 55, 94]],
            ['Tamamlanan',       totOk,       [55, 92, 50]],
            ['Toplam Gecikmis',  totLate,     totLate > 0 ? [123, 28, 28] : [55, 92, 50]],
          ];
          kpis.forEach(([lbl, val, col], ki) => drawKpi(lbl, val, col, ki * 69 + margin - 4, y));
          y += 22;

          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['#', 'Kullanici Adi', 'Atanan', 'Tamamlanan', 'Iptal', 'Acik', 'Devam Eden', 'Gecikmis', 'Tamamlanma %']],
            body: data.map((d, idx) => [
              idx + 1, tr(d.userName), d.assigned, d.completed, d.cancelled, d.open, d.inProgress,
              d.overdue > 0 ? `! ${d.overdue}` : d.overdue,
              d.completionRate.toFixed(1) + '%',
            ]),
            foot: [['', 'TOPLAM / ORT.', totA, totOk, '—', '—', '—', totLate, avgR]],
            headStyles,
            footStyles,
            alternateRowStyles: { fillColor: GRAY },
            columnStyles: {
              0: { halign: 'center', fontStyle: 'bold', fillColor: [191, 215, 237] as [number,number,number] },
              1: { halign: 'left',   fontStyle: 'bold' },
              3: { fillColor: GREEN_BG,  textColor: GREEN_TXT,  fontStyle: 'bold' },
              4: { fillColor: RED_BG,    textColor: RED_TXT    },
              5: { fillColor: YELLOW_BG, textColor: YELLOW_TXT },
              6: { fillColor: BLUE_BG,   textColor: BLUE_TXT   },
              7: { fillColor: RED_BG,    textColor: RED_TXT,   fontStyle: 'bold' },
              8: { fontStyle: 'bold' },
            },
            didParseCell: (hookData: { column: { index: number }; section: string; cell: { raw: unknown; styles: Record<string, unknown> } }) => {
              if (hookData.column.index === 7 && hookData.section === 'body') {
                const raw = String(hookData.cell.raw);
                if (raw.startsWith('!')) {
                  hookData.cell.styles.fillColor = [255, 107, 107];
                  hookData.cell.styles.textColor = WHITE;
                  hookData.cell.styles.fontStyle = 'bold';
                }
              }
            },
            styles: { fontSize: 9, cellPadding: 3, valign: 'middle', halign: 'center' },
          });
        }
      }

      // ── FOOTER on every page ─────────────────────────────────────────────
      const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        const ph = doc.internal.pageSize.getHeight();
        doc.setFillColor(...NAVY);
        doc.rect(0, ph - 8, pw, 8, 'F');
        doc.setTextColor(...WHITE);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`TORA İş Takip Sistemi | ${reportTitle}`, margin, ph - 2.5);
        doc.text(`Sayfa ${p} / ${pageCount}  |  ${generatedAt}`, pw - margin, ph - 2.5, { align: 'right' });
      }

      doc.save(fileName);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar selectedTeamId={selectedTeamId} onTeamSelect={setSelectedTeamId} isCollapsed={isCollapsed} onToggleCollapse={toggleSidebar} />
      <div className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header selectedYear={selectedYear} onYearChange={setSelectedYear} onMenuToggle={toggleSidebar} />
        <div className="content-area">
          <div className="dashboard-container">

            <div className="reports-page-header">
              <div>
                <h1 className="reports-page-title">Rapor</h1>
                <p className="reports-page-subtitle">Performans, verimlilik ve birim analizleri</p>
              </div>
            </div>

            <div className="date-filter-bar">
              <div className="filter-buttons">
                {[
                  { key: 'all',    label: 'Tümü' },
                  { key: '1m',     label: 'Son 1 Ay' },
                  { key: '3m',     label: 'Son 3 Ay' },
                  { key: '6m',     label: 'Son 6 Ay' },
                  { key: '1y',     label: 'Son 1 Yıl' },
                  { key: 'custom', label: 'Özel Aralık' },
                ].map(btn => (
                  <button
                    key={btn.key}
                    className={`filter-btn ${filterMode === btn.key ? 'active' : ''}`}
                    onClick={() => setFilterMode(btn.key)}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              {filterMode === 'custom' && (
                <div className="custom-date-inputs">
                  <div className="date-input-group">
                    <label>Başlangıç</label>
                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="date-input" />
                  </div>
                  <span className="date-separator">–</span>
                  <div className="date-input-group">
                    <label>Bitiş</label>
                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="date-input" />
                  </div>
                </div>
              )}
            </div>

            <div className="reports-tabs">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`report-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="reports-content">
              {activeTab === 'overview' && (
                <TeamDashboard teamId={selectedTeamId || undefined} startDate={startDate} endDate={endDate} />
              )}
              {activeTab === 'units' && (
                <UnitComparison startDate={startDate} endDate={endDate} />
              )}
              {activeTab === 'productivity' && (
                <ProductivityMetrics teamId={selectedTeamId ?? undefined} startDate={startDate} endDate={endDate} />
              )}
              {activeTab === 'export' && (
                <div className="report-section">
                  <div className="report-section-header">
                    <h3 className="report-section-title">Dışa Aktarma</h3>
                  </div>
                  <div className="export-panel">
                    <div className="export-option-group">
                      <label className="export-label">Rapor Türü</label>
                      <div className="export-type-list">
                        {EXPORT_TYPES.map(t => (
                          <button key={t.key} className={`export-type-btn ${exportType === t.key ? 'active' : ''}`} onClick={() => setExportType(t.key)}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {exportType !== 'unit-comparison' && (
                      <div className="export-option-group">
                        <label className="export-label">Birim</label>
                        <div className="filter-buttons" style={{ flexWrap: 'wrap' }}>
                          <button
                            className={`filter-btn ${exportTeamId === null ? 'active' : ''}`}
                            onClick={() => setExportTeamId(null)}
                          >
                            Tüm Birimler
                          </button>
                          {teams.map(t => (
                            <button
                              key={t.id}
                              className={`filter-btn ${exportTeamId === t.id ? 'active' : ''}`}
                              onClick={() => setExportTeamId(t.id)}
                            >
                              {t.icon && <span style={{ marginRight: 4 }}>{t.icon}</span>}
                              {t.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {exportType === 'performance' && (
                      <div className="export-option-group">
                        <label className="export-label">Dönem</label>
                        <div className="filter-buttons">
                          <button className={`filter-btn ${exportPeriod === 'monthly' ? 'active' : ''}`} onClick={() => setExportPeriod('monthly')}>Aylık</button>
                          <button className={`filter-btn ${exportPeriod === 'weekly' ? 'active' : ''}`} onClick={() => setExportPeriod('weekly')}>Haftalık</button>
                        </div>
                      </div>
                    )}
                    <div className="export-option-group">
                      <label className="export-label">Seçili Tarih Aralığı</label>
                      <div className="custom-date-inputs">
                        <div className="date-input-group">
                          <label>Başlangıç</label>
                          <input
                            type="date"
                            value={exportStartDate}
                            onChange={(e) => setExportStartDate(e.target.value)}
                            className="date-input"
                          />
                        </div>
                        <span className="date-separator">–</span>
                        <div className="date-input-group">
                          <label>Bitiş</label>
                          <input
                            type="date"
                            value={exportEndDate}
                            onChange={(e) => setExportEndDate(e.target.value)}
                            className="date-input"
                          />
                        </div>
                      </div>
                      <p className="export-date-info">
                        {effectiveExportStartDate && effectiveExportEndDate
                          ? `${effectiveExportStartDate} – ${effectiveExportEndDate}`
                          : 'Tüm veriler (tarih filtresi yok)'}
                      </p>
                    </div>
                    <div className="export-actions">
                      <button className="export-btn excel" onClick={handleExcelDownload} disabled={exporting}>
                        {exporting ? 'İndiriliyor...' : 'Excel İndir (.xlsx)'}
                      </button>
                      <button className="export-btn print" onClick={handlePdfExport} disabled={exporting}>
                        {exporting ? 'İndiriliyor...' : 'PDF İndir (.pdf)'}
                      </button>
                    </div>
                    <p className="export-hint">Excel ve PDF doğrudan indirilir. Seçilen birim ve tarih aralığına göre filtrelenir.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
