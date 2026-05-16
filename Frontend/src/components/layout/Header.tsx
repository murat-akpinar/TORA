import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LuSun, LuMoon, LuMenu } from 'react-icons/lu';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import NotificationBell from '../notifications/NotificationBell';
import GlobalSearch from '../search/GlobalSearch';
import './Header.css';

interface HeaderProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  onMenuToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ selectedYear, onYearChange, onMenuToggle }) => {
  const { user, logout, hasRole } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const isAdmin = hasRole('ADMIN');

  const handleProfileClick = () => navigate('/profile');
  const handleAdminPanelClick = () => navigate('/admin');

  const getRoleLabel = (roles: string[]): string => {
    if (roles.includes('ADMIN')) return 'Yönetici';
    if (roles.includes('BIRIM_AMIRI')) return 'Birim Amiri';
    if (roles.includes('YAZILIMCI')) return 'Yazılımcı';
    if (roles.includes('DEVOPS')) return 'DevOps';
    if (roles.includes('IS_ANALISTI')) return 'İş Analisti';
    if (roles.includes('TESTCI')) return 'Test Uzmanı';
    return roles.join(', ') || 'Kullanıcı';
  };

  return (
    <header className="header" role="banner">
      {onMenuToggle && (
        <button
          className="header-menu-btn"
          onClick={onMenuToggle}
          aria-label="Menüyü aç / kapat"
        >
          <LuMenu size={20} />
        </button>
      )}

      <div className="year-selector">
        <label htmlFor="year-select">Yıl:</label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
          aria-label="Görüntülenen yılı seç"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <GlobalSearch />

      <div className="user-info">
        <NotificationBell />

        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={isDark ? 'Açık temaya geç (Catppuccin Latte)' : 'Koyu temaya geç (Catppuccin Mocha)'}
          title={isDark ? 'Açık tema' : 'Koyu tema'}
        >
          {isDark ? <LuSun size={17} /> : <LuMoon size={17} />}
          <span className="theme-toggle-label">{isDark ? 'Latte' : 'Mocha'}</span>
        </button>

        {isAdmin && (
          <button
            className="admin-panel-btn"
            onClick={handleAdminPanelClick}
            aria-label="Yönetim Paneli sayfasına git"
          >
            Yönetim Paneli
          </button>
        )}

        <button
          className="user-profile-section"
          onClick={handleProfileClick}
          aria-label={`${user?.fullName || user?.username} — profili görüntüle`}
        >
          <span className="user-name">{user?.fullName || user?.username}</span>
          {user?.roles && user.roles.length > 0 && (
            <span className="user-role" aria-hidden="true">
              {getRoleLabel(user.roles)}
            </span>
          )}
        </button>

        <button
          className="logout-btn"
          onClick={logout}
          aria-label="Oturumu kapat"
        >
          Çıkış
        </button>
      </div>
    </header>
  );
};

export default Header;
