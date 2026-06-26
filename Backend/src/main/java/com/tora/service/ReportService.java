package com.tora.service;

import com.tora.dto.*;
import com.tora.model.Subtask;
import com.tora.model.Task;
import com.tora.model.TaskStatusHistory;
import com.tora.model.Team;
import com.tora.model.User;
import com.tora.model.enums.Priority;
import com.tora.model.enums.SlaStatus;
import com.tora.model.enums.TaskStatus;
import com.tora.repository.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ReportService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private TaskStatusHistoryRepository taskStatusHistoryRepository;

    @Autowired
    private TeamService teamService;

    public List<ReportPerformanceDTO> getPerformanceReport(Long teamId, String period, LocalDate startDate, LocalDate endDate) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (teamId != null && !accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Access denied");
        }
        List<Long> teamIds = teamId != null ? List.of(teamId) : accessibleTeamIds;
        if (teamIds.isEmpty()) return Collections.emptyList();

        List<Task> tasks;
        if (startDate != null && endDate != null) {
            tasks = taskRepository.findByTeamIdsAndCreatedAtBetween(
                teamIds,
                startDate.atStartOfDay(),
                endDate.plusDays(1).atStartOfDay()
            );
        } else {
            tasks = taskRepository.findByTeamIds(teamIds);
        }

        boolean isWeekly = "weekly".equalsIgnoreCase(period);

        Map<String, List<Task>> grouped = tasks.stream().collect(
            Collectors.groupingBy(t -> {
                LocalDate date = t.getCreatedAt().toLocalDate();
                if (isWeekly) {
                    int week = date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
                    int year = date.get(IsoFields.WEEK_BASED_YEAR);
                    return String.format("%d-W%02d", year, week);
                }
                return date.format(DateTimeFormatter.ofPattern("yyyy-MM"));
            })
        );

        return grouped.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> {
                List<Task> pts = entry.getValue();
                long completed  = pts.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();
                long cancelled  = pts.stream().filter(t -> t.getStatus() == TaskStatus.CANCELLED).count();
                long inProgress = pts.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
                long testing    = pts.stream().filter(t -> t.getStatus() == TaskStatus.TESTING).count();
                long open       = pts.stream().filter(t -> t.getStatus() == TaskStatus.OPEN).count();
                return new ReportPerformanceDTO(entry.getKey(), pts.size(), completed, cancelled, inProgress, testing, open, pts.size());
            })
            .collect(Collectors.toList());
    }

    public List<UnitComparisonDTO> getUnitComparison(LocalDate startDate, LocalDate endDate) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();

        return accessibleTeamIds.stream().map(teamId -> {
            Team team = teamRepository.findById(teamId).orElse(null);
            if (team == null) return null;

            List<Task> tasks = (startDate != null && endDate != null)
                ? taskRepository.findByTeamIdAndCreatedAtBetween(teamId, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay())
                : taskRepository.findByTeamId(teamId);

            long total      = tasks.size();
            long completed  = tasks.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();
            long open       = tasks.stream().filter(t -> t.getStatus() == TaskStatus.OPEN).count();
            long inProgress = tasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
            long testing    = tasks.stream().filter(t -> t.getStatus() == TaskStatus.TESTING).count();
            long cancelled  = tasks.stream().filter(t -> t.getStatus() == TaskStatus.CANCELLED).count();
            double rate     = total > 0 ? (double) completed / total * 100 : 0;

            return new UnitComparisonDTO(teamId, team.getName(), team.getColor(), team.getIcon(),
                total, completed, open, inProgress, testing, cancelled, rate);
        })
        .filter(Objects::nonNull)
        .sorted(Comparator.comparingLong(UnitComparisonDTO::getTotal).reversed())
        .collect(Collectors.toList());
    }

    public List<UserProductivityDTO> getUserProductivity(Long teamId, LocalDate startDate, LocalDate endDate) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (teamId != null && !accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Access denied");
        }
        List<Long> teamIds = teamId != null ? List.of(teamId) : accessibleTeamIds;
        if (teamIds.isEmpty()) return Collections.emptyList();

        List<Task> tasks = new ArrayList<>();
        for (Long tid : teamIds) {
            if (startDate != null && endDate != null) {
                tasks.addAll(taskRepository.findByTeamIdAndCreatedAtBetween(tid, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay()));
            } else {
                tasks.addAll(taskRepository.findByTeamId(tid));
            }
        }

        LocalDate today = LocalDate.now();
        Map<Long, List<Task>> userTasks = new HashMap<>();
        Map<Long, String> userNames = new HashMap<>();

        for (Task task : tasks) {
            for (User user : task.getAssignees()) {
                userTasks.computeIfAbsent(user.getId(), k -> new ArrayList<>()).add(task);
                userNames.put(user.getId(), user.getFullName());
            }
        }

        return userTasks.entrySet().stream()
            .map(entry -> {
                List<Task> ut = entry.getValue();
                long assigned   = ut.size();
                long completed  = ut.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();
                long cancelled  = ut.stream().filter(t -> t.getStatus() == TaskStatus.CANCELLED).count();
                long open       = ut.stream().filter(t -> t.getStatus() == TaskStatus.OPEN).count();
                long inProgress = ut.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
                long overdue    = ut.stream()
                    .filter(t -> t.getEndDate() != null && t.getEndDate().isBefore(today)
                        && t.getStatus() != TaskStatus.COMPLETED && t.getStatus() != TaskStatus.CANCELLED)
                    .count();
                double rate = assigned > 0 ? (double) completed / assigned * 100 : 0;
                return new UserProductivityDTO(entry.getKey(), userNames.get(entry.getKey()),
                    assigned, completed, cancelled, open, inProgress, overdue, rate);
            })
            .sorted(Comparator.comparingLong(UserProductivityDTO::getCompleted).reversed())
            .collect(Collectors.toList());
    }

    public ProcessDurationDTO getProcessDuration(Long teamId, LocalDate startDate, LocalDate endDate) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (teamId != null && !accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Access denied");
        }
        List<Long> teamIds = teamId != null ? List.of(teamId) : accessibleTeamIds;
        if (teamIds.isEmpty()) return emptyDuration();

        List<TaskStatusHistory> history = taskStatusHistoryRepository.findCompletionHistoryByTeamIds(teamIds);
        if (history.isEmpty()) return emptyDuration();

        // Keep only the earliest COMPLETED transition per task
        Map<Long, TaskStatusHistory> firstCompletions = history.stream()
            .collect(Collectors.toMap(
                tsh -> tsh.getTask().getId(),
                tsh -> tsh,
                (a, b) -> a.getCreatedAt().isBefore(b.getCreatedAt()) ? a : b
            ));

        if (startDate != null && endDate != null) {
            LocalDateTime startDt = startDate.atStartOfDay();
            LocalDateTime endDt   = endDate.plusDays(1).atStartOfDay();
            firstCompletions = firstCompletions.entrySet().stream()
                .filter(e -> !e.getValue().getCreatedAt().isBefore(startDt)
                    && e.getValue().getCreatedAt().isBefore(endDt))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        }

        if (firstCompletions.isEmpty()) return emptyDuration();

        List<Double> durations = new ArrayList<>();
        Map<String, List<Double>> byPriority = new LinkedHashMap<>();
        Map<String, List<Double>> byTeam = new LinkedHashMap<>();

        for (TaskStatusHistory tsh : firstCompletions.values()) {
            Task task = tsh.getTask();
            if (task.getCreatedAt() == null) continue;
            double days = Duration.between(task.getCreatedAt(), tsh.getCreatedAt()).getSeconds() / 86400.0;
            if (days < 0) continue;

            durations.add(days);
            String pLabel = translatePriority(task.getPriority() != null ? task.getPriority().name() : "NORMAL");
            byPriority.computeIfAbsent(pLabel, k -> new ArrayList<>()).add(days);
            String tLabel = task.getTeam() != null ? task.getTeam().getName() : "Bilinmeyen";
            byTeam.computeIfAbsent(tLabel, k -> new ArrayList<>()).add(days);
        }

        if (durations.isEmpty()) return emptyDuration();

        double avg  = durations.stream().mapToDouble(d -> d).average().orElse(0);
        double min  = durations.stream().mapToDouble(d -> d).min().orElse(0);
        double max  = durations.stream().mapToDouble(d -> d).max().orElse(0);
        long count  = durations.size();

        List<ProcessDurationItemDTO> priorityList = byPriority.entrySet().stream()
            .map(e -> new ProcessDurationItemDTO(e.getKey(),
                e.getValue().stream().mapToDouble(d -> d).average().orElse(0), e.getValue().size()))
            .sorted(Comparator.comparingDouble(ProcessDurationItemDTO::getAvgDays))
            .collect(Collectors.toList());

        List<ProcessDurationItemDTO> teamList = byTeam.entrySet().stream()
            .map(e -> new ProcessDurationItemDTO(e.getKey(),
                e.getValue().stream().mapToDouble(d -> d).average().orElse(0), e.getValue().size()))
            .sorted(Comparator.comparingDouble(ProcessDurationItemDTO::getAvgDays))
            .collect(Collectors.toList());

        return new ProcessDurationDTO(avg, min, max, count, priorityList, teamList);
    }

    private ProcessDurationDTO emptyDuration() {
        return new ProcessDurationDTO(0, 0, 0, 0, Collections.emptyList(), Collections.emptyList());
    }

    private String translatePriority(String p) {
        return switch (p.toUpperCase()) {
            case "LOW"    -> "Düşük";
            case "HIGH"   -> "Yüksek";
            case "URGENT" -> "Acil";
            default       -> "Normal";
        };
    }

    private String translateStatus(TaskStatus status) {
        if (status == null) return "Bilinmeyen";
        return switch (status) {
            case OPEN        -> "Açık";
            case IN_PROGRESS -> "Devam Ediyor";
            case TESTING     -> "Test";
            case COMPLETED   -> "Tamamlandı";
            case CANCELLED   -> "İptal";
        };
    }

    private String translateSla(SlaStatus sla) {
        if (sla == null) return "-";
        return switch (sla) {
            case ON_TRACK -> "Zamanında";
            case AT_RISK  -> "Riskli";
            case BREACHED -> "Aşıldı";
            case MET      -> "Karşılandı";
        };
    }

    private CellStyle getSlaStyle(ExcelStyles s, SlaStatus sla) {
        if (sla == null) return s.dataEven;
        return switch (sla) {
            case ON_TRACK -> s.cellGreen;
            case AT_RISK  -> s.cellYellow;
            case BREACHED -> s.cellRed;
            case MET      -> s.cellBlue;
        };
    }

    private CellStyle getStatusStyle(ExcelStyles s, TaskStatus status) {
        if (status == null) return s.dataEven;
        return switch (status) {
            case COMPLETED   -> s.cellGreen;
            case IN_PROGRESS -> s.cellBlue;
            case TESTING     -> s.cellPurple;
            case OPEN        -> s.cellYellow;
            case CANCELLED   -> s.cellRed;
        };
    }

    private CellStyle getPriorityStyle(ExcelStyles s, Priority priority) {
        if (priority == null) return s.dataEven;
        return switch (priority) {
            case URGENT -> s.cellRed;
            case HIGH   -> s.cellYellow;
            default     -> s.dataEven;
        };
    }

    // ── Task List ─────────────────────────────────────────────────────────────

    private void buildTaskListSheet(XSSFWorkbook wb, ExcelStyles s, String range,
                                     Long teamId, String sheetName,
                                     LocalDate startDate, LocalDate endDate) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        List<Long> teamIds = teamId != null ? List.of(teamId) : accessibleTeamIds;
        if (teamIds.isEmpty()) return;

        List<Task> tasks = (startDate != null && endDate != null)
            ? taskRepository.findByTeamIdsAndDateRange(teamIds, startDate, endDate)
            : taskRepository.findByTeamIds(teamIds);

        tasks.sort(Comparator
            .comparing((Task t) -> t.getTeam() != null ? t.getTeam().getName() : "")
            .thenComparing(t -> t.getStartDate() != null ? t.getStartDate() : LocalDate.MIN));

        Sheet sheet = wb.createSheet(sheetName);
        sheet.setDefaultColumnWidth(16);

        int r = 0;
        r = addSheetHeader(sheet, s, "İş Listesi", range, null, 11, r);

        long total      = tasks.size();
        long completed  = tasks.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();
        long inProgress = tasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
        long stTotal    = tasks.stream().mapToLong(t -> t.getSubtasks().size()).sum();
        long stDone     = tasks.stream().flatMap(t -> t.getSubtasks().stream())
                               .filter(st -> Boolean.TRUE.equals(st.getIsCompleted())).count();

        Row kpiRow = sheet.createRow(r++);
        kpiRow.setHeightInPoints(36);
        styledCell(kpiRow, 0, "Toplam İş: " + total,       s.kpi);
        styledCell(kpiRow, 2, "Tamamlanan: " + completed,   s.kpiGreen);
        styledCell(kpiRow, 4, "Devam Eden: " + inProgress,  s.kpiBlue);
        styledCell(kpiRow, 6, "Alt İşler: " + stDone + "/" + stTotal, stTotal > 0 ? s.kpiBlue : s.kpi);
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 0, 1));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 2, 3));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 4, 5));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 6, 9));

        sheet.createRow(r++);

        String[] headers = {"#", "Başlık", "Birim", "Proje", "Öncelik", "Durum", "Başlangıç", "Bitiş", "Atananlar", "Alt İşler", "SLA"};
        Row hRow = sheet.createRow(r++);
        hRow.setHeightInPoints(22);
        for (int i = 0; i < headers.length; i++) styledCell(hRow, i, headers[i], s.columnHeader);

        int headerEndRow = r;
        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd.MM.yyyy");
        int taskNum = 1;

        for (Task task : tasks) {
            Row row = sheet.createRow(r++);
            row.setHeightInPoints(18);
            styledNumCell(row, 0, taskNum++, s.rankCell);
            styledCell(row, 1, task.getTitle() != null ? task.getTitle() : "", s.taskTitleLeft);
            styledCell(row, 2, task.getTeam() != null ? task.getTeam().getName() : "", s.dataEven);
            styledCell(row, 3, task.getProject() != null ? task.getProject().getName() : "-", s.dataEven);
            styledCell(row, 4,
                translatePriority(task.getPriority() != null ? task.getPriority().name() : "NORMAL"),
                getPriorityStyle(s, task.getPriority()));
            styledCell(row, 5, translateStatus(task.getStatus()), getStatusStyle(s, task.getStatus()));
            styledCell(row, 6, task.getStartDate() != null ? task.getStartDate().format(dtf) : "-", s.dataEven);
            styledCell(row, 7, task.getEndDate()   != null ? task.getEndDate().format(dtf)   : "-", s.dataEven);
            String assigneeNames = task.getAssignees().stream()
                .map(User::getFullName).sorted().collect(Collectors.joining(", "));
            styledCell(row, 8, assigneeNames, s.dataEven);
            long taskStDone = task.getSubtasks().stream()
                .filter(st -> Boolean.TRUE.equals(st.getIsCompleted())).count();
            styledCell(row, 9,
                task.getSubtasks().isEmpty() ? "-" : taskStDone + "/" + task.getSubtasks().size(),
                s.dataEven);
            styledCell(row, 10, translateSla(task.getSlaStatus()), getSlaStyle(s, task.getSlaStatus()));

            List<Subtask> sortedSubs = task.getSubtasks().stream()
                .sorted(Comparator.comparing((Subtask st) ->
                    st.getStartDate() != null ? st.getStartDate() : LocalDate.MAX)
                    .thenComparingLong(Subtask::getId))
                .collect(Collectors.toList());

            for (Subtask st : sortedSubs) {
                Row stRow = sheet.createRow(r++);
                stRow.setHeightInPoints(16);
                styledCell(stRow, 0, "", s.subtaskRow);
                styledCell(stRow, 1, "    ↳ " + (st.getTitle() != null ? st.getTitle() : ""), s.subtaskTitle);
                styledCell(stRow, 2, "", s.subtaskRow);
                styledCell(stRow, 3, "", s.subtaskRow);
                styledCell(stRow, 4, "", s.subtaskRow);
                CellStyle stStatus = Boolean.TRUE.equals(st.getIsCompleted()) ? s.cellGreen : s.cellYellow;
                styledCell(stRow, 5, Boolean.TRUE.equals(st.getIsCompleted()) ? "Tamamlandı" : "Bekliyor", stStatus);
                styledCell(stRow, 6, st.getStartDate() != null ? st.getStartDate().format(dtf) : "-", s.subtaskRow);
                styledCell(stRow, 7, st.getEndDate()   != null ? st.getEndDate().format(dtf)   : "-", s.subtaskRow);
                styledCell(stRow, 8, st.getAssignee() != null ? st.getAssignee().getFullName() : "-", s.subtaskRow);
                styledCell(stRow, 9, "", s.subtaskRow);
                styledCell(stRow, 10, "", s.subtaskRow);
            }
        }

        autoSizeColumns(sheet, headers.length);
        sheet.createFreezePane(0, headerEndRow);
        setupPrint(sheet);
    }

    public List<TaskListReportDTO> getTaskListData(Long teamId, LocalDate startDate, LocalDate endDate) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (teamId != null && !accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Access denied");
        }
        List<Long> teamIds = teamId != null ? List.of(teamId) : accessibleTeamIds;
        if (teamIds.isEmpty()) return Collections.emptyList();

        List<Task> tasks = (startDate != null && endDate != null)
            ? taskRepository.findByTeamIdsAndDateRange(teamIds, startDate, endDate)
            : taskRepository.findByTeamIds(teamIds);

        tasks.sort(Comparator
            .comparing((Task t) -> t.getTeam() != null ? t.getTeam().getName() : "")
            .thenComparing(t -> t.getStartDate() != null ? t.getStartDate() : LocalDate.MIN));

        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd.MM.yyyy");

        return tasks.stream().map(task -> {
            String assigneeNames = task.getAssignees().stream()
                .map(User::getFullName).sorted().collect(Collectors.joining(", "));

            List<SubtaskReportDTO> subtaskDTOs = task.getSubtasks().stream()
                .sorted(Comparator.comparing((Subtask st) ->
                    st.getStartDate() != null ? st.getStartDate() : LocalDate.MAX)
                    .thenComparingLong(Subtask::getId))
                .map(st -> new SubtaskReportDTO(
                    st.getId(), st.getTitle(),
                    Boolean.TRUE.equals(st.getIsCompleted()),
                    st.getStartDate() != null ? st.getStartDate().format(dtf) : null,
                    st.getEndDate()   != null ? st.getEndDate().format(dtf)   : null,
                    st.getAssignee()  != null ? st.getAssignee().getFullName() : null
                ))
                .collect(Collectors.toList());

            long stDone = task.getSubtasks().stream()
                .filter(st -> Boolean.TRUE.equals(st.getIsCompleted())).count();

            return new TaskListReportDTO(
                task.getId(), task.getTitle(),
                task.getTeam() != null ? task.getTeam().getName() : "",
                task.getProject() != null ? task.getProject().getName() : null,
                translatePriority(task.getPriority() != null ? task.getPriority().name() : "NORMAL"),
                translateStatus(task.getStatus()),
                task.getStartDate() != null ? task.getStartDate().format(dtf) : null,
                task.getEndDate()   != null ? task.getEndDate().format(dtf)   : null,
                assigneeNames,
                task.getSubtasks().size(),
                (int) stDone,
                subtaskDTOs,
                translateSla(task.getSlaStatus())
            );
        }).collect(Collectors.toList());
    }

    public byte[] exportToExcel(String type, Long teamId, String period, LocalDate startDate, LocalDate endDate) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            ExcelStyles s = new ExcelStyles(wb);
            String range = buildRangeLabel(startDate, endDate);

            if ("task-list".equalsIgnoreCase(type)) {
                // Sadece iş listesi
                String sheetName = "İş Listesi";
                if (teamId != null) {
                    Team team = teamRepository.findById(teamId).orElse(null);
                    if (team != null) sheetName = sanitizeSheetName(team.getName()) + " İşler";
                }
                buildTaskListSheet(wb, s, range, teamId, sheetName, startDate, endDate);
            } else if ("unit-comparison".equalsIgnoreCase(type)) {
                buildUnitSheet(wb, s, range, startDate, endDate);
                buildTaskListSheet(wb, s, range, null, "İş Listesi", startDate, endDate);
            } else if (teamId != null) {
                // Tek birim
                Team team = teamRepository.findById(teamId).orElse(null);
                String sheetName = team != null ? sanitizeSheetName(team.getName()) : "Rapor";
                if ("productivity".equalsIgnoreCase(type))
                    buildProductivitySheet(wb, s, range, teamId, sheetName, startDate, endDate);
                else
                    buildPerformanceSheet(wb, s, range, teamId, sheetName, period, startDate, endDate);
                buildTaskListSheet(wb, s, range, teamId, "İş Listesi", startDate, endDate);
            } else {
                // Tüm birimler — önce genel özet sekmesi, sonra her birim ayrı
                if ("productivity".equalsIgnoreCase(type))
                    buildProductivitySheet(wb, s, range, null, "Genel Özet", startDate, endDate);
                else
                    buildPerformanceSheet(wb, s, range, null, "Genel Özet", period, startDate, endDate);

                List<Long> teamIds = teamService.getAccessibleTeamIds();
                for (Long tid : teamIds) {
                    Team team = teamRepository.findById(tid).orElse(null);
                    String sheetName = team != null ? sanitizeSheetName(team.getName()) : ("Birim-" + tid);
                    if ("productivity".equalsIgnoreCase(type))
                        buildProductivitySheet(wb, s, range, tid, sheetName, startDate, endDate);
                    else
                        buildPerformanceSheet(wb, s, range, tid, sheetName, period, startDate, endDate);
                }
                buildTaskListSheet(wb, s, range, null, "İş Listesi", startDate, endDate);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    private static String sanitizeSheetName(String name) {
        String clean = name.replaceAll("[:\\\\/?*\\[\\]]", "").trim();
        return clean.length() > 31 ? clean.substring(0, 31) : (clean.isEmpty() ? "Birim" : clean);
    }

    // ── Performance ──────────────────────────────────────────────────────────

    private void buildPerformanceSheet(XSSFWorkbook wb, ExcelStyles s, String range,
                                       Long teamId, String sheetName, String period, LocalDate startDate, LocalDate endDate) {
        List<ReportPerformanceDTO> data = getPerformanceReport(teamId, period, startDate, endDate);
        String periodLabel = "weekly".equalsIgnoreCase(period) ? "Haftalık" : "Aylık";
        Sheet sheet = wb.createSheet(sheetName);
        sheet.setDefaultColumnWidth(16);

        int r = 0;
        r = addSheetHeader(sheet, s, "Performans Raporu", range, "Dönem: " + periodLabel, 8, r);

        // Özet satırı
        long totCreated   = data.stream().mapToLong(ReportPerformanceDTO::getCreated).sum();
        long totCompleted = data.stream().mapToLong(ReportPerformanceDTO::getCompleted).sum();
        long totCancelled = data.stream().mapToLong(ReportPerformanceDTO::getCancelled).sum();
        long totInProg    = data.stream().mapToLong(ReportPerformanceDTO::getInProgress).sum();
        long totTesting   = data.stream().mapToLong(ReportPerformanceDTO::getTesting).sum();
        long totOpen      = data.stream().mapToLong(ReportPerformanceDTO::getOpen).sum();
        double completionRate = totCreated > 0 ? (double) totCompleted / totCreated * 100 : 0;

        Row kpiRow = sheet.createRow(r++);
        kpiRow.setHeightInPoints(36);
        styledCell(kpiRow, 0, "Toplam Oluşturulan: " + totCreated, s.kpi);
        styledCell(kpiRow, 2, "Tamamlanan: " + totCompleted, s.kpiGreen);
        styledCell(kpiRow, 4, "İptal Edilen: " + totCancelled, s.kpiRed);
        styledCell(kpiRow, 6, String.format("Tamamlanma Oranı: %.1f%%", completionRate), s.kpiBlue);
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 0, 1));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 2, 3));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 4, 5));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 6, 7));

        sheet.createRow(r++); // boşluk

        // Sütun başlıkları
        String[] headers = {"Dönem", "Oluşturulan", "Tamamlanan", "İptal", "Devam Eden", "Test", "Açık", "Tamamlanma %"};
        addHeaderRow(sheet, s, headers, r++);

        // Veri satırları
        for (ReportPerformanceDTO d : data) {
            Row row = sheet.createRow(r++);
            CellStyle base = (r % 2 == 0) ? s.dataEven : s.dataOdd;
            styledCell(row, 0, d.getPeriod(), base);
            styledNumCell(row, 1, d.getCreated(), base);
            styledNumCell(row, 2, d.getCompleted(), s.cellGreen);
            styledNumCell(row, 3, d.getCancelled(), s.cellRed);
            styledNumCell(row, 4, d.getInProgress(), s.cellBlue);
            styledNumCell(row, 5, d.getTesting(), s.cellPurple);
            styledNumCell(row, 6, d.getOpen(), s.cellYellow);
            double rate = d.getCreated() > 0 ? (double) d.getCompleted() / d.getCreated() * 100 : 0;
            styledCell(row, 7, String.format("%.1f%%", rate), s.cellPct);
        }

        // Totaller
        Row totRow = sheet.createRow(r);
        totRow.setHeightInPoints(20);
        styledCell(totRow, 0, "TOPLAM", s.totalsLabel);
        styledNumCell(totRow, 1, totCreated,   s.totalsNum);
        styledNumCell(totRow, 2, totCompleted, s.totalsNum);
        styledNumCell(totRow, 3, totCancelled, s.totalsNum);
        styledNumCell(totRow, 4, totInProg,    s.totalsNum);
        styledNumCell(totRow, 5, totTesting,   s.totalsNum);
        styledNumCell(totRow, 6, totOpen,      s.totalsNum);
        styledCell(totRow, 7, String.format("%.1f%%", completionRate), s.totalsNum);

        autoSizeColumns(sheet, headers.length);
        sheet.createFreezePane(0, r - data.size() - 1);
        setupPrint(sheet);
    }

    // ── Unit Comparison ───────────────────────────────────────────────────────

    private void buildUnitSheet(XSSFWorkbook wb, ExcelStyles s, String range,
                                LocalDate startDate, LocalDate endDate) {
        List<UnitComparisonDTO> data = getUnitComparison(startDate, endDate);
        Sheet sheet = wb.createSheet("Birim Karşılaştırma");
        sheet.setDefaultColumnWidth(18);

        int r = 0;
        r = addSheetHeader(sheet, s, "Birim Karşılaştırma Raporu", range, null, 8, r);

        long grandTotal     = data.stream().mapToLong(UnitComparisonDTO::getTotal).sum();
        long grandCompleted = data.stream().mapToLong(UnitComparisonDTO::getCompleted).sum();
        long grandOpen      = data.stream().mapToLong(UnitComparisonDTO::getOpen).sum();
        long grandInProg    = data.stream().mapToLong(UnitComparisonDTO::getInProgress).sum();
        long grandTesting   = data.stream().mapToLong(UnitComparisonDTO::getTesting).sum();
        long grandCancelled = data.stream().mapToLong(UnitComparisonDTO::getCancelled).sum();
        double avgRate      = data.stream().mapToDouble(UnitComparisonDTO::getCompletionRate).average().orElse(0);

        Row kpiRow = sheet.createRow(r++);
        kpiRow.setHeightInPoints(36);
        styledCell(kpiRow, 0, "Toplam İş: " + grandTotal,              s.kpi);
        styledCell(kpiRow, 2, "Tamamlanan: " + grandCompleted,          s.kpiGreen);
        styledCell(kpiRow, 4, "İptal Edilen: " + grandCancelled,        s.kpiRed);
        styledCell(kpiRow, 6, String.format("Ort. Oran: %.1f%%", avgRate), s.kpiBlue);
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 0, 1));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 2, 3));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 4, 5));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 6, 7));

        sheet.createRow(r++);

        String[] headers = {"Birim Adı", "Toplam", "Tamamlanan", "Açık", "Devam Eden", "Test", "İptal", "Tamamlanma %"};
        addHeaderRow(sheet, s, headers, r++);

        for (UnitComparisonDTO d : data) {
            Row row = sheet.createRow(r++);
            CellStyle base = (r % 2 == 0) ? s.dataEven : s.dataOdd;
            styledCell(row, 0, d.getTeamName(), base);
            styledNumCell(row, 1, d.getTotal(),      base);
            styledNumCell(row, 2, d.getCompleted(),  s.cellGreen);
            styledNumCell(row, 3, d.getOpen(),       s.cellYellow);
            styledNumCell(row, 4, d.getInProgress(), s.cellBlue);
            styledNumCell(row, 5, d.getTesting(),    s.cellPurple);
            styledNumCell(row, 6, d.getCancelled(),  s.cellRed);
            styledCell(row, 7, String.format("%.1f%%", d.getCompletionRate()), s.cellPct);
        }

        Row totRow = sheet.createRow(r);
        totRow.setHeightInPoints(20);
        styledCell(totRow, 0, "TOPLAM / ORTALAMA", s.totalsLabel);
        styledNumCell(totRow, 1, grandTotal,     s.totalsNum);
        styledNumCell(totRow, 2, grandCompleted, s.totalsNum);
        styledNumCell(totRow, 3, grandOpen,      s.totalsNum);
        styledNumCell(totRow, 4, grandInProg,    s.totalsNum);
        styledNumCell(totRow, 5, grandTesting,   s.totalsNum);
        styledNumCell(totRow, 6, grandCancelled, s.totalsNum);
        styledCell(totRow, 7, String.format("%.1f%%", avgRate), s.totalsNum);

        autoSizeColumns(sheet, headers.length);
        sheet.createFreezePane(0, r - data.size() - 1);
        setupPrint(sheet);
    }

    // ── Productivity ──────────────────────────────────────────────────────────

    private void buildProductivitySheet(XSSFWorkbook wb, ExcelStyles s, String range,
                                        Long teamId, String sheetName, LocalDate startDate, LocalDate endDate) {
        List<UserProductivityDTO> data = getUserProductivity(teamId, startDate, endDate);
        Sheet sheet = wb.createSheet(sheetName);
        sheet.setDefaultColumnWidth(16);

        int r = 0;
        r = addSheetHeader(sheet, s, "Kişisel Verimlilik Raporu", range, null, 8, r);

        long totAssigned   = data.stream().mapToLong(UserProductivityDTO::getAssigned).sum();
        long totCompleted  = data.stream().mapToLong(UserProductivityDTO::getCompleted).sum();
        long totOverdue    = data.stream().mapToLong(UserProductivityDTO::getOverdue).sum();
        double avgRate     = data.stream().mapToDouble(UserProductivityDTO::getCompletionRate).average().orElse(0);

        Row kpiRow = sheet.createRow(r++);
        kpiRow.setHeightInPoints(36);
        styledCell(kpiRow, 0, "Toplam Atanan: " + totAssigned,         s.kpi);
        styledCell(kpiRow, 2, "Tamamlanan: " + totCompleted,            s.kpiGreen);
        styledCell(kpiRow, 4, "Gecikmiş: " + totOverdue,               totOverdue > 0 ? s.kpiRed : s.kpi);
        styledCell(kpiRow, 6, String.format("Ort. Oran: %.1f%%", avgRate), s.kpiBlue);
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 0, 1));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 2, 3));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 4, 5));
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 6, 7));

        sheet.createRow(r++);

        String[] headers = {"#", "Kullanıcı Adı", "Atanan", "Tamamlanan", "İptal", "Açık", "Devam Eden", "Gecikmiş", "Tamamlanma %"};
        // 9 sütun — başlık satırına manuel yaz
        Row hRow = sheet.createRow(r++);
        hRow.setHeightInPoints(22);
        for (int i = 0; i < headers.length; i++) styledCell(hRow, i, headers[i], s.columnHeader);

        int rank = 1;
        for (UserProductivityDTO d : data) {
            Row row = sheet.createRow(r++);
            CellStyle base = (r % 2 == 0) ? s.dataEven : s.dataOdd;
            CellStyle overdueStyle = d.getOverdue() > 0 ? s.cellRed : base;
            styledNumCell(row, 0, rank++,           s.rankCell);
            styledCell(row,  1, d.getUserName(),     base);
            styledNumCell(row, 2, d.getAssigned(),   base);
            styledNumCell(row, 3, d.getCompleted(),  s.cellGreen);
            styledNumCell(row, 4, d.getCancelled(),  s.cellRed);
            styledNumCell(row, 5, d.getOpen(),       s.cellYellow);
            styledNumCell(row, 6, d.getInProgress(), s.cellBlue);
            styledNumCell(row, 7, d.getOverdue(),    overdueStyle);
            styledCell(row,  8, String.format("%.1f%%", d.getCompletionRate()), s.cellPct);
        }

        Row totRow = sheet.createRow(r);
        totRow.setHeightInPoints(20);
        styledCell(totRow, 0,    "TOPLAM", s.totalsLabel);
        styledCell(totRow, 1,    "",       s.totalsLabel);
        styledNumCell(totRow, 2, totAssigned,  s.totalsNum);
        styledNumCell(totRow, 3, totCompleted, s.totalsNum);
        styledNumCell(totRow, 7, totOverdue,   s.totalsNum);
        styledCell(totRow, 8, String.format("%.1f%%", avgRate), s.totalsNum);

        autoSizeColumns(sheet, headers.length);
        sheet.createFreezePane(0, r - data.size() - 1);
        setupPrint(sheet);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private int addSheetHeader(Sheet sheet, ExcelStyles s, String title,
                                String range, String extra, int colCount, int startRow) {
        int r = startRow;

        Row titleRow = sheet.createRow(r++);
        titleRow.setHeightInPoints(32);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("TORA İş Takip Sistemi  —  " + title);
        titleCell.setCellStyle(s.sheetTitle);
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 0, colCount - 1));

        Row metaRow = sheet.createRow(r++);
        metaRow.setHeightInPoints(18);
        Cell metaCell = metaRow.createCell(0);
        String meta = "Tarih Aralığı: " + range
            + "   |   Oluşturulma: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"))
            + (extra != null ? "   |   " + extra : "");
        metaCell.setCellValue(meta);
        metaCell.setCellStyle(s.metaStyle);
        sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 0, colCount - 1));

        sheet.createRow(r++); // boşluk
        return r;
    }

    private void addHeaderRow(Sheet sheet, ExcelStyles s, String[] headers, int rowIdx) {
        Row hRow = sheet.createRow(rowIdx);
        hRow.setHeightInPoints(22);
        for (int i = 0; i < headers.length; i++) styledCell(hRow, i, headers[i], s.columnHeader);
    }

    private void styledCell(Row row, int col, String value, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(value);
        c.setCellStyle(style);
    }

    private void styledNumCell(Row row, int col, long value, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(value);
        c.setCellStyle(style);
    }

    private void autoSizeColumns(Sheet sheet, int count) {
        for (int i = 0; i < count; i++) {
            sheet.autoSizeColumn(i);
            int w = sheet.getColumnWidth(i);
            sheet.setColumnWidth(i, Math.min(w + 512, 10000));
        }
    }

    private void setupPrint(Sheet sheet) {
        sheet.getPrintSetup().setLandscape(true);
        sheet.getPrintSetup().setFitWidth((short) 1);
        sheet.getPrintSetup().setFitHeight((short) 0);
        sheet.setFitToPage(true);
    }

    private String buildRangeLabel(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) return "Tüm Veriler";
        DateTimeFormatter f = DateTimeFormatter.ofPattern("dd.MM.yyyy");
        return startDate.format(f) + " – " + endDate.format(f);
    }

    // ── Excel Style Container ─────────────────────────────────────────────────

    private static class ExcelStyles {
        final CellStyle sheetTitle, metaStyle, columnHeader, kpi, kpiGreen, kpiRed, kpiBlue;
        final CellStyle dataEven, dataOdd, cellGreen, cellRed, cellBlue, cellPurple, cellYellow;
        final CellStyle cellPct, totalsLabel, totalsNum, rankCell;
        final CellStyle taskTitleLeft, subtaskRow, subtaskTitle;

        ExcelStyles(XSSFWorkbook wb) {
            sheetTitle    = buildTitleStyle(wb);
            metaStyle     = buildMetaStyle(wb);
            columnHeader  = buildHeaderStyle(wb);
            kpi           = buildKpiStyle(wb, 0x1F, 0x49, 0x7D);
            kpiGreen      = buildKpiStyle(wb, 0x37, 0x5C, 0x32);
            kpiRed        = buildKpiStyle(wb, 0x7B, 0x1C, 0x1C);
            kpiBlue       = buildKpiStyle(wb, 0x05, 0x37, 0x61);
            dataEven      = buildDataStyle(wb, 0xFF, 0xFF, 0xFF);
            dataOdd       = buildDataStyle(wb, 0xF2, 0xF7, 0xFF);
            cellGreen     = buildDataStyle(wb, 0xE2, 0xEF, 0xDA);
            cellRed       = buildDataStyle(wb, 0xFF, 0xCC, 0xCC);
            cellBlue      = buildDataStyle(wb, 0xDD, 0xEB, 0xF7);
            cellPurple    = buildDataStyle(wb, 0xEA, 0xE2, 0xF5);
            cellYellow    = buildDataStyle(wb, 0xFF, 0xF2, 0xCC);
            cellPct       = buildPctStyle(wb);
            totalsLabel   = buildTotalsStyle(wb, true);
            totalsNum     = buildTotalsStyle(wb, false);
            rankCell      = buildRankStyle(wb);
            taskTitleLeft = buildTaskTitleStyle(wb);
            subtaskRow    = buildSubtaskRowStyle(wb);
            subtaskTitle  = buildSubtaskTitleStyle(wb);
        }

        private static CellStyle buildTitleStyle(XSSFWorkbook wb) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{0x1F, 0x49, 0x7D}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 14);
            f.setBold(true); f.setColor(new XSSFColor(new byte[]{(byte)0xFF, (byte)0xFF, (byte)0xFF}, null));
            cs.setFont(f);
            cs.setAlignment(HorizontalAlignment.LEFT);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(cs, BorderStyle.NONE);
            return cs;
        }

        private static CellStyle buildMetaStyle(XSSFWorkbook wb) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{(byte)0xD6, (byte)0xE4, (byte)0xF0}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 10);
            f.setColor(new XSSFColor(new byte[]{0x1F, 0x49, 0x7D}, null));
            cs.setFont(f);
            cs.setAlignment(HorizontalAlignment.LEFT);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(cs, BorderStyle.NONE);
            return cs;
        }

        private static CellStyle buildHeaderStyle(XSSFWorkbook wb) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{0x2E, 0x75, (byte)0xB6}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 11);
            f.setBold(true); f.setColor(new XSSFColor(new byte[]{(byte)0xFF, (byte)0xFF, (byte)0xFF}, null));
            cs.setFont(f);
            cs.setAlignment(HorizontalAlignment.CENTER);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            cs.setWrapText(true);
            setBorder(cs, BorderStyle.THIN);
            return cs;
        }

        private static CellStyle buildKpiStyle(XSSFWorkbook wb, int r, int g, int b) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{(byte) r, (byte) g, (byte) b}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 12);
            f.setBold(true); f.setColor(new XSSFColor(new byte[]{(byte)0xFF, (byte)0xFF, (byte)0xFF}, null));
            cs.setFont(f);
            cs.setAlignment(HorizontalAlignment.CENTER);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(cs, BorderStyle.MEDIUM);
            return cs;
        }

        private static CellStyle buildDataStyle(XSSFWorkbook wb, int r, int g, int b) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{(byte) r, (byte) g, (byte) b}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 10);
            cs.setFont(f);
            cs.setAlignment(HorizontalAlignment.CENTER);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(cs, BorderStyle.THIN);
            return cs;
        }

        private static CellStyle buildPctStyle(XSSFWorkbook wb) {
            XSSFCellStyle cs = (XSSFCellStyle) buildDataStyle(wb, 0xEE, 0xEE, 0xEE);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 10); f.setBold(true);
            cs.setFont(f);
            return cs;
        }

        private static CellStyle buildTotalsStyle(XSSFWorkbook wb, boolean isLabel) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{0x1F, 0x49, 0x7D}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 11);
            f.setBold(true); f.setColor(new XSSFColor(new byte[]{(byte)0xFF, (byte)0xFF, (byte)0xFF}, null));
            cs.setFont(f);
            cs.setAlignment(isLabel ? HorizontalAlignment.LEFT : HorizontalAlignment.CENTER);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(cs, BorderStyle.MEDIUM);
            return cs;
        }

        private static CellStyle buildRankStyle(XSSFWorkbook wb) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{(byte)0xBF, (byte)0xD7, (byte)0xED}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 10); f.setBold(true);
            cs.setFont(f);
            cs.setAlignment(HorizontalAlignment.CENTER);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(cs, BorderStyle.THIN);
            return cs;
        }

        private static CellStyle buildTaskTitleStyle(XSSFWorkbook wb) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{(byte)0xFF, (byte)0xFF, (byte)0xFF}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 10); f.setBold(true);
            cs.setFont(f);
            cs.setAlignment(HorizontalAlignment.LEFT);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(cs, BorderStyle.THIN);
            return cs;
        }

        private static CellStyle buildSubtaskRowStyle(XSSFWorkbook wb) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{(byte)0xF5, (byte)0xF5, (byte)0xF5}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 9);
            f.setColor(new XSSFColor(new byte[]{(byte)0x60, (byte)0x60, (byte)0x60}, null));
            cs.setFont(f);
            cs.setAlignment(HorizontalAlignment.CENTER);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(cs, BorderStyle.THIN);
            return cs;
        }

        private static CellStyle buildSubtaskTitleStyle(XSSFWorkbook wb) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFillForegroundColor(new XSSFColor(new byte[]{(byte)0xF5, (byte)0xF5, (byte)0xF5}, null));
            cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setFontName("Calibri"); f.setFontHeightInPoints((short) 9); f.setItalic(true);
            f.setColor(new XSSFColor(new byte[]{(byte)0x40, (byte)0x40, (byte)0x40}, null));
            cs.setFont(f);
            cs.setAlignment(HorizontalAlignment.LEFT);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(cs, BorderStyle.THIN);
            return cs;
        }

        private static void setBorder(XSSFCellStyle cs, BorderStyle bs) {
            cs.setBorderTop(bs); cs.setBorderBottom(bs);
            cs.setBorderLeft(bs); cs.setBorderRight(bs);
        }
    }
}
