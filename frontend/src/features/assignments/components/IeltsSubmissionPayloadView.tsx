/**
 * Location: features/assignments/components/IeltsSubmissionPayloadView.tsx
 * Purpose: Render stored IELTS attempt payloads for read-only review.
 * Why: Makes structured IELTS submissions visible in teacher and student views.
 */

import type { Assignment } from '@domain';
import { isIeltsAssignmentType } from '@lib/ielts';
import { buildIeltsSubmissionDisplay } from './IeltsSubmissionPayloadView.logic';

type IeltsSubmissionPayloadViewProps = {
  assignment: Assignment;
  payload: unknown;
};

export function IeltsSubmissionPayloadView({
  assignment,
  payload,
}: IeltsSubmissionPayloadViewProps) {
  if (!isIeltsAssignmentType(assignment.type)) {
    return null;
  }

  const display = buildIeltsSubmissionDisplay({
    type: assignment.type,
    payload,
    assignmentConfig: assignment.assignmentConfig,
  });

  return (
    <div className="space-y-4">
      {display.metadata.length > 0 && (
        <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          {display.metadata.map(item => (
            <div key={item.label} className="rounded-md border bg-background px-3 py-2">
              <dt>{item.label}</dt>
              <dd className="font-medium text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {display.sections.map(section => (
        <section key={section.title} className="space-y-2 rounded-lg border bg-background p-4">
          <div>
            <h4 className="text-sm font-medium">{section.title}</h4>
            {section.prompt && (
              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                {section.prompt}
              </p>
            )}
          </div>
          {section.text && (
            <p className="text-sm leading-6 whitespace-pre-wrap">{section.text}</p>
          )}
          {section.rows && (
            <dl className="space-y-3">
              {section.rows.map(row => (
                <div key={`${section.title}-${row.label}`} className="space-y-1">
                  <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
                  <dd className="text-sm leading-6 whitespace-pre-wrap">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
      {display.fallback && (
        <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          {display.fallback}
        </p>
      )}
    </div>
  );
}
