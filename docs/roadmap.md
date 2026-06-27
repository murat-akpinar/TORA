# Development Roadmap

This document outlines planned features, improvements, and known issues. Use this as a guide when picking up new development work.

> Turkish version: [todo/todo.md](../todo/todo.md)

---

## Completed Features

The following features are already implemented and available:

- **Admin Panel**: Full user CRUD, team CRUD, role management, LDAP settings UI, LDAP user import, admin audit log
- **Team Management**: Leader assignment, member management, custom colors and icons
- **Task Audit Logging**: TaskLog system tracking all CRUD operations with old/new values
- **Views**: Calendar, Week, 12-month overview, Kanban, Gantt (subtask hierarchy), and paginated List view
- **Task Types & Priorities**: TASK/FEATURE/BUG/… types, NORMAL/HIGH/URGENT priorities
- **Flexible Labels**: Team-scoped `task_labels` (replaced the old fixed task types in the UI)
- **Subtask Support**: Child tasks with assignee, dates, and completion tracking
- **Notifications**: In-app notifications (assignment, status change, due-soon cron, comment mentions) with header bell + polling
- **Task Comments**: Comment threads with `@mention` autocomplete and mention notifications
- **Global Search & Saved Filters**: PostgreSQL full-text/trigram search across tasks/projects/users + per-user saved filters
- **Reports & Analytics**: Performance, productivity, unit-comparison, process-duration reports with Excel (`.xlsx`) export
- **Hybrid Auth**: LDAP + Local user authentication with JWT access + rotating refresh tokens, token revocation on logout
- **Security Hardening**: AES-256-GCM secret encryption (PBKDF2), startup secret validation, HTTP security headers, login history
- **Rate Limiting & Account Lockout**: DB-backed `LoginAttemptService` (IP + account), failed-attempt tracking
- **System Logs & Health**: Backend/frontend log collection and viewing, system health monitoring, scheduled log cleanup
- **Performance**: Caffeine caching (dashboard, user details), N+1 fixes (`@BatchSize` + fetch joins), SQL aggregation, search/start-date indexes, lazy-loaded routes
- **Theme**: Dark/Light toggle (Catppuccin Mocha/Latte) persisted per browser
- **Docker**: Full containerized deployment with Docker Compose
- **Liquibase**: Versioned database migrations (V1–V27)

---

## Short Term (High Priority)

> Notifications, Task Comments, Reporting/Analytics, Global Search + Saved Filters, and the Dark/Light theme have been **completed** — see the Completed Features list above and `todo/todo.md` for details.

### 1. File Attachments
**Goal**: Allow file uploads on tasks.

- [ ] Create `task_attachments` table (id, task_id, filename, file_path, file_size, content_type, uploaded_by, created_at)
- [ ] Create file storage service (local filesystem or S3-compatible)
- [ ] Endpoints:
  - `POST /api/tasks/{id}/attachments` — upload file
  - `GET /api/tasks/{id}/attachments` — list attachments
  - `GET /api/tasks/{id}/attachments/{attachmentId}` — download file
  - `DELETE /api/tasks/{id}/attachments/{attachmentId}` — delete file
- [ ] Frontend: file upload area in TaskModal
- [ ] File size limits and allowed types configuration

### 2. Task Templates
**Goal**: Predefined task templates for common workflows.

- [ ] Create `task_templates` table (id, name, title_template, content_template, task_type, priority, team_id, subtask_templates JSON, created_by, created_at)
- [ ] CRUD endpoints for templates
- [ ] Frontend: "Create from template" option in task creation
- [ ] Team-specific and global templates

### 3. Recurring Tasks
**Goal**: Automatically create tasks on a schedule.

- [ ] Create `recurring_task_rules` table (id, template fields, recurrence_type, recurrence_interval, next_run_date, is_active)
- [ ] Scheduled job to create tasks based on rules
- [ ] Recurrence types: DAILY, WEEKLY, BIWEEKLY, MONTHLY
- [ ] Frontend: recurrence settings in task creation modal

### 4. Bulk CSV User Import
**Goal**: Import multiple users at once from a CSV file.

- [ ] CSV upload endpoint with validation
- [ ] Frontend: CSV upload UI in admin panel
- [ ] Error reporting for invalid rows

---

## Medium Term

