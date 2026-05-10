/**
 * Centralised app config. Pull values from env vars when available; fall
 * back to safe defaults so local dev keeps working without extra setup.
 */

/**
 * Comma-separated list of emails that get the `superviseur` role on first
 * sign-up. Add/remove a supervisor by editing the SUPERVISOR_EMAILS env
 * var in Vercel (Production + Preview) — no deploy of code needed.
 */
export const SUPERVISOR_EMAILS: string[] = (
  process.env.SUPERVISOR_EMAILS ||
  "attaimen40@gmail.com,sarl.handson@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** True if the given email is a supervisor (case-insensitive). */
export function isSupervisorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPERVISOR_EMAILS.includes(email.trim().toLowerCase());
}
