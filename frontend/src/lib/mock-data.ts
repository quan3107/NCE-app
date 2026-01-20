/**
 * Location: src/lib/mock-data.ts
 * Purpose: Provide mock entities and helpers powering the prototype experience.
 * Why: Allows UI flows to function without live backend data.
 */

export type Role = 'student' | 'teacher' | 'admin' | 'public';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  schedule: string;
  duration?: string;
  level?: string;
  price?: number;
  teacher: string;
  teacherId: string;
  enrolled?: number;
  learningOutcomes?: string[];
  structureSummary?: string;
  prerequisitesSummary?: string;
};

export type AssignmentType = 'file' | 'link' | 'text' | 'quiz';
export type AssignmentStatus = 'draft' | 'published' | 'archived';
export type SubmissionStatus = 'not_submitted' | 'draft' | 'submitted' | 'late' | 'graded';

export type Assignment = {
  id: string;
  title: string;
  description: string;
  type: AssignmentType;
  courseId: string;
  courseName: string;
  dueAt: Date;
  publishedAt?: Date;
  status: AssignmentStatus;
  latePolicy: string;
  maxScore: number;
};

export type Submission = {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  status: SubmissionStatus;
  submittedAt?: Date;
  content?: string;
  files?: string[];
  version: number;
};

export type Grade = {
  id: string;
  submissionId: string;
  assignmentId: string;
  studentId: string;
  rubricBreakdown: { criteria: string; points: number; maxPoints: number }[];
  rawScore: number;
  adjustments: number;
  finalScore: number;
  maxScore: number;
  feedback: string;
  gradedAt: Date;
  gradedBy: string;
};

export type Notification = {
  id: string;
  userId: string;
  type: 'assignment_published' | 'due_soon' | 'graded' | 'reminder';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
};

export type Enrollment = {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: Date;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  timestamp: Date;
  details: string;
};

// Mock users
export const mockUsers: User[] = [
  { id: '1', name: 'Sarah Anderson', email: 'sarah@example.com', role: 'student' },
  { id: '2', name: 'Michael Lee', email: 'michael@example.com', role: 'student' },
  { id: '3', name: 'James Patterson', email: 'james@example.com', role: 'teacher' },
  { id: '4', name: 'Lisa Thompson', email: 'lisa@example.com', role: 'admin' },
  { id: '5', name: 'Priya Sharma', email: 'priya@example.com', role: 'student' },
];

// Mock courses
export const mockCourses: Course[] = [
  {
    id: 'c1',
    title: 'IELTS Academic Writing Task 2',
    description: 'Master essay writing for IELTS Academic with comprehensive training on argument development, structure, and advanced vocabulary. Target Band 7+.',
    schedule: 'Mon/Wed/Fri 10:00-11:30 AM',
    duration: '8 weeks',
    level: 'Advanced',
    price: 249,
    teacher: 'James Patterson',
    teacherId: '3',
    enrolled: 28,
  },
  {
    id: 'c2',
    title: 'IELTS Speaking Part 2 & 3 Mastery',
    description: 'Develop fluency and coherence for IELTS Speaking test. Practice with real examiner questions, learn effective strategies, and build confidence.',
    schedule: 'Tue/Thu 2:00-3:30 PM',
    duration: '6 weeks',
    level: 'Intermediate',
    price: 219,
    teacher: 'James Patterson',
    teacherId: '3',
    enrolled: 22,
  },
  {
    id: 'c3',
    title: 'IELTS Reading Techniques',
    description: 'Learn speed reading strategies, skimming, scanning, and question-type specific approaches to achieve Band 8+ in IELTS Academic Reading.',
    schedule: 'Mon/Wed 1:00-2:30 PM',
    duration: '6 weeks',
    level: 'Intermediate',
    price: 199,
    teacher: 'James Patterson',
    teacherId: '3',
    enrolled: 19,
  },
  {
    id: 'c4',
    title: 'IELTS Listening Skills Development',
    description: 'Intensive training for all four sections of IELTS Listening with focus on note-taking, accent recognition, and time management.',
    schedule: 'Tue/Thu 9:00-10:30 AM',
    duration: '5 weeks',
    level: 'All Levels',
    price: 189,
    teacher: 'James Patterson',
    teacherId: '3',
    enrolled: 25,
  },
];

