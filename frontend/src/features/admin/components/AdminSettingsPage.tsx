/**
 * Location: features/admin/components/AdminSettingsPage.tsx
 * Purpose: Manage persisted role-based file upload limits.
 * Why: Admin settings should show only controls with real runtime behavior.
 */
import { type FormEvent, useEffect, useState } from "react";

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

const ROLES: UploadLimitRole[] = ["student", "teacher", "admin"];
const LIMIT_ERROR = "Enter a whole number from 1 to 100 MB.";

type FormValues = Record<UploadLimitRole, string>;
type FormErrors = Partial<Record<UploadLimitRole, string>>;

const emptyValues = (): FormValues => ({
  student: "",
  teacher: "",
  admin: "",
});

export function AdminSettingsPage() {
  const limitsQuery = useAdminUploadLimitsQuery();
  const updateLimits = useUpdateAdminUploadLimitsMutation();
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!limitsQuery.data) return;
    const nextValues = emptyValues();
    for (const limit of limitsQuery.data.limits) {
      nextValues[limit.role] = String(limit.maxFileSizeMb);
    }
    setValues(nextValues);
  }, [limitsQuery.data]);

  const submitSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    const limits = ROLES.map((role) => {
      const maxFileSizeMb = Number(values[role]);
      if (
        !Number.isInteger(maxFileSizeMb) ||
        maxFileSizeMb < 1 ||
        maxFileSizeMb > 100
      ) {
        nextErrors[role] = LIMIT_ERROR;
      }
      return { role, maxFileSizeMb };
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaveError(null);
    try {
      const saved = await updateLimits.mutateAsync({ limits });
      const savedValues = emptyValues();
      for (const limit of saved.limits) {
        savedValues[limit.role] = String(limit.maxFileSizeMb);
      }
      setValues(savedValues);
    } catch {
      setSaveError("Unable to save settings. Please try again.");
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
                <p className="text-sm text-muted-foreground">Loading settings...</p>
              ) : limitsQuery.error ? (
                <p role="alert" className="text-sm text-destructive">
                  Unable to load settings. Please refresh and try again.
                </p>
              ) : (
                ROLES.map((role) => {
                  const inputId = `${role}-max-file-size`;
                  const errorId = `${inputId}-error`;
                  const label = `${role[0].toUpperCase()}${role.slice(1)} max file size (MB)`;
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
                          setValues((current) => ({
                            ...current,
                            [role]: event.target.value,
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
                        <p id={errorId} className="text-sm text-destructive">
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
            </CardContent>
          </Card>
          <Button
            type="submit"
            disabled={limitsQuery.isLoading || Boolean(limitsQuery.error) || updateLimits.isPending}
          >
            {updateLimits.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </div>
    </div>
  );
}
