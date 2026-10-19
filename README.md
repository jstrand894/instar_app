# Instar

A personal research workspace for **projects, manuscripts and reading**, made to work on a Mac, iPad and iPhone.
(An *instar* is the stage between insect molts: every project and manuscript moves through stages too.)

Built by Jackson Strand.

## What it does

**Today** (the landing page)
- A time-of-day greeting, plus a one-line summary of what is coming up
- Quick "log an update" box for any project or manuscript
- **Your progress**: a weekly chart (last 10 weeks) of papers read, project activity and manuscript activity, with meters for Core papers read, tasks done and manuscripts by stage
- **Weekly routine**: things you do on the same weekdays every week (grading, check-ins, planning). Today shows the right day's items with check boxes, anything still open from the last three days, and what is coming up. Includes a one-click teaching-week example
- Your schedule for today and the next week
- **To-dos**: tasks from every project, plus general to-dos that are not tied to a project, soonest first
- **Focus time** from the Pomodoro timer: this week's total, a 7-day chart and a per-project breakdown
- Deadlines (manuscript deadlines and standalone ones; use **+** to add one for any project or manuscript)
- Needs attention: active projects with no update in two weeks
- Papers you are reading now, and recent activity across everything

**Projects**
- Cards for data, field work, code and other projects, each with its latest updates
- **Work / Home** switch at the top; each project belongs to one side
- Pin projects to the top, drag the handle to reorder, collapsible **Completed** section
- On wide screens a project opens in two columns: the timeline and add-update box on the left, and the schedule, tasks, deadlines, focus time and reading on the right
- Each project opens to a **timeline** of dated updates and editable note boxes, a **task list** (add, check off, edit, delete with undo), **tags**, **focus time**, a **schedule** (one-off or weekly meetings that also show on the card), **deadlines**, and a **Reading** list of linked papers

**Manuscripts** (separate from projects)
- Stage tracker: Planning, Drafting, Internal review, Under review, Revision, Accepted, as a **drag-and-drop board** (drag a card to a new stage; the move is logged to its timeline) or a grouped list
- Journal, co-authors and a deadline with an overdue / due-soon chip; stage changes are logged to the timeline automatically
- Shows linked papers and the next scheduled meeting on each card

**Reading**
- Upload PDFs and read them in the built-in reader: select text to **highlight** (four colors), attach notes to highlights, keep notes per paper, and draw with **Apple Pencil** (or mouse) on any page
- **Recommended next read**, based on your priorities, linked projects and manuscripts, and what you read last
- Stats (read this week / month / year / all time, Core papers progress) and a **word cloud** of the titles you have read
- Import a reading list from an Excel file, add papers **by DOI** (autofill from Crossref), or bulk **find missing DOIs**
- Papers can exist before you have the PDF; attach it later
- Link papers to projects and manuscripts, tag them, and filter the library by project or tag

**Everywhere in the app**
- **Search and jump**: press `⌘K` (or `/`) to search projects, manuscripts, papers, tasks, deadlines, notes and highlights, or to run commands (new update, toggle dark mode, go to a section). Results are grouped and you can use the arrow keys
- **Floating + button** (or press `N`) on every screen: add an update, note, task, deadline or a paper by DOI without leaving what you are doing. It remembers your last project and, on a project page, defaults to that project
- **Undo instead of "Are you sure?"**: deleting hides the item right away and offers **Undo** for a few seconds before it is really removed
- **Tags and links between notes**: type `#tag` in a note, or add tags to projects and papers, and filter by them. Type `[[` to link another project or paper, with suggestions as you type. Linked items show a **Mentioned in** list
- **Sync indicator** in the sidebar: Saving, Saved, Offline or "Couldn't save", with calm, plain-language error messages (technical details are one click away)
- **Welcome tour** the first time you open it (replay it from Account), and friendly empty states with a get-started checklist

**Account menu**
- Theme (system / light / dark), accent color, your name, Pomodoro lengths, About, Sign out
- These are saved per device, so each device can look different

**Pomodoro timer**: lives at the bottom of the sidebar on devices with a mouse or trackpad (hidden on touch-only iPads and iPhones), with a progress ring, a compact version when the sidebar is collapsed, and a notification and chime when a session ends.

**Sidebar**: on a Mac it collapses to a slim icon strip and slides open on hover (or keyboard focus); pin it open from the sidebar. Touch devices start pinned. On phones it becomes a bottom tab bar.

## Tech

