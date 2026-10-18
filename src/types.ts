export type ProjectType = 'manuscript' | 'data' | 'field' | 'code' | 'other'
export type ProjectStatus = 'active' | 'paused' | 'done'
export type PaperStatus = 'to-read' | 'reading' | 'read' | 'unavailable'
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

export interface Project {
  id: string
  name: string
  type: ProjectType
  status: ProjectStatus
  description: string
  notes: string
  created_at: string
}
export interface ProjectUpdate {
  id: string
  project_id: string
  kind: 'update' | 'note'
  body: string
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
  name: string; type: ProjectType; status: ProjectStatus; description: string
  entries: { kind: 'update' | 'note'; body: string; date: string }[]
}
