import type { IntakeLifecycleState } from "@/lib/domain/types";

const transitionMap: Record<IntakeLifecycleState, IntakeLifecycleState[]> = {
  DRAFT: ["IN_PROGRESS"],
  IN_PROGRESS: ["SUBMITTED"],
  SUBMITTED: ["KLOR_SYNTHESIS"],
  KLOR_SYNTHESIS: ["COUNCIL_RUNNING"],
  COUNCIL_RUNNING: ["REPORT_READY"],
  REPORT_READY: ["APPROVED", "IN_PROGRESS"],
  APPROVED: [],
};

export function canTransition(
  current: IntakeLifecycleState,
  next: IntakeLifecycleState,
): boolean {
  return transitionMap[current].includes(next);
}

export function assertTransition(
  current: IntakeLifecycleState,
  next: IntakeLifecycleState,
): void {
  if (!canTransition(current, next)) {
    throw new Error(`Invalid transition from ${current} to ${next}`);
  }
}

export function orderedLifecycle(): IntakeLifecycleState[] {
  return [
    "DRAFT",
    "IN_PROGRESS",
    "SUBMITTED",
    "KLOR_SYNTHESIS",
    "COUNCIL_RUNNING",
    "REPORT_READY",
    "APPROVED",
  ];
}
