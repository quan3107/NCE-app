/**
 * Location: features/analytics/components/TeacherAnalyticsPage.tsx
 * Purpose: Render the Teacher Analytics Page component for the Analytics domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { PageHeader } from '@components/common/PageHeader';
import { BarChart3 } from 'lucide-react';

export function TeacherAnalyticsPage() {
  return (
    <div>
      <PageHeader title="Analytics" description="Course performance and insights" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-medium mb-1">87%</div>
                <div className="text-sm text-muted-foreground">Avg Completion Rate</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-medium mb-1">82</div>
                <div className="text-sm text-muted-foreground">Avg Score</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-medium mb-1">2.3</div>
                <div className="text-sm text-muted-foreground">Days to Grade</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="size-12 mx-auto mb-2" />
                <p>Analytics chart visualization</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}









