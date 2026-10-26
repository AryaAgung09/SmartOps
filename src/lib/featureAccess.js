import { prisma } from "@/lib/prisma";
import {
  FEATURES,
  FEATURE_BY_KEY,
  FEATURE_SECTIONS,
  ROLES,
  roleLabel,
  fixedFeatureValue,
} from "@/lib/features";

function overrideKey(role, featureKey) {
  return `${role}:${featureKey}`;
}

async function loadOverrides() {
  const rows = await prisma.roleFeatureAccess.findMany({
    select: {
      role: true,
      featureKey: true,
      enabled: true,
    },
  });

  return new Map(
    rows.map((row) => [
      overrideKey(row.role, row.featureKey),
      row.enabled,
    ])
  );
}

function resolveFeatureValue(overrides, role, feature) {
  const fixed = fixedFeatureValue(feature.key, role);
  if (fixed !== null) return fixed;

  const override = overrides.get(overrideKey(role, feature.key));
  if (override !== undefined) return override;

  return feature.defaultRoles.includes(role);
}

export async function getAllowedFeatureKeys(role) {
  if (!ROLES.includes(role)) return [];

  const overrides = await loadOverrides();

  return FEATURES.filter((feature) =>
    resolveFeatureValue(overrides, role, feature)
  ).map((feature) => feature.key);
}

export async function isFeatureAllowed(role, featureKey) {
  const feature = FEATURE_BY_KEY[featureKey];
  if (!feature || !ROLES.includes(role)) return false;

  const fixed = fixedFeatureValue(featureKey, role);
  if (fixed !== null) return fixed;

  const row = await prisma.roleFeatureAccess.findUnique({
    where: {
      role_featureKey: {
        role,
        featureKey,
      },
    },
  });

  return row?.enabled ?? feature.defaultRoles.includes(role);
}

export async function getFeatureAccessMatrix() {
  const overrides = await loadOverrides();

  return {
    roles: ROLES.map((role) => ({ key: role, label: roleLabel(role) })),
    sections: FEATURE_SECTIONS.map((section) => ({
      label: section.label,
      features: section.items.map((feature) => {
        const roles = {};
        const locked = {};

        for (const role of ROLES) {
          const fixed = fixedFeatureValue(feature.key, role);
          roles[role] = fixed ?? resolveFeatureValue(overrides, role, feature);
          locked[role] = fixed !== null;
        }

        return {
          key: feature.key,
          label: feature.label,
          href: feature.href,
          icon: feature.icon,
          defaultRoles: feature.defaultRoles,
          roles,
          locked,
        };
      }),
    })),
  };
}

export async function saveFeatureAccessMatrix(permissions) {
  const operations = [];

  for (const feature of FEATURES) {
    for (const role of ROLES) {
      if (fixedFeatureValue(feature.key, role) !== null) continue;

      const enabled = permissions?.[feature.key]?.[role] === true;

      operations.push(
        prisma.roleFeatureAccess.upsert({
          where: {
            role_featureKey: {
              role,
              featureKey: feature.key,
            },
          },
          create: {
            role,
            featureKey: feature.key,
            enabled,
          },
          update: {
            enabled,
          },
        })
      );
    }
  }

  await prisma.$transaction(operations);

  return getFeatureAccessMatrix();
}
