import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import UnitComparison from '../components/reports/UnitComparison';
import ProductivityMetrics from '../components/reports/ProductivityMetrics';
import ProcessDurationReport from '../components/reports/ProcessDurationReport';
import { reportService } from '../services/reportService';
import { useSidebar } from '../hooks/useSidebar';
import './ReportsPage.css';

type Tab = 'unit-comparison' | 'productivity' | 'process-duration' | 'export';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'unit-comparison',  label: 'Birim Karşılaştırma', icon: '🏢' },
  { key: 'productivity',     label: 'Verimlilik',          icon: '👤' },
  { key: 'process-duration', label: 'Süreç Analizi',       icon: '⏱' },
  { key: 'export',           label: 'Dışa Aktar',          icon: '📤' },
];

const EXPORT_TYPES = [
  { key: 'performance',      label: 'Performans Raporu' },
  { key: 'unit-comparison',  label: 'Birim Karşılaştırma' },
  { key: 'productivity',     label: 'Kişisel Verimlilik' },
  { key: 'process-duration', label: 'Süreç Analizi' },
];

const ReportsPage: React.FC = () => {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const { isCollapsed, toggleSidebar } = useSidebar();

  const [activeTab, setActiveTab] = useState<Tab>('unit-comparison');

  const [filterMode, setFilterMode] = useState<string>('3m');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportType, setExportType]   = useState('performance');
  const [exportPeriod, setExportPeriod] = useState('monthly');

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
      case '1m': {
        const s = new Date(referenceEnd);
        s.setMonth(s.getMonth() - 1);
        return { startDate: formatDate(s), endDate };
      }
      case '3m': {
        const s = new Date(referenceEnd);
        s.setMonth(s.getMonth() - 3);
        return { startDate: formatDate(s), endDate };
      }
      case '6m': {
        const s = new Date(referenceEnd);
        s.setMonth(s.getMonth() - 6);
        return { startDate: formatDate(s), endDate };
      }
      case '1y': {
        const s = new Date(referenceEnd);
        s.setFullYear(s.getFullYear() - 1);
        return { startDate: formatDate(s), endDate };
      }
      case 'custom': return customStartDate && customEndDate ? { startDate: customStartDate, endDate: customEndDate } : {};
      default: return {};
    }
  };

  const { startDate, endDate } = getDateRange();

  const handleExcelDownload = async () => {
    setExporting(true);
    try {
      await reportService.downloadExcel({
        type: exportType,
        teamId: selectedTeamId ?? undefined,
        period: exportPeriod,
        startDate,
        endDate,
      });
    } finally {
      setExporting(false);
    }
  };

  const handlePdfDownload = async () => {
    setExportingPdf(true);
    try {
      await reportService.downloadReportPdf({
        type: exportType,
        teamId: selectedTeamId ?? undefined,
        period: exportPeriod,
        startDate,
        endDate,
      });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        selectedTeamId={selectedTeamId}
        onTeamSelect={setSelectedTeamId}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      <div className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header selectedYear={selectedYear} onYearChange={setSelectedYear} onMenuToggle={toggleSidebar} />
        <div className="content-area">
          <div className="reports-container">

            {/* Page header */}
            <div className="reports-page-header">
              <div>
                <h1 className="reports-page-title">Raporlar</h1>
                <p className="reports-page-subtitle">Performans, verimlilik ve süreç analizleri</p>
              </div>
            </div>

            {/* Date filter bar */}
            <div className="date-filter-bar">
              <div className="filter-buttons">
                {[
                  { key: 'all', label: 'Tümü' },
                  { key: '1m',  label: 'Son 1 Ay' },
                  { key: '3m',  label: 'Son 3 Ay' },
                  { key: '6m',  label: 'Son 6 Ay' },
                  { key: '1y',  label: 'Son 1 Yıl' },
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
                    <input type="date" value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)} className="date-input" />
                  </div>
                  <span className="date-separator">–</span>
                  <div className="date-input-group">
                    <label>Bitiş</label>
                    <input type="date" value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)} className="date-input" />
                  </div>
                </div>
              )}
            </div>

            {/* Tab navigation */}
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

            {/* Tab content */}
            <div className="reports-content">
              {activeTab === 'unit-comparison' && (
                <UnitComparison startDate={startDate} endDate={endDate} />
              )}
              {activeTab === 'productivity' && (
                <ProductivityMetrics
                  teamId={selectedTeamId ?? undefined}
                  startDate={startDate}
                  endDate={endDate}
                />
              )}
              {activeTab === 'process-duration' && (
                <ProcessDurationReport
                  teamId={selectedTeamId ?? undefined}
                  startDate={startDate}
                  endDate={endDate}
                />
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
                          <button
                            key={t.key}
                            className={`export-type-btn ${exportType === t.key ? 'active' : ''}`}
                            onClick={() => setExportType(t.key)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(exportType === 'performance') && (
                      <div className="export-option-group">
                        <label className="export-label">Dönem</label>
                        <div className="filter-buttons">
                          <button className={`filter-btn ${exportPeriod === 'monthly' ? 'active' : ''}`}
                            onClick={() => setExportPeriod('monthly')}>Aylık</button>
                          <button className={`filter-btn ${exportPeriod === 'weekly' ? 'active' : ''}`}
                            onClick={() => setExportPeriod('weekly')}>Haftalık</button>
                        </div>
                      </div>
                    )}

                    <div className="export-option-group">
                      <label className="export-label">Seçili Tarih Aralığı</label>
                      <p className="export-date-info">
                        {startDate && endDate
                          ? `${startDate} – ${endDate}`
                          : 'Tüm veriler (tarih filtresi yok)'}
                      </p>
                    </div>

                    <div className="export-actions">
                      <button
                        className="export-btn excel"
                        onClick={handleExcelDownload}
                        disabled={exporting}
                      >
                        {exporting ? 'İndiriliyor...' : 'Excel İndir (.xlsx)'}
                      </button>
                      <button
                        className="export-btn print"
                        onClick={handlePdfDownload}
                        disabled={exportingPdf}
                      >
                        {exportingPdf ? 'Hazırlanıyor...' : 'PDF Olarak Yazdır'}
                      </button>
                    </div>

                    <p className="export-hint">
                      Excel: rapor sekmeleri + "İş Listesi" sekmesi (alt işler dahil) birlikte indirilir.
                      PDF: rapor özeti ve iş listesi tek sayfada yazdırma diyaloğuyla açılır.
                    </p>
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

export default ReportsPage;
