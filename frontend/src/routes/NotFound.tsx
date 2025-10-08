/**
 * Location: src/routes/NotFound.tsx
 * Purpose: Render a fallback route when no other path matches.
 * Why: Provides a consistent 404 experience within the new route structure.
 */

import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { useRouter } from '@lib/router';

export function NotFoundRoute() {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle>Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We couldn&apos;t find the page you were looking for. Try heading back to the dashboard or home page.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate('/')}>Go Home</Button>
            <Button variant="outline" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



