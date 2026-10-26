import { getServerSession } from "next-auth";
import { headers } from "next/headers";

import { authOptions } from "@/auth";
import { FEATURE_KEYS_HEADER } from "@/lib/apiFeatures";
import {
  getAllowedFeatureKeys,
  isFeatureAllowed,
} from "@/lib/featureAccess";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  const userId = Number(session?.user?.id);

  if (!session?.user?.id || Number.isNaN(userId)) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
      managerId: true,
    },
  });

  return user;
}

export async function requireRole(allowedRoles = []) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const featureHeader = (await headers()).get(FEATURE_KEYS_HEADER);

  if (featureHeader) {
    const requiredFeatures = featureHeader
      .split(",")
      .map((feature) => feature.trim())
      .filter(Boolean);
    const allowedFeatures = await getAllowedFeatureKeys(user.role);

    if (
      requiredFeatures.length > 0 &&
      !requiredFeatures.some((feature) => allowedFeatures.includes(feature))
    ) {
      throw new Error("FORBIDDEN");
    }

    return user;
  }

  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)
  ) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function requireFeature(featureKey) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  if (!(await isFeatureAllowed(user.role, featureKey))) {
    throw new Error("FORBIDDEN");
  }

  return user;
}
