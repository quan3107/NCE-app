/**
 * Location: src/routes/RouteLoading.tsx
 * Purpose: Provide a lightweight fallback while lazily loaded route chunks resolve.
 * Why: Keeps navigation accessible without pulling shared UI libraries into the loading state.
 */

export function RouteLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-12">
      <div
        aria-live="polite"
        className="text-sm font-medium text-muted-foreground"
        role="status"
      >
        Loading...
      </div>
    </div>
  );
}
