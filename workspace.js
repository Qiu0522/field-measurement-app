"use strict";

const Workspace = (() => {
  const DEFAULT_DATA_TYPES = [
    { id: "data1", name: "测量落差", color: "#0066ff", counter: 1, export: true, ordered: false, direction: "clockwise" },
    { id: "data2", name: "Embed 距离", color: "#ff0000", counter: 1, export: true, ordered: false, direction: "clockwise" },
    { id: "data3", name: "二次测量Embed距离", color: "#00aa00", counter: 1, export: true, ordered: false, direction: "clockwise" },
    { id: "data4", name: "完成后立柱测量尺寸", color: "#8000ff", counter: 1, export: true, ordered: false, direction: "clockwise" }
  ];

  let project = null;

  let points = [];
  let dataTypes = [];

  let pointMode = "lock";
  let commentTool = "none";
  let showOrderLabels = false;
  let zoomLevel = 1;

  let contextPoint = null;
  let movingPoint = null;

  let isDraggingPoint = false;
  let draggedPoint = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragLockedScrollLeft = 0;
  let dragLockedScrollTop = 0;

  let isDrawingComment = false;
  let lastCommentX = 0;
  let lastCommentY = 0;
  let commentBeforeStroke = "";
  let commentImageData = "";

  let measurementCallback = null;
  let measurementRawValue = "";

  let undoStack = [];
  let redoStack = [];

  let saveTimer = null;
  let isDirty = false;

  const els = {};

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  function init() {
    els.workspaceView = document.getElementById("workspaceView");
    els.workspaceProjectName = document.getElementById("workspaceProjectName");
    els.backHomeBtn = document.getElementById("backHomeBtn");

    els.dataSelect = document.getElementById("dataSelect");
    els.addBtn = document.getElementById("addBtn");
    els.lockBtn = document.getElementById("lockBtn");
    els.penBtn = document.getElementById("penBtn");
    els.eraserBtn = document.getElementById("eraserBtn");
    els.undoBtn = document.getElementById("undoBtn");
    els.redoBtn = document.getElementById("redoBtn");
    els.orderBtn = document.getElementById("orderBtn");
    els.labelsBtn = document.getElementById("labelsBtn");
    els.exportCsvBtn = document.getElementById("exportCsvBtn");
    els.exportPdfBtn = document.getElementById("exportPdfBtn");

    els.saveIndicator = document.getElementById("saveIndicator");
    els.status = document.getElementById("status");

    els.drawingWrapper = document.getElementById("drawingWrapper");
    els.drawingArea = document.getElementById("drawingArea");
    els.drawingImage = document.getElementById("drawingImage");
    els.pdfCanvas = document.getElementById("pdfCanvas");
    els.commentCanvas = document.getElementById("commentCanvas");

    els.pointContextMenu = document.getElementById("pointContextMenu");
    els.pointEditAction = document.getElementById("pointEditAction");
    els.pointMoveAction = document.getElementById("pointMoveAction");
    els.pointAssignSideAction = document.getElementById("pointAssignSideAction");
    els.pointDeleteAction = document.getElementById("pointDeleteAction");

    els.measurementModal = document.getElementById("measurementModal");
    els.measurementTitle = document.getElementById("measurementTitle");
    els.measurementDisplay = document.getElementById("measurementDisplay");
    els.cancelMeasurementBtn = document.getElementById("cancelMeasurementBtn");

    els.dataTypeModal = document.getElementById("dataTypeModal");
    els.dataTypeNameInput = document.getElementById("dataTypeNameInput");
    els.dataTypeColorInput = document.getElementById("dataTypeColorInput");
    els.cancelDataTypeBtn = document.getElementById("cancelDataTypeBtn");
    els.confirmDataTypeBtn = document.getElementById("confirmDataTypeBtn");

    els.sideModal = document.getElementById("sideModal");
    els.cancelSideBtn = document.getElementById("cancelSideBtn");

    bindEvents();
    renderDataSelect();
    updateToolButtons();
  }

  function bindEvents() {
    els.backHomeBtn.addEventListener("click", async () => {
      els.backHomeBtn.disabled = true;
      setStatus("Saving…");

      try {
        await closeProject();
        App.showLibrary();
      } catch (error) {
        console.error(error);
        alert("Could not save this work file.");
      } finally {
        els.backHomeBtn.disabled = false;
      }
    });

    els.dataSelect.addEventListener("change", handleDataSelectChange);

    els.addBtn.addEventListener("click", () => setPointMode("add"));
    els.lockBtn.addEventListener("click", () => setPointMode("lock"));
    els.penBtn.addEventListener("click", () => toggleCommentTool("pen"));
    els.eraserBtn.addEventListener("click", () => toggleCommentTool("eraser"));

    els.undoBtn.addEventListener("click", undo);
    els.redoBtn.addEventListener("click", redo);

    els.orderBtn.addEventListener("click", orderCurrentData);
    els.labelsBtn.addEventListener("click", toggleOrderLabels);

    els.exportCsvBtn.addEventListener("click", exportCSV);
    els.exportPdfBtn.addEventListener("click", exportPDF);

    els.drawingArea.addEventListener("click", handleDrawingClick);
    /*
      Scrolling no longer triggers a database write. Scroll position is
      captured during the next content save or when returning to Library.
    */

    els.drawingWrapper.addEventListener("wheel", event => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      zoomLevel += event.deltaY < 0 ? 0.1 : -0.1;
      zoomLevel = Math.max(0.3, Math.min(5, zoomLevel));
      applyZoom();
      scheduleAutoSave();
    }, { passive: false });

    els.pointEditAction.addEventListener("click", () => {
      hidePointContextMenu();
      if (contextPoint) editPoint(contextPoint);
    });

    els.pointMoveAction.addEventListener("click", () => {
      hidePointContextMenu();
      if (!contextPoint) return;

      movingPoint = contextPoint;
      commentTool = "none";
      clearPointSelection();

      const element = findPointElement(contextPoint.uid);
      if (element) {
        element.classList.add("selected");
        element.classList.add("movingPoint");
      }

      updateToolButtons();
      setStatus("Move selected point: drag it or tap its new location. Page scrolling is locked while dragging.");
    });

    els.pointAssignSideAction.addEventListener("click", () => {
      hidePointContextMenu();
      if (contextPoint) els.sideModal.classList.remove("hidden");
    });

    els.pointDeleteAction.addEventListener("click", () => {
      hidePointContextMenu();
      if (contextPoint) deletePoint(contextPoint);
    });

    document.addEventListener("click", event => {
      if (!els.pointContextMenu.contains(event.target)) {
        hidePointContextMenu();
      }
    });

    els.measurementModal.querySelectorAll("[data-key]").forEach(button => {
      button.addEventListener("click", () => {
        appendMeasurementValue(button.dataset.key);
      });
    });

    els.measurementModal.querySelectorAll("[data-fraction]").forEach(button => {
      button.addEventListener("click", () => {
        appendMeasurementFraction(button.dataset.fraction);
      });
    });

    els.measurementModal
      .querySelector('[data-action="backspace"]')
      .addEventListener("click", measurementBackspace);

    els.measurementModal
      .querySelector('[data-action="clear"]')
      .addEventListener("click", () => {
        setMeasurementRawValue("");
      });

    els.measurementModal
      .querySelector('[data-action="negative"]')
      .addEventListener("click", toggleMeasurementNegative);

    els.measurementModal
      .querySelector('[data-action="confirm"]')
      .addEventListener("click", confirmMeasurement);

    els.cancelMeasurementBtn.addEventListener("click", cancelMeasurement);

    els.cancelDataTypeBtn.addEventListener("click", () => {
      els.dataTypeModal.classList.add("hidden");
      renderDataSelect(dataTypes[0]?.id);
    });

    els.confirmDataTypeBtn.addEventListener("click", confirmDataType);

    els.sideModal.querySelectorAll("[data-side]").forEach(button => {
      button.addEventListener("click", () => {
        assignContextPointSide(button.dataset.side);
      });
    });

    els.cancelSideBtn.addEventListener("click", () => {
      els.sideModal.classList.add("hidden");
    });

    bindCommentCanvas();
  }

  async function openProject(projectRecord) {
    project = projectRecord;

    const state = project.state || {};

    points = clone(state.points || []);
    dataTypes = clone(state.dataTypes || DEFAULT_DATA_TYPES);

    dataTypes.forEach(dataType => {
      if (typeof dataType.ordered !== "boolean") dataType.ordered = false;
      if (!dataType.direction) dataType.direction = "clockwise";
    });

    pointMode = state.pointMode || "lock";
    commentTool = "none";
    showOrderLabels = Boolean(state.showOrderLabels);
    zoomLevel = Number(state.zoomLevel || 1);

    commentImageData = state.commentImageData || "";
    undoStack = [];
    redoStack = [];

    els.workspaceProjectName.textContent = project.name;
    renderDataSelect(state.selectedDataId);
    updateToolButtons();
    updateLabelsButton();

    removeAllPointElements();

    if (project.kind === "pdf") {
      await renderStoredPdf(project.pdfData);
    } else {
      createBlankDrawing(
        project.blankWidth || 2400,
        project.blankHeight || 1600
      );
    }

    points.forEach(createPointElement);

    if (commentImageData) {
      await restoreCommentImage(commentImageData);
    }

    applyZoom();

    requestAnimationFrame(() => {
      els.drawingWrapper.scrollLeft = state.scrollLeft || 0;
      els.drawingWrapper.scrollTop = state.scrollTop || 0;
    });

    setPointMode(pointMode);
    isDirty = false;
    setStatus("Project loaded. Changes save automatically.");
    showSaved();
  }

  async function closeProject() {
    if (!project) return;

    clearTimeout(saveTimer);

    /*
      Returning to Library must always preserve zoom and scroll position.
      The save is now small because the PDF asset is stored separately and
      the comment canvas is not re-encoded on every save.
    */
    await saveNow(true);

    project = null;
    points = [];
    dataTypes = clone(DEFAULT_DATA_TYPES);
    removeAllPointElements();

    const context = els.commentCanvas.getContext("2d");
    context.clearRect(
      0,
      0,
      els.commentCanvas.width,
      els.commentCanvas.height
    );
  }

  async function renderStoredPdf(pdfData) {
    if (!pdfData) {
      throw new Error("This project has no stored PDF.");
    }

    const typedArray = new Uint8Array(pdfData);
    const pdf = await pdfjsLib.getDocument(typedArray).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 5 });
    const context = els.pdfCanvas.getContext("2d");

    els.pdfCanvas.width = Math.round(viewport.width);
    els.pdfCanvas.height = Math.round(viewport.height);

    els.drawingArea.style.width = els.pdfCanvas.width + "px";
    els.drawingArea.style.height = els.pdfCanvas.height + "px";

    els.drawingImage.classList.add("hidden");
    els.pdfCanvas.classList.remove("hidden");

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    setupCommentCanvas(
      els.pdfCanvas.width,
      els.pdfCanvas.height
    );
  }

  function createBlankDrawing(width, height) {
    els.drawingImage.classList.add("hidden");
    els.pdfCanvas.classList.add("hidden");

    els.drawingArea.style.width = width + "px";
    els.drawingArea.style.height = height + "px";

    setupCommentCanvas(width, height);
  }

  function setupCommentCanvas(width, height) {
    els.commentCanvas.width = width;
    els.commentCanvas.height = height;
    els.commentCanvas.style.width = width + "px";
    els.commentCanvas.style.height = height + "px";
  }

  function renderDataSelect(selectedId = null) {
    const previousValue = selectedId || els.dataSelect.value;
    els.dataSelect.innerHTML = "";

    dataTypes.forEach(dataType => {
      const pointCount =
        points.filter(point => point.dataId === dataType.id).length;

      const statusMark = pointCount
        ? (dataType.ordered ? "✓ " : "○ ")
        : "";

      const option = document.createElement("option");
      option.value = dataType.id;
      option.textContent = statusMark + dataType.name;
      els.dataSelect.appendChild(option);
    });

    const addOption = document.createElement("option");
    addOption.value = "__add_data_type__";
    addOption.textContent = "+ Add Data Type";
    els.dataSelect.appendChild(addOption);

    if (dataTypes.some(dataType => dataType.id === previousValue)) {
      els.dataSelect.value = previousValue;
    } else if (dataTypes.length) {
      els.dataSelect.value = dataTypes[0].id;
    }
  }

  function handleDataSelectChange() {
    if (els.dataSelect.value !== "__add_data_type__") {
      scheduleAutoSave();
      return;
    }

    els.dataTypeNameInput.value = "New Data";
    els.dataTypeColorInput.value = "#000000";
    els.dataTypeModal.classList.remove("hidden");
  }

  function confirmDataType() {
    const name = els.dataTypeNameInput.value.trim();

    if (!name) {
      alert("Enter a data type name.");
      return;
    }

    const dataType = {
      id: "data_" + Date.now(),
      name,
      color: els.dataTypeColorInput.value || "#000000",
      counter: 1,
      export: true,
      ordered: false,
      direction: "clockwise"
    };

    dataTypes.push(dataType);

    els.dataTypeModal.classList.add("hidden");
    renderDataSelect(dataType.id);
    scheduleAutoSave();
  }

  function setPointMode(mode) {
    pointMode = mode;
    movingPoint = null;
    clearPointSelection();

    setStatus(
      mode === "add"
        ? "Add Points ON: tap drawing, enter measurement, confirm."
        : "Lock Points ON: blank taps will not add points."
    );

    updateToolButtons();
    scheduleAutoSave();
  }

  function toggleCommentTool(tool) {
    commentTool = commentTool === tool ? "none" : tool;

    if (commentTool === "pen") {
      setStatus("Pen ON: Apple Pencil draws; finger scrolls.");
    } else if (commentTool === "eraser") {
      setStatus("Eraser ON: Apple Pencil erases; finger scrolls.");
    } else {
      setStatus("Drawing tool OFF.");
    }

    updateToolButtons();
  }

  function updateToolButtons() {
    [
      els.addBtn,
      els.lockBtn,
      els.penBtn,
      els.eraserBtn
    ].forEach(button => button.classList.remove("activeTool"));

    if (pointMode === "add") els.addBtn.classList.add("activeTool");
    if (pointMode === "lock") els.lockBtn.classList.add("activeTool");
    if (commentTool === "pen") els.penBtn.classList.add("activeTool");
    if (commentTool === "eraser") els.eraserBtn.classList.add("activeTool");
  }

  function updateLabelsButton() {
    els.labelsBtn.textContent =
      showOrderLabels ? "Hide Order Labels" : "Show Order Labels";

    els.labelsBtn.classList.toggle("activeTool", showOrderLabels);
  }

  function handleDrawingClick(event) {
    if (event.target.classList.contains("point")) return;
    if (commentTool !== "none") return;

    const position = getDrawingPosition(event);

    if (movingPoint) {
      movePointTo(movingPoint, position.x, position.y);
      movingPoint = null;
      clearPointSelection();
      return;
    }

    if (pointMode !== "add") return;

    openMeasurementModal("", "Enter Measurement", value => {
      const cleanValue = value.trim();
      if (!cleanValue) return;

      addPoint(position.x, position.y, cleanValue);
    });
  }

  function addPoint(x, y, measurement) {
    const dataType = getDataType(els.dataSelect.value);
    if (!dataType) return;

    const point = {
      uid: "point_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      dataId: dataType.id,
      number: dataType.counter,
      x,
      y,
      measurement,
      moved: false,
      moveDistance: 0,
      assignedSide: "",
      assignedSeq: ""
    };

    points.push(point);
    dataType.counter += 1;
    dataType.ordered = false;

    pushUndo({ type: "add", point });
    createPointElement(point);
    renderDataSelect(dataType.id);

    setStatus(`${dataType.name}: ${measurement} added.`);
    scheduleAutoSave();
  }

  function createPointElement(point) {
    removePointElement(point.uid);

    const element = document.createElement("div");
    element.className = "point";
    element.dataset.uid = point.uid;

    element.addEventListener("click", event => {
      event.stopPropagation();

      if (commentTool !== "none" || isDraggingPoint) return;
      editPoint(point);
    });

    element.addEventListener("contextmenu", event => {
      event.preventDefault();
      event.stopPropagation();
      showPointContextMenu(event.clientX, event.clientY, point);
    });

    let timer = null;

    element.addEventListener("touchstart", event => {
      timer = setTimeout(() => {
        const touch = event.touches[0];
        showPointContextMenu(touch.clientX, touch.clientY, point);
      }, 650);
    }, { passive: true });

    element.addEventListener("touchmove", () => {
      clearTimeout(timer);
    }, { passive: true });

    element.addEventListener("touchend", () => {
      clearTimeout(timer);
    });

    element.addEventListener("pointerdown", event => {
      if (movingPoint !== point) return;

      event.preventDefault();
      event.stopPropagation();

      isDraggingPoint = true;
      draggedPoint = point;
      dragStartX = point.x;
      dragStartY = point.y;

      dragLockedScrollLeft = els.drawingWrapper.scrollLeft;
      dragLockedScrollTop = els.drawingWrapper.scrollTop;
      els.drawingWrapper.classList.add("pointDragActive");
      element.classList.add("movingPoint");

      try {
        element.setPointerCapture(event.pointerId);
      } catch (_) {}
    });

    element.addEventListener("pointermove", event => {
      if (!isDraggingPoint || draggedPoint !== point) return;

      event.preventDefault();
      event.stopPropagation();

      els.drawingWrapper.scrollLeft = dragLockedScrollLeft;
      els.drawingWrapper.scrollTop = dragLockedScrollTop;

      const position = getDrawingPosition(event);
      point.x = position.x;
      point.y = position.y;
      updatePointElement(point);
    });

    element.addEventListener("pointerup", event => {
      if (!isDraggingPoint || draggedPoint !== point) return;

      event.preventDefault();

      const newX = point.x;
      const newY = point.y;
      const distance = Math.hypot(
        newX - dragStartX,
        newY - dragStartY
      );

      isDraggingPoint = false;
      draggedPoint = null;
      movingPoint = null;
      els.drawingWrapper.classList.remove("pointDragActive");
      element.classList.remove("movingPoint");
      clearPointSelection();

      if (distance > 0) {
        point.moved = true;
        point.moveDistance += distance;

        pushUndo({
          type: "move",
          point,
          oldX: dragStartX,
          oldY: dragStartY,
          newX,
          newY,
          distance
        });

        if (point.assignedSide) {
          recalculateDataTypeOrder(point.dataId);
        }

        scheduleAutoSave();
      }
    });

    element.addEventListener("pointercancel", () => {
      if (draggedPoint !== point) return;

      point.x = dragStartX;
      point.y = dragStartY;
      isDraggingPoint = false;
      draggedPoint = null;
      movingPoint = null;
      els.drawingWrapper.classList.remove("pointDragActive");
      element.classList.remove("movingPoint");
      clearPointSelection();
      updatePointElement(point);
    });

    els.drawingArea.appendChild(element);
    updatePointElement(point);
  }

  function updatePointElement(point) {
    const element = findPointElement(point.uid);
    if (!element) return;

    const dataType = getDataType(point.dataId);
    const measurement = point.measurement || String(point.number);

    element.textContent =
      showOrderLabels && point.assignedSide && point.assignedSeq
        ? `${point.assignedSide}${point.assignedSeq} ${measurement}`
        : measurement;

    element.style.left = point.x + "px";
    element.style.top = point.y + "px";
    element.style.color = dataType?.color || "black";
  }

  function editPoint(point) {
    const oldValue = point.measurement;

    openMeasurementModal(
      oldValue,
      "Edit Measurement",
      value => {
        const newValue = value.trim();
        if (!newValue || newValue === oldValue) return;

        point.measurement = newValue;

        pushUndo({
          type: "edit",
          point,
          oldValue,
          newValue
        });

        updatePointElement(point);
        scheduleAutoSave();
      }
    );
  }

  function deletePoint(point) {
    if (!confirm("Delete this point?")) return;

    points = points.filter(item => item.uid !== point.uid);
    removePointElement(point.uid);

    const dataType = getDataType(point.dataId);

    if (dataType?.ordered) {
      recalculateDataTypeOrder(point.dataId);
    }

    pushUndo({ type: "delete", point });
    renderDataSelect(point.dataId);
    scheduleAutoSave();
  }

  function movePointTo(point, x, y) {
    const oldX = point.x;
    const oldY = point.y;
    const distance = Math.hypot(x - oldX, y - oldY);

    point.x = x;
    point.y = y;
    point.moved = true;
    point.moveDistance += distance;

    pushUndo({
      type: "move",
      point,
      oldX,
      oldY,
      newX: x,
      newY: y,
      distance
    });

    if (point.assignedSide) {
      recalculateDataTypeOrder(point.dataId);
    }

    updatePointElement(point);
    scheduleAutoSave();
  }

  function showPointContextMenu(x, y, point) {
    contextPoint = point;

    const left = Math.min(x, window.innerWidth - 195);
    const top = Math.min(y, window.innerHeight - 210);

    els.pointContextMenu.style.left = Math.max(8, left) + "px";
    els.pointContextMenu.style.top = Math.max(8, top) + "px";
    els.pointContextMenu.classList.remove("hidden");
  }

  function hidePointContextMenu() {
    els.pointContextMenu.classList.add("hidden");
  }

  function assignContextPointSide(side) {
    if (!contextPoint) return;

    const oldSide = contextPoint.assignedSide || "";

    contextPoint.assignedSide = side;

    pushUndo({
      type: "assignSide",
      point: contextPoint,
      oldSide,
      newSide: side,
      dataId: contextPoint.dataId
    });

    const dataType = getDataType(contextPoint.dataId);
    if (dataType) dataType.ordered = true;

    recalculateDataTypeOrder(contextPoint.dataId);

    showOrderLabels = true;
    updateLabelsButton();
    refreshAllPoints();
    renderDataSelect(contextPoint.dataId);

    els.sideModal.classList.add("hidden");
    scheduleAutoSave();
  }

  function orderCurrentData() {
    const dataType = getDataType(els.dataSelect.value);

    if (!dataType) return;

    const typePoints =
      points.filter(point => point.dataId === dataType.id);

    if (!typePoints.length) {
      alert("This data type has no points.");
      return;
    }

    const direction = prompt(
      "Type clockwise or counterclockwise:",
      dataType.direction || "clockwise"
    );

    if (!direction) return;

    const cleanDirection = direction.trim().toLowerCase();

    if (!["clockwise", "counterclockwise"].includes(cleanDirection)) {
      alert("Please type clockwise or counterclockwise.");
      return;
    }

    dataType.direction = cleanDirection;
    assignMissingSidesForData(dataType.id);
    dataType.ordered = true;

    recalculateDataTypeOrder(dataType.id);

    showOrderLabels = true;
    updateLabelsButton();
    refreshAllPoints();
    renderDataSelect(dataType.id);

    setStatus(
      `${dataType.name} ordered ${cleanDirection}.`
    );

    scheduleAutoSave();
  }

  function assignMissingSidesForData(dataId) {
    const typePoints =
      points.filter(point => point.dataId === dataId);

    if (!typePoints.length) return;

    const bounds = getBounds(typePoints);

    typePoints.forEach(point => {
      if (!point.assignedSide) {
        point.assignedSide = guessSide(point, bounds);
      }
    });
  }

  function recalculateDataTypeOrder(dataId) {
    const dataType = getDataType(dataId);
    if (!dataType) return;

    const ordered = getOrderedPoints(
      dataId,
      dataType.direction || "clockwise"
    );

    ordered.forEach(item => {
      item.point.assignedSide = item.side;
      item.point.assignedSeq = item.seq;
      updatePointElement(item.point);
    });
  }

  function getOrderedPoints(dataId, direction) {
    const groups = {
      N: [],
      E: [],
      S: [],
      W: []
    };

    points
      .filter(point => point.dataId === dataId)
      .forEach(point => {
        const side = point.assignedSide || "N";
        groups[side].push(point);
      });

    if (direction === "clockwise") {
      groups.N.sort((a, b) => a.x - b.x);
      groups.E.sort((a, b) => a.y - b.y);
      groups.S.sort((a, b) => b.x - a.x);
      groups.W.sort((a, b) => b.y - a.y);

      return buildOrderedList(groups, ["N", "E", "S", "W"]);
    }

    groups.N.sort((a, b) => b.x - a.x);
    groups.W.sort((a, b) => a.y - b.y);
    groups.S.sort((a, b) => a.x - b.x);
    groups.E.sort((a, b) => b.y - a.y);

    return buildOrderedList(groups, ["N", "W", "S", "E"]);
  }

  function buildOrderedList(groups, order) {
    const result = [];

    order.forEach(side => {
      groups[side].forEach((point, index) => {
        result.push({
          point,
          side,
          seq: index + 1
        });
      });
    });

    return result;
  }

  function getBounds(typePoints) {
    const xs = typePoints.map(point => point.x);
    const ys = typePoints.map(point => point.y);

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }

  function guessSide(point, bounds) {
    const distances = {
      N: Math.abs(point.y - bounds.minY),
      E: Math.abs(point.x - bounds.maxX),
      S: Math.abs(point.y - bounds.maxY),
      W: Math.abs(point.x - bounds.minX)
    };

    return Object.entries(distances)
      .sort((a, b) => a[1] - b[1])[0][0];
  }

  function toggleOrderLabels() {
    showOrderLabels = !showOrderLabels;
    updateLabelsButton();
    refreshAllPoints();
    scheduleAutoSave();
  }

  function setMeasurementRawValue(value) {
    measurementRawValue = String(value || "");
    els.measurementDisplay.value =
      measurementRawValue.replace(/ /g, "_");
  }

  function appendMeasurementValue(value) {
    setMeasurementRawValue(measurementRawValue + value);
  }

  function appendMeasurementFraction(fraction) {
    let nextValue = measurementRawValue;

    if (nextValue && !nextValue.endsWith(" ")) {
      nextValue += " ";
    }

    nextValue += fraction;
    setMeasurementRawValue(nextValue);
  }

  function measurementBackspace() {
    setMeasurementRawValue(measurementRawValue.slice(0, -1));
  }

  function toggleMeasurementNegative() {
    setMeasurementRawValue(
      measurementRawValue.startsWith("-")
        ? measurementRawValue.slice(1)
        : "-" + measurementRawValue
    );
  }

  function openMeasurementModal(initialValue, title, callback) {
    setMeasurementRawValue(initialValue || "");
    els.measurementTitle.textContent = title;
    measurementCallback = callback;
    els.measurementModal.classList.remove("hidden");
  }

  function confirmMeasurement() {
    const callback = measurementCallback;
    const value = measurementRawValue;

    measurementCallback = null;
    els.measurementModal.classList.add("hidden");

    if (callback) callback(value);
  }

  function cancelMeasurement() {
    measurementCallback = null;
    measurementRawValue = "";
    els.measurementModal.classList.add("hidden");
  }

  function bindCommentCanvas() {
    els.commentCanvas.addEventListener("pointerdown", event => {
      if (commentTool === "none") return;
      if (!["pen", "mouse"].includes(event.pointerType)) return;

      event.preventDefault();

      try {
        els.commentCanvas.setPointerCapture(event.pointerId);
      } catch (_) {}

      commentBeforeStroke = els.commentCanvas.toDataURL();
      isDrawingComment = true;

      const position = getCanvasPosition(event);
      lastCommentX = position.x;
      lastCommentY = position.y;
    });

    els.commentCanvas.addEventListener("pointermove", event => {
      if (!isDrawingComment || commentTool === "none") return;
      if (!["pen", "mouse"].includes(event.pointerType)) return;

      event.preventDefault();

      const position = getCanvasPosition(event);
      const context = els.commentCanvas.getContext("2d");

      context.lineCap = "round";
      context.lineJoin = "round";

      if (commentTool === "eraser") {
        context.globalCompositeOperation = "destination-out";
        context.lineWidth = 36;
      } else {
        context.globalCompositeOperation = "source-over";
        context.strokeStyle = "#ff0000";
        context.lineWidth = 5;
      }

      context.beginPath();
      context.moveTo(lastCommentX, lastCommentY);
      context.lineTo(position.x, position.y);
      context.stroke();

      lastCommentX = position.x;
      lastCommentY = position.y;
    });

    els.commentCanvas.addEventListener("pointerup", finishStroke);
    els.commentCanvas.addEventListener("pointercancel", finishStroke);
  }

  function finishStroke() {
    if (!isDrawingComment) return;

    isDrawingComment = false;
    const after = els.commentCanvas.toDataURL();

    pushUndo({
      type: "comment",
      before: commentBeforeStroke,
      after
    });

    commentImageData = after;
    scheduleAutoSave();
  }

  function restoreCommentImage(dataUrl) {
    return new Promise(resolve => {
      const context = els.commentCanvas.getContext("2d");

      context.clearRect(
        0,
        0,
        els.commentCanvas.width,
        els.commentCanvas.height
      );

      if (!dataUrl) {
        commentImageData = "";
        resolve();
        return;
      }

      const image = new Image();

      image.onload = () => {
        context.drawImage(image, 0, 0);
        commentImageData = dataUrl;
        resolve();
      };

      image.src = dataUrl;
    });
  }

  function pushUndo(action) {
    undoStack.push(action);
    redoStack = [];
  }

  function undo() {
    const action = undoStack.pop();
    if (!action) return;

    if (action.type === "add") {
      points = points.filter(point => point.uid !== action.point.uid);
      removePointElement(action.point.uid);

      const dataType = getDataType(action.point.dataId);
      if (dataType) {
        dataType.counter = Math.max(1, dataType.counter - 1);
        dataType.ordered = false;
      }

      renderDataSelect(action.point.dataId);
    }

    if (action.type === "edit") {
      action.point.measurement = action.oldValue;
      updatePointElement(action.point);
    }

    if (action.type === "move") {
      action.point.x = action.oldX;
      action.point.y = action.oldY;
      action.point.moveDistance =
        Math.max(0, action.point.moveDistance - action.distance);
      action.point.moved = action.point.moveDistance > 0;

      if (action.point.assignedSide) {
        recalculateDataTypeOrder(action.point.dataId);
      }

      updatePointElement(action.point);
    }

    if (action.type === "delete") {
      points.push(action.point);
      createPointElement(action.point);

      if (action.point.assignedSide) {
        recalculateDataTypeOrder(action.point.dataId);
      }

      renderDataSelect(action.point.dataId);
    }

    if (action.type === "assignSide") {
      action.point.assignedSide = action.oldSide;
      recalculateDataTypeOrder(action.dataId);
      renderDataSelect(action.dataId);
    }

    if (action.type === "comment") {
      restoreCommentImage(action.before);
    }

    redoStack.push(action);
    scheduleAutoSave();
  }

  function redo() {
    const action = redoStack.pop();
    if (!action) return;

    if (action.type === "add") {
      points.push(action.point);
      createPointElement(action.point);

      const dataType = getDataType(action.point.dataId);
      if (dataType) {
        dataType.counter += 1;
        dataType.ordered = false;
      }

      renderDataSelect(action.point.dataId);
    }

    if (action.type === "edit") {
      action.point.measurement = action.newValue;
      updatePointElement(action.point);
    }

    if (action.type === "move") {
      action.point.x = action.newX;
      action.point.y = action.newY;
      action.point.moved = true;
      action.point.moveDistance += action.distance;

      if (action.point.assignedSide) {
        recalculateDataTypeOrder(action.point.dataId);
      }

      updatePointElement(action.point);
    }

    if (action.type === "delete") {
      points = points.filter(point => point.uid !== action.point.uid);
      removePointElement(action.point.uid);
    }

    if (action.type === "assignSide") {
      action.point.assignedSide = action.newSide;
      recalculateDataTypeOrder(action.dataId);
      renderDataSelect(action.dataId);
    }

    if (action.type === "comment") {
      restoreCommentImage(action.after);
    }

    undoStack.push(action);
    scheduleAutoSave();
  }

  function exportCSV() {
    const exportTypes = dataTypes.filter(dataType =>
      dataType.export &&
      points.some(point => point.dataId === dataType.id)
    );

    const unorderedTypes =
      exportTypes.filter(dataType => !dataType.ordered);

    if (unorderedTypes.length) {
      alert(
        "Order these data types before exporting:\n\n" +
        unorderedTypes.map(dataType => "• " + dataType.name).join("\n")
      );
      return;
    }

    exportTypes.forEach(dataType => {
      recalculateDataTypeOrder(dataType.id);
    });

    const fileNameInput =
      prompt("Enter CSV file name:", project?.name || "measurements");

    if (!fileNameInput) return;

    const fileName =
      fileNameInput.toLowerCase().endsWith(".csv")
        ? fileNameInput
        : fileNameInput + ".csv";

    const grouped = {};

    exportTypes.forEach(dataType => {
      grouped[dataType.id] = getOrderedPoints(
        dataType.id,
        dataType.direction || "clockwise"
      );
    });

    const maxRows = Math.max(
      0,
      ...exportTypes.map(dataType => grouped[dataType.id].length)
    );

    const headers = [];

    exportTypes.forEach(dataType => {
      headers.push(dataType.name + " Side");
      headers.push(dataType.name + " Seq");
      headers.push(dataType.name + " Measurement");
      headers.push(dataType.name + " Warning");
    });

    let csv = headers.map(cleanCSV).join(",") + "\n";

    for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
      const row = [];

      exportTypes.forEach(dataType => {
        const item = grouped[dataType.id][rowIndex];

        if (!item) {
          row.push("", "", "", "");
          return;
        }

        const point = item.point;

        row.push(item.side);
        row.push(item.seq);
        row.push(point.measurement);

        if (point.moveDistance > 80) {
          row.push("Point moved a large distance; check order");
        } else if (point.moved) {
          row.push("Point moved");
        } else {
          row.push("");
        }
      });

      csv += row.map(cleanCSV).join(",") + "\n";
    }

    downloadBlob(
      new Blob(
        ["\ufeff" + csv],
        { type: "text/csv;charset=utf-8" }
      ),
      fileName
    );
  }

  async function exportPDF() {
    const fileNameInput =
      prompt("Enter PDF file name:", project?.name || "marked_drawing");

    if (!fileNameInput) return;

    const fileName =
      fileNameInput.toLowerCase().endsWith(".pdf")
        ? fileNameInput
        : fileNameInput + ".pdf";

    const oldTransform = els.drawingArea.style.transform;
    els.drawingArea.style.transform = "scale(1)";

    try {
      await html2pdf()
        .set({
          margin: 0,
          filename: fileName,
          image: {
            type: "jpeg",
            quality: 1
          },
          html2canvas: {
            scale: 4,
            useCORS: true,
            backgroundColor: "#ffffff"
          },
          jsPDF: {
            unit: "px",
            format: [
              els.drawingArea.offsetWidth,
              els.drawingArea.offsetHeight
            ],
            orientation:
              els.drawingArea.offsetWidth >
              els.drawingArea.offsetHeight
                ? "landscape"
                : "portrait"
          }
        })
        .from(els.drawingArea)
        .save();
    } finally {
      els.drawingArea.style.transform = oldTransform;
    }
  }

  function scheduleAutoSave() {
    if (!project) return;

    isDirty = true;
    els.saveIndicator.textContent = "Unsaved";
    els.saveIndicator.classList.add("saving");

    clearTimeout(saveTimer);

    /*
      Batch rapid field edits into one IndexedDB write.
      This avoids writing after every tap.
    */
    saveTimer = setTimeout(() => {
      saveNow(false).catch(error => {
        console.error("Autosave failed:", error);
        els.saveIndicator.textContent = "Save failed";
      });
    }, 1600);
  }

  async function saveNow(force = false) {
    if (!project) return;
    if (!force && !isDirty) return;

    clearTimeout(saveTimer);
    showSaving();

    project.state = {
      points,
      dataTypes,
      pointMode,
      showOrderLabels,
      zoomLevel,
      selectedDataId: els.dataSelect.value,

      /*
        commentImageData is refreshed only when a pen/eraser stroke ends.
        Avoiding canvas.toDataURL() here removes the largest autosave delay.
      */
      commentImageData,
      scrollLeft: els.drawingWrapper.scrollLeft,
      scrollTop: els.drawingWrapper.scrollTop
    };

    await ProjectDB.saveProject(project);

    isDirty = false;
    showSaved();
  }

  function showSaving() {
    els.saveIndicator.textContent = "Saving…";
    els.saveIndicator.classList.add("saving");
  }

  function showSaved() {
    els.saveIndicator.textContent = "Saved";
    els.saveIndicator.classList.remove("saving");
  }

  function applyZoom() {
    els.drawingArea.style.transform = `scale(${zoomLevel})`;
  }

  function getDrawingPosition(event) {
    const rect = els.drawingArea.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / zoomLevel,
      y: (event.clientY - rect.top) / zoomLevel
    };
  }

  function getCanvasPosition(event) {
    const rect = els.commentCanvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / zoomLevel,
      y: (event.clientY - rect.top) / zoomLevel
    };
  }

  function getDataType(id) {
    return dataTypes.find(dataType => dataType.id === id);
  }

  function findPointElement(uid) {
    return els.drawingArea.querySelector(`[data-uid="${uid}"]`);
  }

  function removePointElement(uid) {
    const element = findPointElement(uid);
    if (element) element.remove();
  }

  function removeAllPointElements() {
    els.drawingArea
      .querySelectorAll(".point")
      .forEach(element => element.remove());
  }

  function refreshAllPoints() {
    points.forEach(updatePointElement);
  }

  function clearPointSelection() {
    document
      .querySelectorAll(".point.selected, .point.movingPoint")
      .forEach(element => {
        element.classList.remove("selected");
        element.classList.remove("movingPoint");
      });

    if (!isDraggingPoint) {
      els.drawingWrapper.classList.remove("pointDragActive");
    }
  }

  function setStatus(message) {
    els.status.textContent = message;
  }

  function cleanCSV(value) {
    return '"' +
      String(value ?? "").replace(/"/g, '""') +
      '"';
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  return {
    init,
    openProject,
    closeProject,
    scheduleAutoSave,
    saveNow
  };
})();
