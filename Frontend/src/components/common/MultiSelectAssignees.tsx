import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../../types/User';
import './MultiSelectAssignees.css';

interface MultiSelectAssigneesProps {
  users: User[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  emptyText?: string;
  /** Görünür label (kendi label'ı dış container'da kullanıyorsa boş bırakılır) */
  ariaLabel?: string;
  disabled?: boolean;
}

const initialsOf = (fullName: string): string => {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || '?';
};

const MultiSelectAssignees: React.FC<MultiSelectAssigneesProps> = ({
  users,
  selectedIds,
  onChange,
  placeholder = 'Atanan kişi seçin',
  emptyText = 'Kullanıcı bulunamadı',
  ariaLabel = 'Atanan kişiler',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedIds.includes(u.id)),
    [users, selectedIds]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, query]);

  const toggle = (userId: number) => {
    if (disabled) return;
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const removeOne = (userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedIds.filter((id) => id !== userId));
  };

  return (
    <div
      className={`assignee-select${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="assignee-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="assignee-select__value">
          {selectedUsers.length === 0 ? (
            <span className="assignee-select__placeholder">{placeholder}</span>
          ) : (
            <span className="assignee-select__chips">
              {selectedUsers.map((u) => (
                <span key={u.id} className="assignee-chip" title={u.fullName}>
                  <span className="assignee-chip__avatar" aria-hidden="true">
                    {initialsOf(u.fullName)}
                  </span>
                  <span className="assignee-chip__name">{u.fullName}</span>
                  {!disabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="assignee-chip__remove"
                      aria-label={`${u.fullName} kişisini kaldır`}
                      onClick={(e) => removeOne(u.id, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!disabled) {
                            onChange(selectedIds.filter((id) => id !== u.id));
                          }
                        }
                      }}
                    >
                      ×
                    </span>
                  )}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="assignee-select__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="assignee-select__panel" role="dialog" aria-label={ariaLabel}>
          <input
            ref={inputRef}
            type="text"
            className="assignee-select__search"
            placeholder="Ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Kullanıcı ara"
          />
          <ul role="listbox" aria-multiselectable="true" className="assignee-select__options">
            {filteredUsers.length === 0 ? (
              <li className="assignee-select__empty">{emptyText}</li>
            ) : (
              filteredUsers.map((u) => {
                const checked = selectedIds.includes(u.id);
                return (
                  <li
                    key={u.id}
                    role="option"
                    aria-selected={checked}
                    className={`assignee-option${checked ? ' is-checked' : ''}`}
                    onClick={() => toggle(u.id)}
                  >
                    <span className="assignee-option__check" aria-hidden="true">
                      {checked ? '✓' : ''}
                    </span>
                    <span className="assignee-option__avatar" aria-hidden="true">
                      {initialsOf(u.fullName)}
                    </span>
                    <span className="assignee-option__body">
                      <span className="assignee-option__name">{u.fullName}</span>
                      <span className="assignee-option__username">@{u.username}</span>
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MultiSelectAssignees;