// Mock assignments
export const mockAssignments: Assignment[] = [
  {
    id: 'a1',
    title: 'Writing Task 2: Environmental Issues',
    description: '# IELTS Writing Task 2 Practice\n\n**Question:**\nSome people believe that environmental problems are too big for individuals to solve, while others think individuals can make a significant difference. Discuss both views and give your own opinion.\n\n## Requirements\n- Minimum 250 words\n- 40 minutes time limit (self-timed)\n- Clear position with supporting arguments\n- Appropriate academic vocabulary\n- Coherent paragraphing\n\n## Assessment Criteria\n- Task Achievement (25%)\n- Coherence & Cohesion (25%)\n- Lexical Resource (25%)\n- Grammatical Range & Accuracy (25%)\n\n**Target Band:** 7.0+',
    type: 'file',
    courseId: 'c1',
    courseName: 'IELTS Academic Writing Task 2',
    dueAt: new Date('2025-10-12T23:59:00+07:00'),
    publishedAt: new Date('2025-10-01T10:00:00+07:00'),
    status: 'published',
    latePolicy: 'Late submissions: -0.5 band score per day',
    maxScore: 9,
  },
  {
    id: 'a2',
    title: 'Speaking Part 2: Describe a Memorable Event',
    description: '# IELTS Speaking Part 2 Practice\n\n**Cue Card:**\nDescribe a memorable event in your life.\n\nYou should say:\n- What the event was\n- When and where it happened\n- Who was involved\n- And explain why it was memorable\n\n## Instructions\n- Record your response (2 minutes)\n- Allow 1 minute for preparation\n- Upload audio/video file\n- Natural delivery, don\'t memorize\n\n## Evaluation Focus\n- Fluency and coherence\n- Lexical resource\n- Grammatical range\n- Pronunciation',
    type: 'file',
    courseId: 'c2',
    courseName: 'IELTS Speaking Part 2 & 3 Mastery',
    dueAt: new Date('2025-10-09T17:00:00+07:00'),
    publishedAt: new Date('2025-09-30T14:00:00+07:00'),
    status: 'published',
    latePolicy: 'No late submissions accepted',
    maxScore: 9,
  },
  {
    id: 'a3',
    title: 'Reading Practice: Multiple Choice & True/False/Not Given',
    description: '# IELTS Reading Mock Test\n\nComplete the attached reading passage with mixed question types.\n\n## Passage Topic\nThe Impact of Artificial Intelligence on Modern Healthcare\n\n## Question Types\n- Multiple Choice (5 questions)\n- True/False/Not Given (7 questions)\n- Sentence Completion (3 questions)\n\n## Time Limit\n20 minutes (self-timed)\n\n## Format\nDownload the PDF, complete answers on the answer sheet, and upload your completed sheet.',
    type: 'file',
    courseId: 'c3',
    courseName: 'IELTS Reading Techniques',
    dueAt: new Date('2025-10-15T23:59:00+07:00'),
    publishedAt: new Date('2025-10-05T09:00:00+07:00'),
    status: 'published',
    latePolicy: 'Late submissions: No penalty up to 2 days',
    maxScore: 15,
  },
  {
    id: 'a4',
    title: 'Listening Section 3: Academic Discussion',
    description: '# IELTS Listening Practice - Section 3\n\nListen to the academic discussion and answer the questions.\n\n## Audio Details\n- Length: ~5 minutes\n- Topic: University students discussing a research project\n- Question types: Note completion, Multiple choice\n\n## Instructions\n1. Click the link to access the audio file\n2. Listen ONCE only (test conditions)\n3. Complete the answer sheet\n4. Upload your answers\n\n## Total Questions\n10 questions',
    type: 'link',
    courseId: 'c4',
    courseName: 'IELTS Listening Skills Development',
    dueAt: new Date('2025-10-08T14:00:00+07:00'),
    publishedAt: new Date('2025-09-28T10:00:00+07:00'),
    status: 'published',
    latePolicy: 'Late penalty: -1 point per day (max 3 days)',
    maxScore: 10,
  },
  {
    id: 'a5',
    title: 'Writing Task 1: Line Graph Analysis',
    description: '# IELTS Writing Task 1 Practice\n\n**Question:**\nThe line graph shows the percentage of households with internet access in three countries between 2000 and 2020.\n\nSummarize the information by selecting and reporting the main features, and make comparisons where relevant.\n\n## Requirements\n- Minimum 150 words\n- 20 minutes time limit\n- Clear overview statement\n- Accurate data description\n- Appropriate vocabulary for trends\n\n## Assessment\nGraded on Task Achievement, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy',
    type: 'file',
    courseId: 'c1',
    courseName: 'IELTS Academic Writing Task 2',
    dueAt: new Date('2025-10-10T23:59:00+07:00'),
    publishedAt: new Date('2025-09-29T10:00:00+07:00'),
    status: 'published',
    latePolicy: 'Late submissions: -0.5 band score per day',
    maxScore: 9,
  },
];

