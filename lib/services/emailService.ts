import type { Brokerage, ClientIdentity, IntakeSession, OutboundEmail } from "@/lib/domain/types";
import { addOutboundEmail, addAuditLog } from "@/lib/persistence/mockDb";

function renderWelcomeEmail(input: {
  brokerage: Brokerage;
  client: ClientIdentity;
  magicLinkUrl: string;
}): { subject: string; html: string } {
  const { brokerage, client, magicLinkUrl } = input;
  const supportLabel = brokerage.senderName;

  return {
    subject: `${brokerage.name} secure intake portal access`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1b1b1b;">
        <h2 style="margin-bottom:8px;">Welcome to ${brokerage.name}</h2>
        <p>Hi ${client.contactName}, your secure intake portal is ready.</p>
        <p>This intake is designed for multiple sessions. You can save progress and return at any time.</p>
        <p>
          <a href="${magicLinkUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:${brokerage.branding.primaryColor};color:#fff;text-decoration:none;">Open Secure Portal</a>
        </p>
        <p>On first access, you can set a password. You can always request a new magic link later.</p>
        <p style="font-size:12px;color:#555;">${brokerage.branding.legalFooter}</p>
        <p style="font-size:12px;color:#777;">Sent by ${supportLabel}.</p>
      </div>
    `.trim(),
  };
}

export function sendWelcomeEmail(input: {
  brokerage: Brokerage;
  client: ClientIdentity;
  session: IntakeSession;
  magicLinkUrl: string;
}): OutboundEmail {
  const content = renderWelcomeEmail({
    brokerage: input.brokerage,
    client: input.client,
    magicLinkUrl: input.magicLinkUrl,
  });

  const email = addOutboundEmail({
    brokerageId: input.brokerage.id,
    sessionId: input.session.id,
    to: input.client.email,
    fromName: input.brokerage.senderName,
    fromEmail: input.brokerage.senderEmail,
    subject: content.subject,
    html: content.html,
  });

  addAuditLog(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "WELCOME_EMAIL_SENT", {
    to: input.client.email,
    from: `${input.brokerage.senderName} <${input.brokerage.senderEmail}>`,
  });

  return email;
}
