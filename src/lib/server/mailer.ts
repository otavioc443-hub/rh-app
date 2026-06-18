type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseSender(value: string) {
  const raw = clean(value);
  const match = /^(.*?)<([^<>@\s]+@[^<>@\s]+)>$/.exec(raw);
  if (match) {
    return {
      name: clean(match[1]) || undefined,
      email: clean(match[2]),
    };
  }

  return {
    name: undefined,
    email: raw,
  };
}

function getBrevoConfig() {
  const apiKey = clean(process.env.BREVO_API_KEY);
  const from = clean(process.env.BREVO_EMAIL_FROM) || clean(process.env.LMS_EMAIL_FROM);
  return apiKey && from ? { apiKey, from } : null;
}

function getResendConfig() {
  const apiKey = clean(process.env.RESEND_API_KEY);
  const from = clean(process.env.RESEND_EMAIL_FROM) || clean(process.env.LMS_EMAIL_FROM);
  return apiKey && from ? { apiKey, from } : null;
}

export function getPortalMailerStatus() {
  const brevo = getBrevoConfig();
  const resend = getResendConfig();
  return {
    enabled: Boolean(brevo || resend),
    provider: brevo ? "brevo" : resend ? "resend" : null,
  };
}

export async function sendPortalEmail(payload: MailPayload) {
  const brevo = getBrevoConfig();
  if (brevo) {
    const sender = parseSender(brevo.from);
    if (!sender.email) return { sent: false, skipped: true as const };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevo.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: payload.to }],
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text ?? stripHtml(payload.html),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Falha ao enviar e-mail via Brevo: ${detail || response.statusText}`);
    }

    return { sent: true, skipped: false as const };
  }

  const resend = getResendConfig();
  if (!resend) {
    return { sent: false, skipped: true as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resend.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? stripHtml(payload.html),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar e-mail via Resend: ${detail || response.statusText}`);
  }

  return { sent: true, skipped: false as const };
}
