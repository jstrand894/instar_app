// This is a personal workspace, but Supabase sign-ups may be open. Only the emails in GITHUB_OWNER_EMAILS
// (comma separated) may see the GitHub repo list or have pushes logged, so nobody else can point a
// project at your repo name and read your commit messages.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const ownerEmails = (): string[] => (Deno.env.get('GITHUB_OWNER_EMAILS') ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

export async function isOwnerId(db: SupabaseClient, userId: string): Promise<boolean> {
  const allowed = ownerEmails()
  if (!allowed.length) return false
  const { data } = await db.auth.admin.getUserById(userId)
  return !!data.user?.email && allowed.includes(data.user.email.toLowerCase())
}
