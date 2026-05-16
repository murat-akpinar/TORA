import React, { useEffect, useState, KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LuClipboardList,
  LuFolderKanban,
  LuLayoutDashboard,
  LuUsers,
  LuChevronLeft,
  LuChevronRight,
  LuX,
} from 'react-icons/lu';
import { Team } from '../../types/Team';
import { teamService } from '../../services/teamService';
import './Sidebar.css';

interface SidebarProps {
  selectedTeamId: number | null;
  onTeamSelect: (teamId: number | null) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedTeamId,
  onTeamSelect,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const location = useLocation();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const data = await teamService.getAllTeams();
        setTeams(data);
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, []);

  const handleCloseOnMobile = () => {
    if (window.matchMedia('(max-width: 768px)').matches && !isCollapsed && onToggleCollapse) {
      onToggleCollapse();
    }
  };

  const handleTeamKeyDown = (e: KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  const isNavActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      {!isCollapsed && onToggleCollapse && (
        <button
          className="sidebar-backdrop"
          onClick={onToggleCollapse}
          aria-label="Kenar çubuğunu kapat"
          tabIndex={-1}
        />
      )}

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
        aria-label="Ana gezinme"
      >
        <div className="sidebar-header">
          <div className="sidebar-header-inner">
            {!isCollapsed && (
              <div>
                <div className="sidebar-title">TORA</div>
                <div className="sidebar-subtitle">İş Takip Sistemi</div>
              </div>
            )}
            {onToggleCollapse && (
              <>
                {/* Masaüstü: daralt / genişlet oku */}
                <button
                  className="sidebar-toggle-btn sidebar-toggle-desktop"
                  onClick={onToggleCollapse}
                  title={isCollapsed ? 'Menüyü Göster' : 'Menüyü Gizle'}
                  aria-label={isCollapsed ? 'Kenar çubuğunu genişlet' : 'Kenar çubuğunu daralt'}
                  aria-expanded={!isCollapsed}
                  style={isCollapsed ? { width: '100%', justifyContent: 'center' } : {}}
                >
                  {isCollapsed ? <LuChevronRight size={18} /> : <LuChevronLeft size={18} />}
                </button>
                {/* Mobil: kapat (X) butonu */}
                <button
                  className="sidebar-close-btn"
                  onClick={onToggleCollapse}
                  aria-label="Menüyü kapat"
                >
                  <LuX size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        <nav aria-label="Sayfa gezinmesi">
          <Link
            to="/"
            className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
            title={isCollapsed ? 'İşler' : undefined}
            aria-current={location.pathname === '/' ? 'page' : undefined}
            onClick={handleCloseOnMobile}
          >
            <span className="nav-icon" aria-hidden="true"><LuClipboardList size={18} /></span>
            <span className="nav-label">İşler</span>
          </Link>

          <Link
            to="/projects"
            className={`nav-item ${isNavActive('/projects') ? 'active' : ''}`}
            title={isCollapsed ? 'Projeler' : undefined}
            aria-current={isNavActive('/projects') ? 'page' : undefined}
            onClick={handleCloseOnMobile}
          >
            <span className="nav-icon" aria-hidden="true"><LuFolderKanban size={18} /></span>
            <span className="nav-label">Projeler</span>
          </Link>

          <Link
            to="/dashboard"
            className={`nav-item ${isNavActive('/dashboard') || location.pathname.startsWith('/reports') ? 'active' : ''}`}
            title={isCollapsed ? 'Rapor' : undefined}
            aria-current={isNavActive('/dashboard') || location.pathname.startsWith('/reports') ? 'page' : undefined}
            onClick={handleCloseOnMobile}
          >
            <span className="nav-icon" aria-hidden="true"><LuLayoutDashboard size={18} /></span>
            <span className="nav-label">Rapor</span>
          </Link>
        </nav>

        <div className="team-list" role="list" aria-label="Birim filtresi">
          <div
            className={`team-item ${selectedTeamId === null ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={selectedTeamId === null}
            title={isCollapsed ? 'Tüm Birimler' : undefined}
            onClick={() => { onTeamSelect(null); handleCloseOnMobile(); }}
            onKeyDown={(e) =>
              handleTeamKeyDown(e, () => { onTeamSelect(null); handleCloseOnMobile(); })
            }
          >
            <div className="team-item-content">
              <span className="nav-icon" aria-hidden="true"><LuUsers size={18} /></span>
              <span className="nav-label team-item-name">Tüm Birimler</span>
            </div>
          </div>

          {loading ? (
            <div className="loading" role="status" aria-live="polite">
              {isCollapsed ? '...' : 'Yükleniyor...'}
            </div>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className={`team-item ${selectedTeamId === team.id ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={selectedTeamId === team.id}
                title={isCollapsed ? team.name : undefined}
                style={{
                  borderLeftColor:
                    team.color ||
                    (selectedTeamId === team.id ? 'var(--ctp-blue)' : 'transparent'),
                }}
                onClick={() => { onTeamSelect(team.id); handleCloseOnMobile(); }}
                onKeyDown={(e) =>
                  handleTeamKeyDown(e, () => {
                    onTeamSelect(team.id);
                    handleCloseOnMobile();
                  })
                }
              >
                <div className="team-item-content">
                  <span className="nav-icon" aria-hidden="true">
                    {team.icon ? (
                      <span className="team-icon" style={{ color: team.color || 'var(--ctp-text)' }}>
                        {team.icon}
                      </span>
                    ) : (
                      <span
                        className="team-color-indicator"
                        style={{
                          backgroundColor: team.color || 'var(--ctp-overlay0)',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          display: 'inline-block',
                        }}
                      />
                    )}
                  </span>
                  <span className="nav-label">
                    <div className="team-item-name">{team.name}</div>
                    {team.description && (
                      <div className="team-item-description">{team.description}</div>
                    )}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
