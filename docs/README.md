# TORA Documentation

> A calendar-focused project and task management platform for departments/teams.

## Table of Contents

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture, tech stack, project structure, and design patterns |
| [Database Schema](./database-schema.md) | Complete database tables, columns, relationships, indexes, and migrations |
| [API Reference](./api-reference.md) | All REST API endpoints with request/response examples |
| [Authentication & Security](./authentication.md) | JWT, LDAP, hybrid auth flow, role-based access, rate limiting, AOP logging |
| [Deployment](./deployment.md) | Docker setup, environment variables, HikariCP, troubleshooting, and production config |
| [Development Guide](./development-guide.md) | Local setup, coding conventions, adding features, resilience patterns |
| [Frontend](./frontend.md) | React frontend architecture, components, state management, and views |
| [Roadmap](./roadmap.md) | Planned features, improvements, and known issues for future development |

## Quick Overview

TORA is a full-stack web application built with **Spring Boot 3.2** (Java 17) and **React 18** (TypeScript). It provides:

- **Multi-level authorization**: Admin > Department Head > Staff
- **Hybrid authentication**: LDAP + Local users with JWT access + rotating refresh tokens
- **Task management**: Calendar, Week, 12-month, Gantt chart, Kanban, and List views
- **Project management**: Multi-team projects with progress tracking and a project manager
- **Search & filters**: Global full-text search (tasks/projects/users) + saved filters
- **Reports**: Performance, productivity, unit-comparison metrics with Excel export
- **Notifications**: In-app notifications (assignment, status, due-soon, comment mentions)
- **Admin panel**: User, team, role, LDAP, and log management
- **Dashboard**: Real-time statistics with charts and leaderboards
- **Logging**: System logs (backend/frontend) and task operation audit logs
- **Security**: Rate limiting, account lockout, AES-256-GCM encryption, BCrypt passwords, token revocation, HTTP security headers

## Default Credentials

| User | Password | Role | Access |
|------|----------|------|--------|
| `admin` | `admin` | ADMIN | Full access to all teams and features |

> **Important**: Change the default password after first login.
