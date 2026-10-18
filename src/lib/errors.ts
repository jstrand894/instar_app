/** An error whose message is already written for the user (shown as-is). */
export class UserError extends Error {}

const rawMessage = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : (e as { message?: string } | null)?.message ?? ''

/** Turns technical errors into short, calm sentences. */
export function friendlyError(e: unknown): string {
  if (e instanceof UserError) return e.message
  const m = rawMessage(e).toLowerCase()
  if ((typeof navigator !== 'undefined' && !navigator.onLine) || /failed to fetch|networkerror|load failed|network request failed/.test(m))
    return "Can't reach the server. Check your connection and try again."
  if (/jwt|not authenticated|invalid refresh token|auth session missing/.test(m)) return 'Your sign-in expired. Please sign in again.'
  if (/schema cache|could not find the|does not exist/.test(m)) return 'This needs a database update. Run the latest supabase/schema.sql in Supabase.'
  if (/row-level security|permission denied/.test(m)) return "You don't have permission to do that."
  if (/duplicate key|already exists/.test(m)) return 'That already exists.'
  if (/too large|exceeded the maximum|payload/.test(m)) return 'That file is too large to upload.'
  if (/rate limit|too many requests|429/.test(m)) return 'Too many requests right now. Wait a moment and try again.'
  return 'Something went wrong. Please try again.'
}

/** The original message, for the "Details" line. */
export const technicalDetail = rawMessage
