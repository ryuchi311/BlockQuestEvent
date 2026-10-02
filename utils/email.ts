// Utility to send email notifications via configured SMTP or Email Provider (Resend, SendGrid, etc.)
// Also falls back gracefully or logs if no API key is set.

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmailNotification({
  to,
  subject,
  html,
  text,
}: SendEmailParams): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const cleanEmail = to?.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Invalid recipient email address" };
  }

  // 1. Resend API support (popular in Next.js/Vercel/Cloudflare setups)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.EMAIL_FROM || "BlockQuest Fiesta PH <support@chiprojects.com>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [cleanEmail],
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, " "),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.warn("Resend email failed:", errorData);
        return { success: false, error: errorData?.message || "Failed to deliver email through Resend." };
      }
      return { success: true };
    } catch (err: any) {
      console.warn("Resend email transport exception:", err);
      return { success: false, error: err.message };
    }
  }

  // 2. Generic Webhook / Mailgun / Custom HTTP Email endpoint support if configured
  const emailWebhookUrl = process.env.EMAIL_WEBHOOK_URL;
  if (emailWebhookUrl) {
    try {
      const res = await fetch(emailWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: cleanEmail,
          subject,
          html,
          text,
          timestamp: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        return { success: true };
      }
    } catch (err: any) {
      console.warn("Custom email webhook error:", err);
    }
  }

  // If no email API is configured in the environment, we log it without breaking the request
  console.info(`[Email Service Notice] Email would be sent to ${cleanEmail}: "${subject}". (To enable automatic delivery, add RESEND_API_KEY or EMAIL_WEBHOOK_URL to your environment variables).`);
  return { success: true, skipped: true };
}
