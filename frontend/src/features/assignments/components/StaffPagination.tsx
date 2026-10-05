/** Visible staff pages stay bounded while Previous/Next keep all authorized records reachable. */
import { Button } from '@components/ui/button';
type Props = { page: number; total?: number; canPrevious: boolean; hasNext: boolean; busy: boolean; previous: () => void; next: () => void };
export function StaffPagination({ page, total, canPrevious, hasNext, busy, previous, next }: Props) {
  return <div className="flex items-center justify-between gap-3 p-4" aria-label="Pagination">
    <p className="text-sm text-muted-foreground">Page {page}{total !== undefined ? ` · ${total} total` : ''}</p>
    <div className="flex gap-2">
      <Button variant="outline" disabled={!canPrevious || busy} onClick={previous}>Previous</Button>
      <Button variant="outline" disabled={!hasNext || busy} onClick={next}>Next</Button>
    </div>
  </div>;
}
