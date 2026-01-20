/**
 * Location: src/lib/router.tsx
 * Purpose: Provide a minimal client-side router to mimic navigation during prototyping.
 * Why: Enables route-aware state without adding external dependencies yet.
 */

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';

type RouterContextType = {
  currentPath: string;
  navigate: (path: string) => void;
  goBack: () => void;
};

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: ReactNode }) {
  const initialPath =
    typeof window !== 'undefined' ? window.location.pathname : '/';
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [history, setHistory] = useState<string[]>([initialPath]);

  const navigate = (path: string) => {
    setCurrentPath(path);
    setHistory(prev => [...prev, path]);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const previousPath = newHistory[newHistory.length - 1];
      setCurrentPath(previousPath);
      setHistory(newHistory);
      if (typeof window !== 'undefined') {
        window.history.back();
      }
    }
  };

  useEffect(() => {
    // Scroll to top on navigation
    window.scrollTo(0, 0);
  }, [currentPath]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handlePopState = () => {
      const nextPath = window.location.pathname;
      setCurrentPath(nextPath);
      setHistory(prev => [...prev, nextPath]);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return (
    <RouterContext.Provider value={{ currentPath, navigate, goBack }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (context === undefined) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}



