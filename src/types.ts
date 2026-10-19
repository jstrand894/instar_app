export type ProjectType = 'manuscript' | 'data' | 'field' | 'code' | 'other'
export type ProjectStatus = 'active' | 'paused' | 'done'
export type Area = 'work' | 'home'
export type Stage = 'planning' | 'drafting' | 'internal' | 'submitted' | 'revision' | 'accepted'
export type PaperStatus = 'to-read' | 'reading' | 'read' | 'unavailable'
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

export interface Project {
  id: string
  name: string
  type: ProjectType
  status: ProjectStatus
  area: Area
  pinned?: boolean
  github_repo?: string | null
  sort_order?: number | null
  stage?: Stage | null
  journal?: string
  coauthors?: string
  deadline?: string | null
  tags?: string[]
  description: string
  notes: string
  created_at: string
}
export interface ProjectEvent {
  id: string
  project_id: string
  title: string
  starts_at: string
  repeat: 'none' | 'weekly'
  created_at: string
}
export interface ProjectUpdate {
  id: string
  project_id: string
  kind: 'update' | 'note' | 'commit'
  body: string
  source_url?: string | null
  created_at: string
}
export interface Paper {
  id: string
  title: string
  authors: string
  year: string
  file_path: string | null
  status: PaperStatus
  notes: string
  doi: string
  category: string
  priority: string
  source: string
  why: string
  read_at?: string | null
  tags?: string[]
  created_at: string
}
export interface Rect { x: number; y: number; w: number; h: number }
export interface Highlight {
  id: string
  paper_id: string
  page: number
  rects: Rect[]
  text: string
  color: HighlightColor
  note: string
  created_at: string
}
export interface Stroke {
  color: string
  width: number
  points: [number, number, number][]
}
export interface InkPage { paper_id: string; page: number; strokes: Stroke[] }

export type PaperInput = Partial<Omit<Paper, 'id' | 'created_at' | 'file_path'>> & { title: string }

export interface ProjectImport {
  name: string; type: ProjectType; status: ProjectStatus; area?: Area; description: string
  entries: { kind: 'update' | 'note'; body: string; date: string }[]
}

export interface PaperLink { project_id: string; paper_id: string; created_at: string }

export interface Deadline { id: string; project_id: string; title: string; due_on: string; done: boolean; created_at: string }

export interface ProjectTask { id: string; project_id: string | null; title: string; done: boolean; due_on: string | null; done_at?: string | null; created_at: string }
export interface TimeEntry { id: string; project_id: string | null; minutes: number; started_at: string; created_at: string }

export interface Routine { id: string; title: string; notes: string; weekdays: number[]; project_id: string | null; active: boolean; created_at: string }
export interface RoutineCheck { id: string; routine_id: string; on_date: string; created_at: string }
