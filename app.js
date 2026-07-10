"use strict";

const App = (() => {
  let projects = [];
  let currentMenuProjectId = null;
  let pendingProjectKind = null;
  let pendingPdfData = null;

  const els = {};

  function init() {
    els.homeView = document.getElementById("homeView");
    els.workspaceView = document.getElementById("workspaceView");

    els.newProjectBtn = document.getElementById("newProjectBtn");
    els.newProjectMenu = document.getElementById("newProjectMenu");
    els.importPdfChoice = document.getElementById("importPdfChoice");
    els.blankChoice = document.getElementById("blankChoice");

    els.projectSearch = document.getElementById("projectSearch");
    els.towerFilter = document.getElementById("towerFilter");
    els.projectGrid = document.getElementById("projectGrid");
    els.emptyLibrary = document.getElementById("emptyLibrary");

    els.projectContextMenu = document.getElementById("projectContextMenu");
    els.renameProjectAction = document.getElementById("renameProjectAction");
    els.duplicateProjectAction = document.getElementById("duplicateProjectAction");
    els.deleteProjectAction = document.getElementById("deleteProjectAction");

    els.projectModal = document.getElementById("projectModal");
    els.projectModalTitle = document.getElementById("projectModalTitle");
    els.projectNameInput = document.getElementById("projectNameInput");
    els.towerInput = document.getElementById("towerInput");
    els.floorInput = document.getElementById("floorInput");
    els.blankSizeFields = document.getElementById("blankSizeFields");
    els.blankWidthInput = document.getElementById("blankWidthInput");
    els.blankHeightInput = document.getElementById("blankHeightInput");
    els.pdfFileInput = document.getElementById("pdfFileInput");
    els.cancelProjectModal = document.getElementById("cancelProjectModal");
    els.confirmProjectModal = document.getElementById("confirmProjectModal");

    bindEvents();
  }

  function bindEvents() {
    els.newProjectBtn.addEventListener("click", event => {
      event.stopPropagation();
      positionMenu(
        els.newProjectMenu,
        event.clientX,
        event.clientY
      );
    });

    els.importPdfChoice.addEventListener("click", () => {
      hideMenus();
      pendingProjectKind = "pdf";
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

      const baseName = file.name.replace(/\.pdf$/i, "");
      openProjectModal(baseName);
    });

    els.cancelProjectModal.addEventListener("click", closeProjectModal);
    els.confirmProjectModal.addEventListener("click", createProjectFromModal);

    els.projectSearch.addEventListener("input", renderLibrary);
    els.towerFilter.addEventListener("change", renderLibrary);

    els.renameProjectAction.addEventListener("click", renameSelectedProject);
    els.duplicateProjectAction.addEventListener("click", duplicateSelectedProject);
    els.deleteProjectAction.addEventListener("click", deleteSelectedProject);

    document.addEventListener("click", event => {
      if (!els.newProjectMenu.contains(event.target)) {
        els.newProjectMenu.classList.add("hidden");
      }

      if (!els.projectContextMenu.contains(event.target)) {
        els.projectContextMenu.classList.add("hidden");
      }
    });
  }

  async function start() {
    await ProjectDB.open();
    await refreshProjects();
    showLibrary();
  }

  async function refreshProjects() {
    projects = await ProjectDB.getAllProjects();
    renderTowerFilter();
    renderLibrary();
  }

  function renderLibrary() {
    const search =
      els.projectSearch.value.trim().toLowerCase();

    const tower = els.towerFilter.value;

    const visibleProjects = projects.filter(project => {
      const searchable = [
        project.name,
        project.tower,
        project.floor
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!search || searchable.includes(search)) &&
        (!tower || project.tower === tower)
      );
    });

    els.projectGrid.innerHTML = "";
    els.emptyLibrary.classList.toggle(
      "hidden",
      projects.length > 0
    );

    visibleProjects.forEach(project => {
      els.projectGrid.appendChild(
        createProjectCard(project)
      );
    });
  }

  function createProjectCard(project) {
    const card = document.createElement("article");
    card.className = "projectCard";

    const openArea = document.createElement("div");
    openArea.className = "cardOpenArea";

    const preview = document.createElement("div");
    preview.className = "projectPreview";
    preview.textContent =
      project.kind === "pdf" ? "📄" : "⬜";

    const title = document.createElement("h3");
    title.className = "projectName";
    title.textContent = project.name;

    const meta = document.createElement("p");
    meta.className = "projectMeta";
    meta.textContent = [
      project.tower,
      project.floor,
      project.kind === "pdf" ? "PDF" : "Blank"
    ]
      .filter(Boolean)
      .join(" · ");

    const pointCount =
      project.state?.points?.length || 0;

    const updated = document.createElement("p");
    updated.className = "projectUpdated";
    updated.textContent =
      `${pointCount} points · Updated ${formatDate(project.updatedAt)}`;

    openArea.append(preview, title, meta, updated);

    openArea.addEventListener("click", () => {
      openProject(project.id);
    });

    const menuButton = document.createElement("button");
    menuButton.className = "cardMenuButton";
    menuButton.type = "button";
    menuButton.textContent = "⋯";
    menuButton.title = "Project options";

    menuButton.addEventListener("click", event => {
      event.stopPropagation();
      currentMenuProjectId = project.id;
      positionMenu(
        els.projectContextMenu,
        event.clientX,
        event.clientY
      );
    });

    card.append(openArea, menuButton);
    return card;
  }

  function renderTowerFilter() {
    const currentValue = els.towerFilter.value;
    const towers = [
      ...new Set(
        projects
          .map(project => project.tower)
          .filter(Boolean)
      )
    ].sort();

    els.towerFilter.innerHTML =
      '<option value="">All towers</option>';

    towers.forEach(tower => {
      const option = document.createElement("option");
      option.value = tower;
      option.textContent = tower;
      els.towerFilter.appendChild(option);
    });

    if (towers.includes(currentValue)) {
      els.towerFilter.value = currentValue;
    }
  }

  function openProjectModal(suggestedName = "") {
    els.projectModalTitle.textContent =
      pendingProjectKind === "pdf"
        ? "Import PDF Work File"
        : "Create Blank Work File";

    els.projectNameInput.value = suggestedName;
    els.towerInput.value = "";
    els.floorInput.value = "";

    els.blankSizeFields.classList.toggle(
      "hidden",
      pendingProjectKind !== "blank"
    );

    els.projectModal.classList.remove("hidden");

    setTimeout(() => {
      els.projectNameInput.focus();
    }, 50);
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
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : "project_" + now + "_" + Math.random().toString(16).slice(2),

      name,
      tower: els.towerInput.value.trim(),
      floor: els.floorInput.value.trim(),
      kind: pendingProjectKind,
      createdAt: now,
      updatedAt: now,

      pdfData:
        pendingProjectKind === "pdf"
          ? pendingPdfData
          : null,

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
    await refreshProjects();
    await openProject(project.id);
  }

  async function openProject(id) {
    const project = await ProjectDB.getProject(id);

    if (!project) {
      alert("Project not found.");
      return;
    }

    els.homeView.classList.add("hidden");
    els.workspaceView.classList.remove("hidden");

    try {
      await Workspace.openProject(project);
    } catch (error) {
      console.error(error);
      alert("Could not open this project.");
      showLibrary();
    }
  }

  async function renameSelectedProject() {
    const project =
      projects.find(item => item.id === currentMenuProjectId);

    hideMenus();

    if (!project) return;

    const newName = prompt(
      "New project name:",
      project.name
    );

    if (!newName?.trim()) return;

    project.name = newName.trim();
    await ProjectDB.saveProject(project);
    await refreshProjects();
  }

  async function duplicateSelectedProject() {
    hideMenus();

    if (!currentMenuProjectId) return;

    await ProjectDB.duplicateProject(currentMenuProjectId);
    await refreshProjects();
  }

  async function deleteSelectedProject() {
    const project =
      projects.find(item => item.id === currentMenuProjectId);

    hideMenus();

    if (!project) return;

    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      return;
    }

    await ProjectDB.deleteProject(project.id);
    await refreshProjects();
  }

  function showLibrary() {
    els.workspaceView.classList.add("hidden");
    els.homeView.classList.remove("hidden");
    refreshProjects();
  }

  function hideMenus() {
    els.newProjectMenu.classList.add("hidden");
    els.projectContextMenu.classList.add("hidden");
  }

  function positionMenu(menu, x, y) {
    const width = 200;
    const height = 145;

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
    showLibrary
  };
})();

document.addEventListener("DOMContentLoaded", async () => {
  Workspace.init();
  App.init();
  await App.start();
});
