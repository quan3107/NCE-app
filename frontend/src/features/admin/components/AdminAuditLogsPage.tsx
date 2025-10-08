/**
 * Location: features/admin/components/AdminAuditLogsPage.tsx
 * Purpose: Render the Admin Audit Logs Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { PageHeader } from '@components/common/PageHeader';
import { formatDate } from '@lib/utils';
import { Download } from 'lucide-react';
import { useAdminAuditLogsQuery } from '@features/admin/api';

export function AdminAuditLogsPage() {
  const { data: logs = [], isLoading, error, refresh } = useAdminAuditLogsQuery();

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="System activity and changes"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="mr-2 size-4" />
              Export
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading audit logs...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              Unable to load audit logs. Please try again later.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{formatDate(log.timestamp, 'datetime')}</TableCell>
                      <TableCell>{log.actor}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.action}</Badge>
                      </TableCell>
                      <TableCell>{log.entity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.details}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}









