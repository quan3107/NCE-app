/**
 * Location: src/lib/router.tsx
 * Purpose: Wrap React Router to provide the app's routing primitives and shared helpers.
 * Why: Centralizes navigation wiring while keeping existing hooks stable during migration.
 */

import { ReactNode, useEffect } from 'react';
import {
  BrowserRouter,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from 'react-router-dom';

type RouterContextType = {
  currentPath: string;
  navigate: NavigateFunction;
  goBack: () => void;
};

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

export function RouterProvider({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <ScrollToTop />
      {children}
    </BrowserRouter>
  );
}

export function useRouter(): RouterContextType {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    navigate(-1);
  };

  return {
    currentPath: location.pathname,
    navigate,
    goBack,
  };
}



