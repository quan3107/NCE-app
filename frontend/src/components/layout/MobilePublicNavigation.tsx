/**
 * Location: src/components/layout/MobilePublicNavigation.tsx
 * Purpose: Render the keyboard-accessible public navigation sheet on narrow screens.
 * Why: Desktop-only links leave mobile visitors unable to reach public pages.
 */
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@components/ui/sheet';
import type { NavigationItem } from '@features/navigation/types';
import { getIcon } from '@features/navigation/utils/iconMap';

import { isNavigationPathCurrent } from './appShell.helpers';

type MobilePublicNavigationProps = {
  currentEntryKey: string;
  currentPath: string;
  items: NavigationItem[];
  navigate: (path: string) => void;
};

export function MobilePublicNavigation({
  currentEntryKey,
  currentPath,
  items,
}: MobilePublicNavigationProps) {
  const [openAtEntryKey, setOpenAtEntryKey] = useState<string | null>(null);
  const open = openAtEntryKey === currentEntryKey;

  useEffect(() => {
    setOpenAtEntryKey((entryKey) =>
      entryKey === currentEntryKey ? entryKey : null,
    );
  }, [currentEntryKey]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenAtEntryKey(null);
    };

    if (desktop.matches) setOpenAtEntryKey(null);
    desktop.addEventListener('change', closeAtDesktop);
    return () => desktop.removeEventListener('change', closeAtDesktop);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpenAtEntryKey(nextOpen ? currentEntryKey : null);
  };

  const closeSheet = () => {
    setOpenAtEntryKey(null);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(20rem,85vw)]">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Browse NCE public pages.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          {items.map((item) => {
            const Icon = getIcon(item.iconName);
            const isCurrent = isNavigationPathCurrent(currentPath, item.path);
            return (
              <Button
                key={item.id}
                asChild
                variant={isCurrent ? 'secondary' : 'ghost'}
                className="justify-start gap-3"
              >
                <Link
                  to={item.path}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={closeSheet}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
