/**
 * Location: src/routes/CourseDetail.tsx
 * Purpose: Render a detailed course overview route using shared UI primitives.
 * Why: Keeps the dynamic course route encapsulated within the routing layer.
 */

import { BookOpen, Calendar, ChevronLeft, Clock, Users } from 'lucide-react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { useRouter } from '@lib/router';
import { useCoursesQuery } from '@features/courses/api';

export function CourseDetailRoute({ courseId }: { courseId: string }) {
  const { navigate } = useRouter();
  const { data: courses = [], isLoading, error } = useCoursesQuery();
  const course = courses.find(c => c.id === courseId);

  if (isLoading) {
    return (
      <div className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" onClick={() => navigate('/courses')} className="mb-6">
            <ChevronLeft className="mr-2 size-4" />
            Back to Courses
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading course details...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-destructive font-medium mb-4">Unable to load the course.</p>
          <p className="text-muted-foreground mb-6">{error.message}</p>
          <Button onClick={() => navigate('/courses')}>Back to Courses</Button>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Course not found</p>
          <Button onClick={() => navigate('/courses')}>Back to Courses</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" onClick={() => navigate('/courses')} className="mb-6">
          <ChevronLeft className="mr-2 size-4" />
          Back to Courses
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="mb-4">{course.title}</h1>
              <p className="text-xl text-muted-foreground">{course.description}</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Course Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="mb-2">What You'll Learn</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Advanced English grammar and vocabulary</li>
                    <li>• Professional writing and communication skills</li>
                    <li>• Critical reading and analysis techniques</li>
                    <li>• Effective presentation and speaking abilities</li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-2">Course Structure</h4>
                  <p className="text-muted-foreground">
                    This course consists of weekly lectures, interactive assignments, and regular assessments. 
                    Students will engage in both individual and group activities designed to enhance their English proficiency.
                  </p>
                </div>

                <div>
                  <h4 className="mb-2">Prerequisites</h4>
                  <p className="text-muted-foreground">
                    Basic to intermediate English proficiency. A placement test may be required for enrollment.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Instructor</p>
                    <p className="font-medium">{course.teacher}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Schedule</p>
                    <p className="font-medium">{course.schedule}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">16 weeks</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <BookOpen className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Enrolled</p>
                    <p className="font-medium">{course.enrolled} students</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF]/50 border-0">
              <CardHeader>
                <CardTitle>Interested?</CardTitle>
                <CardDescription>Join this course and start learning today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => navigate('/login')}>
                  Enroll Now
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate('/contact')}>
                  Contact Us
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}



