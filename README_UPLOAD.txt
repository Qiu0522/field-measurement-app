FIELD MEASUREMENT VERSION 6.6

VERSION 6.8 — EXPORT JSON, PDF LABEL DEFAULT, FIND POINT BY LABEL, MOVE TO FOLDER
- Export menu now includes Export JSON alongside Export CSV and Export PDF.
  It writes the same points/side/seq/measurement data as CSV, grouped by
  Data Type, as a downloadable .json file.
- PDF export now always burns in the measurement value on each point label,
  regardless of whether "Show Order Labels" is currently toggled on in the
  workspace view. The on-screen toggle still works for live viewing; it just
  no longer changes what gets exported to PDF.
- Review ("Preview CSV") sidebar has a new search box: type a label (e.g. N3)
  or a measurement value to filter the list live, or press Enter to jump
  straight to the first match and flash it on the drawing.
- Library: added "Move to Folder…" to the file/folder ⋯ menu. Lets you move
  an existing work file or folder into any other folder (including newly
  created ones) without drag-and-drop, which does not work reliably on
  iPad/Safari. A folder cannot be moved into itself or one of its own
  subfolders.
- No changes to saved project/folder data structure — existing work files
  open exactly as before.
- sw.js CACHE_VERSION bumped to v1-v2-12 so installed iPads pick up this
  update on their next online launch.

VERSION 6.7 — TOOLBAR, ICONS, AND COLOUR SYSTEM
- First row: Library and project name on the left; Zoom, Fit, Undo, Redo, Save, and Export on the right.
- Second row: Data Type, Point, Lock, Order, Batch Side, Labels, and the Markup dropdown.
- Replaced mixed emoji controls with consistent line icons.
- Added a professional cool-gray and engineering-blue colour system; Save remains green.
- Fit now calculates a best-fit zoom for the visible workspace.

VERSION 6.6.1 — COLLAPSIBLE MARKUP MENU
- Text, Highlighter, Eraser, Color, and Size are grouped inside Markup.
- Selecting a tool closes the panel and the Markup button shows the active tool.
- Color and size choices keep the panel open for quicker adjustment.

VERSION 6.6 — TEXT + MISSING VALUE
- Removed Pen and added a Text tool with small, medium, and large sizes.
- Text uses the selected annotation colour, supports Undo/Redo, saves with the project, and exports to PDF.
- Added an X button beside SPACE for missing measurements. X uses the current Data Type colour and exports to CSV normally.
- Highlighter and Eraser remain available.
- Service-worker cache version bumped so deployed devices receive the update.

PREVIOUS VERSION HISTORY
================================

UPLOAD THESE FILES TO THE SAME GITHUB FOLDER:

1. index.html
2. style.css
3. db.js
4. workspace.js
5. app.js
6. manifest.json

IMPORTANT:
- All six files must be in the same folder.
- Do not rename the JavaScript or CSS files.
- The main page must be named exactly: index.html
- GitHub Pages should publish from the branch and / (root) folder containing these files.

HOW TO UPLOAD:
1. Open your GitHub repository.
2. Switch to the branch you want to use.
3. Click Add file > Upload files.
4. Drag all six files into the upload box.
5. If an older index.html exists, GitHub will replace it after you commit.
6. Click Commit changes.
7. Wait for GitHub Pages to redeploy.
8. Hard refresh the website.

HOW VERSION 4 WORKS:
- Home page lists every work file.
- + New Work File can import a PDF or create a blank drawing.
- Click a project card to continue previous work.
- Press Library to return to the home page.
- Changes auto-save in IndexedDB on the same device/browser.
- PDF data itself is stored locally, so reopening the project does not require reselecting the PDF.
- Rename, Duplicate, and Delete are available from the three-dot menu.

IMPORTANT DATA WARNING:
IndexedDB data belongs to that browser/device.
Clearing Safari website data can delete locally saved projects.
A future version should add Project Export/Import backup files before company-wide use.


UPDATE IN THIS BUILD
- New large iPad measurement keypad.
- Space is shown as "_" while typing, but saved/exported as a real space.
- Large number buttons, /, negative sign, backspace, clear, Space, Cancel, and OK.
- Moving a measurement temporarily locks drawing scroll/pan so the page does not move.


