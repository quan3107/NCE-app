/**
 * File: src/prisma/seeds/navigation.seed.ts
 * Purpose: Seed default navigation items, permissions, and feature flags.
 * Why: Provides initial configuration for the navigation system.
 */

import { UserRole } from "../generated/client/client.js";
import { basePrisma as prisma } from "../client.js";
import { validateNavigationKeys } from "../../modules/navigation/navigation.validation.js";

// ============================================================================
// Default Permissions
// ============================================================================

const DEFAULT_PERMISSIONS = [
  // Student permissions
  { key: "dashboard:view", name: "View Dashboard", roles: [UserRole.student, UserRole.teacher, UserRole.admin] },
  { key: "assignments:read", name: "Read Assignments", roles: [UserRole.student, UserRole.teacher, UserRole.admin] },
  { key: "assignments:submit", name: "Submit Assignments", roles: [UserRole.student] },
  { key: "assignments:create", name: "Create Assignments", roles: [UserRole.teacher, UserRole.admin] },
  { key: "assignments:edit", name: "Edit Assignments", roles: [UserRole.teacher, UserRole.admin] },
  { key: "assignments:delete", name: "Delete Assignments", roles: [UserRole.teacher, UserRole.admin] },
  { key: "grades:view", name: "View Grades", roles: [UserRole.student, UserRole.teacher, UserRole.admin] },
  { key: "notifications:read", name: "Read Notifications", roles: [UserRole.student, UserRole.teacher, UserRole.admin] },
  { key: "profile:view", name: "View Profile", roles: [UserRole.student, UserRole.teacher, UserRole.admin] },
  { key: "profile:edit", name: "Edit Profile", roles: [UserRole.student, UserRole.teacher, UserRole.admin] },
  { key: "courses:read", name: "Read Courses", roles: [UserRole.teacher, UserRole.admin] },
  { key: "courses:manage", name: "Manage Courses", roles: [UserRole.teacher, UserRole.admin] },
  { key: "submissions:read", name: "Read Submissions", roles: [UserRole.teacher, UserRole.admin] },
  { key: "submissions:grade", name: "Grade Submissions", roles: [UserRole.teacher, UserRole.admin] },
  { key: "rubrics:manage", name: "Manage Rubrics", roles: [UserRole.teacher, UserRole.admin] },
  { key: "analytics:view", name: "View Analytics", roles: [UserRole.teacher, UserRole.admin] },
  { key: "users:manage", name: "Manage Users", roles: [UserRole.admin] },
  { key: "enrollments:manage", name: "Manage Enrollments", roles: [UserRole.admin] },
  { key: "audit-logs:view", name: "View Audit Logs", roles: [UserRole.admin] },
  { key: "settings:manage", name: "Manage Settings", roles: [UserRole.admin] },
];

// ============================================================================
// Default Feature Flags
// ============================================================================

const DEFAULT_FEATURE_FLAGS = [
  {
    key: "ielts-speaking-module",
    name: "IELTS Speaking Module",
    description: "Enable IELTS speaking assignments and assessments",
    enabled: true,
    roles: [UserRole.teacher, UserRole.admin],
  },
];

// ============================================================================
// Default Navigation Items
// ============================================================================