React 19 + TypeScript + Vite, [Supabase](https://supabase.com) (Postgres, Auth, Storage), [PDF.js](https://mozilla.github.io/pdf.js/) for the reader, [dnd-kit](https://dndkit.com) for drag-to-reorder, [Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) for DOI lookups. It is a web app (installable to the home screen), not a native app.

## Getting started

You need Node 20+ and a free Supabase project.

1. **Create the database.** In Supabase, open *SQL Editor → New query*, paste all of [`supabase/schema.sql`](supabase/schema.sql) and run it. It creates the tables, row-level security (each row is only visible to its owner) and a private storage bucket for PDFs. It is safe to run again later when new versions add tables.
2. **Turn on sign-in.** *Authentication → Providers*: email works out of the box; for GitHub sign-in add a GitHub OAuth app and paste its client ID and secret. Under *Authentication → URL Configuration* add your app's address (for example `http://localhost:5173`) to **Redirect URLs**. Use exact addresses, not wildcards.
3. **Add your keys.**
   ```bash
   cp .env.example .env
   ```
   Fill in the project URL and the **publishable** key (`sb_publishable_…`, under *Project Settings → API Keys*). Never put the secret key in this file.
4. **Run it.**
   ```bash
   npm install
   npm run dev
   ```
   Open the address it prints, create an account, and you are in.

Without a `.env` the app starts in **demo mode**: data is stored only in that browser, so you can try everything before connecting Supabase.

### Hosting on GitHub Pages (use it on iPad and iPhone)

`localhost` only works on the computer running it. This repo includes a workflow (`.github/workflows/deploy.yml`) that builds the site and publishes it to GitHub Pages every time you push to `main`. Your data stays in Supabase, so the site itself holds nothing private.

1. **Make the repo public** (*Settings → General → Danger Zone → Change visibility*). GitHub Pages needs a public repo on the free plan.
2. **Turn on Pages:** *Settings → Pages → Build and deployment → Source: GitHub Actions*.
3. **Add your two public keys:** *Settings → Secrets and variables → Actions → Variables → New repository variable*: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the project URL and the **publishable** key, the same values as in `.env`). They are baked in at build time; the publishable key is meant to be in the browser.
4. **Deploy:** push to `main` (or *Actions → Deploy to GitHub Pages → Run workflow*). The site appears at `https://<your-username>.github.io/<repo-name>/`.
5. **Allow the address in Supabase:** *Authentication → URL Configuration*: set **Site URL** to that address and add it to **Redirect URLs** (keep `http://localhost:5173` for development).
6. **Optional, recommended:** after you have created your account, turn off *Allow new users to sign up* (*Authentication → Sign In / Providers*) so the public address cannot be used to create other accounts.
7. **On iPad / iPhone:** open the address in Safari, then *Share → Add to Home Screen*. Sign in inside the home-screen app. If GitHub sign-in misbehaves there, use email and password.

Any other static host (Vercel, Cloudflare Pages, Netlify) works too: build with `npm run build`, publish `dist/`, and set the same two environment variables.

## Connect GitHub (pushes show up as updates)

Pick a repo on a project's page and every push to a branch adds an entry to its timeline: the branch, the commit messages and a link to the diff. This uses a **GitHub App** you create once for your own account, plus two small Supabase functions. After that, adding a repo is just choosing it from a list.

**One-time setup**

