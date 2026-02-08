/**
 * Location: frontend/src/features/marketing/fallback.ts
 * Purpose: Provide resilient fallback CMS content for public marketing routes.
 * Why: Keeps Home and About usable when CMS API data is temporarily unavailable.
 */

import type { AboutPageContent, HomepageContent } from './types'

export const fallbackHomepageContent: HomepageContent = {
  hero: {
    badge: 'Professional IELTS Training',
    title: 'Achieve Your Target IELTS Band Score',
    description:
      'Master all four IELTS skills with expert tutors, authentic practice materials, and personalized feedback. Get the band score you need for university admission, immigration, or career advancement.',
    cta_primary: 'View Courses',
    cta_secondary: 'Teacher Login',
  },
  stats: [
    { label: 'Active Students', value: 500, format: 'number', suffix: '+' },
    { label: 'Average Band Score', value: 7.5, format: 'decimal' },
    { label: 'Success Rate', value: 0.92, format: 'percentage' },
  ],
  howItWorks: {
    title: 'How It Works',
    description:
      'Our structured approach helps you improve systematically across all IELTS test components with expert guidance every step of the way.',
    features: [
      {
        icon: 'book-open',
        title: 'IELTS Practice Tasks',
        description:
          'Authentic IELTS practice materials for all four skills - Reading, Writing, Listening, and Speaking.',
      },
      {
        icon: 'users',
        title: 'Expert Feedback',
        description:
          'Receive detailed feedback from certified IELTS instructors on every submission with band score evaluations.',
      },
      {
        icon: 'trending-up',
        title: 'Track Your Progress',
        description:
          'Monitor your band scores across all skills and identify areas for improvement with detailed analytics.',
      },
    ],
  },
}

export const fallbackAboutPageContent: AboutPageContent = {
  hero: {
    title: 'About NCE',
    description:
      "We're dedicated to helping students achieve their IELTS goals through comprehensive training, expert feedback, and authentic practice materials.",
  },
  values: [
    {
      icon: 'target',
      title: 'Our Mission',
      description:
        'To help students worldwide achieve their target IELTS band scores through expert instruction, authentic materials, and personalized feedback.',
    },
    {
      icon: 'heart',
      title: 'Student Success',
      description:
        'We prioritize individual learning goals with tailored feedback, regular progress monitoring, and support throughout your IELTS journey.',
    },
    {
      icon: 'users',
      title: 'Expert Instructors',
      description:
        'Our certified IELTS tutors bring years of teaching experience and deep understanding of the test format and scoring criteria.',
    },
    {
      icon: 'award',
      title: 'Proven Results',
      description:
        'Committed to excellence with a track record of helping students achieve band scores of 7.0 and above consistently.',
    },
  ],
  story: {
    sections: [
      'Founded in 2020, NCE was created by IELTS examiners and educators who understood the challenges students face in preparing for this critical test.',
      'We developed a comprehensive platform that combines authentic IELTS materials, detailed band score feedback, and personalized learning paths to help students improve efficiently across all four skills.',
      "Today, we've helped hundreds of students achieve their target band scores for university admissions, professional registration, and immigration applications worldwide.",
    ],
  },
}
