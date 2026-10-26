const APPROVAL_WORKFLOW = {
  IT_SUPPORT: [{ label: "IT Support", role: "IT" }],
  EQUIPMENT: [{ label: "General Affair", role: "GENERAL_AFFAIR" }],
  FACILITY: [{ label: "HR", role: "HR" }],
  ADMINISTRATIVE: [{ label: "HR", role: "HR" }],
  PROCUREMENT: [{ label: "Finance", role: "FINANCE" }],
};

const DEFAULT_WORKFLOW = APPROVAL_WORKFLOW.ADMINISTRATIVE;

export function getApprovalWorkflow(requestType) {
  return (
    APPROVAL_WORKFLOW[String(requestType || "").toUpperCase()] ||
    DEFAULT_WORKFLOW
  );
}

export function buildApprovalSteps(requestType) {
  return getApprovalWorkflow(requestType).map((definition, index) => ({
    stepOrder: index + 1,
    stepLabel: definition.label,
    approverRole: definition.role,
    approverId: null,
  }));
}

export function getCurrentApproval(approvals = []) {
  return (
    approvals
      .filter((approval) => approval.status === "PENDING")
      .sort((a, b) => a.stepOrder - b.stepOrder)[0] || null
  );
}

export function getNextApproval(approvals = [], currentStepOrder) {
  return (
    approvals
      .filter(
        (approval) =>
          approval.status === "PENDING" &&
          approval.stepOrder > currentStepOrder
      )
      .sort((a, b) => a.stepOrder - b.stepOrder)[0] || null
  );
}

export function canApproveCurrentStep(user, request, approvals = []) {
  if (!user || !request || request.status !== "PENDING") {
    return false;
  }

  if (Number(request.userId) === Number(user.id)) {
    return false;
  }

  const currentApproval = getCurrentApproval(approvals);

  if (!currentApproval) return false;

  return (
    user.role === "ADMIN" ||
    currentApproval.approverRole === user.role
  );
}

export { APPROVAL_WORKFLOW };
