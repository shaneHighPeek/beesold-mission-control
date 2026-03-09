import type { Brokerage, ClientIdentity, IntakeSession, OutboundEmail } from "@/lib/domain/types";
import { isPostgresDriver } from "@/lib/persistence/driver";
import { addOutboundEmail, addAuditLog, updateOutboundEmailDelivery } from "@/lib/persistence/mockDb";
import {
  addAuditLogInSupabase,
  addOutboundEmailInSupabase,
  updateOutboundEmailDeliveryInSupabase,
} from "@/lib/persistence/supabaseRest";

type EmailProvider = "stub" | "postmark" | "sendgrid";

type DeliveryResult = {
  provider: EmailProvider;
  providerStatus: string;
  providerMessageId?: string;
};

function renderWelcomeEmail(input: {
  brokerage: Brokerage;
  client: ClientIdentity;
  magicLinkUrl: string;
}): { subject: string; html: string } {
  const { brokerage, client, magicLinkUrl } = input;
  const supportLabel = brokerage.senderName;
  const logoMarkup = brokerage.branding.logoUrl
    ? `<img src="${brokerage.branding.logoUrl}" alt="${brokerage.name} logo" style="max-width:180px;height:auto;display:block;margin-bottom:14px;" />`
    : "";
  const footerBranding = brokerage.branding.showBeeSoldBranding
    ? `<p style="font-size:12px;color:#6b7280;margin:6px 0 0;">Powered by BeeSold</p>`
    : "";

  return {
    subject: `${brokerage.name} secure intake portal access`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1b1b1b;background:#f6f8ff;padding:24px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e1e7f5;border-radius:14px;overflow:hidden;">
          <div style="height:8px;background:linear-gradient(90deg, ${brokerage.branding.primaryColor}, ${brokerage.branding.secondaryColor});"></div>
          <div style="padding:22px 22px 18px;">
            ${logoMarkup}
            <h2 style="margin:0 0 8px;color:${brokerage.branding.primaryColor};">Welcome to ${brokerage.name}</h2>
            <p style="margin:0 0 10px;">Hi ${client.contactName}, your secure intake portal is ready.</p>
            <p style="margin:0 0 14px;">This intake is designed for multiple sessions. You can save progress and return at any time.</p>
            <p style="margin:0 0 16px;">
              <a href="${magicLinkUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:${brokerage.branding.primaryColor};color:#fff;text-decoration:none;font-weight:600;">Open Secure Portal</a>
            </p>
            <p style="margin:0 0 12px;">On first access, you can set a password. You can always request a new magic link later.</p>
            <p style="font-size:12px;color:#4b5563;margin:0 0 4px;">${brokerage.branding.legalFooter}</p>
            <p style="font-size:12px;color:#6b7280;margin:0;">Sent by ${supportLabel} &lt;${brokerage.senderEmail}&gt;.</p>
            ${footerBranding}
          </div>
        </div>
      </div>
    `.trim(),
  };
}

function getEmailProvider(): EmailProvider {
  const provider = (process.env.EMAIL_PROVIDER ?? "stub").toLowerCase();
  if (provider === "postmark") return "postmark";
  if (provider === "sendgrid") return "sendgrid";
  return "stub";
}

async function sendViaPostmark(input: {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
}): Promise<DeliveryResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    throw new Error("POSTMARK_SERVER_TOKEN is required when EMAIL_PROVIDER=postmark");
  }

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: `${input.fromName} <${input.fromEmail}>`,
      To: input.to,
      Subject: input.subject,
      HtmlBody: input.html,
      MessageStream: "outbound",
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Postmark send failed (${response.status}): ${bodyText}`);
  }

  let parsed: { MessageID?: string } = {};
  try {
    parsed = JSON.parse(bodyText) as { MessageID?: string };
  } catch {
    parsed = {};
  }

  return {
    provider: "postmark",
    providerStatus: "SENT",
    providerMessageId: parsed.MessageID,
  };
}

