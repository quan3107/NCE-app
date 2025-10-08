import type { MouseEvent } from 'react';

import { ArrowRight, CheckCircle2, Users } from 'lucide-react';

import type { Course } from '../../lib/mock-data';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

type FeaturedCoursesProps = {
  courses: Course[];
  onSelectCourse: (courseId: string) => void;
  onViewAll: () => void;
};

export function FeaturedCourses({ courses, onSelectCourse, onViewAll }: FeaturedCoursesProps) {
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
          {courses.map(course => (
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

