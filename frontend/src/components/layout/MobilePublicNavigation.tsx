/**
 * Location: src/components/layout/MobilePublicNavigation.tsx
 * Purpose: Render the keyboard-accessible public navigation sheet on narrow screens.
 * Why: Desktop-only links leave mobile visitors unable to reach public pages.
 */
import { useState } from 'react';
import { Menu } from 'lucide-react';

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

type MobilePublicNavigationProps = {
  currentPath: string;
  items: NavigationItem[];
  navigate: (path: string) => void;
};

export function MobilePublicNavigation({
  currentPath,
  items,
  navigate,
}: MobilePublicNavigationProps) {
  const [open, setOpen] = useState(false);

  const navigateFromSheet = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
            return (
              <Button
                key={item.id}
                type="button"
                variant={currentPath === item.path ? 'secondary' : 'ghost'}
                className="justify-start gap-3"
                onClick={() => navigateFromSheet(item.path)}
              >
                <Icon className="size-5" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
