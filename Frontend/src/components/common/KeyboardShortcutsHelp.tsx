import React, { useEffect, useRef } from 'react';
import { Shortcut } from '../../hooks/useKeyboardShortcuts';
import './KeyboardShortcutsHelp.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
}

const KeyboardShortcutsHelp: React.FC<Props> = ({ isOpen, onClose, shortcuts }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));
  // Exclude the "?" shortcut from its own list to avoid confusion
  const displayShortcuts = shortcuts.filter(s => !(s.keys.length === 1 && s.keys[0] === '?'));

  return (
    <div
      className="kbd-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kbd-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="kbd-panel" ref={panelRef} tabIndex={-1}>
        <div className="kbd-header">
          <h2 id="kbd-title" className="kbd-title">Klavye Kısayolları</h2>
          <button
            className="kbd-close-btn"
            onClick={onClose}
            aria-label="Klavye kısayolları panelini kapat"
          >
            ✕
          </button>
        </div>
        <div className="kbd-content">
          {categories.map(category => {
            const catShortcuts = displayShortcuts.filter(s => s.category === category);
            if (catShortcuts.length === 0) return null;
            return (
              <section key={category} className="kbd-category">
                <h3 className="kbd-category-title">{category}</h3>
                <ul className="kbd-list">
                  {catShortcuts.map((s, i) => (
                    <li key={i} className="kbd-item">
                      <div className="kbd-keys">
                        {s.keys.map((key, ki) => (
                          <React.Fragment key={ki}>
                            {ki > 0 && <span className="kbd-then">sonra</span>}
                            <kbd className="kbd-key">{key}</kbd>
                          </React.Fragment>
                        ))}
                      </div>
                      <span className="kbd-desc">{s.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <div className="kbd-footer">
          <span><kbd className="kbd-key kbd-key-sm">?</kbd> ile aç/kapat</span>
          <span>Giriş alanlarında devre dışı</span>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;
