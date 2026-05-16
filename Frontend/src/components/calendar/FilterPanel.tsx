import React, { useState, useMemo, useEffect } from 'react';
import { Task, TaskStatus, Priority, TaskLabel } from '../../types/Task';
import { FilterState, SavedFilter, emptyFilter } from '../../types/Search';
import { searchService } from '../../services/searchService';
import { notify } from '../../utils/notify';
import { extractErrorMessage } from '../../utils/errorMessages';
import './FilterPanel.css';

interface FilterPanelProps {
  tasks: Task[];
  filter: FilterState;
  onFilterChange: (f: FilterState) => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: TaskStatus.OPEN, label: 'Açık' },
  { value: TaskStatus.IN_PROGRESS, label: 'Yapılıyor' },
  { value: TaskStatus.TESTING, label: 'Test' },
  { value: TaskStatus.COMPLETED, label: 'Tamamlandı' },
  { value: TaskStatus.CANCELLED, label: 'İptal' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: Priority.NORMAL, label: 'Normal' },
  { value: Priority.HIGH, label: 'Yüksek' },
  { value: Priority.URGENT, label: 'Acil' },
];

const FilterPanel: React.FC<FilterPanelProps> = ({ tasks, filter, onFilterChange }) => {
  const [open, setOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Mevcut task listesinden erişilebilir etiket ve atanan bilgilerini türet
  const availableLabels = useMemo(() => {
    const map = new Map<number, TaskLabel>();
    tasks.forEach(t => t.labels?.forEach(l => map.set(l.id, l)));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [tasks]);

  const availableAssignees = useMemo(() => {
    const map = new Map<number, string>();
    tasks.forEach(t =>
      t.assigneeIds.forEach((id, idx) => {
        if (!map.has(id)) map.set(id, t.assigneeNames[idx] ?? String(id));
      })
    );
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'tr'));
  }, [tasks]);

  const isActive =
    filter.statuses.length > 0 ||
    filter.priorities.length > 0 ||
    filter.labelIds.length > 0 ||
    filter.assigneeId !== null;

  useEffect(() => {
    searchService.getSavedFilters()
      .then(setSavedFilters)
      .catch(() => {});
  }, []);

  const toggleStatus = (s: string) => {
    const next = filter.statuses.includes(s)
      ? filter.statuses.filter(x => x !== s)
      : [...filter.statuses, s];
    onFilterChange({ ...filter, statuses: next });
  };

  const togglePriority = (p: string) => {
    const next = filter.priorities.includes(p)
      ? filter.priorities.filter(x => x !== p)
      : [...filter.priorities, p];
    onFilterChange({ ...filter, priorities: next });
  };

  const toggleLabel = (id: number) => {
    const next = filter.labelIds.includes(id)
      ? filter.labelIds.filter(x => x !== id)
      : [...filter.labelIds, id];
    onFilterChange({ ...filter, labelIds: next });
  };

  const reset = () => onFilterChange(emptyFilter());

  const handleSave = async () => {
    if (!saveName.trim()) return;
    try {
      const saved = await searchService.saveFilter(saveName.trim(), JSON.stringify(filter));
      setSavedFilters(prev => [saved, ...prev]);
      setSaveName('');
      setShowSaveInput(false);
      notify.success('Filtre kaydedildi.');
    } catch (e) {
      notify.error(extractErrorMessage(e, 'Filtre kaydedilemedi.'));
    }
  };

  const applyFilter = (sf: SavedFilter) => {
    try {
      const parsed: FilterState = JSON.parse(sf.filterJson);
      onFilterChange(parsed);
    } catch {
      notify.error('Filtre yüklenemedi.');
    }
  };

  const handleDeleteSaved = async (id: number) => {
    try {
      await searchService.deleteFilter(id);
      setSavedFilters(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      notify.error(extractErrorMessage(e, 'Filtre silinemedi.'));
    }
  };

  return (
    <div className="fp-root">
      <button
        className={`fp-toggle ${isActive ? 'fp-toggle--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Gelişmiş filtreler"
      >
        <span>🔧 Filtreler</span>
        {isActive && <span className="fp-badge" aria-label="Aktif filtre var" />}
        <span className="fp-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="fp-panel" role="region" aria-label="Gelişmiş filtreler">

          {/* Durum */}
          <div className="fp-section">
            <div className="fp-section-label">Durum</div>
            <div className="fp-chips">
              {STATUS_OPTIONS.map(o => (
                <button
                  key={o.value}
                  className={`fp-chip ${filter.statuses.includes(o.value) ? 'fp-chip--on' : ''}`}
                  onClick={() => toggleStatus(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Öncelik */}
          <div className="fp-section">
            <div className="fp-section-label">Öncelik</div>
            <div className="fp-chips">
              {PRIORITY_OPTIONS.map(o => (
                <button
                  key={o.value}
                  className={`fp-chip ${filter.priorities.includes(o.value) ? 'fp-chip--on' : ''}`}
                  onClick={() => togglePriority(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Etiketler */}
          {availableLabels.length > 0 && (
            <div className="fp-section">
              <div className="fp-section-label">Etiketler</div>
              <div className="fp-chips">
                {availableLabels.map(l => (
                  <button
                    key={l.id}
                    className={`fp-chip ${filter.labelIds.includes(l.id) ? 'fp-chip--on' : ''}`}
                    onClick={() => toggleLabel(l.id)}
                    style={filter.labelIds.includes(l.id) ? { backgroundColor: l.color, borderColor: l.color, color: '#fff' } : { borderColor: l.color }}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Atanan */}
          {availableAssignees.length > 0 && (
            <div className="fp-section">
              <div className="fp-section-label">Atanan</div>
              <select
                className="fp-select"
                value={filter.assigneeId ?? ''}
                onChange={e => onFilterChange({ ...filter, assigneeId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Tümü</option>
                {availableAssignees.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Aksiyonlar */}
          <div className="fp-actions">
            {isActive && (
              <button className="fp-btn fp-btn--reset" onClick={reset}>Temizle</button>
            )}

            {isActive && !showSaveInput && (
              <button className="fp-btn fp-btn--save" onClick={() => setShowSaveInput(true)}>
                💾 Kaydet
              </button>
            )}

            {showSaveInput && (
              <div className="fp-save-row">
                <input
                  className="fp-save-input"
                  placeholder="Filtre adı…"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveInput(false); }}
                  autoFocus
                  maxLength={100}
                />
                <button className="fp-btn fp-btn--save" onClick={handleSave} disabled={!saveName.trim()}>Kaydet</button>
                <button className="fp-btn fp-btn--reset" onClick={() => setShowSaveInput(false)}>İptal</button>
              </div>
            )}
          </div>

          {/* Kayıtlı filtreler */}
          {savedFilters.length > 0 && (
            <div className="fp-section">
              <div className="fp-section-label">Kayıtlı Filtreler</div>
              <div className="fp-saved-list">
                {savedFilters.map(sf => (
                  <div key={sf.id} className="fp-saved-item">
                    <button className="fp-saved-name" onClick={() => applyFilter(sf)}>{sf.name}</button>
                    <button
                      className="fp-saved-del"
                      onClick={() => handleDeleteSaved(sf.id)}
                      aria-label={`${sf.name} filtresini sil`}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