async function sendViaSendGrid(input: {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
}): Promise<DeliveryResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is required when EMAIL_PROVIDER=sendgrid");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: input.fromEmail, name: input.fromName },
      subject: input.subject,
      content: [{ type: "text/html", value: input.html }],
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`SendGrid send failed (${response.status}): ${bodyText}`);
  }

  return {
    provider: "sendgrid",
    providerStatus: "SENT",
    providerMessageId: response.headers.get("x-message-id") ?? undefined,
  };
}

async function dispatchWelcomeEmail(input: {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
}): Promise<DeliveryResult> {
  const provider = getEmailProvider();
  if (provider === "postmark") return sendViaPostmark(input);
  if (provider === "sendgrid") return sendViaSendGrid(input);

  return {
    provider: "stub",
    providerStatus: "STUBBED",
  };
}

export async function sendWelcomeEmail(input: {
  brokerage: Brokerage;
  client: ClientIdentity;
  session: IntakeSession;
  magicLinkUrl: string;
}): Promise<OutboundEmail> {
  const content = renderWelcomeEmail({
    brokerage: input.brokerage,
    client: input.client,
    magicLinkUrl: input.magicLinkUrl,
  });

  const email = isPostgresDriver()
    ? await addOutboundEmailInSupabase({
        brokerageId: input.brokerage.id,
        sessionId: input.session.id,
        to: input.client.email,
        fromName: input.brokerage.senderName,
        fromEmail: input.brokerage.senderEmail,
        subject: content.subject,
        html: content.html,
        providerStatus: "QUEUED",
      })
    : addOutboundEmail({
        brokerageId: input.brokerage.id,
        sessionId: input.session.id,
        to: input.client.email,
        fromName: input.brokerage.senderName,
        fromEmail: input.brokerage.senderEmail,
        subject: content.subject,
        html: content.html,
        providerStatus: "QUEUED",
      });

  try {
    const delivery = await dispatchWelcomeEmail({
      fromName: input.brokerage.senderName,
      fromEmail: input.brokerage.senderEmail,
      to: input.client.email,
      subject: content.subject,
      html: content.html,
    });

    const updatedEmail = isPostgresDriver()
      ? await updateOutboundEmailDeliveryInSupabase(email.id, {
          providerStatus: delivery.providerStatus,
          providerMessageId: delivery.providerMessageId,
        })
      : updateOutboundEmailDelivery(email.id, {
          providerStatus: delivery.providerStatus,
          providerMessageId: delivery.providerMessageId,
        });

    if (isPostgresDriver()) {
      await addAuditLogInSupabase(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "WELCOME_EMAIL_SENT", {
        to: input.client.email,
        from: `${input.brokerage.senderName} <${input.brokerage.senderEmail}>`,
        provider: delivery.provider,
        providerStatus: delivery.providerStatus,
        providerMessageId: delivery.providerMessageId,
      });
    } else {
      addAuditLog(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "WELCOME_EMAIL_SENT", {
        to: input.client.email,
        from: `${input.brokerage.senderName} <${input.brokerage.senderEmail}>`,
        provider: delivery.provider,
        providerStatus: delivery.providerStatus,
        providerMessageId: delivery.providerMessageId,
      });
    }

    return updatedEmail;
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (isPostgresDriver()) {
      await updateOutboundEmailDeliveryInSupabase(email.id, { providerStatus: "FAILED" });
      await addAuditLogInSupabase(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "WELCOME_EMAIL_FAILED", {
        to: input.client.email,
        from: `${input.brokerage.senderName} <${input.brokerage.senderEmail}>`,
        error: errorMessage,
      });
    } else {
      updateOutboundEmailDelivery(email.id, { providerStatus: "FAILED" });
      addAuditLog(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "WELCOME_EMAIL_FAILED", {
        to: input.client.email,
        from: `${input.brokerage.senderName} <${input.brokerage.senderEmail}>`,
        error: errorMessage,
      });
    }
    throw new Error(`Welcome email delivery failed: ${errorMessage}`);
  }
}
