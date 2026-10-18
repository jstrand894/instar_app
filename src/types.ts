export type ProjectType = 'manuscript' | 'data' | 'field' | 'code' | 'other'
export type ProjectStatus = 'active' | 'paused' | 'done'
export type PaperStatus = 'to-read' | 'reading' | 'read'
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

export interface Project {
  id: string
  name: string
  type: ProjectType
  status: ProjectStatus
  description: string
  created_at: string
}
export interface ProjectUpdate {
  id: string
  project_id: string
  body: string
  created_at: string
}
export interface Paper {
  id: string
  title: string
  authors: string
  year: string
  file_path: string
  status: PaperStatus
  notes: string
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
