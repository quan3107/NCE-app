/**
 * Location: features/admin/components/AdminAuditLogsPage.tsx
 * Purpose: Render the Admin Audit Logs Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useState } from "react";
import { Card, CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { PageHeader } from "@components/common/PageHeader";
import { formatDate } from "@lib/utils";
import { Download } from "lucide-react";
import {
  AUDIT_LOG_PAGE_SIZE,
  useAdminAuditLogsQuery,
} from "@features/admin/api";

export function AdminAuditLogsPage() {
  const [offset, setOffset] = useState(0);
  const {
    data: page,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAdminAuditLogsQuery(offset);
  const logs = page?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="System activity and changes"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
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
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center">
                        No audit logs on this page.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDate(log.timestamp, "datetime")}
                      </TableCell>
                      <TableCell>{log.actor}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.action}</Badge>
                      </TableCell>
                      <TableCell>{log.entity}</TableCell>
                      <TableCell
                        className="max-w-48 truncate font-mono text-xs"
                        title={log.entityId}
                      >
                        {log.entityId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">v{log.schemaVersion}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.details}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        <nav
          aria-label="Audit log pagination"
          className="mt-4 flex items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            disabled={offset === 0 || isFetching}
            onClick={() =>
              setOffset((current) => Math.max(0, current - AUDIT_LOG_PAGE_SIZE))
            }
          >
            Previous
          </Button>
          <p role="status" className="text-sm text-muted-foreground">
            {isFetching
              ? "Loading audit logs..."
              : `Page ${Math.floor(offset / AUDIT_LOG_PAGE_SIZE) + 1}`}
          </p>
          <Button
            variant="outline"
            disabled={isFetching || Boolean(error) || page?.nextOffset == null}
            onClick={() => {
              if (page?.nextOffset != null) setOffset(page.nextOffset);
            }}
          >
            Next
          </Button>
        </nav>
      </div>
    </div>
  );
}
