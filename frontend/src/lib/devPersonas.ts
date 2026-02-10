/**
 * Location: src/lib/devPersonas.ts
 * Purpose: Provide deterministic persona profiles for temporary auth and impersonation flows.
 * Why: Keeps frontend mock auth aligned with backend guard requirements during development.
 */

import type { Role, User } from '@types/domain';

export type PersonaKey = 'admin' | 'teacher' | 'student';

type PersonaProfile = User & {
  persona: PersonaKey;
};

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';

export const PERSONA_USERS: Record<PersonaKey, PersonaProfile> = {
  admin: {
    persona: 'admin',
    id: ADMIN_ID,
    name: 'Rosa Martinez',
    email: 'rosa.admin@ielts.local',
    role: 'admin',
  },
  teacher: {
    persona: 'teacher',
    id: TEACHER_ID,
    name: 'Sarah Nguyen',
    email: 'sarah.tutor@ielts.local',
    role: 'teacher',
  },
  student: {
    persona: 'student',
    id: STUDENT_ID,
    name: 'Amelia Chan',
    email: 'amelia.chan@ielts.local',
    role: 'student',
  },
};

type SupportedRole = Exclude<Role, 'public'>;

export const PERSONA_HEADERS: Record<PersonaKey, { id: string; role: SupportedRole }> = {
  admin: { id: ADMIN_ID, role: 'admin' },
  teacher: { id: TEACHER_ID, role: 'teacher' },
  student: { id: STUDENT_ID, role: 'student' },
};

export const DEFAULT_PERSONA: PersonaKey = 'admin';

export const roleToPersonaKey: Partial<Record<Role, PersonaKey>> = {
  admin: 'admin',
  teacher: 'teacher',
  student: 'student',
};

export const isPersonaKey = (value: unknown): value is PersonaKey =>
  value === 'admin' || value === 'teacher' || value === 'student';