> **Done:** Reporting & Analytics (performance/productivity/unit-comparison/process-duration + Excel export, `GET /api/reports/*`) and Global Search + Saved Filters are implemented — see Completed Features. PDF export remains a possible future addition.

### 5. Advanced Calendar Features
**Goal**: Enhanced calendar functionality.

- [ ] Drag-and-drop task rescheduling on calendar
- [ ] Daily detailed view
- [ ] Holiday and leave day markers
- [ ] Google Calendar / Outlook integration (iCal export)
- [ ] Print-friendly calendar view

### 6. Sprint / Milestone Support
**Goal**: Agile project management capabilities.

- [ ] Create `milestones` table (id, project_id, name, target_date, status)
- [ ] Create `sprints` table (id, project_id, name, start_date, end_date, goal)
- [ ] Link tasks to sprints/milestones
- [ ] Sprint board view
- [ ] Burndown chart
- [ ] Project progress percentage widget

---

## Long Term

### 7. Mobile Application
**Goal**: Native mobile experience.

- [ ] React Native or Flutter mobile app
- [ ] Push notifications
- [ ] Offline mode with sync
- [ ] Camera integration for file attachments

### 8. Integrations & Automation
**Goal**: Connect with external tools.

- [ ] Webhook system for external integrations
- [ ] Slack / Microsoft Teams notification integration
- [ ] Email-to-task creation
- [ ] Automatic task assignment rules (round-robin, skill-based)
- [ ] SLA tracking with configurable thresholds

### 9. Enhanced Security
**Goal**: Enterprise-grade security.

- [ ] Two-factor authentication (2FA) — TOTP
- [ ] Comprehensive audit log (all entity changes)
- [ ] Database backup and restore UI
- [ ] API key authentication for external integrations
- [ ] IP whitelist for admin panel

### 10. AI Features
**Goal**: Intelligent assistance.

- [ ] Task priority suggestion based on historical data
- [ ] Automatic time estimation for tasks
- [ ] Smart task assignment (workload balancing)
- [ ] Duplicate task detection
- [ ] Natural language task creation

### 11. Internationalization (i18n)
**Goal**: Multi-language support.

- [ ] Extract all UI strings to translation files
- [ ] Turkish and English language support
- [ ] Language preference per user
- [ ] Date/time format localization

### 12. Theme Support (partially done)
**Goal**: User-customizable appearance.

- [x] Dark/Light theme toggle (Catppuccin Mocha/Latte, persisted in `localStorage`)
- [ ] Theme preference stored server-side per user
- [ ] Additional Catppuccin flavors (Frappe, Macchiato)

---

## Known Issues & Improvements

### Code Quality
- [ ] Increase unit test coverage (backend & frontend)
- [ ] Add integration tests for API endpoints
- [ ] Add E2E tests (Cypress or Playwright)

### UX Improvements
- [x] Consistent loading states (`LoadingSpinner`) and inline form validation (`formValidation.ts`)
- [x] Responsive design for tablets and mobile (900px breakpoint)
- [x] Accessibility (WCAG 2.1 AA) pass — skip link, focus rings, ARIA roles
- [x] Keyboard shortcuts for common actions (`?` help, `g h/p/d/a/u` navigation)
- [x] Dedicated error pages (403 / 500 / network) + ErrorBoundary
- [ ] More user-friendly error messages (ongoing)

### Performance
- [x] Pagination on task list views (20/page)
- [x] Caffeine in-memory caching (dashboard stats + user details)
- [x] Database index review (V23/V25/V26) and N+1 query fixes
- [x] Route-level lazy loading + Vite chunk splitting
- [ ] Add a Redis caching/shared layer (also enables persistent token blacklist/refresh store)
- [ ] Image/asset optimization

### DevOps
- [ ] CI/CD pipeline (GitHub Actions / GitLab CI)
- [ ] Automated testing in pipeline
- [ ] Staging environment configuration
- [ ] Health check alerting (Prometheus + Grafana)
- [ ] Log aggregation (ELK stack or similar)
- [ ] Database backup automation

---

## How to Pick Up Work

1. Choose an item from the lists above
2. Check the [database schema docs](./database-schema.md) for related tables
3. Check the [API reference](./api-reference.md) for existing endpoints in the same domain
4. Follow the patterns described in the [Development Guide](./development-guide.md)
5. Update this roadmap and [todo.md](../todo/todo.md) when the feature is complete
