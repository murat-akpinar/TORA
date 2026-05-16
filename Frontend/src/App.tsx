import React, { lazy, Suspense, useEffect, useState, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorBoundary from './components/common/ErrorBoundary';
import KeyboardShortcutsHelp from './components/common/KeyboardShortcutsHelp';
import { useKeyboardShortcuts, Shortcut } from './hooks/useKeyboardShortcuts';
import { initializeErrorLogger } from './utils/errorLogger';
import './App.css';

const CalendarPage      = lazy(() => import('./pages/CalendarPage'));
const DashboardPage     = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage      = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const AdminPanelPage    = lazy(() => import('./pages/AdminPanelPage'));
const UserProfilePage   = lazy(() => import('./pages/UserProfilePage'));
const NotFoundPage      = lazy(() => import('./pages/NotFoundPage'));
const ErrorPage         = lazy(() => import('./pages/ErrorPage'));

const AppContent: React.FC = () => {
  const { isAuthenticated, loading, hasRole } = useAuth();
  const navigate = useNavigate();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const isAdmin = hasRole('ADMIN');

  const shortcuts = useMemo<Shortcut[]>(() => [
    {
      keys: ['?'],
      description: 'Klavye kısayollarını göster / gizle',
      category: 'Genel',
      handler: () => setShowShortcuts(prev => !prev),
    },
    {
      keys: ['g', 'h'],
      description: 'Ana Sayfa — İşler',
      category: 'Navigasyon',
      handler: () => navigate('/'),
    },
    {
      keys: ['g', 'p'],
      description: 'Projeler',
      category: 'Navigasyon',
      handler: () => navigate('/projects'),
    },
    {
      keys: ['g', 'd'],
      description: 'Rapor / Dashboard',
      category: 'Navigasyon',
      handler: () => navigate('/dashboard'),
    },
    {
      keys: ['g', 'u'],
      description: 'Profilim',
      category: 'Navigasyon',
      handler: () => navigate('/profile'),
    },
    ...(isAdmin
      ? [{
          keys: ['g', 'a'],
          description: 'Yönetim Paneli',
          category: 'Navigasyon',
          handler: () => navigate('/admin'),
        }]
      : []),
  ], [navigate, isAdmin]);

  useKeyboardShortcuts(isAuthenticated ? shortcuts : []);

  if (loading) {
    return <LoadingSpinner size="lg" showLabel label="Yükleniyor..." />;
  }

  return (
    <>
      <a href="#main-content" className="skip-link">Ana içeriğe geç</a>

      <Suspense fallback={<LoadingSpinner size="lg" showLabel label="Yükleniyor..." />}>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />}
          />
          <Route
            path="/"
            element={isAuthenticated ? <CalendarPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/dashboard"
            element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/projects"
            element={isAuthenticated ? <ProjectsPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/projects/:id"
            element={isAuthenticated ? <ProjectDetailPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/admin"
            element={isAuthenticated ? <AdminPanelPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <UserProfilePage /> : <Navigate to="/login" />}
          />
          <Route path="/reports" element={<Navigate to="/dashboard" />} />
          <Route path="/403" element={<ErrorPage type="403" />} />
          <Route path="/500" element={<ErrorPage type="500" />} />
          <Route path="/network-error" element={<ErrorPage type="network" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      {isAuthenticated && (
        <KeyboardShortcutsHelp
          isOpen={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          shortcuts={shortcuts}
        />
      )}
    </>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    initializeErrorLogger();
  }, []);

  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
