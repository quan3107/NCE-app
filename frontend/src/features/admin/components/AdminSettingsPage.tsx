/**
 * Location: features/admin/components/AdminSettingsPage.tsx
 * Purpose: Manage persisted role-based file upload limits.
 * Why: Admin settings should show only controls with real runtime behavior.
 */
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useMutationLifetime } from "@lib/useMutationLifetime";

import { PageHeader } from "@components/common/PageHeader";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  type UploadLimitRole,
  useAdminUploadLimitsQuery,
  useUpdateAdminUploadLimitsMutation,
} from "@features/admin/settingsApi";
import { ApiError } from "@lib/apiClient";
import { useAuthStore } from "@store/authStore";

const ROLES: UploadLimitRole[] = ["student", "teacher", "admin"];
const LIMIT_ERROR = "Enter a whole number from 1 to 100 MiB.";

type FormValues = Record<UploadLimitRole, string>;
type FormErrors = Partial<Record<UploadLimitRole, string>>;
type FormState = {
  values: FormValues;
  savedValues: FormValues;
};

const emptyValues = (): FormValues => ({
  student: "",
  teacher: "",
  admin: "",
});

export function AdminSettingsPage() {
  const { currentUser, sessionGeneration } = useAuthStore();
  return <AdminSettingsForm key={`${currentUser.id}:${sessionGeneration}`} />;
}

function AdminSettingsForm() {
  const pending = useRef(false);
  const captureLifetime = useMutationLifetime();
  const limitsQuery = useAdminUploadLimitsQuery();
  const updateLimits = useUpdateAdminUploadLimitsMutation();
  const [form, setForm] = useState<FormState>(() => ({
    values: emptyValues(),
    savedValues: emptyValues(),
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const { values, savedValues } = form;

  useEffect(() => {
    if (!limitsQuery.data) return;
    const incomingValues = emptyValues();
    for (const limit of limitsQuery.data.limits) {
      incomingValues[limit.role] = String(limit.maxFileSizeMib);
    }
    setForm((current) => {
      const nextValues = { ...current.values };
      const nextSavedValues = { ...current.savedValues };
      for (const role of ROLES) {
        if (current.values[role] === current.savedValues[role]) {
          nextValues[role] = incomingValues[role];
          nextSavedValues[role] = incomingValues[role];
        }
      }
      return { values: nextValues, savedValues: nextSavedValues };
    });
  }, [limitsQuery.data]);

  const submitSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || updateLimits.isPending || conflicted) return;
    const nextErrors: FormErrors = {};
    const parsedValues = emptyValues();
    for (const role of ROLES) {
      const maxFileSizeMib = Number(values[role]);
      if (
        !Number.isInteger(maxFileSizeMib) ||
        maxFileSizeMib < 1 ||
        maxFileSizeMib > 100
      ) {
        nextErrors[role] = LIMIT_ERROR;
      }
      parsedValues[role] = String(maxFileSizeMib);
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const updates = Object.fromEntries(
      ROLES.filter((role) => values[role] !== savedValues[role]).map((role) => [
        role,
        {
          expectedMaxFileSizeMib: Number(savedValues[role]),
          maxFileSizeMib: Number(parsedValues[role]),
        },
      ]),
    );
    if (Object.keys(updates).length === 0) return;

    setSaveError(null);
    pending.current = true;
    const isCurrent = captureLifetime();
    try {
      const saved = await updateLimits.mutateAsync({ updates });
      if (!isCurrent()) return;
      const nextSavedValues = emptyValues();
      for (const limit of saved.limits) {
        nextSavedValues[limit.role] = String(limit.maxFileSizeMib);
      }
      setForm({
        values: nextSavedValues,
        savedValues: nextSavedValues,
      });
    } catch (error) {
      if (!isCurrent()) return;
      setConflicted(error instanceof ApiError && error.status === 409);
      setSaveError(
        error instanceof ApiError && error.status === 409
          ? "Settings changed in another session. Reload before saving again."
          : "Unable to save settings. Please try again.",
      );
    } finally {
      pending.current = false;
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Runtime file upload configuration"
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <form
          className="max-w-2xl space-y-6"
          onSubmit={submitSettings}
          noValidate
        >
          <Card>
            <CardHeader>
              <CardTitle>File Upload Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                These per-file limits are enforced by the backend for each role.
              </p>
              {limitsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading settings...
                </p>
              ) : limitsQuery.error ? (
                <p role="alert" className="text-sm text-destructive">
                  Unable to load settings. Please refresh and try again.
                </p>
              ) : (
                ROLES.map((role) => {
                  const inputId = `${role}-max-file-size`;
                  const errorId = `${inputId}-error`;
                  const label = `${role[0].toUpperCase()}${role.slice(1)} max file size (MiB)`;
                  return (
                    <div key={role} className="space-y-2">
                      <Label htmlFor={inputId}>{label}</Label>
                      <Input
                        id={inputId}
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        value={values[role]}
                        onChange={(event) => {
                          setForm((current) => ({
                            ...current,
                            values: {
                              ...current.values,
                              [role]: event.target.value,
                            },
                          }));
                          setErrors((current) => ({
                            ...current,
                            [role]: undefined,
                          }));
                        }}
                        disabled={updateLimits.isPending}
                        aria-invalid={Boolean(errors[role])}
                        aria-describedby={errors[role] ? errorId : undefined}
                      />
                      {errors[role] && (
                        <p id={errorId} role="alert" className="text-sm text-destructive">
                          {errors[role]}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
              {saveError && (
                <p role="alert" className="text-sm text-destructive">
                  {saveError}
                </p>
              )}
              {updateLimits.isSuccess && !saveError && <p role="status">Settings saved.</p>}
              {conflicted && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={limitsQuery.isFetching}
                  onClick={async () => {
                    const result = await limitsQuery.refetch();
                    if (!result.data || result.error) return;
                    const incoming = emptyValues();
                    for (const limit of result.data.limits)
                      incoming[limit.role] = String(limit.maxFileSizeMib);
                    setForm({ values: incoming, savedValues: incoming });
                    setConflicted(false);
                    setSaveError(null);
                  }}
                >
                  Reload latest settings
                </Button>
              )}
            </CardContent>
          </Card>
          <Button
            type="submit"
            disabled={
              limitsQuery.isLoading ||
              Boolean(limitsQuery.error) ||
              updateLimits.isPending ||
              conflicted
            }
          >
            {updateLimits.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </div>
    </div>
  );
}
