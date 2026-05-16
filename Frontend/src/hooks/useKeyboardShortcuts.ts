import { useEffect, useRef, useCallback } from 'react';

export interface Shortcut {
  keys: string[];
  description: string;
  category: string;
  handler: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  const pendingKeyRef = useRef<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) return;

    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const key = e.key;
    const pending = pendingKeyRef.current;
    const chord = pending ? `${pending} ${key}` : key;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Try chord match first
    const chordMatch = shortcutsRef.current.find(s => s.keys.join(' ') === chord);
    if (chordMatch) {
      e.preventDefault();
      chordMatch.handler();
      pendingKeyRef.current = '';
      return;
    }

    // Try single key match (only when no pending chord)
    if (!pending) {
      const singleMatch = shortcutsRef.current.find(
        s => s.keys.length === 1 && s.keys[0] === key
      );
      if (singleMatch) {
        e.preventDefault();
        singleMatch.handler();
        return;
      }
    }

    // Check if key starts a chord
    const startsChord = shortcutsRef.current.some(
      s => s.keys.length > 1 && s.keys[0] === key && !pending
    );
    if (startsChord) {
      pendingKeyRef.current = key;
      timeoutRef.current = setTimeout(() => {
        pendingKeyRef.current = '';
      }, 2000);
      return;
    }

    pendingKeyRef.current = '';
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleKeyDown]);
}
