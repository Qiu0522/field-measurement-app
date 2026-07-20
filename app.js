"use strict";

const App = (() => {
  let projects = [];
  let folders = [];

  let currentFolderId = null;
  let currentMenuItem = null;
  let pendingRename = null;
  let moveTargetItem = null;
  let moveModalFolderId = null;

  let pendingProjectKind = null;
  let pendingPdfData = null;

  let pendingBackup = null;
  let replaceArmed = false;
  let fileSelectionMode = false;
  const selectedProjectIds = new Set();

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
    els.moveLibraryAction = document.getElementById("moveLibraryAction");
    els.deleteLibraryAction = document.getElementById("deleteLibraryAction");
    els.exportFileAction = document.getElementById("exportFileAction");
    els.importFileBtn = document.getElementById("importFileBtn");
    els.importFileInput = document.getElementById("importFileInput");
    els.backupStatus = document.getElementById("backupStatus");
    els.selectFilesBtn = document.getElementById("selectFilesBtn");
    els.selectionBar = document.getElementById("selectionBar");
    els.selectionCount = document.getElementById("selectionCount");
    els.selectAllFilesBtn = document.getElementById("selectAllFilesBtn");
    els.exportSelectedFilesBtn = document.getElementById("exportSelectedFilesBtn");
    els.backupSelectedFilesBtn = document.getElementById("backupSelectedFilesBtn");
    els.cancelFileSelectionBtn = document.getElementById("cancelFileSelectionBtn");
    els.renameModal = document.getElementById("renameModal");
    els.renameModalTitle = document.getElementById("renameModalTitle");
    els.renameInput = document.getElementById("renameInput");
    els.cancelRenameBtn = document.getElementById("cancelRenameBtn");
    els.confirmRenameBtn = document.getElementById("confirmRenameBtn");

    els.moveModal = document.getElementById("moveModal");
    els.moveModalPath = document.getElementById("moveModalPath");
    els.moveModalList = document.getElementById("moveModalList");
    els.moveUpFolderBtn = document.getElementById("moveUpFolderBtn");
    els.cancelMoveBtn = document.getElementById("cancelMoveBtn");
    els.confirmMoveHereBtn = document.getElementById("confirmMoveHereBtn");

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
    els.moveLibraryAction.addEventListener("click", moveSelectedItem);
    els.deleteLibraryAction.addEventListener("click", deleteSelectedItem);

    els.exportFileAction.addEventListener("click", exportSelectedFile);

    els.importFileBtn.addEventListener("click", () => {
      els.importFileInput.value = "";
      els.importFileInput.click();
    });
    els.importFileInput.addEventListener("change", handleImportFile);
    els.selectFilesBtn.addEventListener("click", startFileSelection);
    els.cancelFileSelectionBtn.addEventListener("click", stopFileSelection);
    els.selectAllFilesBtn.addEventListener("click", selectAllVisibleFiles);
    els.exportSelectedFilesBtn.addEventListener("click", exportSelectedFiles);
    els.backupSelectedFilesBtn.addEventListener("click", backupSelectedFiles);

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

    els.cancelMoveBtn.addEventListener("click", closeMoveModal);
    els.confirmMoveHereBtn.addEventListener("click", confirmMoveHere);
    els.moveUpFolderBtn.addEventListener("click", moveUpInModal);

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
    openArea.addEventListener("click", () => {
      if (fileSelectionMode) toggleProjectSelection(project.id);
      else openProject(project.id);
    });

    const selector = document.createElement("button");
    selector.type = "button";
    selector.className = "fileSelector";
    selector.setAttribute("aria-label", `Select ${project.name}`);
    selector.textContent = selectedProjectIds.has(project.id) ? "✓" : "";
    selector.classList.toggle("selected", selectedProjectIds.has(project.id));
    selector.addEventListener("click", event => {
      event.stopPropagation();
      toggleProjectSelection(project.id);
    });

    const menuButton = makeMenuButton({
      type: "project",
      id: project.id
    });

    card.classList.toggle("selectionMode", fileSelectionMode);
    card.classList.toggle("selectedFile", selectedProjectIds.has(project.id));
    card.append(openArea, selector, menuButton);
    return card;
  }

  function startFileSelection() {
    fileSelectionMode = true;
    selectedProjectIds.clear();
    els.selectionBar.classList.remove("hidden");
    els.selectFilesBtn.classList.add("hidden");
    updateFileSelectionUI();
    renderLibrary();
  }

  function stopFileSelection() {
    fileSelectionMode = false;
    selectedProjectIds.clear();
    els.selectionBar.classList.add("hidden");
    els.selectFilesBtn.classList.remove("hidden");
    renderLibrary();
  }

  function toggleProjectSelection(id) {
    if (!fileSelectionMode) fileSelectionMode = true;
    if (selectedProjectIds.has(id)) selectedProjectIds.delete(id);
    else selectedProjectIds.add(id);
    updateFileSelectionUI();
    renderLibrary();
  }

  function visibleProjectIds() {
    const search = els.projectSearch.value.trim().toLowerCase();
    return projects
      .filter(project => (project.folderId || null) === currentFolderId)
      .filter(project => !search || project.name.toLowerCase().includes(search))
      .map(project => project.id);
  }

  function selectAllVisibleFiles() {
    const visible = visibleProjectIds();
    const allSelected = visible.length > 0 && visible.every(id => selectedProjectIds.has(id));
    visible.forEach(id => allSelected ? selectedProjectIds.delete(id) : selectedProjectIds.add(id));
    updateFileSelectionUI();
    renderLibrary();
  }

  function updateFileSelectionUI() {
    const count = selectedProjectIds.size;
    els.selectionCount.textContent = `${count} file${count === 1 ? "" : "s"} selected`;
    els.exportSelectedFilesBtn.disabled = count === 0;
    els.backupSelectedFilesBtn.disabled = count === 0;
    const visible = visibleProjectIds();
    els.selectAllFilesBtn.textContent = visible.length && visible.every(id => selectedProjectIds.has(id))
      ? "Clear All" : "Select All";
  }

  async function exportSelectedFiles() {
    if (!selectedProjectIds.size) return;
    try {
      const bundle = await ProjectDB.exportProjectBundle([...selectedProjectIds]);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([JSON.stringify(bundle)], { type: "application/json" }),
        `field-measurement-files-${stamp}.fmfiles.json`);
    } catch (error) {
      alert("Export failed: " + explainDbError(error));
    }
  }

  async function backupSelectedFiles() {
    if (!selectedProjectIds.size) return;
    try {
      const backup = await ProjectDB.exportSelected([...selectedProjectIds]);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([JSON.stringify(backup)], { type: "application/json" }),
        `field-measurement-selected-backup-${stamp}.json`);
      alert(`Backup saved with ${backup.counts.projects} selected file${backup.counts.projects === 1 ? "" : "s"}.`);
    } catch (error) {
      alert("Backup failed: " + explainDbError(error));
    }
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
        item.type === "folder" ? 140 : 185
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

  function getFolderDescendantIds(folderId) {
    const result = new Set();
    const stack = [folderId];

    while (stack.length) {
      const id = stack.pop();
      folders
        .filter(folder => folder.parentId === id)
        .forEach(folder => {
          if (!result.has(folder.id)) {
            result.add(folder.id);
            stack.push(folder.id);
          }
        });
    }

    return result;
  }

  function moveSelectedItem() {
    hideMenus();
    if (!currentMenuItem) return;

    const record = currentMenuItem.type === "folder"
      ? folders.find(item => item.id === currentMenuItem.id)
      : projects.find(item => item.id === currentMenuItem.id);
    if (!record) return;

    moveTargetItem = { type: currentMenuItem.type, id: currentMenuItem.id };
    moveModalFolderId = currentMenuItem.type === "folder"
      ? (record.parentId || null)
      : (record.folderId || null);

    renderMoveModal();
    els.moveModal.classList.remove("hidden");
  }

  function closeMoveModal() {
    moveTargetItem = null;
    els.moveModal.classList.add("hidden");
  }

  function renderMoveModal() {
    if (!moveTargetItem) return;

    // A folder can never be moved into itself or one of its own subfolders.
    const forbidden = moveTargetItem.type === "folder"
      ? new Set([moveTargetItem.id, ...getFolderDescendantIds(moveTargetItem.id)])
      : new Set();

    if (forbidden.has(moveModalFolderId)) {
      moveModalFolderId = null;
    }

    const path = [];
    let id = moveModalFolderId;
    while (id) {
      const folder = folders.find(item => item.id === id);
      if (!folder) break;
      path.unshift(folder);
      id = folder.parentId || null;
    }

    els.moveModalPath.textContent =
      "Library" + path.map(folder => " / " + folder.name).join("");
    els.moveUpFolderBtn.disabled = !moveModalFolderId;

    els.moveModalList.innerHTML = "";

    const subfolders = folders
      .filter(folder => (folder.parentId || null) === moveModalFolderId)
      .filter(folder => !forbidden.has(folder.id));

    if (!subfolders.length) {
      const empty = document.createElement("p");
      empty.className = "moveModalEmpty";
      empty.textContent = "No subfolders here.";
      els.moveModalList.appendChild(empty);
      return;
    }

    subfolders.forEach(folder => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "moveModalRow";
      row.textContent = "📁 " + folder.name;
      row.addEventListener("click", () => {
        moveModalFolderId = folder.id;
        renderMoveModal();
      });
      els.moveModalList.appendChild(row);
    });
  }

  function moveUpInModal() {
    if (!moveModalFolderId) return;
    const folder = folders.find(item => item.id === moveModalFolderId);
    moveModalFolderId = folder?.parentId || null;
    renderMoveModal();
  }

  async function confirmMoveHere() {
    if (!moveTargetItem) return;

    try {
      if (moveTargetItem.type === "folder") {
        const folder = folders.find(item => item.id === moveTargetItem.id);
        if (!folder) { closeMoveModal(); return; }

        if (findSiblingByName("folder", folder.name, moveModalFolderId, folder.id)) {
          alert(`A folder named "${folder.name}" already exists there. Rename it first.`);
          return;
        }

        folder.parentId = moveModalFolderId;
        await ProjectDB.saveFolder(folder);
      } else {
        const project = projects.find(item => item.id === moveTargetItem.id);
        if (!project) { closeMoveModal(); return; }

        const duplicate = findSiblingByName("project", project.name, moveModalFolderId, project.id);
        if (duplicate) {
          const replace = confirm(
            `A work file named "${project.name}" already exists there.\n\n` +
            "OK = Replace it (the old file is deleted)\n" +
            "Cancel = keep this file where it is"
          );
          if (!replace) return;
          await ProjectDB.deleteProject(duplicate.id);
        }

        project.folderId = moveModalFolderId;
        await ProjectDB.saveProject(project);
      }

      closeMoveModal();
      await refreshLibrary();
    } catch (error) {
      alert("Move failed: " + explainDbError(error));
    }
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

    let data;
    try {
      data = JSON.parse(await file.text());
    } catch (error) {
      alert("That file could not be read.");
      return;
    }

    if (!data || !["field-measurement-file", "field-measurement-files"].includes(data.format)) {
      alert("That is not a single-file export. For a whole-library backup file, use Restore instead.");
      return;
    }

    try {
      const files = data.format === "field-measurement-files" && Array.isArray(data.files)
        ? data.files : [data];
      const imported = [];
      for (const fileData of files) {
        imported.push(await ProjectDB.importProject(fileData, currentFolderId));
      }
      await refreshLibrary();
      alert(imported.length === 1
        ? `Imported "${imported[0].name}" into this folder.`
        : `Imported ${imported.length} work files into this folder.`);
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
