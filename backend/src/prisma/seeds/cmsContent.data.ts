/**
 * File: backend/src/prisma/seeds/cmsContent.data.ts
 * Purpose: Hold static CMS seed payloads for marketing pages.
 * Why: Keeps the executable seed script small, focused, and under the repo LOC guideline.
 */

export type CmsSeedItem = {
  itemKey: string
  sortOrder: number
  contentType: string
  contentJson: Record<string, unknown>
}

export type CmsSeedSection = {
  sectionKey: string
  label: string
  sortOrder: number
  items: CmsSeedItem[]
}

export type CmsSeedPage = {
  pageKey: string
  label: string
  sections: CmsSeedSection[]
}

export const CMS_PAGES: CmsSeedPage[] = [
  {
    pageKey: 'homepage',
    label: 'Homepage',
    sections: [
      {
        sectionKey: 'hero',
        label: 'Hero Section',
        sortOrder: 0,
        items: [
          {
            itemKey: 'hero_main',
            sortOrder: 0,
            contentType: 'hero',
            contentJson: {
              badge: 'Professional IELTS Training',
              title: 'Achieve Your Target IELTS Band Score',
              description:
                'Master all four IELTS skills with expert tutors, authentic practice materials, and personalized feedback. Get the band score you need for university admission, immigration, or career advancement.',
              cta_primary: 'View Courses',
              cta_secondary: 'Teacher Login',
            },
          },
        ],
      },
      {
        sectionKey: 'stats',
        label: 'Statistics',
        sortOrder: 1,
        items: [
          {
            itemKey: 'stat_students',
            sortOrder: 0,
            contentType: 'stat',
            contentJson: {
              label: 'Active Students',
              value: 1250,
              format: 'number',
              suffix: '+',
            },
          },
          {
            itemKey: 'stat_band_score',
            sortOrder: 1,
            contentType: 'stat',
            contentJson: {
              label: 'Average Band Score',
              value: 7.5,
              format: 'decimal',
            },
          },
          {
            itemKey: 'stat_success_rate',
            sortOrder: 2,
            contentType: 'stat',
            contentJson: {
              label: 'Success Rate',
              value: 0.92,
              format: 'percentage',
            },
          },
        ],
      },
      {
        sectionKey: 'features',
        label: 'How It Works',
        sortOrder: 2,
        items: [
          {
            itemKey: 'section_meta',
            sortOrder: 0,
            contentType: 'section_meta',
            contentJson: {
              title: 'How It Works',
              description:
                'Our structured approach helps you improve systematically across all IELTS test components with expert guidance every step of the way.',
            },
          },
          {
            itemKey: 'feature_practice',
            sortOrder: 1,
            contentType: 'feature',
            contentJson: {
              icon: 'book-open',
              title: 'IELTS Practice Tasks',
              description:
                'Authentic IELTS practice materials for all four skills - Reading, Writing, Listening, and Speaking.',
            },
          },
          {
            itemKey: 'feature_feedback',
            sortOrder: 2,
            contentType: 'feature',
            contentJson: {
              icon: 'users',
              title: 'Expert Feedback',
              description:
                'Receive detailed feedback from certified IELTS instructors on every submission with band score evaluations.',
            },
          },
          {
            itemKey: 'feature_progress',
            sortOrder: 3,
            contentType: 'feature',
            contentJson: {
              icon: 'trending-up',
              title: 'Track Your Progress',
              description:
                'Monitor your band scores across all skills and identify areas for improvement with detailed analytics.',
            },
          },
        ],
      },
    ],
  },
  {
    pageKey: 'about',
    label: 'About Page',
    sections: [
      {
        sectionKey: 'hero',
        label: 'Hero Section',
        sortOrder: 0,
        items: [
          {
            itemKey: 'hero_main',
            sortOrder: 0,
            contentType: 'hero',
            contentJson: {
              title: 'About NCE',
              description:
                "We're dedicated to helping students achieve their IELTS goals through comprehensive training, expert feedback, and authentic practice materials.",
            },
          },
        ],
      },
      {
        sectionKey: 'values',
        label: 'Our Values',
        sortOrder: 1,
        items: [
          {
            itemKey: 'value_mission',
            sortOrder: 0,
            contentType: 'value',
            contentJson: {
              icon: 'target',
              title: 'Our Mission',
              description:
                'To help students worldwide achieve their target IELTS band scores through expert instruction, authentic materials, and personalized feedback.',
            },
          },
          {
            itemKey: 'value_success',
            sortOrder: 1,
            contentType: 'value',
            contentJson: {
              icon: 'heart',
              title: 'Student Success',
              description:
                'We prioritize individual learning goals with tailored feedback, regular progress monitoring, and support throughout your IELTS journey.',
            },
          },
          {
            itemKey: 'value_instructors',
            sortOrder: 2,
            contentType: 'value',
            contentJson: {
              icon: 'users',
              title: 'Expert Instructors',
              description:
                'Our certified IELTS tutors bring years of teaching experience and deep understanding of the test format and scoring criteria.',
            },
          },
          {
            itemKey: 'value_results',
            sortOrder: 3,
            contentType: 'value',
            contentJson: {
              icon: 'award',
              title: 'Proven Results',
              description:
                'Committed to excellence with a track record of helping students achieve band scores of 7.0 and above consistently.',
            },
          },
        ],
      },
      {
        sectionKey: 'story',
        label: 'Our Story',
        sortOrder: 2,
        items: [
          {
            itemKey: 'story_p1',
            sortOrder: 0,
            contentType: 'story_paragraph',
            contentJson: {
              text: 'Founded in 2020, NCE was created by IELTS examiners and educators who understood the challenges students face in preparing for this critical test.',
            },
          },
          {
            itemKey: 'story_p2',
            sortOrder: 1,
            contentType: 'story_paragraph',
            contentJson: {
              text: 'We developed a comprehensive platform that combines authentic IELTS materials, detailed band score feedback, and personalized learning paths to help students improve efficiently across all four skills.',
            },
          },
          {
            itemKey: 'story_p3',
            sortOrder: 2,
            contentType: 'story_paragraph',
            contentJson: {
              text: "Today, we've helped hundreds of students achieve their target band scores for university admissions, professional registration, and immigration applications worldwide.",
            },
          },
        ],
      },
    ],
  },
]
