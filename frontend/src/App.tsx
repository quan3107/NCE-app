/**
 * Location: src/App.tsx
 * Purpose: Compose global providers and render the React Router route tree.
 * Why: Keeps app bootstrapping focused while routing logic lives in the routes layer.
 */

import { Toaster } from '@components/ui/sonner';
import { AuthProvider } from '@lib/auth';
import { RouterProvider } from '@lib/router';
import { AppRoutes } from '@routes/AppRoutes';

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </RouterProvider>
    </AuthProvider>
  );
}



