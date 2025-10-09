/**
 * Location: features/courses/management/components/tabs/OverviewTab.tsx
 * Purpose: Present the overview tab for teacher course management with editable details and stats.
 * Why: Extracting the tab keeps the main screen slim while preserving the existing UI structure.
 */

import React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { BookOpen, CheckCircle2, Users } from 'lucide-react';

import type { CourseDetailsHandlers } from '../../hooks/useTeacherCourseManagement';
import type { CourseDetailsState } from '../../types';

type OverviewTabProps = {
  details: CourseDetailsState;
  handlers: CourseDetailsHandlers;
  stats: {
    students: number;
    assignments: number;
    completionRate: string;
  };
};

export function OverviewTab({ details, handlers, stats }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Course Details</CardTitle>
          <CardDescription>Update basic course information and schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Course Title</Label>
              <Input value={details.title} onChange={(event) => handlers.setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={details.level} onValueChange={handlers.setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                  <SelectItem value="All Levels">All Levels</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={details.description}
              onChange={(event) => handlers.setDescription(event.target.value)}
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Schedule</Label>
              <Input
                value={details.schedule}
                onChange={(event) => handlers.setSchedule(event.target.value)}
                placeholder="e.g., Mon & Wed, 6-8 PM"
              />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Input
                value={details.duration}
                onChange={(event) => handlers.setDuration(event.target.value)}
                placeholder="e.g., 8 weeks"
              />
            </div>
            <div className="space-y-2">
              <Label>Price ($)</Label>
              <Input
                type="number"
                value={details.price}
                onChange={(event) => handlers.setPrice(event.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handlers.save}>Save Changes</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard
              icon={<Users className="size-5 text-blue-500" />}
              label="Total Students"
              value={stats.students}
            />
            <StatCard
              icon={<BookOpen className="size-5 text-green-500" />}
              label="Assignments"
              value={stats.assignments}
            />
            <StatCard
              icon={<CheckCircle2 className="size-5 text-purple-500" />}
              label="Completion Rate"
              value={stats.completionRate}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="p-4 rounded-lg border">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl">{value}</p>
    </div>
  );
}
