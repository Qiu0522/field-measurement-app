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
