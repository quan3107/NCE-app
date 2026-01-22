/**
 * Location: src/App.tsx
 * Purpose: Compose global providers and render the React Router route tree.
 * Why: Keeps app bootstrapping focused while routing logic lives in the routes layer.
 */

import { QueryClientProvider } from '@tanstack/react-query';

import { Toaster } from '@components/ui/sonner';
import { AuthProvider } from '@lib/auth';
import { queryClient } from '@lib/queryClient';
import { RouterProvider } from '@lib/router';
import { AppRoutes } from '@routes/AppRoutes';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider>
          <AppRoutes />
          <Toaster position="top-right" />
        </RouterProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}



