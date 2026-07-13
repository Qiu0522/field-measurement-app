Field Measurement App - Batch Project Transfer Update

Replace these files/folders in your repository:
- index.html
- app.js
- db.js
- style.css
- sw.js
- lib/jszip.min.js

New Library workflow:
1. Select
2. Select one or more projects, or select a folder to include all projects below it
3. Export Project
4. Choose whether to include original PDFs
5. Export ZIP

Import workflow:
1. Import Project
2. Choose the transfer ZIP
3. If the same projectId already exists, choose Keep Both, Overwrite, or Cancel Import

Transfer format:
- manifest.json: format field-measurement-backup, version 1, exportedAt, counts
- projects/*.json: project data, projectId, updatedAt
- pdf/*.pdf: original PDFs when included

After uploading, open the app online once so the updated service worker can cache lib/jszip.min.js for offline use.