VERSION 4.2 CHANGES
- Removed Tower and Floor fields from New Work File.
- Added nested New Folder support.
- Open a folder, then use New File to add PDF/blank work files inside it.
- PDF data is stored separately from project state, greatly reducing autosave size.
- Comment canvas is encoded only after drawing, not during every save.
- Scrolling no longer triggers repeated database saves.
- Autosave batches rapid edits for 1.6 seconds.
- Library return waits only for a small final save and should be much faster.


VERSION 4.2.1 SAVE FIX
- Serializes IndexedDB writes to prevent overlapping autosaves.
- Saves imported PDF data only once instead of rewriting it on every autosave.
- Adds compatibility for older projects that stored PDF data inside the project record.
- Shows a useful reason when saving fails.
- Allows returning to Library after a failed save, with a warning.
- Important after upload: close all older tabs/windows of the app, then reopen it.


VERSION 5 — MANUAL SAVE + SAFETY SAVE

SAVE BEHAVIOR
- Editing only changes the status to "Unsaved".
- Press the large Save button whenever needed.
- A safety save runs every 3 minutes only when changes exist.
- Returning to Library saves first if there are unsaved changes.
- Cmd+S / Ctrl+S also saves.
- Closing the browser with unsaved changes shows a warning.
- No database write occurs after every point, movement, or drawing action.

FILES TO UPLOAD
- index.html
- style.css
- db.js
- save.js
- workspace.js
- app.js
- manifest.json

All files must be in the repository root.


VERSION 5.1 UI FIXES
- Added 0 to the measurement keypad.
- Added /4, /8, and /16 denominator buttons.
  Example: tap 3, then /8, to create 3/8.
- Added Zoom Out, zoom percentage, and Zoom In controls to the workspace toolbar.
- Zoom buttons keep the visible area approximately centered.
- Renamed the Library folder navigation button from Up to Back.


VERSION 6 KEYBOARD
- Finalized compact 4-column keypad layout:
  7 8 9 ⌫
  4 5 6 /4
  1 2 3 /8
  0 / − /16
- Removed Clear.
- SPACE is full-width and light blue.
- OK is green.
- Cancel is neutral gray.
- Fraction buttons are visually grouped on the right.


VERSION 6.1 PDF EXPORT FIX
- Replaced webpage screenshot export with direct canvas composition.
- Prevents blank PDFs on iPad caused by oversized html2canvas rendering.
- Export is independent of current zoom.
- Includes the PDF/image background, pen comments, and measurement labels.
- Automatically reduces output resolution only when required by older iPad canvas limits.


VERSION 6.1.1 STARTUP FIX
- Fixed a JavaScript syntax error in workspace.js.
- The syntax error stopped all startup scripts, so New Folder and New File did nothing.
- Keeps the Version 6 keyboard, zoom controls, manual save, folders, and Version 6.1 PDF export fix.


VERSION 6.2 — OFFLINE + BACKUP/RESTORE

NEW FILE TO UPLOAD
- sw.js  (service worker; required for offline use)

FULL FILE LIST FOR THIS VERSION (all in the repository root):
- index.html
- style.css
- db.js
- save.js
- workspace.js
- app.js
- manifest.json
- sw.js   <-- NEW

OFFLINE USE
- The app now installs a service worker that caches the app and the
  pdf.js / html2pdf libraries.
- Load the app online once with signal. After that it opens and runs
  with no signal on the job site, including importing PDFs and exporting.
- The very first launch on a new device still needs signal once.

BACKUP (protects against lost data)
- Press Backup on the home screen to download one .json file containing
  every folder, work file, and PDF drawing on this device.
- Email it to yourself or save it to a cloud drive / another device.
- Do this regularly, and before clearing Safari data or switching devices.

RESTORE
- Press Restore and choose a backup .json file.
- Merge: keeps what is already on the device and adds/updates from the backup.
- Replace All: wipes the device first, then loads only the backup
  (tap the red button twice to confirm).

DEPLOY NOTE FOR FUTURE UPDATES
- When you upload new app files, open sw.js and change CACHE_VERSION
  (for example v6-2 -> v6-3). This clears old cached copies so every
  device picks up the new version on the next launch.


VERSION 6.3 — ORDERING, INPUT CHECK, AND UI FIXES

SMARTER POINT ORDERING
- Ordering now walks the perimeter by angle around the centre of the points,
  instead of measuring distance to a bounding box.
