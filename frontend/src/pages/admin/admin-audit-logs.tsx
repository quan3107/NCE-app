import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { PageHeader } from '../../components/page-header';
import { mockAuditLogs } from '../../lib/mock-data';
import { formatDate } from '../../lib/utils';
import { Download } from 'lucide-react';

export function AdminAuditLogs() {
  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="System activity and changes"
        actions={
          <Button variant="outline">
            <Download className="mr-2 size-4" />
            Export
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
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
                {mockAuditLogs.map(log => (
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
      </div>
    </div>
  );
}