1. Run the new lines at the bottom of [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor.
2. Make a random secret (`openssl rand -hex 32`). It signs webhooks from GitHub.
3. On GitHub: *Settings → Developer settings → GitHub Apps → New GitHub App*.
   - Name: anything unique (e.g. `instar-yourname`). Homepage URL: any URL (your site is fine).
   - Webhook: **Active**, URL `https://<project-ref>.supabase.co/functions/v1/github-webhook`, Secret: the string from step 2.
   - Repository permissions: **Contents: Read-only** (Metadata is added automatically).
   - Subscribe to events: **Push**.
   - Where can it be installed: **Only on this account**. Click *Create GitHub App*.
4. On the App's page note the **App ID**, then *Generate a private key* (a `.pem` file downloads).
5. Click *Install App* in the sidebar and choose **All repositories** or only the ones you want.
6. Set the secrets and deploy (use `npx supabase@latest` if you don't have the CLI installed):

   ```bash
   supabase secrets set GITHUB_WEBHOOK_SECRET=<the string from step 2>
   supabase secrets set GITHUB_APP_ID=<the App ID>
   supabase secrets set GITHUB_APP_PRIVATE_KEY="$(cat path/to/your-key.pem)"
   supabase secrets set GITHUB_OWNER_EMAILS=<the email you sign in with>
   supabase functions deploy github-webhook --no-verify-jwt
   supabase functions deploy github-repos
   ```

   `github-webhook` is deployed without a Supabase login because GitHub can't send one; it checks GitHub's signature instead. `github-repos` requires you to be signed in, and both functions only act for the emails in `GITHUB_OWNER_EMAILS`, so nobody else who signs up can see your repos or read your commit messages.

**Using it:** open a project, choose a repo under *Connect a GitHub repo*. Repos the App isn't installed on don't appear; the *Add more repos* link takes you to GitHub to add them. Re-delivered pushes are ignored, and tag pushes and branch deletions are skipped.

Prefer no App? A plain per-repo webhook also works: *Settings → Webhooks* on the repo, same URL and secret, content type `application/json`, push events only. Type the repo name by hand in the app.

## Importing your data

**Reading list (Excel).** On the Reading page choose *Import reading list* and pick an `.xlsx` file. The first row must have headers (case-insensitive): `Title` (required), and optionally `Read`, `doi`, `Category`, `Priority`, `Authors`, `Year`, `Source`, `Why it matters`. In the `Read` column any mark means read, `unavailable` marks the paper unavailable, and blank means to-read. Papers already in your library (same DOI, or same title and year) are skipped, so re-importing is safe.

**Project history (JSON).** On the Projects page choose *Import history* and pick a file shaped like:

```json
{
  "version": 1,
  "projects": [
    {
      "name": "Soil carbon manuscript",
      "type": "manuscript",
      "status": "active",
      "area": "work",
      "description": "Short description",
      "entries": [
        { "kind": "update", "body": "Redrew Figure 3", "date": "2026-10-15T12:00:00-06:00" },
        { "kind": "note", "body": "A longer note", "date": "2026-10-16T09:30:00-06:00" }
      ]
    }
  ]
}
```

`type` is one of `manuscript`, `data`, `field`, `code`, `other`. Existing projects (matched by name) are not duplicated.

## Backup to a OneDrive (or any) folder

A one-way mirror of everything in readable files: a Markdown file per project (timeline, tasks, focus time, schedule, deadlines, tags, linked papers), each paper as a PDF plus a Markdown file with its notes and highlights, a `Reading List.csv`, and a full raw JSON copy.

1. `cp scripts/backup.env.example .env.backup`
2. In it, set `SUPABASE_SECRET_KEY` (*Project Settings → API Keys → secret key*) and `BACKUP_DIR` (a folder inside your OneDrive, Dropbox, iCloud Drive or similar). The sync app on your computer does the uploading; the script never talks to those services.
3. `npm run backup`

The secret key bypasses row-level security. Keep it only in `.env.backup` (git-ignored) on your own computer and never in `.env` or the app. The script reads **all** rows, so it is meant for a single-user setup.

## Keyboard shortcuts

| Keys | What it does |
|---|---|
| `⌘K` or `/` | Search and jump (Ctrl+K on Windows) |
| `N` | Quick add (update, note, task, deadline or paper) |
| `⌘↵` | Save in the quick-add sheet and in the note box |
| `Esc` | Close a sheet, the search or the tour |

## Project layout

```
src/
  pages/        Today, Projects (Home), Manuscripts, ProjectDetail, Library (Reading), Reader
                (all but Today load on demand, so the first screen is fast)
  components/   CommandPalette, QuickCapture, TaskList, ProgressChart, Tour, Toasts, SyncStatus,
                Account, Auth, Logo, Pomodoro, ReadingDashboard, PageView (PDF page + ink), ...
  lib/          store (Supabase or demo storage), notify (toasts and undo), sync, errors,
                links (tags and [[links]]), crossref, reading, manuscript, readingList, prefs, util
supabase/schema.sql      tables, security rules, storage bucket
scripts/backup.mjs       the backup script
public/                  icons and web app manifest
```

Data lives in these tables: `projects`, `project_updates` (updates and notes), `project_events` (schedule), `project_deadlines`, `project_tasks` (a task may have no project), `routines` and `routine_checks` (weekly routine), `time_entries` (focus time), `project_papers` (links), `papers`, `highlights` and `ink`. PDFs are in the private `papers` storage bucket under a folder named for your user id.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run lint` | Run the linter |
| `npm run backup` | Mirror your data to the folder in `.env.backup` |

## Notes

- Highlights are stored in the app, not inside the PDF files, so your original PDFs are never modified.
- The browser only sends your **publishable** key; what each signed-in user can see is enforced by row-level security in the database.
- Appearance, accent color, name and timer lengths are stored in the browser on each device.