- This stays correct when the drawing is rotated/skewed or the outline is
  irregular (for example L-shaped), which the old method could get wrong.
- The output is unchanged in shape: points are still grouped by N/E/S/W with
  each side numbered from 1, so CSV columns and on-drawing labels look the same.
- Manual "Assign Side" still overrides the automatic guess.

MEASUREMENT INPUT IS NOW CHECKED
- Pressing OK checks the format before saving.
- Valid examples: 26, 26 3/8, -12 1/2, 3/16.
- Junk like //, 3/8/16, or 3/0 is rejected with a message; the keypad stays
  open so you can fix it. This keeps bad values out of the CSV.

NO MORE POP-UP TEXT BOXES FOR ORDERING/EXPORT
- Choosing clockwise/counterclockwise now uses on-screen buttons.
- CSV and PDF file names now use a proper dialog with a text box.
- These replace the old prompt() boxes, which iOS can disable when the app
  is added to the Home Screen.

MULTI-TAB / MULTI-WINDOW WARNING
- If the app is open in more than one tab or window, a yellow banner warns
  you to keep only one open, which avoids overlapping saves.
- A banner also appears if another tab reloads the app with new files.

STORAGE WARNING
- If the device is almost out of website storage, a banner suggests making a
  Backup and deleting unused work files, before a save actually fails.

FILES CHANGED IN 6.3: index.html, style.css, db.js, workspace.js, app.js, sw.js
(save.js and manifest.json are unchanged, but upload all 8 files together.)

REMINDER: sw.js CACHE_VERSION was bumped to v6-3 so every device picks up
this update on its next online launch.


VERSION 6.3.1 — ORDERING START-CORNER FIX
- Fixed each side starting its numbering from the MIDDLE of the side.
- Now each side is numbered continuously from its corner:
  clockwise starts at the top-left, counter-clockwise at the top-right.
- Axis-aligned drawings now match the original behaviour exactly, plus the
  rotation robustness added in 6.3.
- Only workspace.js and sw.js changed since 6.3.
- sw.js CACHE_VERSION bumped to v6-3-1.


VERSION 6.4 — ORDERING REVERTED + MANUAL ADJUSTMENTS

ORDERING
- Reverted to the original bounding-box ordering (the version you preferred).
- The rotated-drawing (centroid-angle) experiment was removed.

MANUAL SEQUENCE ADJUSTMENTS (long-press a point to open its menu)
- "↑ Move Up in Order" / "↓ Move Down in Order":
  swaps a point with its neighbour within the same side. Use it to fix two
  close points that ordered the wrong way round.
- "Reorder Side by Tapping":
  a blue bar appears; tap the points on that side one by one in the order you
  want. Numbering follows your taps. It finishes automatically after the last
  point, or press Cancel to abort.

HOW MANUAL AND AUTOMATIC INTERACT
- The first manual adjustment puts that data type into MANUAL mode; the CSV and
  the on-drawing labels then follow the manual order (geometry no longer
  overrides it).
- New points added in manual mode are appended to the end of their side.
- Pressing "Order Current Data" again clears manual mode and returns to fully
  automatic ordering (treat it as a "reset to automatic" button).
- Assign Side is unchanged and still overrides which side a point belongs to.

NOTE: Move Up/Down and tap-reorder are not covered by Undo yet; press the
opposite action or re-run Order Current Data to revert.

FILES CHANGED IN 6.4: index.html, style.css, workspace.js, sw.js
sw.js CACHE_VERSION bumped to v6-4.


VERSION 6.5 — UNDO FOR MANUAL ORDER + LABEL STYLING

UNDO / REDO NOW COVER MANUAL ORDERING
- "Move Up/Down in Order" and "Reorder Side by Tapping" can now be undone and
  redone with the normal Undo (⟲) / Redo (⟳) buttons.
- Undo also restores automatic mode if the adjustment was the first manual
  change, so undoing returns you exactly to the automatic order.

MEASUREMENT LABEL STYLING
- On-drawing measurement labels now have a white outline so they stay readable
  over dark or busy drawings.
- Font changed to a lighter (thinner) Arial. Size is unchanged.
- The exported PDF uses the same white-outlined, thinner labels.

FILES CHANGED IN 6.5: style.css, workspace.js, sw.js
sw.js CACHE_VERSION bumped to v6-5.
