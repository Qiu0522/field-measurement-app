"use strict";

const App = (() => {
  let projects = [];
  let folders = [];

  let currentFolderId = null;
  let currentMenuItem = null;
  let pendingRename = null;

  let pendingProjectKind = null;
  let pendingPdfData = null;

  let pendingBackup = null;
  let replaceArmed = false;

  let selectionMode = false;
  const selectedTransferItems = new Set();
  let pendingConflictResolve = null;

  const els = {};

  function init() {
    els.homeView = document.getElementById("homeView");
    els.workspaceView = document.getElementById("workspaceView");

    els.newFolderBtn = document.getElementById("newFolderBtn");
    els.newProjectBtn = document.getElementById("newProjectBtn");
    els.newProjectMenu = document.getElementById("newProjectMenu");
    els.importPdfChoice = document.getElementById("importPdfChoice");
    els.blankChoice = document.getElementById("blankChoice");

    els.backupBtn = document.getElementById("backupBtn");
    els.restoreBtn = document.getElementById("restoreBtn");
    els.restoreFileInput = document.getElementById("restoreFileInput");
    els.restoreModal = document.getElementById("restoreModal");
    els.restoreSummary = document.getElementById("restoreSummary");
    els.restoreMergeBtn = document.getElementById("restoreMergeBtn");
    els.restoreReplaceBtn = document.getElementById("restoreReplaceBtn");
    els.cancelRestoreBtn = document.getElementById("cancelRestoreBtn");

    els.appBanner = document.getElementById("appBanner");
    els.appBannerText = document.getElementById("appBannerText");
    els.appBannerClose = document.getElementById("appBannerClose");

    els.upFolderBtn = document.getElementById("upFolderBtn");
    els.folderBreadcrumb = document.getElementById("folderBreadcrumb");
    els.projectSearch = document.getElementById("projectSearch");
    els.libraryGrid = document.getElementById("libraryGrid");
    els.emptyLibrary = document.getElementById("emptyLibrary");

    els.libraryContextMenu = document.getElementById("libraryContextMenu");
    els.renameLibraryAction = document.getElementById("renameLibraryAction");
    els.duplicateLibraryAction = document.getElementById("duplicateLibraryAction");
    els.deleteLibraryAction = document.getElementById("deleteLibraryAction");
    els.exportFileAction = document.getElementById("exportFileAction");
    els.importFileBtn = document.getElementById("importFileBtn");
    els.importFileInput = document.getElementById("importFileInput");
    els.selectProjectsBtn = document.getElementById("selectProjectsBtn");
    els.exportProjectsBtn = document.getElementById("exportProjectsBtn");
    els.cancelSelectionBtn = document.getElementById("cancelSelectionBtn");
    els.transferExportModal = document.getElementById("transferExportModal");
    els.transferExportSummary = document.getElementById("transferExportSummary");
    els.includePdfCheckbox = document.getElementById("includePdfCheckbox");
    els.cancelTransferExportBtn = document.getElementById("cancelTransferExportBtn");
    els.confirmTransferExportBtn = document.getElementById("confirmTransferExportBtn");
    els.transferConflictModal = document.getElementById("transferConflictModal");
    els.transferConflictSummary = document.getElementById("transferConflictSummary");
    els.existingProjectTime = document.getElementById("existingProjectTime");
    els.incomingProjectTime = document.getElementById("incomingProjectTime");
    els.keepBothConflictBtn = document.getElementById("keepBothConflictBtn");
    els.overwriteConflictBtn = document.getElementById("overwriteConflictBtn");
    els.cancelConflictBtn = document.getElementById("cancelConflictBtn");
    els.backupStatus = document.getElementById("backupStatus");
    els.renameModal = document.getElementById("renameModal");
    els.renameModalTitle = document.getElementById("renameModalTitle");
    els.renameInput = document.getElementById("renameInput");
    els.cancelRenameBtn = document.getElementById("cancelRenameBtn");
    els.confirmRenameBtn = document.getElementById("confirmRenameBtn");

    els.folderModal = document.getElementById("folderModal");
    els.folderNameInput = document.getElementById("folderNameInput");
    els.cancelFolderModal = document.getElementById("cancelFolderModal");
    els.confirmFolderModal = document.getElementById("confirmFolderModal");

    els.projectModal = document.getElementById("projectModal");
    els.projectModalTitle = document.getElementById("projectModalTitle");
    els.projectNameInput = document.getElementById("projectNameInput");
    els.blankSizeFields = document.getElementById("blankSizeFields");
    els.blankWidthInput = document.getElementById("blankWidthInput");
    els.blankHeightInput = document.getElementById("blankHeightInput");
    els.pdfFileInput = document.getElementById("pdfFileInput");
    els.cancelProjectModal = document.getElementById("cancelProjectModal");
    els.confirmProjectModal = document.getElementById("confirmProjectModal");

    bindEvents();
  }

  function bindEvents() {
    els.newFolderBtn.addEventListener("click", openFolderModal);

    els.newProjectBtn.addEventListener("click", event => {
      event.stopPropagation();
      positionMenu(els.newProjectMenu, event.clientX, event.clientY, 200, 100);
    });

    els.importPdfChoice.addEventListener("click", () => {
      hideMenus();
      pendingProjectKind = "pdf";
      pendingPdfData = null;
      els.pdfFileInput.value = "";
      els.pdfFileInput.click();
    });

    els.blankChoice.addEventListener("click", () => {
      hideMenus();
      pendingProjectKind = "blank";
      pendingPdfData = null;
      openProjectModal();
    });

    els.pdfFileInput.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;

      pendingPdfData = await file.arrayBuffer();
      pendingProjectKind = "pdf";
      openProjectModal(file.name.replace(/\.pdf$/i, ""));
    });

    els.backupBtn.addEventListener("click", downloadBackup);

    els.restoreBtn.addEventListener("click", () => {
      els.restoreFileInput.value = "";
      els.restoreFileInput.click();
    });

    els.restoreFileInput.addEventListener("change", handleRestoreFile);
    els.cancelRestoreBtn.addEventListener("click", closeRestoreModal);
    els.restoreMergeBtn.addEventListener("click", () => runRestore("merge"));
    els.restoreReplaceBtn.addEventListener("click", handleReplaceClick);

    els.appBannerClose.addEventListener("click", hideBanner);

    // Another tab took over the local database (e.g. a reload with new files).
    window.addEventListener("fielddb:conflict", () => {
      showBanner(
        "This app was reloaded in another tab or window. Close the other " +
        "copies and reload this page to avoid save problems."
      );
    });

    setupTabDetection();

    els.upFolderBtn.addEventListener("click", goUpFolder);
    els.projectSearch.addEventListener("input", renderLibrary);

    els.cancelFolderModal.addEventListener("click", closeFolderModal);
    els.confirmFolderModal.addEventListener("click", createFolder);

    els.cancelProjectModal.addEventListener("click", closeProjectModal);
    els.confirmProjectModal.addEventListener("click", createProjectFromModal);

    els.renameLibraryAction.addEventListener("click", renameSelectedItem);
    els.duplicateLibraryAction.addEventListener("click", duplicateSelectedItem);
    els.deleteLibraryAction.addEventListener("click", deleteSelectedItem);

    els.exportFileAction.addEventListener("click", exportSelectedFile);

    els.importFileBtn.addEventListener("click", () => {
      els.importFileInput.value = "";
      els.importFileInput.click();
    });
    els.importFileInput.addEventListener("change", handleImportFile);

    els.selectProjectsBtn.addEventListener("click", enterSelectionMode);
    els.cancelSelectionBtn.addEventListener("click", exitSelectionMode);
    els.exportProjectsBtn.addEventListener("click", openTransferExportModal);
    els.cancelTransferExportBtn.addEventListener("click", closeTransferExportModal);
    els.confirmTransferExportBtn.addEventListener("click", exportSelectedTransferPackage);
    els.keepBothConflictBtn.addEventListener("click", () => resolveTransferConflict("keep-both"));
    els.overwriteConflictBtn.addEventListener("click", () => resolveTransferConflict("overwrite"));
    els.cancelConflictBtn.addEventListener("click", () => resolveTransferConflict("cancel"));

    els.cancelRenameBtn.addEventListener("click", () => {
      pendingRename = null;
      els.renameModal.classList.add("hidden");
    });
    els.confirmRenameBtn.addEventListener("click", confirmRename);
    els.renameInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirmRename();
      }
    });

    document.addEventListener("click", event => {
      if (!els.newProjectMenu.contains(event.target)) {
        els.newProjectMenu.classList.add("hidden");
      }

      if (!els.libraryContextMenu.contains(event.target)) {
        els.libraryContextMenu.classList.add("hidden");
      }
    });
  }

  async function start() {
    await ProjectDB.open();
    await refreshLibrary();
    showLibrary();
    warnIfStorageLow();
  }

  async function refreshLibrary() {
    [projects, folders] = await Promise.all([
      ProjectDB.getAllProjects(),
      ProjectDB.getAllFolders()
    ]);

    updateBackupStatus();
    renderLibrary();
  }

  function renderLibrary() {
    const search = els.projectSearch.value.trim().toLowerCase();

    const childFolders = folders
      .filter(folder => (folder.parentId || null) === currentFolderId)
      .filter(folder => !search || folder.name.toLowerCase().includes(search));

    const childProjects = projects
      .filter(project => (project.folderId || null) === currentFolderId)
      .filter(project => !search || project.name.toLowerCase().includes(search));

    els.libraryGrid.innerHTML = "";

    childFolders.forEach(folder => {
      els.libraryGrid.appendChild(createFolderCard(folder));
    });

    childProjects.forEach(project => {
      els.libraryGrid.appendChild(createProjectCard(project));
    });

    els.emptyLibrary.classList.toggle(
      "hidden",
      childFolders.length + childProjects.length > 0
    );

    renderBreadcrumb();
  }

  function createFolderCard(folder) {
    const card = document.createElement("article");
    card.className = "libraryCard folderCard";

    const openArea = document.createElement("div");
    openArea.className = "cardOpenArea";

    const preview = document.createElement("div");
    preview.className = "projectPreview folderPreview";
    preview.textContent = "📁";

    const title = document.createElement("h3");
    title.className = "projectName";
    title.textContent = folder.name;

    const counts = getFolderCounts(folder.id);

    const meta = document.createElement("p");
    meta.className = "projectMeta";
    meta.textContent =
      `${counts.folders} folders · ${counts.projects} files`;

    openArea.append(preview, title, meta);

    if (selectionMode) {
      card.classList.add("selectionMode");
      addTransferCheck(card, "folder", folder.id);
    }

    openArea.addEventListener("click", () => {
      if (selectionMode) {
        toggleTransferSelection("folder", folder.id);
        return;
      }
      currentFolderId = folder.id;
      els.projectSearch.value = "";
      renderLibrary();
    });

    const menuButton = makeMenuButton({
      type: "folder",
      id: folder.id
    });
    menuButton.classList.toggle("hidden", selectionMode);

    card.append(openArea, menuButton);
    return card;
  }

  function createProjectCard(project) {
    const card = document.createElement("article");
    card.className = "libraryCard projectCard";

    const openArea = document.createElement("div");
    openArea.className = "cardOpenArea";

    const preview = document.createElement("div");
    preview.className = "projectPreview";
    preview.textContent = project.kind === "pdf" ? "📄" : "⬜";

    const title = document.createElement("h3");
    title.className = "projectName";
    title.textContent = project.name;

    const meta = document.createElement("p");
    meta.className = "projectMeta";
    meta.textContent = project.kind === "pdf" ? "PDF" : "Blank drawing";

    const pointCount = project.state?.points?.length || 0;

    const updated = document.createElement("p");
    updated.className = "projectUpdated";
    updated.textContent =
      `${pointCount} points · Updated ${formatDate(project.updatedAt)}`;

    openArea.append(preview, title, meta, updated);
    if (selectionMode) {
      card.classList.add("selectionMode");
      addTransferCheck(card, "project", project.id);
    }
    openArea.addEventListener("click", () => {
      if (selectionMode) {
        toggleTransferSelection("project", project.id);
        return;
      }
      openProject(project.id);
    });

    const menuButton = makeMenuButton({
      type: "project",
      id: project.id
    });
    menuButton.classList.toggle("hidden", selectionMode);

    card.append(openArea, menuButton);
    return card;
  }

  function makeMenuButton(item) {
    const button = document.createElement("button");
    button.className = "cardMenuButton";
    button.type = "button";
    button.textContent = "⋯";
    button.title = "Options";

    button.addEventListener("click", event => {
      event.stopPropagation();
      currentMenuItem = item;

      els.duplicateLibraryAction.classList.toggle(
        "hidden",
        item.type === "folder"
      );

      els.exportFileAction.classList.toggle(
        "hidden",
        item.type === "folder"
      );

      positionMenu(
        els.libraryContextMenu,
        event.clientX,
        event.clientY,
        200,
        item.type === "folder" ? 100 : 145
      );
    });

    return button;
  }

  function getFolderCounts(folderId) {
    return {
      folders: folders.filter(folder => folder.parentId === folderId).length,
      projects: projects.filter(project => project.folderId === folderId).length
    };
  }

  function renderBreadcrumb() {
    const path = [];
    let id = currentFolderId;

    while (id) {
      const folder = folders.find(item => item.id === id);
      if (!folder) break;
      path.unshift(folder);
      id = folder.parentId || null;
    }

    els.folderBreadcrumb.innerHTML = "";

    const rootButton = document.createElement("button");
    rootButton.type = "button";
    rootButton.textContent = "Library";
    rootButton.addEventListener("click", () => {
      currentFolderId = null;
      renderLibrary();
    });

    els.folderBreadcrumb.appendChild(rootButton);

    path.forEach(folder => {
      const separator = document.createElement("span");
      separator.textContent = "›";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = folder.name;
      button.addEventListener("click", () => {
        currentFolderId = folder.id;
        renderLibrary();
      });

      els.folderBreadcrumb.append(separator, button);
    });

    els.upFolderBtn.disabled = !currentFolderId;
  }

  function goUpFolder() {
    if (!currentFolderId) return;

    const folder = folders.find(item => item.id === currentFolderId);
    currentFolderId = folder?.parentId || null;
    renderLibrary();
  }

  function openFolderModal() {
    els.folderNameInput.value = "";
    els.folderModal.classList.remove("hidden");
    setTimeout(() => els.folderNameInput.focus(), 50);
  }

  function closeFolderModal() {
    els.folderModal.classList.add("hidden");
  }

  function findSiblingByName(type, name, folderScope, excludeId) {
    const lower = name.trim().toLowerCase();
    if (type === "folder") {
      return folders.find(f =>
        (f.parentId || null) === folderScope &&
        f.id !== excludeId &&
        (f.name || "").trim().toLowerCase() === lower
      );
    }
    return projects.find(p =>
      (p.folderId || null) === folderScope &&
      p.id !== excludeId &&
      (p.name || "").trim().toLowerCase() === lower
    );
  }

  async function createFolder() {
    const name = els.folderNameInput.value.trim();

    if (!name) {
      alert("Enter a folder name.");
      return;
    }

    if (findSiblingByName("folder", name, currentFolderId, null)) {
      alert(`A folder named "${name}" already exists here. Please choose a different name.`);
      return;
    }

    await ProjectDB.saveFolder({
      id: ProjectDB.makeId("folder"),
      name,
      parentId: currentFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    closeFolderModal();
    await refreshLibrary();
  }

  function openProjectModal(suggestedName = "") {
    els.projectModalTitle.textContent =
      pendingProjectKind === "pdf"
        ? "Import PDF"
        : "Create Blank Drawing";

    els.projectNameInput.value = suggestedName;

    els.blankSizeFields.classList.toggle(
      "hidden",
      pendingProjectKind !== "blank"
    );

    els.projectModal.classList.remove("hidden");
    setTimeout(() => els.projectNameInput.focus(), 50);
  }

  function closeProjectModal() {
    els.projectModal.classList.add("hidden");
    pendingProjectKind = null;
    pendingPdfData = null;
  }

  async function createProjectFromModal() {
    const name = els.projectNameInput.value.trim();

    if (!name) {
      alert("Enter a work file name.");
      return;
    }

    if (pendingProjectKind === "pdf" && !pendingPdfData) {
      alert("Choose a PDF file.");
      return;
    }

    const duplicate = findSiblingByName("project", name, currentFolderId, null);
    if (duplicate) {
      const replace = confirm(
        `A work file named "${name}" already exists here.\n\n` +
        "OK = Replace it (the old file is deleted)\n" +
        "Cancel = go back and change the name"
      );
      if (!replace) return; // leave the dialog open so they can rename
      await ProjectDB.deleteProject(duplicate.id);
    }

    const now = Date.now();

    const newProjectId = ProjectDB.makeId("project");
    const project = {
      id: newProjectId,
      projectId: newProjectId,
      name,
      folderId: currentFolderId,
      kind: pendingProjectKind,
      createdAt: now,
      updatedAt: now,

      pdfData: pendingProjectKind === "pdf" ? pendingPdfData : null,
      _assetSaved: pendingProjectKind !== "pdf",

      blankWidth:
        pendingProjectKind === "blank"
          ? Number(els.blankWidthInput.value || 2400)
          : null,

      blankHeight:
        pendingProjectKind === "blank"
          ? Number(els.blankHeightInput.value || 1600)
          : null,

      state: {
        points: [],
        dataTypes: null,
        selectedDataId: null,
        pointMode: "lock",
        showOrderLabels: false,
        zoomLevel: 1,
        commentImageData: "",
        scrollLeft: 0,
        scrollTop: 0
      }
    };

    await ProjectDB.saveProject(project);

    closeProjectModal();
    await refreshLibrary();
    warnIfStorageLow();
    await openProject(project.id);
  }

  async function openProject(id) {
    const project = await ProjectDB.getProject(id);

    if (!project) {
      alert("Work file not found.");
      return;
    }

    els.homeView.classList.add("hidden");
    els.workspaceView.classList.remove("hidden");

    try {
      await Workspace.openProject(project);
    } catch (error) {
      console.error(error);
      alert("Could not open this work file.");
      showLibrary();
    }
  }

  function renameSelectedItem() {
    hideMenus();
    if (!currentMenuItem) return;

    const record = currentMenuItem.type === "folder"
      ? folders.find(item => item.id === currentMenuItem.id)
      : projects.find(item => item.id === currentMenuItem.id);
    if (!record) return;

    pendingRename = { type: currentMenuItem.type, id: currentMenuItem.id };
    els.renameModalTitle.textContent =
      currentMenuItem.type === "folder" ? "Rename Folder" : "Rename File";
    els.renameInput.value = record.name;
    els.renameModal.classList.remove("hidden");

    setTimeout(() => {
      els.renameInput.focus();
      els.renameInput.select();
    }, 30);
  }

  async function confirmRename() {
    if (!pendingRename) return;

    const name = els.renameInput.value.trim();
    if (!name) return;

    if (pendingRename.type === "folder") {
      const folder = folders.find(item => item.id === pendingRename.id);
      if (!folder) { closeRenameModal(); return; }

      if (findSiblingByName("folder", name, folder.parentId || null, folder.id)) {
        alert(`A folder named "${name}" already exists here. Please choose a different name.`);
        return;
      }

      folder.name = name;
      await ProjectDB.saveFolder(folder);
    } else {
      const project = projects.find(item => item.id === pendingRename.id);
      if (!project) { closeRenameModal(); return; }

      const duplicate = findSiblingByName("project", name, project.folderId || null, project.id);
      if (duplicate) {
        const replace = confirm(
          `A work file named "${name}" already exists here.\n\n` +
          "OK = Replace it (the old file is deleted)\n" +
          "Cancel = keep editing the name"
        );
        if (!replace) return;
        await ProjectDB.deleteProject(duplicate.id);
      }

      project.name = name;
      await ProjectDB.saveProject(project);
    }

    closeRenameModal();
    await refreshLibrary();
  }

  function closeRenameModal() {
    pendingRename = null;
    els.renameModal.classList.add("hidden");
  }

  async function exportSelectedFile() {
    hideMenus();

    if (!currentMenuItem || currentMenuItem.type !== "project") {
      alert("Only work files can be exported to a single file. For folders, use Backup.");
      return;
    }

    try {
      const project = projects.find(item => item.id === currentMenuItem.id);
      const data = await ProjectDB.exportProject(currentMenuItem.id);
      const safeName = (project?.name || "file").replace(/[^\w\-]+/g, "_");

      downloadBlob(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
        `${safeName}.fmfile.json`
      );
    } catch (error) {
      alert("Export failed: " + explainDbError(error));
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (/\.zip$/i.test(file.name) || file.type === "application/zip") {
      await importTransferPackage(file);
      event.target.value = "";
      return;
    }

    let data;
    try {
      data = JSON.parse(await file.text());
    } catch (error) {
      alert("That file could not be read.");
      return;
    }

    if (!data || data.format !== "field-measurement-file") {
      alert("That is not a project transfer ZIP or single-file export.");
      return;
    }

    try {
      const record = await ProjectDB.importProject(data, currentFolderId);
      await refreshLibrary();
      alert(`Imported "${record.name}" into this folder.`);
    } catch (error) {
      alert("Import failed: " + explainDbError(error));
    }
  }

  function updateBackupStatus() {
    if (!els.backupStatus) return;

    let raw = null;
    try { raw = localStorage.getItem("fm_lastBackupAt"); } catch (_) {}

    if (!raw) {
      els.backupStatus.textContent =
        "No backup yet — press Backup to save a copy you can restore.";
      els.backupStatus.classList.add("warn");
      return;
    }

    const days = Math.floor((Date.now() - Number(raw)) / 86400000);

    if (days <= 0) {
      els.backupStatus.textContent = "Last backup: today.";
    } else {
      els.backupStatus.textContent = `Last backup: ${days} day${days > 1 ? "s" : ""} ago.`;
    }
    els.backupStatus.classList.toggle("warn", days >= 7);
  }

  async function duplicateSelectedItem() {
    hideMenus();

    if (!currentMenuItem || currentMenuItem.type !== "project") return;

    await ProjectDB.duplicateProject(currentMenuItem.id);
    await refreshLibrary();
  }

  async function deleteSelectedItem() {
    hideMenus();
    if (!currentMenuItem) return;

    if (currentMenuItem.type === "folder") {
      const folder = folders.find(item => item.id === currentMenuItem.id);
      if (!folder) return;

      if (!confirm(`Delete empty folder "${folder.name}"?`)) return;

      try {
        await ProjectDB.deleteFolder(folder.id);
      } catch (error) {
        alert("This folder is not empty. Delete or move its contents first.");
        return;
      }
    } else {
      const project = projects.find(item => item.id === currentMenuItem.id);
      if (!project) return;

      if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
      await ProjectDB.deleteProject(project.id);
    }

    await refreshLibrary();
  }

  /* ---------- Whole-library backup and restore ---------- */

  async function downloadBackup() {
    els.backupBtn.disabled = true;

    try {
      const backup = await ProjectDB.exportAll();
      const stamp = new Date().toISOString().slice(0, 10);

      downloadBlob(
        new Blob([JSON.stringify(backup)], { type: "application/json" }),
        `field-measurement-backup-${stamp}.json`
      );

      try { localStorage.setItem("fm_lastBackupAt", String(Date.now())); } catch (_) {}
      updateBackupStatus();

      alert(
        "Backup saved.\n\n" +
        `${backup.counts.folders} folders\n` +
        `${backup.counts.projects} work files\n` +
        `${backup.counts.assets} PDF drawings\n\n` +
        "Keep this file somewhere safe: email it to yourself, or save it to a " +
        "cloud drive or another device."
      );
    } catch (error) {
      alert("Backup failed: " + explainDbError(error));
    } finally {
      els.backupBtn.disabled = false;
    }
  }

  async function handleRestoreFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    let backup;

    try {
      backup = JSON.parse(await file.text());
    } catch (error) {
      alert("That file could not be read as a backup.");
      return;
    }

    if (!backup || backup.format !== "field-measurement-backup" || !backup.data) {
      alert("That file is not a Field Measurement backup.");
      return;
    }

    pendingBackup = backup;
    openRestoreModal(backup);
  }

  function openRestoreModal(backup) {
    const counts = backup.counts || {};

    const made = backup.exportedAt
      ? new Date(backup.exportedAt).toLocaleString()
      : "an unknown date";

    els.restoreSummary.textContent =
      `This backup was made ${made} and contains ` +
      `${counts.folders ?? "?"} folders, ${counts.projects ?? "?"} work files, ` +
      `and ${counts.assets ?? "?"} PDF drawings.`;

    disarmReplace();
    els.restoreModal.classList.remove("hidden");
  }

  function closeRestoreModal() {
    els.restoreModal.classList.add("hidden");
    pendingBackup = null;
    disarmReplace();
  }

  function handleReplaceClick() {
    if (!replaceArmed) {
      replaceArmed = true;
      els.restoreReplaceBtn.textContent = "Tap again to Replace All";
      return;
    }

    runRestore("replace");
  }

  function disarmReplace() {
    replaceArmed = false;

    if (els.restoreReplaceBtn) {
      els.restoreReplaceBtn.textContent = "Replace All";
    }
  }

  async function runRestore(mode) {
    if (!pendingBackup) return;

    const backup = pendingBackup;

    els.restoreMergeBtn.disabled = true;
    els.restoreReplaceBtn.disabled = true;

    try {
      const result = await ProjectDB.importAll(backup, { mode });

      closeRestoreModal();
      currentFolderId = null;
      els.projectSearch.value = "";
      await refreshLibrary();

      alert(
        (mode === "replace" ? "Replaced with backup.\n\n" : "Backup merged.\n\n") +
        `${result.folders} folders and ${result.projects} work files ` +
        "are now on this device."
      );
    } catch (error) {
      alert("Restore failed: " + explainDbError(error));
    } finally {
      els.restoreMergeBtn.disabled = false;
      els.restoreReplaceBtn.disabled = false;
    }
  }

  function explainDbError(error) {
    return window.ProjectDB?.explainError
      ? ProjectDB.explainError(error)
      : (error?.message || String(error));
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- Batch project transfer ZIP ---------- */

  function transferKey(type, id) {
    return `${type}:${id}`;
  }

  function enterSelectionMode() {
    selectionMode = true;
    selectedTransferItems.clear();
    updateSelectionControls();
    renderLibrary();
  }

  function exitSelectionMode() {
    selectionMode = false;
    selectedTransferItems.clear();
    updateSelectionControls();
    renderLibrary();
  }

  function addTransferCheck(card, type, id) {
    const key = transferKey(type, id);
    const check = document.createElement("span");
    check.className = "transferCheck";
    check.textContent = selectedTransferItems.has(key) ? "✓" : "";
    check.addEventListener("click", event => {
      event.stopPropagation();
      toggleTransferSelection(type, id);
    });
    card.classList.toggle("selectedForTransfer", selectedTransferItems.has(key));
    card.prepend(check);
  }

  function toggleTransferSelection(type, id) {
    const key = transferKey(type, id);
    if (selectedTransferItems.has(key)) selectedTransferItems.delete(key);
    else selectedTransferItems.add(key);
    updateSelectionControls();
    renderLibrary();
  }

  function updateSelectionControls() {
    const count = selectedTransferItems.size;
    els.selectProjectsBtn.classList.toggle("hidden", selectionMode);
    els.exportProjectsBtn.classList.toggle("hidden", !selectionMode);
    els.cancelSelectionBtn.classList.toggle("hidden", !selectionMode);
    els.exportProjectsBtn.textContent = count
      ? `⇧ Export Project (${count})`
      : "⇧ Export Project";
    els.exportProjectsBtn.disabled = count === 0;
  }

  function collectTransferSelection() {
    const folderIds = new Set();
    const projectIds = new Set();

    selectedTransferItems.forEach(key => {
      const [type, id] = key.split(":");
      if (type === "folder") folderIds.add(id);
      if (type === "project") projectIds.add(id);
    });

    let changed = true;
    while (changed) {
      changed = false;
      folders.forEach(folder => {
        if (folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
          folderIds.add(folder.id);
          changed = true;
        }
      });
    }

    projects.forEach(project => {
      if (project.folderId && folderIds.has(project.folderId)) projectIds.add(project.id);
    });

    return {
      folders: folders.filter(folder => folderIds.has(folder.id)),
      projects: projects.filter(project => projectIds.has(project.id))
    };
  }

  function openTransferExportModal() {
    const selection = collectTransferSelection();
    if (!selection.projects.length) {
      alert("Select at least one work file, or a folder containing work files.");
      return;
    }
    els.transferExportSummary.textContent =
      `${selection.projects.length} project${selection.projects.length === 1 ? "" : "s"} ` +
      `and ${selection.folders.length} folder${selection.folders.length === 1 ? "" : "s"} selected.`;
    els.includePdfCheckbox.checked = true;
    els.transferExportModal.classList.remove("hidden");
  }

  function closeTransferExportModal() {
    els.transferExportModal.classList.add("hidden");
  }

  function safeTransferName(name, fallback) {
    const cleaned = String(name || fallback)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return cleaned || fallback;
  }

  async function exportSelectedTransferPackage() {
    if (typeof JSZip === "undefined") {
      alert("ZIP support did not load. Reload the app while online once, then try again.");
      return;
    }

    const selection = collectTransferSelection();
    if (!selection.projects.length) return;

    const includePdf = els.includePdfCheckbox.checked;
    els.confirmTransferExportBtn.disabled = true;
    els.confirmTransferExportBtn.textContent = "Preparing…";

    try {
      const zip = new JSZip();
      const usedNames = new Set();
      const manifestProjects = [];

      for (const summary of selection.projects) {
        const project = await ProjectDB.getProject(summary.id);
        if (!project) continue;

        const sourceProjectId = project.projectId || project.id;
        let base = safeTransferName(project.name, sourceProjectId);
        let uniqueBase = base;
        let suffix = 2;
        while (usedNames.has(uniqueBase.toLowerCase())) uniqueBase = `${base}-${suffix++}`;
        usedNames.add(uniqueBase.toLowerCase());

        const projectPath = `projects/${uniqueBase}.json`;
        const pdfPath = includePdf && project.pdfData instanceof ArrayBuffer
          ? `pdf/${uniqueBase}.pdf`
          : null;

        const cleanProject = { ...project, projectId: sourceProjectId };
        delete cleanProject.pdfData;
        delete cleanProject._assetSaved;

        const projectFile = {
          format: "field-measurement-project",
          version: 1,
          projectId: sourceProjectId,
          updatedAt: project.updatedAt || Date.now(),
          project: cleanProject
        };

        zip.file(projectPath, JSON.stringify(projectFile, null, 2));
        if (pdfPath) zip.file(pdfPath, project.pdfData);

        manifestProjects.push({
          projectId: sourceProjectId,
          name: project.name,
          updatedAt: project.updatedAt || null,
          folderId: project.folderId || null,
          projectPath,
          pdfPath
        });
      }

      const manifest = {
        format: "field-measurement-backup",
        version: 1,
        packageType: "project-transfer",
        exportedAt: new Date().toISOString(),
        includesPdf: includePdf,
        counts: {
          folders: selection.folders.length,
          projects: manifestProjects.length,
          pdfs: manifestProjects.filter(item => item.pdfPath).length
        },
        folders: selection.folders.map(folder => ({ ...folder })),
        projects: manifestProjects
      };

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const stamp = new Date().toISOString().slice(0, 10);
      const rootName = selection.projects.length === 1
        ? safeTransferName(selection.projects[0].name, "Project")
        : "Field-Projects";
      downloadBlob(blob, `${rootName}-Field-Backup-${stamp}.zip`);

      closeTransferExportModal();
      exitSelectionMode();
      alert(
        `Transfer package created.\n\n${manifest.counts.projects} projects\n` +
        `${manifest.counts.pdfs} PDF files\n\nSave or share the ZIP through iCloud Drive, Google Drive, OneDrive, or email.`
      );
    } catch (error) {
      alert("Project export failed: " + explainDbError(error));
    } finally {
      els.confirmTransferExportBtn.disabled = false;
      els.confirmTransferExportBtn.textContent = "Export ZIP";
    }
  }

  async function importTransferPackage(file) {
    if (typeof JSZip === "undefined") {
      alert("ZIP support did not load. Reload the app while online once, then try again.");
      return;
    }

    try {
      const zip = await JSZip.loadAsync(file);
      const manifestEntry = zip.file("manifest.json");
      if (!manifestEntry) throw new Error("manifest.json is missing.");

      const manifest = JSON.parse(await manifestEntry.async("text"));
      if (manifest.format !== "field-measurement-backup" || manifest.version !== 1 || manifest.packageType !== "project-transfer") {
        throw new Error("This ZIP is not a supported Field Measurement transfer package.");
      }

      const incomingFolders = Array.isArray(manifest.folders) ? manifest.folders : [];
      const incomingProjects = Array.isArray(manifest.projects) ? manifest.projects : [];
      if (!incomingProjects.length) throw new Error("The transfer package contains no projects.");

      const folderMap = await importTransferFolders(incomingFolders);
      let imported = 0;
      let overwritten = 0;
      let keptBoth = 0;

      for (const item of incomingProjects) {
        const projectEntry = zip.file(item.projectPath);
        if (!projectEntry) throw new Error(`Missing ${item.projectPath}.`);
        const projectFile = JSON.parse(await projectEntry.async("text"));
        if (projectFile.format !== "field-measurement-project" || projectFile.version !== 1 || !projectFile.project) {
          throw new Error(`${item.projectPath} is not a supported project file.`);
        }

        const source = projectFile.project;
        source.projectId = projectFile.projectId || source.projectId || source.id;
        source.updatedAt = Number(projectFile.updatedAt || source.updatedAt) || Date.now();

        let pdfBuffer = null;
        if (item.pdfPath) {
          const pdfEntry = zip.file(item.pdfPath);
          if (!pdfEntry) throw new Error(`Missing ${item.pdfPath}.`);
          pdfBuffer = await pdfEntry.async("arraybuffer");
        }

        const latestProjects = await ProjectDB.getAllProjects();
        const existing = latestProjects.find(project =>
          (project.projectId || project.id) === source.projectId
        );

        let mode = "new";
        if (existing) {
          mode = await askTransferConflict(existing, source);
          if (mode === "cancel") throw new Error("Import cancelled by user.");
        }

        const importedFolderId = item.folderId
          ? (folderMap.get(item.folderId) || currentFolderId || null)
          : (currentFolderId || null);

        await ProjectDB.importTransferProject(source, pdfBuffer, {
          mode,
          existingId: existing?.id || null,
          folderId: importedFolderId
        });

        imported += 1;
        if (mode === "overwrite") overwritten += 1;
        if (mode === "keep-both") keptBoth += 1;
      }

      await refreshLibrary();
      alert(
        `Import complete.\n\n${imported} projects imported\n` +
        `${overwritten} overwritten\n${keptBoth} kept as separate copies`
      );
    } catch (error) {
      if (error?.message === "Import cancelled by user.") return;
      alert("Project import failed: " + (error?.message || String(error)));
    }
  }

  async function importTransferFolders(incomingFolders) {
    const map = new Map();
    const remaining = [...incomingFolders];
    let guard = 0;

    while (remaining.length && guard++ < incomingFolders.length + 5) {
      let progressed = false;
      for (let i = remaining.length - 1; i >= 0; i -= 1) {
        const source = remaining[i];
        const parentReady = !source.parentId || map.has(source.parentId);
        if (!parentReady) continue;

        const targetParent = source.parentId
          ? map.get(source.parentId)
          : (currentFolderId || null);
        const existing = (await ProjectDB.getAllFolders()).find(folder =>
          (folder.parentId || null) === targetParent &&
          String(folder.name).toLowerCase() === String(source.name).toLowerCase()
        );

        if (existing) {
          map.set(source.id, existing.id);
        } else {
          const newFolder = {
            ...source,
            id: ProjectDB.makeId("folder"),
            parentId: targetParent,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await ProjectDB.saveFolder(newFolder);
          map.set(source.id, newFolder.id);
        }
        remaining.splice(i, 1);
        progressed = true;
      }
      if (!progressed) break;
    }
    return map;
  }

  function askTransferConflict(existing, incoming) {
    return new Promise(resolve => {
      pendingConflictResolve = resolve;
      els.transferConflictSummary.textContent =
        `“${incoming.name || "Unnamed project"}” has the same project ID as a project already on this device.`;
      els.existingProjectTime.textContent = formatFullDate(existing.updatedAt);
      els.incomingProjectTime.textContent = formatFullDate(incoming.updatedAt);
      els.transferConflictModal.classList.remove("hidden");
    });
  }

  function resolveTransferConflict(choice) {
    els.transferConflictModal.classList.add("hidden");
    const resolve = pendingConflictResolve;
    pendingConflictResolve = null;
    if (resolve) resolve(choice);
  }

  function formatFullDate(value) {
    if (!value) return "Unknown date";
    return new Date(value).toLocaleString();
  }

  /* ---------- Warning banner, multi-tab detection, storage check ---------- */

  function showBanner(message) {
    if (!els.appBanner) return;
    els.appBannerText.textContent = message;
    els.appBanner.classList.remove("hidden");
  }

  function hideBanner() {
    if (!els.appBanner) return;
    els.appBanner.classList.add("hidden");
  }

  /*
    Detect the same app being open in more than one tab/window, which can
    cause overlapping saves to the shared local database.
  */
  function setupTabDetection() {
    if (typeof BroadcastChannel === "undefined") return;

    try {
      const channel = new BroadcastChannel("field-measurement-tabs");
      const myId = Math.random().toString(16).slice(2);

      channel.onmessage = event => {
        const data = event.data || {};
        if (data.tabId === myId) return;

        if (data.type === "hello") {
          channel.postMessage({ type: "here", tabId: myId });
          warnMultipleTabs();
        } else if (data.type === "here") {
          warnMultipleTabs();
        }
      };

      channel.postMessage({ type: "hello", tabId: myId });
    } catch (error) {
      /* BroadcastChannel unavailable or blocked: skip detection */
    }
  }

  function warnMultipleTabs() {
    showBanner(
      "This app is open in more than one tab or window. To avoid save " +
      "conflicts, keep only one open."
    );
  }

  /*
    Warn before the device actually runs out of website storage, rather than
    only reporting it after a save has already failed.
  */
  async function warnIfStorageLow() {
    if (!navigator.storage || !navigator.storage.estimate) return;

    try {
      const { usage, quota } = await navigator.storage.estimate();
      if (!quota) return;

      if (usage / quota > 0.9) {
        showBanner(
          "This device is almost out of storage for the app. Make a Backup, " +
          "then delete work files you no longer need."
        );
      }
    } catch (error) {
      /* estimate unavailable: ignore */
    }
  }

  function showLibrary() {
    els.workspaceView.classList.add("hidden");
    els.homeView.classList.remove("hidden");
    refreshLibrary();
  }

  function hideMenus() {
    els.newProjectMenu.classList.add("hidden");
    els.libraryContextMenu.classList.add("hidden");
  }

  function positionMenu(menu, x, y, width, height) {
    menu.style.left =
      Math.max(8, Math.min(x, window.innerWidth - width - 8)) + "px";

    menu.style.top =
      Math.max(8, Math.min(y, window.innerHeight - height - 8)) + "px";

    menu.classList.remove("hidden");
  }

  function formatDate(timestamp) {
    if (!timestamp) return "unknown";

    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  return {
    init,
    start,
    showLibrary,
    refreshLibrary
  };
})();

document.addEventListener("DOMContentLoaded", async () => {
  Workspace.init();
  App.init();
  await App.start();
});
