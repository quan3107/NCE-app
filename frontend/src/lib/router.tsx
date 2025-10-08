import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type RouterContextType = {
  currentPath: string;
  navigate: (path: string) => void;
  goBack: () => void;
};

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [currentPath, setCurrentPath] = useState('/');
  const [history, setHistory] = useState<string[]>(['/']);

  const navigate = (path: string) => {
    setCurrentPath(path);
    setHistory(prev => [...prev, path]);
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const previousPath = newHistory[newHistory.length - 1];
      setCurrentPath(previousPath);
      setHistory(newHistory);
    }
  };

  useEffect(() => {
    // Scroll to top on navigation
    window.scrollTo(0, 0);
  }, [currentPath]);

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
