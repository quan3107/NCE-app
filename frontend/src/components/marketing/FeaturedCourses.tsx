/**
 * Location: components/marketing/FeaturedCourses.tsx
 * Purpose: Render the Featured Courses component within the Marketing layer.
 * Why: Supports reuse under the refactored frontend structure.
 */

import type { MouseEvent } from 'react';

import { ArrowRight, CheckCircle2, Users } from 'lucide-react';

import type { Course } from '@lib/mock-data';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

type FeaturedCoursesProps = {
  courses: Course[];
  onSelectCourse: (courseId: string) => void;
  onViewAll: () => void;
  isLoading?: boolean;
};

export function FeaturedCourses({ courses, onSelectCourse, onViewAll, isLoading }: FeaturedCoursesProps) {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="mb-2">Featured IELTS Courses</h2>
            <p className="text-muted-foreground">Comprehensive training for all IELTS test sections</p>
          </div>
          <Button variant="outline" onClick={onViewAll}>
            View All
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {isLoading && courses.length === 0
            ? Array.from({ length: 3 }).map((_, index) => (
                <Card key={`skeleton-${index}`} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 w-24 bg-muted rounded mb-4" />
                    <div className="h-5 w-3/4 bg-muted rounded mb-2" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 w-2/3 bg-muted rounded mb-4" />
                    <div className="h-3 w-1/2 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            : courses.map(course => (
              <Card
                key={course.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onSelectCourse(course.id)}
              >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  {course.enrolled != null && <Badge variant="secondary">{course.enrolled} enrolled</Badge>}
                </div>
                <CardTitle>{course.title}</CardTitle>
                <CardDescription className="line-clamp-2">{course.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Users className="size-4" />
                  <span>{course.teacher}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4" />
                  <span>{course.schedule}</span>
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    event.stopPropagation();
                    onSelectCourse(course.id);
                  }}
                >
                  Learn More
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}






