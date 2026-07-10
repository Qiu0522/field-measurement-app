"use strict";

const App = (() => {
  let projects = [];
  let folders = [];

  let currentFolderId = null;
  let currentMenuItem = null;

  let pendingProjectKind = null;
  let pendingPdfData = null;

  let pendingBackup = null;
  let replaceArmed = false;

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

    els.upFolderBtn = document.getElementById("upFolderBtn");
    els.folderBreadcrumb = document.getElementById("folderBreadcrumb");
    els.projectSearch = document.getElementById("projectSearch");
    els.libraryGrid = document.getElementById("libraryGrid");
    els.emptyLibrary = document.getElementById("emptyLibrary");

    els.libraryContextMenu = document.getElementById("libraryContextMenu");
    els.renameLibraryAction = document.getElementById("renameLibraryAction");
    els.duplicateLibraryAction = document.getElementById("duplicateLibraryAction");
    els.deleteLibraryAction = document.getElementById("deleteLibraryAction");

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

    els.upFolderBtn.addEventListener("click", goUpFolder);
    els.projectSearch.addEventListener("input", renderLibrary);

    els.cancelFolderModal.addEventListener("click", closeFolderModal);
    els.confirmFolderModal.addEventListener("click", createFolder);

    els.cancelProjectModal.addEventListener("click", closeProjectModal);
    els.confirmProjectModal.addEventListener("click", createProjectFromModal);

    els.renameLibraryAction.addEventListener("click", renameSelectedItem);
    els.duplicateLibraryAction.addEventListener("click", duplicateSelectedItem);
    els.deleteLibraryAction.addEventListener("click", deleteSelectedItem);

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
  }

  async function refreshLibrary() {
    [projects, folders] = await Promise.all([
      ProjectDB.getAllProjects(),
      ProjectDB.getAllFolders()
    ]);

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

    openArea.addEventListener("click", () => {
      currentFolderId = folder.id;
      els.projectSearch.value = "";
      renderLibrary();
    });

    const menuButton = makeMenuButton({
      type: "folder",
      id: folder.id
    });

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
    openArea.addEventListener("click", () => openProject(project.id));

    const menuButton = makeMenuButton({
      type: "project",
      id: project.id
    });

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

  async function createFolder() {
    const name = els.folderNameInput.value.trim();

    if (!name) {
      alert("Enter a folder name.");
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

    const now = Date.now();

    const project = {
      id: ProjectDB.makeId("project"),
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

  async function renameSelectedItem() {
    hideMenus();
    if (!currentMenuItem) return;

    if (currentMenuItem.type === "folder") {
      const folder = folders.find(item => item.id === currentMenuItem.id);
      if (!folder) return;

      const name = prompt("New folder name:", folder.name);
      if (!name?.trim()) return;

      folder.name = name.trim();
      await ProjectDB.saveFolder(folder);
    } else {
      const project = projects.find(item => item.id === currentMenuItem.id);
      if (!project) return;

      const name = prompt("New work file name:", project.name);
      if (!name?.trim()) return;

      project.name = name.trim();
      await ProjectDB.saveProject(project);
    }

    await refreshLibrary();
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
