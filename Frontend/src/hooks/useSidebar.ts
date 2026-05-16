import { useState, useEffect } from 'react';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';
const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';

export const useSidebar = () => {
  const isMobileViewport = () => window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (isMobileViewport()) {
      return true;
    }

    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });

  useEffect(() => {
    if (!isMobileViewport()) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed.toString());
    }
  }, [isCollapsed]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsCollapsed(true);
        return;
      }

      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setIsCollapsed(saved === 'true');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  return {
    isCollapsed,
    toggleSidebar
  };
};

