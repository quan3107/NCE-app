/**
 * Location: src/components/layout/AppShell.tsx
 * Purpose: Route AppShell rendering to public or authenticated layout variants.
 * Why: Keeps shell entrypoint small while delegating variant-specific concerns.
 */

import type { ReactNode } from 'react';

import { AppShellAuthenticated } from './AppShellAuthenticated';
import { AppShellPublic } from './AppShellPublic';

type AppShellVariant = 'public' | 'app';

type AppShellProps = {
  children: ReactNode;
  variant?: AppShellVariant;
};

export function AppShell({ children, variant = 'app' }: AppShellProps) {
  if (variant === 'public') {
    return <AppShellPublic>{children}</AppShellPublic>;
  }

  return <AppShellAuthenticated>{children}</AppShellAuthenticated>;
}
