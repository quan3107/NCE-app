/**
 * Location: features/assignments/components/TeacherAssignmentContentTab.tsx
 * Purpose: Render the assignment content tab with description and IELTS preview.
 * Why: Keeps the tab content modular and easier to align to the Figma Make layout.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import type { Assignment } from '@lib/mock-data';
import type { IeltsAssignmentConfig, IeltsAssignmentType } from '@lib/ielts';
import { isIeltsAssignmentType } from '@lib/ielts';
import { IeltsAssignmentContentPreview } from './ielts/IeltsAssignmentContentPreview';

type TeacherAssignmentContentTabProps = {
  assignment: Assignment;
  ieltsConfig: IeltsAssignmentConfig | null;
};

export function TeacherAssignmentContentTab({
  assignment,
  ieltsConfig,
}: TeacherAssignmentContentTabProps) {
  return (
    <>
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Assignment Overview</CardTitle>
          <CardDescription>Student-facing instructions and materials</CardDescription>
        </CardHeader>
        <CardContent>
          <MarkdownText value={assignment.description} />
        </CardContent>
      </Card>
      {isIeltsAssignmentType(assignment.type) && ieltsConfig && (
        <Card className="rounded-[14px]">
          <CardHeader>
            <CardTitle>IELTS Assignment Content</CardTitle>
            <CardDescription>Full student-facing content preview</CardDescription>
          </CardHeader>
          <CardContent>
            <IeltsAssignmentContentPreview
              type={assignment.type as IeltsAssignmentType}
              value={ieltsConfig}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function MarkdownText({ value }: { value: string }) {
  if (!value) {
    return <p className="text-sm text-muted-foreground">No description provided.</p>;
  }

  return (
    <div className="prose prose-sm max-w-none">
      {value.split('\n').map((line, index) => {
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
  );
}
