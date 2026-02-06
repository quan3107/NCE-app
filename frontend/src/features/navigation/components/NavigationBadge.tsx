/**
 * Location: src/features/navigation/components/NavigationBadge.tsx
 * Purpose: Render a compact badge for navigation count values.
 * Why: Centralizes count formatting and display rules for sidebar/menu items.
 */

import { Badge } from '@components/ui/badge';

type NavigationBadgeProps = {
  count: number;
};

const formatCount = (count: number): string => (count > 99 ? '99+' : String(count));

export function NavigationBadge({ count }: NavigationBadgeProps) {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  return (
    <Badge className="ml-auto min-w-5 rounded-full px-1.5 py-0 text-[10px] leading-4">
      {formatCount(count)}
    </Badge>
  );
}