const DEFAULT_NAVIGATION_ITEMS = [
  // Student navigation
  { role: UserRole.student, label: "Dashboard", path: "/student/dashboard", iconName: "layout-dashboard", permission: "dashboard:view", order: 0 },
  { role: UserRole.student, label: "Assignments", path: "/student/assignments", iconName: "file-text", permission: "assignments:read", badge: "assignments", order: 1 },
  { role: UserRole.student, label: "Grades", path: "/student/grades", iconName: "graduation-cap", permission: "grades:view", order: 2 },
  { role: UserRole.student, label: "Notifications", path: "/student/notifications", iconName: "bell", permission: "notifications:read", badge: "notifications", order: 3 },
  { role: UserRole.student, label: "Profile", path: "/student/profile", iconName: "user", permission: "profile:view", order: 4 },

  // Teacher navigation
  { role: UserRole.teacher, label: "Dashboard", path: "/teacher/dashboard", iconName: "layout-dashboard", permission: "dashboard:view", order: 0 },
  { role: UserRole.teacher, label: "Courses", path: "/teacher/courses", iconName: "book-open", permission: "courses:read", order: 1 },
  { role: UserRole.teacher, label: "Assignments", path: "/teacher/assignments", iconName: "file-text", permission: "assignments:create", order: 2 },
  { role: UserRole.teacher, label: "Submissions", path: "/teacher/submissions", iconName: "scroll-text", permission: "submissions:read", badge: "submissions", order: 3 },
  { role: UserRole.teacher, label: "Rubrics", path: "/teacher/rubrics", iconName: "book-marked", permission: "rubrics:manage", order: 4 },
  { role: UserRole.teacher, label: "Analytics", path: "/teacher/analytics", iconName: "bar-chart-3", permission: "analytics:view", order: 5 },
  { role: UserRole.teacher, label: "Profile", path: "/teacher/profile", iconName: "user", permission: "profile:view", order: 6 },

  // Admin navigation
  { role: UserRole.admin, label: "Dashboard", path: "/admin/dashboard", iconName: "layout-dashboard", permission: "dashboard:view", order: 0 },
  { role: UserRole.admin, label: "Users", path: "/admin/users", iconName: "users", permission: "users:manage", order: 1 },
  { role: UserRole.admin, label: "Courses", path: "/admin/courses", iconName: "book-open", permission: "courses:manage", order: 2 },
  { role: UserRole.admin, label: "Enrollments", path: "/admin/enrollments", iconName: "graduation-cap", permission: "enrollments:manage", order: 3 },
  { role: UserRole.admin, label: "Audit Logs", path: "/admin/logs", iconName: "scroll-text", permission: "audit-logs:view", order: 4 },
  { role: UserRole.admin, label: "Settings", path: "/admin/settings", iconName: "settings", permission: "settings:manage", order: 5 },
];

// ============================================================================
// Seed Functions
// ============================================================================

async function seedPermissions() {
  console.log("Seeding permissions...");

  for (const perm of DEFAULT_PERMISSIONS) {
    // Create or update permission
    const permission = await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name },
      create: {
        key: perm.key,
        name: perm.name,
      },
    });

    // Create role permissions
    for (const role of perm.roles) {
      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          role,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log(`✓ Seeded ${DEFAULT_PERMISSIONS.length} permissions`);
}

async function seedFeatureFlags() {
  console.log("Seeding feature flags...");

  for (const flag of DEFAULT_FEATURE_FLAGS) {
    const featureFlag = await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
      },
      create: {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
      },
    });

    // Create feature flag roles
    for (const role of flag.roles) {
      await prisma.featureFlagRole.upsert({
        where: {
          featureFlagId_role: {
            featureFlagId: featureFlag.id,
            role,
          },
        },
        update: {},
        create: {
          featureFlagId: featureFlag.id,
          role,
        },
      });
    }
  }

  console.log(`✓ Seeded ${DEFAULT_FEATURE_FLAGS.length} feature flags`);
}

async function seedNavigationItems() {
  console.log("Seeding navigation items...");

  // Validate all navigation items before inserting
  console.log("  Validating navigation item keys...");
  for (const item of DEFAULT_NAVIGATION_ITEMS) {
    try {
      await validateNavigationKeys({
        requiredPermission: item.permission,
        featureFlag: null,
      });
    } catch (error) {
      console.error(`    ❌ Validation failed for navigation item "${item.label}":`, error);
      throw error;
    }
  }
  console.log("  ✓ All navigation item keys validated");

  // Clear existing navigation items first (to avoid duplicates on re-run)
  await prisma.navigationItem.deleteMany({});

  for (const item of DEFAULT_NAVIGATION_ITEMS) {
    await prisma.navigationItem.create({
      data: {
        role: item.role,
        label: item.label,
        path: item.path,
        iconName: item.iconName,
        requiredPermission: item.permission,
        orderIndex: item.order,
        badgeSource: item.badge || null,
        isActive: true,
        featureFlag: null,
      },
    });
  }

  console.log(`✓ Seeded ${DEFAULT_NAVIGATION_ITEMS.length} navigation items`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("🌱 Starting navigation seed...\n");

  try {
    await seedPermissions();
    await seedFeatureFlags();
    await seedNavigationItems();

    console.log("\n✅ Navigation seed completed successfully!");
  } catch (error) {
    console.error("\n❌ Navigation seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
