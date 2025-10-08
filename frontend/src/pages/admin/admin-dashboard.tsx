import { Card, CardContent } from '../../components/ui/card';
import { PageHeader } from '../../components/page-header';
import { mockAssignments, mockCourses, mockEnrollments, mockUsers } from '../../lib/mock-data';
import { Users, BookOpen, CheckCircle2, FileText } from 'lucide-react';

export function AdminDashboard() {
  return (
    <div>
      <PageHeader title="Admin Dashboard" description="System overview and management" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: mockUsers.length, icon: <Users className="size-5" /> },
            { label: 'Courses', value: mockCourses.length, icon: <BookOpen className="size-5" /> },
            { label: 'Enrollments', value: mockEnrollments.length, icon: <CheckCircle2 className="size-5" /> },
            { label: 'Assignments', value: mockAssignments.length, icon: <FileText className="size-5" /> },
          ].map((stat, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-medium mt-1">{stat.value}</p>
                  </div>
                  <div className="text-muted-foreground">{stat.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

