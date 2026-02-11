/**
 * Location: components/marketing/FeaturedCourses.tsx
 * Purpose: Render top courses from backend data on the public marketing surface.
 * Why: Prevents fabricated fallback course content when backend data is unavailable.
 */

import { useEffect, useRef, type MouseEvent } from 'react';

import { ArrowRight, CheckCircle2, Users } from 'lucide-react';

import { useCoursesQuery } from '@features/courses/api';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { buildFeaturedCoursesFallbackLog, resolveFeaturedCoursesState } from './featuredCourses.state';

type FeaturedCoursesProps = {
  onSelectCourse: (courseId: string) => void;
  onViewAll: () => void;
};

export function FeaturedCourses({ onSelectCourse, onViewAll }: FeaturedCoursesProps) {
  const { data: backendCourses, isLoading, error } = useCoursesQuery();
  const loggedErrorRef = useRef(false);
  const featuredState = resolveFeaturedCoursesState({ backendCourses, isLoading, error });

  useEffect(() => {
    if (!error || loggedErrorRef.current) {
      return;
    }

    console.warn(
      '[marketing] backend featured courses unavailable; no fallback courses rendered',
      buildFeaturedCoursesFallbackLog(),
    );
    loggedErrorRef.current = true;
  }, [error]);

  if (featuredState.mode === 'unavailable') {
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
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Featured courses are currently unavailable.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

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
          {featuredState.mode === 'loading'
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
            : featuredState.mode === 'list'
              ? featuredState.courses.map(course => (
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
                ))
              : (
                <Card className="md:col-span-3">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No featured courses are available right now.</p>
                  </CardContent>
                </Card>
                )}
        </div>
      </div>
    </section>
  );
}

