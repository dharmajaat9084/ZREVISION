# Worklog

---
Task ID: 1
Agent: main (Super Z)
Task: Build "StudyNest" — a personal study notebook web app with hierarchical library (subjects → chapters → topics → subtopics + custom folders), local-only storage (IndexedDB), PDF/image/text material management with Notes/Questions/Practice-Sheets separation, snapshot cropping from PDFs & images, and a spaced-repetition revision system with progress tracking. Notebook-style creative UI. No auth, no AI, no server storage.

Work Log:
- Loaded fullstack-dev skill, initialized the Next.js 16 environment (bun, Tailwind 4, shadcn/ui).
- Installed pdfjs-dist@6.3.289 and copied pdf.worker.min.mjs to public/ for client-side PDF rendering.
- Built data layer: src/lib/types.ts (StudyNode, StudyItem, ReviewItem, ReviewLogEntry, Settings), src/lib/db.ts (IndexedDB wrapper with 6 stores: nodes, items, blobs, reviews, logs, meta; blob URL cache; full dump/wipe for backup), src/lib/srs.ts (SM-2 spaced repetition engine: 4 ratings, learning steps 10m, ease/interval/lapses, interval previews, mastery levels).
- Built src/lib/store.ts (zustand): CRUD for nodes/items/reviews with cascade delete, review grading + logging, session queue management, settings, export/import backup (base64 blobs in JSON), recents.
- Notebook theme: globals.css with paper/night CSS variable palettes, paper grain texture, ruled paper, red margin line, sketchy hand-drawn border-radius, washi tape, binder holes, doodle underline, highlighter, custom ink scrollbars; layout.tsx with Caveat + Patrick Hand + Nunito fonts via next/font.
- App shell (src/components/shell/app-shell.tsx): desktop sidebar (binder holes, nav with due badge, storage meter, theme + settings), mobile top bar + bottom tab nav, framer-motion view transitions, notification reminder scheduling (once daily at reminder time while app open).
- Library: subjects home (colored notebook-cover cards with due badges), folder view (breadcrumb, subfolder cards, add chips context-aware to folder level, category tabs All/Notes/Questions/Practice Sheets, sort menu), item cards with thumbnails, revision status chips, action menus; dialogs (create node with kind + color picker, upload with multi-file + category + add-to-revision, text note editor, rename, move via tree picker, delete confirms); drag-and-drop file upload overlay.
- Item viewer: full-screen dialog with PDF iframe, zoomable image, ruled-paper text display; actions: revise now, add/remove revision, snapshot, edit, star, download, move, delete.
- Snapshot tool (snapshot-dialog.tsx): renders images or PDF pages (pdfjs) to canvas with page navigation + zoom; pointer-based crop (draw/move/resize with corner handle, dimming mask); saves cropped PNG as a new item linked to source, optionally enrolled into revision.
- Review system: revision desk (due count, due list with overdue badges, upcoming forecast), session player (item content rendered, Again/Hard/Good/Easy buttons with computed interval previews, Later postpone, progress bar, end-session confirm), session summary with rating breakdown.
- Dashboard: greeting, due-today CTA, streak/reviews/recall stat cards, 7-day forecast bar chart, continue-reading recents, subject quick jump.
- Stats: recharts bar chart (30-day revisions), rating donut, 14-day workload forecast, mastery mix bars, 17-week revision-diary heatmap, per-subject mastery table with stacked mastery bars.
- Search: live search across folder names, item names, and text-note content, with type filters and location breadcrumbs.
- Settings: day/night desk themes, browser notification permission + reminder time, daily session limit, backup export/restore (JSON), storage usage, how-it-works notes, danger-zone wipe.
- Fixed lint errors: hook ordering after early return in FolderView, static-components rule in icons, setState-in-effect in dialogs (remount pattern), excluded public/ from eslint; fixed formatInterval imports from srs instead of helpers; added Settings button to desktop sidebar (was mobile-only).

Stage Summary:
- E2E verified with agent-browser: subject→chapter creation, PDF+image upload with revision enrollment, text note creation, image crop snapshot, PDF page-2 crop snapshot ("Newton's laws — key lines"), full 5-item review session with all ratings, postpone, session summary, stats accuracy (5 revisions, 60% recall, correct mastery mix), full-text search, night theme, reload persistence, fresh-database empty states, mobile 390px layout.
- VLM visual review confirmed warm notebook aesthetic, clean uncluttered layout, no visual bugs across dashboard, library, stats, night mode, and mobile views.
- Final state: lint 0 errors/0 warnings, dev server 200, no console/page errors, all regression views pass.
