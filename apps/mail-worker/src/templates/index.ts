import type { InviteEvent, OtpEmailData } from '@quiz/messaging';
import type { OutgoingEmail } from '../transport';

// Minimal HTML escaping for values interpolated into email bodies.
// Coerces first so a typed-but-absent/non-string field can never throw here
// (a throw would be misclassified as a transient failure and wastefully retried).
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <h2 style="margin: 0 0 16px;">${esc(heading)}</h2>
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="font-size: 12px; color: #888;">Quiz Platform</p>
  </body>
</html>`;
}

/** Invite email — built from the InviteEvent on quiz.invites.dispatch. */
export function renderInvite(event: InviteEvent): OutgoingEmail {
  const subject = `You're invited to "${event.quizTitle}"`;
  const start = new Date(event.startTime);
  const startLabel = Number.isNaN(start.getTime()) ? event.startTime : start.toUTCString();

  const html = layout(`You're invited, ${esc(event.name)}!`, `
    <p>You've been invited to take part in the quiz <strong>${esc(event.quizTitle)}</strong>.</p>
    <p>It starts at <strong>${esc(startLabel)}</strong>.</p>
    <p>
      <a href="${esc(event.joinLink)}"
         style="display:inline-block; background:#4f46e5; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">
        Join the quiz
      </a>
    </p>
    <p style="font-size: 13px; color: #555;">Or paste this link into your browser:<br />${esc(event.joinLink)}</p>
  `);

  const text = [
    `You're invited, ${event.name}!`,
    ``,
    `You've been invited to take part in the quiz "${event.quizTitle}".`,
    `It starts at ${startLabel}.`,
    ``,
    `Join the quiz: ${event.joinLink}`,
  ].join('\n');

  return { to: event.to, subject, html, text };
}

/** OTP email — built from an EmailJob with template 'otp'. */
export function renderOtp(to: string, data: OtpEmailData): OutgoingEmail {
  const subject = data.quizTitle
    ? `Your code for "${data.quizTitle}": ${data.code}`
    : `Your verification code: ${data.code}`;
  const expiry = data.expiresInMinutes
    ? `<p>This code expires in ${data.expiresInMinutes} minute(s).</p>`
    : '';

  const html = layout('Your verification code', `
    <p>Use this code to continue:</p>
    <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${esc(data.code)}</p>
    ${expiry}
    <p style="font-size: 13px; color: #555;">If you didn't request this, you can ignore this email.</p>
  `);

  const text = [
    `Your verification code: ${data.code}`,
    data.expiresInMinutes ? `This code expires in ${data.expiresInMinutes} minute(s).` : '',
    ``,
    `If you didn't request this, you can ignore this email.`,
  ].filter(Boolean).join('\n');

  return { to, subject, html, text };
}
