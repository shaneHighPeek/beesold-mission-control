export interface IntakeStepDefinition {
  key: string;
  title: string;
  description: string;
  helpText: string;
  fields: Array<{ name: string; label: string; required?: boolean }>;
}

export const INTAKE_STEP_DEFINITIONS: IntakeStepDefinition[] = [
  {
    key: "business_profile",
    title: "Business Profile",
    description: "Capture the foundational client and entity details.",
    helpText: "Use legal names and current operating structure to avoid downstream report rework.",
    fields: [
      { name: "businessName", label: "Business name", required: true },
      { name: "contactName", label: "Primary contact", required: true },
      { name: "email", label: "Contact email", required: true },
    ],
  },
  {
    key: "goals_constraints",
    title: "Goals and Constraints",
    description: "Collect strategic outcomes, risks, and timing requirements.",
    helpText: "Document target outcomes with measurable constraints for better synthesis quality.",
    fields: [
      { name: "primaryGoal", label: "Primary goal", required: true },
      { name: "timeline", label: "Target timeline", required: true },
      { name: "constraints", label: "Known constraints" },
    ],
  },
  {
    key: "documents",
    title: "Structured Document Upload",
    description: "Attach key source records by category.",
    helpText: "Upload clean source files to reduce ambiguity during Klor synthesis.",
    fields: [],
  },
  {
    key: "review",
    title: "Review and Confirm",
    description: "Review all captured information before final submission.",
    helpText: "Confirm details are complete. Submission starts the internal pipeline.",
    fields: [],
  },
];
