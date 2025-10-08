/**
 * Location: src/routes/Courses.tsx
 * Purpose: Provide the public course catalog route with filtering capabilities.
 * Why: Keeps the route layer focused while allowing future extraction into feature modules.
 */

import { useState } from 'react';
import { ArrowRight, Calendar, Search, Users } from 'lucide-react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { useRouter } from '@lib/router';
import { useCoursesQuery } from '@features/courses/api';

export function CoursesRoute() {
  const { navigate } = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: courses = [], isLoading, error } = useCoursesQuery();

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto mb-12 text-center">
          <h1 className="mb-4">IELTS Preparation Courses</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Comprehensive training for all four IELTS skills - Reading, Writing, Listening, and Speaking
          </p>
          
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={`course-skeleton-${index}`} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 w-20 bg-muted rounded mb-4" />
                  <div className="h-6 w-3/4 bg-muted rounded mb-2" />
                  <div className="h-4 w-full bg-muted rounded" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-3 w-2/3 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                  <div className="h-10 w-full bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive font-medium">Unable to load courses.</p>
            <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map(course => (
                <Card key={course.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      {course.enrolled != null && <Badge variant="secondary">{course.enrolled} enrolled</Badge>}
                    </div>
                    <CardTitle>{course.title}</CardTitle>
                    <CardDescription className="line-clamp-3">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="size-4" />
                        <span>Instructor: {course.teacher}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="size-4" />
                        <span>{course.schedule}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      Learn More
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredCourses.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No courses found matching your search.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}



