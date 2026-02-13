import { AppShell } from "@/components/ui/AppShell";
import { IntakeClient } from "@/components/intake/IntakeClient";

export default function IntakePage({ params }: { params: { token: string } }) {
  return (
    <AppShell
      active="intake"
      title="Client Intake Portal"
      subtitle="Guided onboarding with autosave, document capture, and deterministic handoff."
    >
      <IntakeClient token={params.token} />
    </AppShell>
  );
}
