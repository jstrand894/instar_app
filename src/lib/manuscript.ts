import type { Stage } from '../types'

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'planning', label: 'Planning', hint: 'Idea, outline, analysis underway' },
  { id: 'drafting', label: 'Drafting', hint: 'Writing the manuscript' },
  { id: 'internal', label: 'Internal review', hint: 'With co-authors or advisor' },
  { id: 'submitted', label: 'Under review', hint: 'Submitted to a journal' },
  { id: 'revision', label: 'Revision', hint: 'Responding to reviewers' },
  { id: 'accepted', label: 'Accepted / published', hint: 'Done' },
]
export const stageLabel = (s?: Stage | null) => STAGES.find(x => x.id === (s ?? 'drafting'))?.label ?? 'Drafting'

/** Describes a deadline relative to today; tone drives the chip color. */
export function deadlineInfo(date?: string | null): { text: string; tone: 'overdue' | 'soon' | 'ok'; days: number } | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(y, m - 1, d); const now = new Date()
  const days = Math.round((target.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 864e5)
  const when = target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (days < 0) return { text: `Overdue ${-days}d · ${when}`, tone: 'overdue', days }
  if (days === 0) return { text: `Due today`, tone: 'soon', days }
  if (days === 1) return { text: `Due tomorrow`, tone: 'soon', days }
  return { text: `Due ${when} · ${days}d`, tone: days <= 7 ? 'soon' : 'ok', days }
}
