# Research Notebook

Personal app for Mac, iPad and iPhone (installable web app).

- **Projects**: home page of cards (manuscripts, data, field work, code) with latest updates.
- **Papers**: upload PDFs, highlight text, take notes, draw with Apple Pencil.
- **Timer**: pomodoro in the sidebar (Mac/desktop only).

## Setup
1. Supabase: SQL Editor -> paste `supabase/schema.sql` -> Run.
2. `cp .env.example .env` and fill in the project URL and anon key (Project Settings -> API).
3. `npm install && npm run dev`

Without `.env` the app runs in demo mode (data stays in this browser only).

## Backup to OneDrive
One-way mirror of everything (project timelines as Markdown, papers as PDF + Markdown notes/highlights, plus a raw JSON copy):
1. `cp scripts/backup.env.example .env.backup` and fill in the Supabase **secret** key and `BACKUP_DIR` (a folder inside your OneDrive).
2. `npm run backup`

The secret key bypasses row security. Keep it only in `.env.backup` on your Mac (git-ignored); never put it in `.env` or the app.
