import { useRouter } from '../lib/router';
import { BookOpen, TrendingUp, Users } from 'lucide-react';
import { mockCourses } from '../lib/mock-data';
import { CallToAction } from '../components/home/CallToAction';
import { FeaturedCourses } from '../components/home/FeaturedCourses';
import { HeroSection } from '../components/home/HeroSection';
import { HowItWorks } from '../components/home/HowItWorks';

export function PublicHome() {
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
        courses={mockCourses}
        onSelectCourse={courseId => navigate(`/courses/${courseId}`)}
        onViewAll={() => navigate('/courses')}
      />
      <CallToAction onCreateAccount={() => navigate('/login')} onContact={() => navigate('/contact')} />
    </div>
  );
}