// Mock submissions
export const mockSubmissions: Submission[] = [
  {
    id: 's1',
    assignmentId: 'a1',
    studentId: '1',
    studentName: 'Sarah Anderson',
    status: 'submitted',
    submittedAt: new Date('2025-10-11T20:30:00+07:00'),
    files: ['writing_task2_environmental.pdf'],
    version: 1,
  },
  {
    id: 's2',
    assignmentId: 'a2',
    studentId: '1',
    studentName: 'Sarah Anderson',
    status: 'graded',
    submittedAt: new Date('2025-10-09T16:45:00+07:00'),
    files: ['speaking_part2_memorable_event.mp4'],
    version: 1,
  },
  {
    id: 's3',
    assignmentId: 'a4',
    studentId: '2',
    studentName: 'Michael Lee',
    status: 'late',
    submittedAt: new Date('2025-10-08T16:00:00+07:00'),
    files: ['listening_section3_answers.pdf'],
    version: 1,
  },
  {
    id: 's4',
    assignmentId: 'a1',
    studentId: '5',
    studentName: 'Priya Sharma',
    status: 'submitted',
    submittedAt: new Date('2025-10-12T22:00:00+07:00'),
    files: ['environmental_essay_final.docx'],
    version: 2,
  },
  {
    id: 's5',
    assignmentId: 'a5',
    studentId: '1',
    studentName: 'Sarah Anderson',
    status: 'graded',
    submittedAt: new Date('2025-10-10T15:30:00+07:00'),
    files: ['writing_task1_line_graph.pdf'],
    version: 1,
  },
];

// Mock grades
export const mockGrades: Grade[] = [
  {
    id: 'g1',
    submissionId: 's2',
    assignmentId: 'a2',
    studentId: '1',
    rubricBreakdown: [
      { criteria: 'Fluency & Coherence', points: 7, maxPoints: 9 },
      { criteria: 'Lexical Resource', points: 7.5, maxPoints: 9 },
      { criteria: 'Grammatical Range & Accuracy', points: 7, maxPoints: 9 },
      { criteria: 'Pronunciation', points: 7.5, maxPoints: 9 },
    ],
    rawScore: 7.25,
    adjustments: 0,
    finalScore: 7.5,
    maxScore: 9,
    feedback: '# Excellent Speaking Performance!\n\nYour response demonstrates strong speaking skills with good fluency and natural delivery.\n\n## Strengths\n- Clear structure following the cue card points\n- Good use of idiomatic expressions\n- Natural pauses and appropriate intonation\n- Wide range of vocabulary\n\n## Areas for improvement\n- Work on reducing filler words ("um", "like")\n- Try to extend your answers with more details\n- Practice using more complex sentence structures\n\n**Overall Band Score: 7.5**',
    gradedAt: new Date('2025-10-10T11:00:00+07:00'),
    gradedBy: 'James Patterson',
  },
  {
    id: 'g2',
    submissionId: 's5',
    assignmentId: 'a5',
    studentId: '1',
    rubricBreakdown: [
      { criteria: 'Task Achievement', points: 7.5, maxPoints: 9 },
      { criteria: 'Coherence & Cohesion', points: 7, maxPoints: 9 },
      { criteria: 'Lexical Resource', points: 7.5, maxPoints: 9 },
      { criteria: 'Grammatical Range & Accuracy', points: 7, maxPoints: 9 },
    ],
    rawScore: 7.25,
    adjustments: 0,
    finalScore: 7.5,
    maxScore: 9,
    feedback: '# Good Task 1 Response\n\nYour line graph description is well-organized with clear overview and appropriate data selection.\n\n## Strengths\n- Clear overview statement identifying main trends\n- Good selection of key features\n- Accurate data description\n- Appropriate vocabulary for describing trends\n\n## Areas for improvement\n- Include more specific data points for comparison\n- Work on variety in sentence structures\n- Minor grammar errors with verb tenses\n\n**Band Score: 7.5**',
    gradedAt: new Date('2025-10-11T14:20:00+07:00'),
    gradedBy: 'James Patterson',
  },
];

