import type { IntakeLifecycleState } from "@/lib/domain/types";

const transitionMap: Record<IntakeLifecycleState, IntakeLifecycleState[]> = {
  INVITED: ["IN_PROGRESS"],
  IN_PROGRESS: ["PARTIAL_SUBMITTED", "FINAL_SUBMITTED", "MISSING_ITEMS_REQUESTED"],
  PARTIAL_SUBMITTED: ["MISSING_ITEMS_REQUESTED", "IN_PROGRESS", "FINAL_SUBMITTED"],
  MISSING_ITEMS_REQUESTED: ["IN_PROGRESS", "PARTIAL_SUBMITTED", "FINAL_SUBMITTED"],
  FINAL_SUBMITTED: ["KLOR_SYNTHESIS"],
  KLOR_SYNTHESIS: ["COUNCIL_RUNNING"],
  COUNCIL_RUNNING: ["REPORT_READY"],
  REPORT_READY: ["APPROVED", "IN_PROGRESS", "MISSING_ITEMS_REQUESTED"],
  APPROVED: [],
};

export function canTransition(current: IntakeLifecycleState, next: IntakeLifecycleState): boolean {
  return transitionMap[current].includes(next);
}

export function assertTransition(current: IntakeLifecycleState, next: IntakeLifecycleState): void {
  if (!canTransition(current, next)) {
    throw new Error(`Invalid transition from ${current} to ${next}`);
  }
}

export function orderedLifecycle(): IntakeLifecycleState[] {
  return [
    "INVITED",
    "IN_PROGRESS",
    "PARTIAL_SUBMITTED",
    "MISSING_ITEMS_REQUESTED",
    "FINAL_SUBMITTED",
    "KLOR_SYNTHESIS",
    "COUNCIL_RUNNING",
    "REPORT_READY",
    "APPROVED",
  ];
}
