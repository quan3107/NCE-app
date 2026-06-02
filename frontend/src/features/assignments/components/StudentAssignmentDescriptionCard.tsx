/**
 * Location: features/assignments/components/StudentAssignmentDescriptionCard.tsx
 * Purpose: Render student assignment description markdown-lite content.
 * Why: Keeps presentation-only description markup out of the detail page.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import type { Assignment } from '@domain';

export function StudentAssignmentDescriptionCard({
  assignment,
}: {
  assignment: Assignment;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment Description</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none">
          {assignment.description.split('\n').map((line, index) => {
            if (line.startsWith('# ')) {
              return <h2 key={index}>{line.replace('# ', '')}</h2>;
            }
            if (line.startsWith('## ')) {
              return <h3 key={index}>{line.replace('## ', '')}</h3>;
            }
            if (line.startsWith('- ')) {
              return <li key={index}>{line.replace('- ', '')}</li>;
            }
            if (line) {
              return <p key={index}>{line}</p>;
            }
            return null;
          })}
        </div>
      </CardContent>
    </Card>
  );
}
