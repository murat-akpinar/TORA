import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TaskLabel } from '../../types/Task';
import { taskLabelService } from '../../services/taskLabelService';
import './TagInput.css';

export interface TagOption {
  id?: number;
  name: string;
  color: string;
}

interface TagInputProps {
  teamId: number;
  selected: TagOption[];
  onChange: (tags: TagOption[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const AUTO_COLORS = [
  '#89b4fa', '#a6e3a1', '#f38ba8', '#fab387',
  '#cba6f7', '#89dceb', '#f9e2af', '#74c7ec', '#b4befe',
];

function colorForNew(index: number): string {
  return AUTO_COLORS[index % AUTO_COLORS.length];
}

const TagInput: React.FC<TagInputProps> = ({
  teamId,
  selected,
  onChange,
  disabled = false,
  placeholder = 'Etiket ara veya oluştur...',
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await taskLabelService.search(teamId, q || undefined);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, search]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      return;
    }
    search('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

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

  const isSelected = (label: TaskLabel) =>
    selected.some((t) => (t.id && t.id === label.id) || t.name.toLowerCase() === label.name.toLowerCase());

  const addExisting = (label: TaskLabel) => {
    if (isSelected(label)) return;
    onChange([...selected, { id: label.id, name: label.name, color: label.color }]);
    setQuery('');
    inputRef.current?.focus();
  };

  const addNew = () => {
    const name = query.trim();
    if (!name) return;
    if (selected.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setQuery('');
      return;
    }
    const color = colorForNew(selected.length);
    onChange([...selected, { name, color }]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (tag: TagOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selected.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const exact = results.find((r) => r.name.toLowerCase() === query.trim().toLowerCase());
      if (exact) addExisting(exact);
      else if (query.trim()) addNew();
    } else if (e.key === 'Backspace' && !query && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  };

  const showCreateOption =
    query.trim().length > 0 &&
    !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase()) &&
    !selected.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div
      ref={containerRef}
      className={`tag-input${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}`}
      onClick={() => { if (!disabled) setOpen(true); }}
    >
      <div className="tag-input__field">
        {selected.map((tag, i) => (
          <span
            key={tag.id ?? `new-${i}`}
            className="tag-chip"
            style={{ borderColor: tag.color, backgroundColor: `${tag.color}22` }}
          >
            <span className="tag-chip__dot" style={{ backgroundColor: tag.color }} />
            <span className="tag-chip__name">{tag.name}</span>
            {!disabled && (
              <span
                role="button"
                tabIndex={0}
                className="tag-chip__remove"
                aria-label={`${tag.name} etiketini kaldır`}
                onClick={(e) => remove(tag, e)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); remove(tag, e as any); } }}
              >
                ×
              </span>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          className="tag-input__search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : ''}
          disabled={disabled}
          aria-label="Etiket ara"
          aria-autocomplete="list"
          aria-expanded={open}
        />
      </div>

      {open && (
        <div className="tag-input__dropdown" role="listbox">
          {loading && <div className="tag-input__status">Aranıyor...</div>}

          {!loading && results.length === 0 && !showCreateOption && (
            <div className="tag-input__status">
              {query.trim() ? 'Etiket bulunamadı.' : 'Henüz etiket yok.'}
            </div>
          )}

          {!loading && results.map((label) => {
            const checked = isSelected(label);
            return (
              <div
                key={label.id}
                role="option"
                aria-selected={checked}
                className={`tag-input__option${checked ? ' is-checked' : ''}`}
                onClick={() => addExisting(label)}
              >
                <span className="tag-input__option-dot" style={{ backgroundColor: label.color }} />
                <span className="tag-input__option-name">{label.name}</span>
                {checked && <span className="tag-input__option-check" aria-hidden>✓</span>}
              </div>
            );
          })}

          {showCreateOption && (
            <div
              role="option"
              className="tag-input__option tag-input__option--create"
              onClick={addNew}
            >
              <span className="tag-input__create-icon" aria-hidden>+</span>
              <span>
                <strong>&quot;{query.trim()}&quot;</strong> etiketini oluştur
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagInput;
