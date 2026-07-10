FIELD MEASUREMENT VERSION 4
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
