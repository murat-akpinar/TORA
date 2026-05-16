import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { searchService } from '../../services/searchService';
import { SearchResult, TaskSearchResult, ProjectSearchResult, UserSearchResult } from '../../types/Search';
import './GlobalSearch.css';

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

const statusLabel: Record<string, string> = {
  OPEN: 'Açık', IN_PROGRESS: 'Yapılıyor', TESTING: 'Test', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal',
};

const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const totalResults = result
    ? result.tasks.length + result.projects.length + result.users.length
    : 0;

  const doSearch = useCallback(async (q: string) => {
    if (q.length < MIN_LENGTH) { setResult(null); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await searchService.search(q);
      setResult(data);
      setOpen(true);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < MIN_LENGTH) { setResult(null); setOpen(false); return; }
    timerRef.current = setTimeout(() => doSearch(query), DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, doSearch]);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTaskClick = (task: TaskSearchResult) => {
    setOpen(false);
    setQuery('');
    navigate(`/?taskId=${task.id}`);
  };

  const handleProjectClick = (project: ProjectSearchResult) => {
    setOpen(false);
    setQuery('');
    navigate(`/projects/${project.id}`);
  };

  const handleUserClick = (clickedUser: UserSearchResult) => {
    setOpen(false);
    setQuery('');
    if (clickedUser.id === user?.id) {
      navigate('/profile');
    } else if (isAdmin) {
      navigate(`/admin?userId=${clickedUser.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div className="gs-container" ref={containerRef}>
      <div className="gs-input-wrap">
        <span className="gs-icon" aria-hidden="true">🔍</span>
        <input
          ref={inputRef}
          className="gs-input"
          type="search"
          placeholder="Görev, proje veya kullanıcı ara…"
          value={query}
          onChange={e => { setQuery(e.target.value); if (e.target.value.length >= MIN_LENGTH) setOpen(true); }}
          onFocus={() => { if (result && totalResults > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          aria-label="Global arama"
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
        />
        {loading && <span className="gs-spinner" aria-label="Aranıyor" />}
        {query && !loading && (
          <button className="gs-clear" onClick={() => { setQuery(''); setResult(null); setOpen(false); }} aria-label="Aramayı temizle">×</button>
        )}
      </div>

      {open && result && (
        <div className="gs-dropdown" role="listbox" aria-label="Arama sonuçları">
          {totalResults === 0 && (
            <div className="gs-empty">"{query}" için sonuç bulunamadı</div>
          )}

          {result.tasks.length > 0 && (
            <section>
              <div className="gs-group-label">Görevler</div>
              {result.tasks.map(task => (
                <button key={task.id} className="gs-item" onClick={() => handleTaskClick(task)} role="option">
                  <span className="gs-item-icon" style={{ color: task.teamColor ?? '#ccc' }}>{task.teamIcon ?? '📋'}</span>
                  <span className="gs-item-body">
                    <span className="gs-item-title">{task.title}</span>
                    <span className="gs-item-sub">{task.teamName} · {statusLabel[task.status] ?? task.status}</span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {result.projects.length > 0 && (
            <section>
              <div className="gs-group-label">Projeler</div>
              {result.projects.map(project => (
                <button key={project.id} className="gs-item" onClick={() => handleProjectClick(project)} role="option">
                  <span className="gs-item-icon">📁</span>
                  <span className="gs-item-body">
                    <span className="gs-item-title">{project.name}</span>
                    {project.description && (
                      <span className="gs-item-sub">{project.description.slice(0, 60)}{project.description.length > 60 ? '…' : ''}</span>
                    )}
                  </span>
                </button>
              ))}
            </section>
          )}

          {result.users.length > 0 && (
            <section>
              <div className="gs-group-label">Kullanıcılar</div>
              {result.users.map(u => {
                const isClickable = u.id === user?.id || isAdmin;
                return (
                  <button
                    key={u.id}
                    className="gs-item"
                    onClick={() => isClickable && handleUserClick(u)}
                    role="option"
                    style={isClickable ? undefined : { cursor: 'default', opacity: 0.6 }}
                  >
                    <span className="gs-item-icon">👤</span>
                    <span className="gs-item-body">
                      <span className="gs-item-title">{u.fullName}</span>
                      <span className="gs-item-sub">@{u.username} · {u.roles.join(', ')}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
