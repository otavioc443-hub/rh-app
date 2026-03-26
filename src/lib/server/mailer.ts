type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function isMailerConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.LMS_EMAIL_FROM?.trim());
}

export async function sendPortalEmail(payload: MailPayload) {
  if (!isMailerConfigured()) {
    return { sent: false, skipped: true as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.LMS_EMAIL_FROM!.trim(),
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, " "),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar e-mail: ${detail || response.statusText}`);
  }

  return { sent: true, skipped: false as const };
}
