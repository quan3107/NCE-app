/**
 * Location: admin dashboard notification delivery panel.
 * Purpose: Inspect delivery state and explicitly requeue eligible failures.
 * Why: Recovery must keep the existing notification and surface competing retries.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/apiClient";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";

type Delivery = {
  id: string;
  userId: string;
  type: string;
  channel: string;
  status: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  deadLetteredAt: string | null;
};
const eligible = new Set([
  "failed",
  "dead_letter",
  "suppressed",
  "delivery_unknown",
]);

export function NotificationDeliveries() {
  const [cursor, setCursor] = useState<string | undefined>();
  const client = useQueryClient();
  const deliveries = useQuery({
    queryKey: ["admin", "notification-deliveries", cursor],
    queryFn: () =>
      apiClient<{ data: Delivery[]; nextCursor: string | null }>(
        "/notifications/deliveries",
        {
          auth: "required",
          params: { limit: 20, cursor },
        },
      ),
  });
  const resend = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/notifications/${id}/resend`, {
        auth: "required",
        method: "POST",
      }),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: ["admin", "notification-deliveries"],
      }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification deliveries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          disabled={deliveries.isFetching}
          onClick={() => void deliveries.refetch()}
        >
          Refresh deliveries
        </Button>
        {deliveries.isLoading && <p role="status">Loading deliveries…</p>}
        {deliveries.isError && (
          <p role="alert">Unable to load deliveries. Refresh to retry.</p>
        )}
        {resend.isError && (
          <p role="alert">
            Unable to resend. The delivery may have changed; refresh and inspect
            its current status before retrying.
          </p>
        )}
        {resend.isSuccess && <p role="status">Delivery queued for retry.</p>}
        {!deliveries.isLoading &&
          !deliveries.isError &&
          !deliveries.data?.data.length && <p>No notification deliveries.</p>}
        {deliveries.data?.data.map((item) => (
          <div key={item.id} className="rounded border p-3 space-y-2">
            <p>
              {item.type} · {item.channel} · <strong>{item.status}</strong> ·
              Attempts: {item.attemptCount}
            </p>
            <p className="break-all text-sm">
              Notification: {item.id} · Recipient: {item.userId}
            </p>
            <p className="text-sm">
              Last attempt: {item.lastAttemptAt ?? "Never"} · Next attempt:{" "}
              {item.nextAttemptAt ?? "None"} · Dead-lettered:{" "}
              {item.deadLetteredAt ?? "No"}
            </p>
            <Button
              disabled={resend.isPending || !eligible.has(item.status)}
              onClick={() => resend.mutate(item.id)}
            >
              {resend.isPending && resend.variables === item.id
                ? "Queuing…"
                : "Resend delivery"}
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!cursor || deliveries.isFetching}
            onClick={() => setCursor(undefined)}
          >
            First deliveries
          </Button>
          <Button
            variant="outline"
            disabled={!deliveries.data?.nextCursor || deliveries.isFetching}
            onClick={() => setCursor(deliveries.data?.nextCursor ?? undefined)}
          >
            More deliveries
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