// Mock notifications
export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    userId: '1',
    type: 'graded',
    title: 'Speaking Assignment Graded',
    message: 'Your Speaking Part 2 recording has been evaluated. Band Score: 7.5',
    timestamp: new Date('2025-10-10T11:05:00+07:00'),
    read: false,
    link: '/student/grades',
  },
  {
    id: 'n2',
    userId: '1',
    type: 'due_soon',
    title: 'Due in 24 hours',
    message: 'Writing Task 2: Environmental Issues is due tomorrow at 11:59 PM',
    timestamp: new Date('2025-10-11T23:59:00+07:00'),
    read: true,
  },
  {
    id: 'n3',
    userId: '1',
    type: 'assignment_published',
    title: 'New Assignment',
    message: 'Reading Practice has been published in IELTS Reading Techniques',
    timestamp: new Date('2025-10-05T09:00:00+07:00'),
    read: true,
  },
  {
    id: 'n4',
    userId: '1',
    type: 'due_soon',
    title: 'Due in 2 hours',
    message: 'Listening Section 3 practice is due today at 2:00 PM',
    timestamp: new Date('2025-10-08T12:00:00+07:00'),
    read: true,
  },
  {
    id: 'n5',
    userId: '1',
    type: 'graded',
    title: 'Writing Task 1 Graded',
    message: 'Your Line Graph Analysis has been graded. Band Score: 7.5',
    timestamp: new Date('2025-10-11T14:25:00+07:00'),
    read: false,
    link: '/student/grades',
  },
];

// Mock enrollments
export const mockEnrollments: Enrollment[] = [
  { id: 'e1', userId: '1', courseId: 'c1', enrolledAt: new Date('2025-09-01') },
  { id: 'e2', userId: '1', courseId: 'c2', enrolledAt: new Date('2025-09-01') },
  { id: 'e3', userId: '1', courseId: 'c3', enrolledAt: new Date('2025-09-01') },
  { id: 'e4', userId: '2', courseId: 'c1', enrolledAt: new Date('2025-09-02') },
  { id: 'e5', userId: '2', courseId: 'c4', enrolledAt: new Date('2025-09-02') },
  { id: 'e6', userId: '5', courseId: 'c1', enrolledAt: new Date('2025-09-03') },
  { id: 'e7', userId: '5', courseId: 'c2', enrolledAt: new Date('2025-09-03') },
];

// Mock audit logs
export const mockAuditLogs: AuditLog[] = [
  {
    id: 'l1',
    actor: 'James Patterson',
    action: 'Published Assignment',
    entity: 'Writing Task 2: Environmental Issues',
    timestamp: new Date('2025-10-01T10:00:00+07:00'),
    details: 'Published to IELTS Academic Writing Task 2',
  },
  {
    id: 'l2',
    actor: 'Lisa Thompson',
    action: 'Created User',
    entity: 'Priya Sharma',
    timestamp: new Date('2025-09-03T14:30:00+07:00'),
    details: 'Added student account',
  },
  {
    id: 'l3',
    actor: 'James Patterson',
    action: 'Graded Submission',
    entity: 'Speaking Part 2 - Sarah Anderson',
    timestamp: new Date('2025-10-10T11:00:00+07:00'),
    details: 'Band Score: 7.5',
  },
  {
    id: 'l4',
    actor: 'Lisa Thompson',
    action: 'Updated Course',
    entity: 'IELTS Speaking Part 2 & 3 Mastery',
    timestamp: new Date('2025-09-28T16:00:00+07:00'),
    details: 'Changed schedule time',
  },
  {
    id: 'l5',
    actor: 'James Patterson',
    action: 'Graded Submission',
    entity: 'Writing Task 1 - Sarah Anderson',
    timestamp: new Date('2025-10-11T14:20:00+07:00'),
    details: 'Band Score: 7.5',
  },
];
