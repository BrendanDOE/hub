# Resizable and sortable List columns

Install by replacing `index.html` and the complete `assets/` folder. Keep your live `data/` and `uploads/` folders.

- In Jobs → List, drag the right edge of a column heading to resize it (80–800 px). The table scrolls horizontally when needed, and rows remain compact.
- Click a heading to sort ascending; click again to sort descending. Arrows show the current order. Sorting is case-insensitive and treats numeric parts naturally, so Job 2 precedes Job 10. Empty values remain at the bottom in either direction.
- Column widths and sort order are stored per browser. Hiding and restoring a column retains its width. Overview, Status, and Schedule retain their existing order and layout.
- Keyboard: focus a heading and press Enter or Space to sort. Focus its resize handle and use Left/Right arrows (10px steps, or 20px with Shift); Home/End select minimum/maximum width. Escape cancels an active pointer resize.
- Right-click still opens the column visibility picker. Resizing does not trigger sorting, and automatic refresh pauses during resizing.

New table tests cover natural sorting, descending order, empty values, numeric IDs, saved preferences, resize boundaries, keyboard controls, cancellation, and click isolation. Jobs and drag tests also pass, as do JavaScript syntax checks. Live browser verification remains unavailable in this environment.

---

# Jobs interaction and row-height fixes

## Install

Copy `index.html` and the complete `assets/` folder from this ZIP over your current version, then reload. These include the new `assets/js/jobs-drag.js` module and updated cache URLs. Keep your live `data/` and `uploads/` folders. The files in this package were preserved unchanged from the supplied ZIP, but your local data may have changed since uploading it.

## What was fixed

- The page loaded `assets/css/style.css`, while the compact-row changes existed in SCSS and the alternative `assets/scss/css/style.css` output. The loaded CSS is now updated. Fixed-height, single-line cell content prevents long descriptions from expanding rows; open a job to read the complete details. Cells use 8px vertical padding plus a 24px content line (approximately 41px rows including the border).
- Overview and List rows open the job editor when clicked anywhere except an attachment link or another interactive control. Focus a row and press Enter or Space to edit. The subject button still works.
- Native card drags were captured by the collection manager's global native-drag guard before the Jobs drop listeners could receive them. Jobs now uses Pointer Events independently of native file imports. Cards have a movement threshold, an easing floating ghost, a highlighted landing slot, animated card displacement, edge scrolling, and an eased landing animation. Drop outside a lane or press Escape to cancel. Pointer cancellation and window blur clean up the drag. Reduced-motion preferences disable animation.
- Cards remain sorted by due date, as before. The landing slot previews that exact position; this update does not introduce manual within-column ordering.
- A successful drop updates the displayed status immediately while saving to the existing API. A failed save rolls back the displayed change and shows an error.

## Future SCSS compilation

Compile the main entrypoint into the file actually loaded by the page:

    sass assets/scss/style.scss assets/css/style.css

Configure your editor's Sass output destination accordingly. Both existing compiled CSS locations are synchronized in this package.

## Validation

JavaScript syntax checks, the Jobs logic suite, pointer-drag lifecycle tests, existing behavior tests, and mosaic tests pass. The supplied `data/` and `uploads/` contents were checked byte-for-byte against the uploaded archive. Live browser and PHP checks were unavailable in this environment; browser installation was attempted but failed. Locally verify mouse/touch dragging, persistence after reload, row clicking, and compact rows.

---

# Hub update — Dedicated Jobs JSON and demo data

## Install without replacing your saved content

1. Stop the local PHP server and make a backup of your current hub folder.
2. Copy `index.html`, all files in `assets/`, `api.php`, `jobs.php`, `history-storage.php`, and `config/tabs.json` from this update into your current hub folder. Replace those code files when prompted.
3. **Keep your current `data/` and `uploads/` folders.** The ZIP includes the original supplied data for a fresh installation, so do not overwrite newer local data with it. The app creates `data/jobs.json` automatically and migrates any jobs previously stored in `data/app.json` on the next load.
4. If you have added tabs since the supplied ZIP, merge the new Jobs entry into your current `config/tabs.json` instead of replacing that configuration.
5. From the hub folder, run `php -S 127.0.0.1:8081 -t .` and open `http://127.0.0.1:8081/`. Hard-refresh once to load the updated code.

## Dedicated jobs file

All jobs, including their details, status, revision, and attachment references, are saved to `data/jobs.json`. Uploaded attachment bytes remain in `uploads/`. The file format is an object with `schemaVersion: 1` and a `jobs` array. Create, edit, status changes, refresh, and backup all use this file through the existing storage layer.

Existing jobs inside `data/app.json` migrate automatically on the next request. If both files contain jobs, they are merged by ID, with `jobs.json` taking precedence for matching IDs. The existing shared lock and recovery journal protect the migration. Malformed JSON is rejected rather than silently replaced with an empty dataset.

## Try the 15-job demo

