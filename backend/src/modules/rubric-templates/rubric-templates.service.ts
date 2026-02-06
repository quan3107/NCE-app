/**
 * File: src/modules/rubric-templates/rubric-templates.service.ts
 * Purpose: Provide query and mapping logic for rubric template endpoints.
 * Why: Centralizes fallback behavior so frontend can rely on one consistent template contract.
 */
import { EnrollmentRole, UserRole } from "../../prisma/generated/client/client.js";
import { prisma } from "../../prisma/client.js";
import { createHttpError } from "../../utils/httpError.js";
import {
  courseDefaultRubricTemplateParamsSchema,
  defaultRubricsQuerySchema,
  rubricTemplatesQuerySchema,
  type RubricTemplateAssignmentType,
  type RubricTemplateContext,
} from "./rubric-templates.schema.js";

type TemplateLevel = {
  label: string;
  points: number;
  desc?: string;
};

type TemplateCriterion = {
  id: string;
  name: string;
  weight: number;
  description?: string;
  maxScore?: number;
  levels?: TemplateLevel[];
};

export type RubricTemplateResponse = {
  id: string;
  name: string;
  context: RubricTemplateContext;
  assignmentType: RubricTemplateAssignmentType;
  source: "system" | "course";
  criteria: TemplateCriterion[];
};

export type RubricTemplatesResponse = {
  templates: RubricTemplateResponse[];
};

type Actor = {
  id: string;
  role: UserRole;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function parseLevels(value: unknown): TemplateLevel[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const levels: TemplateLevel[] = [];
  for (const item of value) {
    const parsed = asObject(item);
    if (!parsed) {
      continue;
    }

    const label = typeof parsed.label === "string" ? parsed.label.trim() : "";
    const points = asNumber(parsed.points);
    if (!label || points === null) {
      continue;
    }

    const desc = typeof parsed.desc === "string" ? parsed.desc : undefined;
    levels.push({ label, points, desc });
  }

  return levels.length > 0 ? levels : undefined;
}

function mapCriteria(value: unknown): TemplateCriterion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const criteria: TemplateCriterion[] = [];
  for (const [index, item] of value.entries()) {
    const parsed = asObject(item);
    if (!parsed) {
      continue;
    }

    const id =
      typeof parsed.id === "string" && parsed.id.trim().length > 0
        ? parsed.id
        : `criterion-${index + 1}`;
    const nameCandidate =
      typeof parsed.name === "string"
        ? parsed.name
        : typeof parsed.criterion === "string"
          ? parsed.criterion
          : "";
    const name = nameCandidate.trim() || `Criterion ${index + 1}`;
    const weight = asNumber(parsed.weight) ?? 0;
    const description =
      typeof parsed.description === "string"
        ? parsed.description
        : undefined;
    const maxScore =
      asNumber(parsed.maxScore) ?? asNumber(parsed.max_score) ?? undefined;
    const levels = parseLevels(parsed.levels);

    criteria.push({
      id,
      name,
      weight,
      description,
      maxScore,
      levels,
    });
  }

  return criteria;
}

async function ensureCourseRubricAccess(courseId: string, actor: Actor): Promise<void> {
  if (actor.role === UserRole.admin) {
    return;
  }

  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: {
      ownerId: true,
      enrollments: {
        where: {
          userId: actor.id,
          roleInCourse: EnrollmentRole.teacher,
          deletedAt: null,
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!course) {
    throw createHttpError(404, "Course not found");
  }

  if (actor.role !== UserRole.teacher) {
    throw createHttpError(403, "You do not have permission to access this course");
  }

  const canManage = course.ownerId === actor.id || course.enrollments.length > 0;
  if (!canManage) {
    throw createHttpError(403, "You do not have permission to access this course");
  }
}

function mapSystemTemplate(template: {
  id: string;
  name: string;
  context: string;
  assignmentType: string;
  criteria: unknown;
}): RubricTemplateResponse {
  return {
    id: template.id,
    name: template.name,
    context: template.context as RubricTemplateContext,
    assignmentType: template.assignmentType as RubricTemplateAssignmentType,
    source: "system",
    criteria: mapCriteria(template.criteria),
  };
}

function mapCourseRubric(rubric: {
  id: string;
  name: string;
  criteria: unknown;
}): RubricTemplateResponse {
  return {
    id: rubric.id,
    name: rubric.name,
    context: "course",
    assignmentType: "generic",
    source: "course",
    criteria: mapCriteria(rubric.criteria),
  };
}

export async function listDefaultRubrics(query: unknown): Promise<RubricTemplatesResponse> {
  const { context, assignmentType } = defaultRubricsQuerySchema.parse(query);

  const templates = await prisma.rubricTemplate.findMany({
    where: {
      context,
      isActive: true,
      ...(assignmentType
        ? {
            OR: [{ assignmentType }, { assignmentType: "generic" }],
          }
        : undefined),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    templates: templates.map(mapSystemTemplate),
  };
}

export async function getCourseDefaultRubricTemplate(
  params: unknown,
  actor: Actor,
): Promise<{ template: RubricTemplateResponse }> {
  const { courseId } = courseDefaultRubricTemplateParamsSchema.parse(params);
  await ensureCourseRubricAccess(courseId, actor);

  const latestCourseRubric = await prisma.rubric.findFirst({
    where: {
      courseId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      criteria: true,
    },
  });

  if (latestCourseRubric) {
    return { template: mapCourseRubric(latestCourseRubric) };
  }

  const fallbackTemplate = await prisma.rubricTemplate.findFirst({
    where: {
      context: "course",
      assignmentType: "generic",
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (!fallbackTemplate) {
    throw createHttpError(404, "Default course rubric template not found");
  }

  return { template: mapSystemTemplate(fallbackTemplate) };
}

export async function listRubricTemplates(
  query: unknown,
  actor: Actor,
): Promise<RubricTemplatesResponse> {
  const { courseId, context } = rubricTemplatesQuerySchema.parse(query);
  await ensureCourseRubricAccess(courseId, actor);

  const [courseRubrics, systemTemplates] = await Promise.all([
    prisma.rubric.findMany({
      where: {
        courseId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        criteria: true,
      },
    }),
    prisma.rubricTemplate.findMany({
      where: {
        isActive: true,
        ...(context ? { context } : undefined),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        context: true,
        assignmentType: true,
        criteria: true,
      },
    }),
  ]);

  return {
    templates: [
      ...courseRubrics.map(mapCourseRubric),
      ...systemTemplates.map(mapSystemTemplate),
    ],
  };
}
