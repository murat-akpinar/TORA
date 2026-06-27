import api from './api';
import type {
  PerformancePeriod,
  UnitComparison,
  UserProductivity,
  ProcessDuration,
  TaskListReportItem,
} from '../types/Report';

type RawParams = Record<string, string | number | undefined | null>;

function clean(params: RawParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) result[k] = String(v);
  }
  return result;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Shared CSS ────────────────────────────────────────────────────────────────

const SHARED_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#222}
  .doc-header{background:#1F497D;color:#fff;padding:12px 18px;margin-bottom:6px}
  .doc-header h1{font-size:14px;font-weight:700}
  .doc-header .meta{font-size:9px;opacity:.85;margin-top:3px}
  .kpi-bar{display:flex;gap:8px;padding:6px 16px;background:#f0f4f8;margin-bottom:10px;flex-wrap:wrap}
  .kpi{background:#1F497D;color:#fff;padding:5px 12px;border-radius:4px;font-weight:700;font-size:10px}
  .kpi.g{background:#375C32}.kpi.b{background:#053761}.kpi.r{background:#7B1C1C}
  .section-title{font-size:12px;font-weight:700;color:#1F497D;padding:6px 16px 4px;border-left:4px solid #2E75B6;margin:12px 0 6px}
  .section-divider{border-top:2px solid #2E75B6;margin:14px 0 10px}
  table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:4px}
  th{background:#2E75B6;color:#fff;padding:6px 5px;text-align:center;border:1px solid #1F497D;font-weight:700;white-space:nowrap}
  td{padding:4px 5px;border:1px solid #dee2e6;vertical-align:middle;text-align:center}
  tr.alt td{background:#f2f7ff}
  tr.total-row td{background:#1F497D;color:#fff;font-weight:700}
  td.left{text-align:left}
  td.bold{font-weight:700}
  td.num{width:26px;font-weight:700;color:#1F497D}
  td.task-title{text-align:left;font-weight:700;max-width:180px;word-break:break-word}
  td.assignees{text-align:left;max-width:110px;word-break:break-word}
  tr.subtask-row td{background:#fafafa!important;color:#555;font-style:italic;font-size:8.5px}
  td.subtask-title{text-align:left;padding-left:18px}
  @media print{
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    @page{margin:10mm;size:A4 landscape}
    .section-divider{page-break-before:auto}
  }
`;

// ── Report section renderers ───────────────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  'Tamamlandı': '#d4edda', 'Devam Ediyor': '#cce5ff',
  'Test': '#e2d9f3', 'Açık': '#fff3cd', 'İptal': '#f8d7da',
};
const PRIORITY_BG: Record<string, string> = { 'Acil': '#f8d7da', 'Yüksek': '#fff3cd' };
const SLA_BG: Record<string, string> = {
  'Zamanında': '#d4edda', 'Riskli': '#fff3cd', 'Aşıldı': '#f8d7da', 'Karşılandı': '#cce5ff',
};

function renderPerformanceTable(data: PerformancePeriod[], period?: string): string {
  const totCreated   = data.reduce((s, d) => s + d.created,    0);
  const totCompleted = data.reduce((s, d) => s + d.completed,  0);
  const totCancelled = data.reduce((s, d) => s + d.cancelled,  0);
  const totInProg    = data.reduce((s, d) => s + d.inProgress, 0);
  const totTesting   = data.reduce((s, d) => s + d.testing,    0);
  const totOpen      = data.reduce((s, d) => s + d.open,       0);
  const rate         = totCreated > 0 ? ((totCompleted / totCreated) * 100).toFixed(1) : '0.0';
  const label        = period === 'weekly' ? 'Haftalık' : 'Aylık';

  const kpi = `
    <div class="kpi-bar">
      <span class="kpi">Oluşturulan: ${totCreated}</span>
      <span class="kpi g">Tamamlanan: ${totCompleted}</span>
      <span class="kpi r">İptal: ${totCancelled}</span>
      <span class="kpi b">Tamamlanma: ${rate}%</span>
    </div>`;

  const rows = data.map((d, i) => {
    const r = d.created > 0 ? ((d.completed / d.created) * 100).toFixed(1) : '0.0';
    return `<tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="left">${esc(d.period)}</td>
      <td>${d.created}</td><td>${d.completed}</td><td>${d.cancelled}</td>
      <td>${d.inProgress}</td><td>${d.testing}</td><td>${d.open}</td>
      <td><b>${r}%</b></td>
    </tr>`;
  }).join('');

  const table = `
    <div class="section-title">Performans Raporu — ${label}</div>
    ${kpi}
    <table>
      <thead><tr>
        <th>Dönem</th><th>Oluşturulan</th><th>Tamamlanan</th><th>İptal</th>
        <th>Devam Eden</th><th>Test</th><th>Açık</th><th>Tamamlanma %</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td class="left">TOPLAM</td>
          <td>${totCreated}</td><td>${totCompleted}</td><td>${totCancelled}</td>
          <td>${totInProg}</td><td>${totTesting}</td><td>${totOpen}</td>
          <td>${rate}%</td>
        </tr>
      </tbody>
    </table>`;
  return table;
}

function renderUnitTable(data: UnitComparison[]): string {
  const grandTotal     = data.reduce((s, d) => s + d.total,     0);
  const grandCompleted = data.reduce((s, d) => s + d.completed, 0);
  const grandOpen      = data.reduce((s, d) => s + d.open,      0);
  const grandInProg    = data.reduce((s, d) => s + d.inProgress,0);
  const grandTesting   = data.reduce((s, d) => s + d.testing,   0);
  const grandCancelled = data.reduce((s, d) => s + d.cancelled, 0);
  const avgRate        = data.length > 0
    ? (data.reduce((s, d) => s + d.completionRate, 0) / data.length).toFixed(1)
    : '0.0';

  const kpi = `
    <div class="kpi-bar">
      <span class="kpi">Toplam İş: ${grandTotal}</span>
      <span class="kpi g">Tamamlanan: ${grandCompleted}</span>
      <span class="kpi r">İptal: ${grandCancelled}</span>
      <span class="kpi b">Ort. Oran: ${avgRate}%</span>
    </div>`;

  const rows = data.map((d, i) => `
    <tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="left bold">${esc(d.teamName)}</td>
      <td>${d.total}</td><td>${d.completed}</td><td>${d.open}</td>
      <td>${d.inProgress}</td><td>${d.testing}</td><td>${d.cancelled}</td>
      <td><b>${d.completionRate.toFixed(1)}%</b></td>
    </tr>`).join('');

  return `
    <div class="section-title">Birim Karşılaştırma Raporu</div>
    ${kpi}
    <table>
      <thead><tr>
        <th>Birim Adı</th><th>Toplam</th><th>Tamamlanan</th><th>Açık</th>
        <th>Devam Eden</th><th>Test</th><th>İptal</th><th>Tamamlanma %</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td class="left">TOPLAM / ORT.</td>
          <td>${grandTotal}</td><td>${grandCompleted}</td><td>${grandOpen}</td>
          <td>${grandInProg}</td><td>${grandTesting}</td><td>${grandCancelled}</td>
          <td>${avgRate}%</td>
        </tr>
      </tbody>
    </table>`;
}

function renderProductivityTable(data: UserProductivity[]): string {
  const totAssigned   = data.reduce((s, d) => s + d.assigned,  0);
  const totCompleted  = data.reduce((s, d) => s + d.completed, 0);
  const totOverdue    = data.reduce((s, d) => s + d.overdue,   0);
  const avgRate       = data.length > 0
    ? (data.reduce((s, d) => s + d.completionRate, 0) / data.length).toFixed(1)
    : '0.0';

  const kpi = `
    <div class="kpi-bar">
      <span class="kpi">Atanan: ${totAssigned}</span>
      <span class="kpi g">Tamamlanan: ${totCompleted}</span>
      <span class="kpi r">Gecikmiş: ${totOverdue}</span>
      <span class="kpi b">Ort. Oran: ${avgRate}%</span>
    </div>`;

  const rows = data.map((d, i) => `
    <tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="num">${i + 1}</td>
      <td class="left bold">${esc(d.userName)}</td>
      <td>${d.assigned}</td><td>${d.completed}</td><td>${d.cancelled}</td>
      <td>${d.open}</td><td>${d.inProgress}</td>
      <td style="${d.overdue > 0 ? 'background:#f8d7da;font-weight:700' : ''}">${d.overdue}</td>
      <td><b>${d.completionRate.toFixed(1)}%</b></td>
    </tr>`).join('');

  return `
    <div class="section-title">Kişisel Verimlilik Raporu</div>
    ${kpi}
    <table>
      <thead><tr>
        <th>#</th><th>Kullanıcı Adı</th><th>Atanan</th><th>Tamamlanan</th>
        <th>İptal</th><th>Açık</th><th>Devam Eden</th><th>Gecikmiş</th><th>Tamamlanma %</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td></td><td class="left">TOPLAM</td>
          <td>${totAssigned}</td><td>${totCompleted}</td><td></td>
          <td></td><td></td><td>${totOverdue}</td><td>${avgRate}%</td>
        </tr>
      </tbody>
    </table>`;
}

function renderProcessDurationSection(data: ProcessDuration): string {
  const kpi = `
    <div class="kpi-bar">
      <span class="kpi">Tamamlanan: ${data.completedCount}</span>
      <span class="kpi b">Ort. Süre: ${data.avgDaysToComplete.toFixed(1)} gün</span>
      <span class="kpi g">Min: ${data.minDays.toFixed(1)} gün</span>
      <span class="kpi r">Max: ${data.maxDays.toFixed(1)} gün</span>
    </div>`;

  const priRows = (data.byPriority ?? []).map((p, i) => `
    <tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="left">${esc(p.label)}</td>
      <td>${p.avgDays.toFixed(1)}</td><td>${p.count}</td>
    </tr>`).join('');

  const teamRows = (data.byTeam ?? []).map((t, i) => `
    <tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="left">${esc(t.label)}</td>
      <td>${t.avgDays.toFixed(1)}</td><td>${t.count}</td>
    </tr>`).join('');

  return `
    <div class="section-title">Süreç Analizi Raporu</div>
    ${kpi}
    <div style="display:flex;gap:16px;margin-top:4px">
      <div style="flex:1">
        <div style="font-weight:700;font-size:9px;color:#1F497D;margin-bottom:4px">Önceliğe Göre</div>
        <table>
          <thead><tr><th>Öncelik</th><th>Ort. Gün</th><th>Adet</th></tr></thead>
          <tbody>${priRows}</tbody>
        </table>
      </div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:9px;color:#1F497D;margin-bottom:4px">Birime Göre</div>
        <table>
          <thead><tr><th>Birim</th><th>Ort. Gün</th><th>Adet</th></tr></thead>
          <tbody>${teamRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Task list section renderer ─────────────────────────────────────────────────

function renderTaskSection(tasks: TaskListReportItem[]): string {
  const totalTasks = tasks.length;
  const completed  = tasks.filter(t => t.status === 'Tamamlandı').length;
  const inProgress = tasks.filter(t => t.status === 'Devam Ediyor').length;
  const stTotal    = tasks.reduce((s, t) => s + t.subtaskTotal,    0);
  const stDone     = tasks.reduce((s, t) => s + t.subtaskCompleted, 0);

  const kpi = `
    <div class="kpi-bar">
      <span class="kpi">Toplam İş: ${totalTasks}</span>
      <span class="kpi g">Tamamlanan: ${completed}</span>
      <span class="kpi b">Devam Eden: ${inProgress}</span>
      ${stTotal > 0 ? `<span class="kpi b">Alt İşler: ${stDone}/${stTotal}</span>` : ''}
    </div>`;

  const rows = tasks.map((task, idx) => {
    const stCell = task.subtaskTotal > 0 ? `${task.subtaskCompleted}/${task.subtaskTotal}` : '-';
    const priBg  = PRIORITY_BG[task.priority] ?? 'transparent';
    const stsBg  = STATUS_BG[task.status]     ?? 'transparent';
    const slaLbl = task.slaStatus ?? '-';
    const slaBg  = SLA_BG[slaLbl] ?? 'transparent';

    const taskRow = `
      <tr>
        <td class="num">${idx + 1}</td>
        <td class="task-title">${esc(task.title)}</td>
        <td>${esc(task.teamName)}</td>
        <td>${esc(task.projectName ?? '-')}</td>
        <td style="background:${priBg}">${esc(task.priority)}</td>
        <td style="background:${stsBg}">${esc(task.status)}</td>
        <td>${task.startDate ?? '-'}</td>
        <td>${task.endDate ?? '-'}</td>
        <td class="assignees">${esc(task.assignees || '-')}</td>
        <td>${stCell}</td>
        <td style="background:${slaBg}">${esc(slaLbl)}</td>
      </tr>`;

    const subtaskRows = task.subtasks.map(st => {
      const bg = st.completed ? '#d4edda' : '#fff3cd';
      return `
      <tr class="subtask-row">
        <td></td>
        <td class="subtask-title">↳ ${esc(st.title)}</td>
        <td colspan="3"></td>
        <td style="background:${bg}">${st.completed ? 'Tamamlandı' : 'Bekliyor'}</td>
        <td>${st.startDate ?? '-'}</td>
        <td>${st.endDate ?? '-'}</td>
        <td>${esc(st.assignee ?? '-')}</td>
        <td></td>
        <td></td>
      </tr>`;
    }).join('');

    return taskRow + subtaskRows;
  }).join('');

  return `
    <div class="section-title">İş Listesi (Alt İşler Dahil)</div>
    ${kpi}
    <table>
      <thead>
        <tr>
          <th>#</th><th>Başlık</th><th>Birim</th><th>Proje</th>
          <th>Öncelik</th><th>Durum</th><th>Başlangıç</th><th>Bitiş</th>
          <th>Atananlar</th><th>Alt İşler</th><th>SLA</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Full document builder ─────────────────────────────────────────────────────

function buildCombinedHtml(
  reportTitle: string,
  reportSection: string,
  taskSection: string,
  range: string,
): string {
  const now = new Date().toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${reportTitle}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
  <div class="doc-header">
    <h1>TORA İş Takip Sistemi — ${reportTitle}</h1>
    <div class="meta">Tarih Aralığı: ${range} &nbsp;|&nbsp; Oluşturulma: ${now}</div>
  </div>
  ${reportSection}
  <div class="section-divider"></div>
  ${taskSection}
  <script>window.onload=()=>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;
}

// ── Export service ────────────────────────────────────────────────────────────

export const reportService = {
  getPerformance: (params: { teamId?: number; period?: string; startDate?: string; endDate?: string } = {}) =>
    api.get<PerformancePeriod[]>('/reports/performance', { params: clean(params) }).then(r => r.data),

  getUnitComparison: (params: { startDate?: string; endDate?: string } = {}) =>
    api.get<UnitComparison[]>('/reports/unit-comparison', { params: clean(params) }).then(r => r.data),

  getUserProductivity: (params: { teamId?: number; startDate?: string; endDate?: string } = {}) =>
    api.get<UserProductivity[]>('/reports/productivity', { params: clean(params) }).then(r => r.data),

  getProcessDuration: (params: { teamId?: number; startDate?: string; endDate?: string } = {}) =>
    api.get<ProcessDuration>('/reports/process-duration', { params: clean(params) }).then(r => r.data),

  downloadExcel: async (params: {
    type: string;
    teamId?: number;
    period?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await api.get('/reports/export/excel', {
      params: clean(params),
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data as Blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `rapor-${params.type}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadReportPdf: async (params: {
    type: string;
    teamId?: number;
    period?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const range = params.startDate && params.endDate
      ? `${params.startDate} – ${params.endDate}`
      : 'Tüm Veriler';

    const taskParams = clean({
      teamId: params.teamId,
      startDate: params.startDate,
      endDate: params.endDate,
    });
    const reportParams = clean({
      teamId: params.teamId,
      period: params.period,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const [taskData, reportData] = await Promise.all([
      api.get<TaskListReportItem[]>('/reports/task-list', { params: taskParams }).then(r => r.data),
      (() => {
        switch (params.type) {
          case 'unit-comparison':
            return api.get<UnitComparison[]>('/reports/unit-comparison', {
              params: clean({ startDate: params.startDate, endDate: params.endDate }),
            }).then(r => r.data);
          case 'productivity':
            return api.get<UserProductivity[]>('/reports/productivity', { params: reportParams }).then(r => r.data);
          case 'process-duration':
            return api.get<ProcessDuration>('/reports/process-duration', { params: reportParams }).then(r => r.data);
          default:
            return api.get<PerformancePeriod[]>('/reports/performance', { params: reportParams }).then(r => r.data);
        }
      })(),
    ]);

    const TITLES: Record<string, string> = {
      'performance':     'Performans Raporu',
      'unit-comparison': 'Birim Karşılaştırma Raporu',
      'productivity':    'Kişisel Verimlilik Raporu',
      'process-duration':'Süreç Analizi Raporu',
    };

    let reportSection = '';
    switch (params.type) {
      case 'unit-comparison':
        reportSection = renderUnitTable(reportData as UnitComparison[]);
        break;
      case 'productivity':
        reportSection = renderProductivityTable(reportData as UserProductivity[]);
        break;
      case 'process-duration':
        reportSection = renderProcessDurationSection(reportData as ProcessDuration);
        break;
      default:
        reportSection = renderPerformanceTable(reportData as PerformancePeriod[], params.period);
    }

    const taskSection = renderTaskSection(taskData);
    const title       = TITLES[params.type] ?? 'Rapor';
    const html        = buildCombinedHtml(title, reportSection, taskSection, range);

    const win = window.open('', '_blank', 'width=1280,height=900');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  },
};
