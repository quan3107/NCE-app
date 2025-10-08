/**
 * Location: components/marketing/HeroSection.tsx
 * Purpose: Render the Hero Section component within the Marketing layer.
 * Why: Supports reuse under the refactored frontend structure.
 */

import { ArrowRight } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';

import { StatsOverview } from './StatsOverview';

type Stat = {
  label: string;
  value: string;
};

type HeroSectionProps = {
  stats: Stat[];
  onViewCourses: () => void;
  onTeacherLogin: () => void;
};

export function HeroSection({ stats, onViewCourses, onTeacherLogin }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#E6F0FF] via-[#BFD9FF]/30 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="max-w-3xl">
          <Badge className="mb-4">Professional IELTS Training</Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl mb-6">Achieve Your Target IELTS Band Score</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Master all four IELTS skills with expert tutors, authentic practice materials, and personalized feedback. Get the
            band score you need for university admission, immigration, or career advancement.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" onClick={onViewCourses}>
              View Courses
              <ArrowRight className="ml-2 size-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={onTeacherLogin}>
              Teacher Login
            </Button>
          </div>
        </div>
        <StatsOverview stats={stats} />
      </div>
    </section>
  );
}