1. Install the updated code, including **`history-storage.php`**, then open the app once so any existing jobs migrate.
2. Stop the PHP server. Back up `data/jobs.json` if you already have real jobs.
3. Copy `demo/jobs-demo.json` to `data/jobs.json` (rename the copied file to `jobs.json`). This intentionally replaces the current jobs dataset for the demo.
4. Restart PHP and refresh the browser. All 15 demo jobs will appear in the Jobs tab.
5. To restore real jobs, stop PHP and replace `data/jobs.json` with your backup.

The demo includes five job types, all four statuses, all four priorities, varied requesters and assignees, detailed print specifications, and one unscheduled job. Due dates span 19 October–12 November 2026, with overdue, current-week, and next-month work relative to 23 October 2026. Names and work requests are fictional. Attachment lists are empty so there are no broken download links.

Added PHP storage tests cover migration, repeat reads, job edits, backup partitioning, recovery, merging, and malformed-file protection. These tests could not be executed here because PHP is unavailable; run `php tests/storage.php` locally.

## Latest refinements

- Job filters appear only in Overview. List, Status, and Schedule use the full available width and ignore the Overview filter. Search remains available in all views.
- Right-click any column heading in Overview or List to toggle visible columns. The Columns button provides the same picker on touch devices. Keyboard users can focus a heading and press Shift+F10, or use the Columns button. Escape dismisses the picker. At least one column stays visible.
- Column choices persist per browser, separately for Overview and List.
- Schedule offers Weekly and Monthly display. Previous/next controls follow the selected period, and Today resets both. The month grid starts on Monday and includes surrounding dates to complete each week. Overview retains its weekly preview.
- New logic tests cover view-specific filtering, column visibility, monthly grids, leap-day jobs, and December/January navigation. Visual browser validation remains unavailable in this environment.

## Features

- Display is available under Settings → Data → User, including private collection ownership. It follows the existing profile model; it is not a new login or permission role.
- Automatic Refresh is under Settings → Data. It defaults off and is saved per browser. Every 30 seconds it reloads shared data and recalculates tile layout while retaining the current tab, filters, and local appearance settings. It pauses while a dialog is open, a job is being dragged/saved, content is saving, or the page is hidden. Failed refreshes retry on the next interval.
- Midnight adds a very dark carbon palette, with a coordinated light-mode palette. Jobs uses existing theme tokens across every theme.
- Jobs provides Design, Print, Digital, Media, and General request buttons; Overview, List, Status, and Schedule views; All Jobs, In Progress, On Hold, and Overdue filters; and search across text details.
- Overview includes a compact table and weekly due-date schedule. List includes every job detail, timestamps, production fields, and attachment links. Status has Pending, In Progress, On Hold, and Complete lanes. Drag a card between lanes, or use its Edit button to change status by keyboard or touch.
- Schedule provides previous/next week controls, Today, and an unscheduled section. Date-only deadlines use the browser's local calendar day. Completed jobs are excluded from Overdue.
- The job editor supports requester, department, subject, description, due date, priority, assignment, location, status, and attachments. Design and Print expose artwork type, copies, finished size, paper weight, and colour.
- Attachments support PDF, images, Office documents, text, CSV, and ZIP files; at most 10 per save and 20 MB per file, subject to your PHP upload limits. Existing attachments are retained on edits. Downloads use a forced-download endpoint.
- Jobs are stored in `data/jobs.json`, separately from `data/app.json`, using the application's locked transaction storage and included in existing backups. Revision checks reject stale job updates rather than silently overwriting another browser's changes.
- Motion includes hover, modal, view-entry, and drag states, with reduced-motion support.

## Extending

Jobs is registered in `config/tabs.json`. The feature lives in `assets/js/jobs.js`, API handlers in `jobs.php`, and styling in `assets/scss/components/_jobs.scss`. Midnight lives in `assets/scss/themes/_midnight.scss`. The compiled `assets/css/style.css` is included; SCSS imports are also updated. Job types and statuses have matching client and server definitions that should be updated together.

## Validation

Passed in the build environment:

- `node --experimental-vm-modules tests/behavior.cjs`
- `node --experimental-vm-modules tests/mosaic.cjs`
- `node --experimental-vm-modules tests/jobs.cjs`
- JavaScript syntax checks for all feature modules.

PHP and browser executables were unavailable in the build environment. PHP execution, real attachment uploads, and visual/browser interaction checks still need to be verified locally:

1. Run `php -l api.php` and `php -l jobs.php`.
2. Create a Print job, attach a PDF, reload, edit it, and download the attachment.
3. Drag the job into In Progress; reload and confirm persistence. Test the Edit status selector on a phone.
4. Check each view, search, and filter. Check a past-due completed job is not counted as overdue.
5. Enable Automatic Refresh in one browser and update content in another. Confirm the first updates after 30 seconds and that an open job form retains its unsaved input.
6. Check Midnight and another theme on desktop and mobile. Confirm dialog scrolling and narrow-screen tables/boards.

Demo jobs are supplied separately in `demo/jobs-demo.json`; your supplied application data has not been replaced with demo content.
