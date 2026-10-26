const API_RULES = [
  {
    pattern: /^\/api\/documents\/[^/]+\/download$/,
    features: ["documents"],
  },
  {
    pattern: /^\/api\/documents\/[^/]+\/remind$/,
    features: ["documents-upload"],
  },
  {
    pattern: /^\/api\/documents\/[^/]+$/,
    features: ["documents"],
    methodFeatures: {
      PATCH: ["documents-upload"],
      PUT: ["documents-upload"],
      DELETE: ["documents-upload"],
    },
  },
  {
    pattern: /^\/api\/documents$/,
    features: ["documents"],
    methodFeatures: {
      POST: ["documents-upload"],
    },
  },
  {
    pattern: /^\/api\/employees(\/|$)/,
    features: ["employees"],
  },
  {
    pattern: /^\/api\/departments(\/|$)/,
    features: ["employees", "users", "attendance-report", "payroll-periods"],
  },
  {
    pattern: /^\/api\/workforce\/assignments$/,
    features: ["employees", "users"],
  },
  {
    pattern: /^\/api\/workforce(\/|$)/,
    features: ["attendance-report"],
  },
  {
    pattern: /^\/api\/users(\/|$)/,
    features: ["users"],
  },
  {
    pattern: /^\/api\/hr-dashboard$/,
    features: ["hr-dashboard"],
  },
  {
    pattern: /^\/api\/finance(\/|$)/,
    features: ["finance"],
  },
  {
    pattern: /^\/api\/payroll\/periods$/,
    features: ["payroll-periods"],
  },
  {
    pattern: /^\/api\/payroll\/attendance-summary$/,
    features: ["payroll-periods"],
  },
  {
    pattern: /^\/api\/payroll\/[^/]+\/(finalize|pay)$/,
    features: ["payroll-periods"],
  },
  {
    pattern: /^\/api\/payroll$/,
    features: ["payroll", "my-payroll"],
    methodFeatures: {
      POST: ["payroll-periods"],
    },
  },
  {
    pattern: /^\/api\/leave-types(\/|$)/,
    features: ["leaves"],
  },
  {
    pattern: /^\/api\/leave-balances(\/|$)/,
    features: ["leaves"],
  },
  {
    pattern: /^\/api\/leaves(\/|$)/,
    features: ["leaves"],
  },
  {
    pattern: /^\/api\/requests(\/|$)/,
    features: ["requests"],
  },
  {
    pattern: /^\/api\/attendance\/corrections(\/|$)/,
    features: ["attendance-corrections"],
  },
  {
    pattern: /^\/api\/attendance\/summary$/,
    features: ["attendance-report"],
  },
  {
    pattern: /^\/api\/attendance\/clock-(in|out)$/,
    features: ["attendance"],
  },
  {
    pattern: /^\/api\/attendance(\/|$)/,
    features: ["attendance", "attendance-report", "attendance-corrections"],
  },
];

export const FEATURE_KEYS_HEADER = "x-smartops-feature-keys";

export function getApiFeatureKeys(pathname, method = "GET") {
  const normalizedMethod = String(method || "GET").toUpperCase();

  for (const rule of API_RULES) {
    if (!rule.pattern.test(pathname)) continue;
    return rule.methodFeatures?.[normalizedMethod] || rule.features;
  }

  return null;
}
