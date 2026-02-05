/**
 * File: src/modules/navigation/navigation.validation.ts
 * Purpose: Validate navigation item keys before creation/update.
 * Why: Prevents invalid permission/featureFlag references and catches typos early.
 */

import { basePrisma } from "../../prisma/client.js";
import { createHttpError } from "../../utils/httpError.js";

const prisma = basePrisma;

/**
 * Validates that requiredPermission and featureFlag keys exist in their respective tables.
 * Throws an error if any key is invalid.
 */
export async function validateNavigationKeys(input: {
  requiredPermission?: string | null;
  featureFlag?: string | null;
}): Promise<void> {
  // Validate requiredPermission if provided
  if (input.requiredPermission) {
    const permissionExists = await prisma.permission.findUnique({
      where: { key: input.requiredPermission },
      select: { id: true },
    });

    if (!permissionExists) {
      throw createHttpError(
        400,
        `Invalid permission key: "${input.requiredPermission}". Key does not exist in permissions table.`,
      );
    }
  }

  // Validate featureFlag if provided
  if (input.featureFlag) {
    const featureFlagExists = await prisma.featureFlag.findUnique({
      where: { key: input.featureFlag },
      select: { id: true },
    });

    if (!featureFlagExists) {
      throw createHttpError(
        400,
        `Invalid feature flag key: "${input.featureFlag}". Key does not exist in feature_flags table.`,
      );
    }
  }
}
