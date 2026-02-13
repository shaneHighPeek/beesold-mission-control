import { IntakeClient } from "@/components/intake/IntakeClient";

export default function IntakePage({ params }: { params: { token: string } }) {
  return <IntakeClient token={params.token} />;
}
