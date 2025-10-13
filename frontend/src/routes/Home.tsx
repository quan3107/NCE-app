/**
 * Location: src/routes/Home.tsx
 * Purpose: Render the marketing landing route composed of reusable marketing sections.
 * Why: Keeps routing thin while aligning with the refactored file structure.
 */

import { BookOpen, TrendingUp, Users } from 'lucide-react';
import { CallToAction } from '@components/marketing/CallToAction';
import { FeaturedCourses } from '@components/marketing/FeaturedCourses';
import { HeroSection } from '@components/marketing/HeroSection';
import { HowItWorks } from '@components/marketing/HowItWorks';
import { useRouter } from '@lib/router';

export function HomeRoute() {
  const { navigate } = useRouter();

  const features = [
    {
      icon: <BookOpen className="size-6 text-primary" />,
      title: 'IELTS Practice Tasks',
      description: 'Authentic IELTS practice materials for all four skills - Reading, Writing, Listening, and Speaking.',
    },
    {
      icon: <Users className="size-6 text-primary" />,
      title: 'Expert Feedback',
      description: 'Receive detailed feedback from certified IELTS instructors on every submission with band score evaluations.',
    },
    {
      icon: <TrendingUp className="size-6 text-primary" />,
      title: 'Track Your Progress',
      description: 'Monitor your band scores across all skills and identify areas for improvement with detailed analytics.',
    },
  ];

  const stats = [
    { label: 'Active Students', value: '500+' },
    { label: 'Average Band Score', value: '7.5' },
    { label: 'Success Rate', value: '92%' },
  ];

  return (
    <div>
      <HeroSection
        stats={stats}
        onViewCourses={() => navigate('/courses')}
        onTeacherLogin={() => navigate('/login')}
      />
      <HowItWorks features={features} />
      <FeaturedCourses
        onSelectCourse={courseId => navigate(`/courses/${courseId}`)}
        onViewAll={() => navigate('/courses')}
      />
      <CallToAction
        onCreateAccount={() => navigate('/login')}
        onContact={() => navigate('/contact')}
      />
    </div>
  );
}



