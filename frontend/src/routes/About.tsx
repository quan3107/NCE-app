/**
 * Location: src/routes/About.tsx
 * Purpose: Expose the public “About” route using shared UI components for consistency.
 * Why: Keeps marketing content organized within the new route layer.
 */

import { Award, Heart, Target, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

export function AboutRoute() {
  const values = [
    {
      icon: <Target className="size-6 text-primary" />,
      title: 'Our Mission',
      description: 'To help students worldwide achieve their target IELTS band scores through expert instruction, authentic materials, and personalized feedback.',
    },
    {
      icon: <Heart className="size-6 text-primary" />,
      title: 'Student Success',
      description: 'We prioritize individual learning goals with tailored feedback, regular progress monitoring, and support throughout your IELTS journey.',
    },
    {
      icon: <Users className="size-6 text-primary" />,
      title: 'Expert Instructors',
      description: 'Our certified IELTS tutors bring years of teaching experience and deep understanding of the test format and scoring criteria.',
    },
    {
      icon: <Award className="size-6 text-primary" />,
      title: 'Proven Results',
      description: 'Committed to excellence with a track record of helping students achieve band scores of 7.0 and above consistently.',
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#E6F0FF] via-[#BFD9FF]/30 to-background py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl mb-6">About NCE</h1>
            <p className="text-xl text-muted-foreground">
              We're dedicated to helping students achieve their IELTS goals through comprehensive training, expert feedback, and authentic practice materials.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="mb-4">Our Values</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {values.map((value, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="size-12 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center mb-4">
                    {value.icon}
                  </div>
                  <CardTitle>{value.title}</CardTitle>
                  <CardDescription>{value.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="mb-4">Our Story</h2>
            <div className="max-w-3xl mx-auto space-y-4 text-muted-foreground">
              <p>
                Founded in 2020, NCE was created by IELTS examiners and educators who understood the challenges students face in preparing for this critical test.
              </p>
              <p>
                We developed a comprehensive platform that combines authentic IELTS materials, detailed band score feedback, and personalized learning paths to help students improve efficiently across all four skills.
              </p>
              <p>
                Today, we've helped hundreds of students achieve their target band scores for university admissions, professional registration, and immigration applications worldwide.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}



