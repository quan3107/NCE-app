/**
 * Location: src/features/navigation/components/NavigationItem.tsx
 * Purpose: Render one navigation entry with icon and optional badge.
 * Why: Keeps AppShell integration simple by encapsulating nav row rendering concerns.
 */

import { Button } from '@components/ui/button';
import { cn } from '@components/ui/utils';

import type { NavigationItem as NavigationEntry } from '../types';
import { getIcon } from '../utils/iconMap';
import { NavigationBadge } from './NavigationBadge';

type NavigationItemProps = {
  item: NavigationEntry;
  isActive: boolean;
  count?: number;
  onClick: (path: string) => void;
  className?: string;
};

export function NavigationItem({
  item,
  isActive,
  count = 0,
  onClick,
  className,
}: NavigationItemProps) {
  const Icon = getIcon(item.iconName);

  return (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn('w-full justify-start gap-3', className)}
      onClick={() => onClick(item.path)}
      type="button"
    >
      <Icon className="size-5 shrink-0" />
      <span className="truncate">{item.label}</span>
      <NavigationBadge count={count} />
    </Button>
  );
}
