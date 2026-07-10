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

  let tapReorderState = null;

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

  let directionCallback = null;
  let fileNameCallback = null;

  let undoStack = [];
  let redoStack = [];

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
    els.zoomOutBtn = document.getElementById("zoomOutBtn");
    els.zoomInBtn = document.getElementById("zoomInBtn");
    els.zoomDisplay = document.getElementById("zoomDisplay");
    els.orderBtn = document.getElementById("orderBtn");
    els.labelsBtn = document.getElementById("labelsBtn");
    els.exportCsvBtn = document.getElementById("exportCsvBtn");
    els.exportPdfBtn = document.getElementById("exportPdfBtn");
    els.manualSaveBtn = document.getElementById("manualSaveBtn");

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
    els.pointMoveUpAction = document.getElementById("pointMoveUpAction");
    els.pointMoveDownAction = document.getElementById("pointMoveDownAction");
    els.pointReorderSideAction = document.getElementById("pointReorderSideAction");
    els.pointDeleteAction = document.getElementById("pointDeleteAction");

    els.reorderBar = document.getElementById("reorderBar");
    els.reorderBarText = document.getElementById("reorderBarText");
    els.reorderCancelBtn = document.getElementById("reorderCancelBtn");

    els.measurementModal = document.getElementById("measurementModal");
    els.measurementTitle = document.getElementById("measurementTitle");
    els.measurementDisplay = document.getElementById("measurementDisplay");
    els.measurementError = document.getElementById("measurementError");
    els.cancelMeasurementBtn = document.getElementById("cancelMeasurementBtn");

    els.directionModal = document.getElementById("directionModal");
    els.cancelDirectionBtn = document.getElementById("cancelDirectionBtn");

    els.fileNameModal = document.getElementById("fileNameModal");
    els.fileNameModalTitle = document.getElementById("fileNameModalTitle");
    els.fileNameInput = document.getElementById("fileNameInput");
    els.confirmFileNameBtn = document.getElementById("confirmFileNameBtn");
    els.cancelFileNameBtn = document.getElementById("cancelFileNameBtn");

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

    SaveController.init({
      statusElement: els.saveIndicator,
      intervalMs: 3 * 60 * 1000,
      saveFunction: async () => {
        await persistProjectState();
      }
    });
  }

  function bindEvents() {
    els.backHomeBtn.addEventListener("click", async () => {
      els.backHomeBtn.disabled = true;

      try {
        if (SaveController.isDirty()) {
          setStatus("Saving before returning to Library…");
          await SaveController.save("library", true);
        }

        await closeProject(false);
        App.showLibrary();
      } catch (error) {
        console.error(error);

        const details = ProjectDB.explainError
          ? ProjectDB.explainError(error)
          : String(error);

        const choice = confirm(
          "Save failed.\n\n" + details +
          "\n\nReturn to Library without saving recent changes?"
        );

        if (choice) {
          await closeProject(false);
          App.showLibrary();
        }
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

    els.manualSaveBtn.addEventListener("click", async () => {
      els.manualSaveBtn.disabled = true;

      try {
        await SaveController.save("manual", true);
        setStatus("Saved manually.");
      } catch (error) {
        console.error(error);

        const details = ProjectDB.explainError
          ? ProjectDB.explainError(error)
          : String(error);

        alert("Save failed.\n\n" + details);
      } finally {
        els.manualSaveBtn.disabled = false;
      }
    });

    document.addEventListener("keydown", event => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
        return;
      }

      event.preventDefault();
      SaveController.save("keyboard", true).catch(console.error);
    });

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

    els.zoomInBtn.addEventListener("click", () => {
      changeZoom(0.2);
    });

    els.zoomOutBtn.addEventListener("click", () => {
      changeZoom(-0.2);
    });

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

    els.pointMoveUpAction.addEventListener("click", () => {
      hidePointContextMenu();
      if (contextPoint) movePointInSequence(contextPoint, -1);
    });

    els.pointMoveDownAction.addEventListener("click", () => {
      hidePointContextMenu();
      if (contextPoint) movePointInSequence(contextPoint, 1);
    });

    els.pointReorderSideAction.addEventListener("click", () => {
      hidePointContextMenu();
      if (contextPoint) startTapReorder(contextPoint);
    });

    els.reorderCancelBtn.addEventListener("click", cancelTapReorder);

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

    els.measurementModal.querySelectorAll("[data-denominator]").forEach(button => {
      button.addEventListener("click", () => {
        appendMeasurementDenominator(button.dataset.denominator);
      });
    });

    els.measurementModal
      .querySelector('[data-action="backspace"]')
      .addEventListener("click", measurementBackspace);


    els.measurementModal
      .querySelector('[data-action="negative"]')
      .addEventListener("click", toggleMeasurementNegative);

    els.measurementModal
      .querySelector('[data-action="confirm"]')
      .addEventListener("click", confirmMeasurement);

    els.cancelMeasurementBtn.addEventListener("click", cancelMeasurement);

    els.directionModal.querySelectorAll("[data-direction]").forEach(button => {
      button.addEventListener("click", () => {
        chooseDirection(button.dataset.direction);
      });
    });

    els.cancelDirectionBtn.addEventListener("click", () => chooseDirection(null));

    els.confirmFileNameBtn.addEventListener("click", confirmFileName);
    els.cancelFileNameBtn.addEventListener("click", () => closeFileNameModal(null));

    els.fileNameInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirmFileName();
      }
    });

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
    SaveController.markSaved();
    setStatus("Project loaded. Press Save anytime; safety save runs every 3 minutes.");
  }

  async function closeProject(saveBeforeClosing = true) {
    if (!project) return;

    if (saveBeforeClosing && SaveController.isDirty()) {
      await SaveController.save("close", true);
    }

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

    SaveController.markSaved();
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
    if (tapReorderState) return;
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

    if (dataType.manual) {
      // Keep the manual order: guess this point's side and append it last.
      const sidePoints = points.filter(p => p.dataId === dataType.id);
      const bounds = getBounds(sidePoints);
      point.assignedSide = guessSide(point, bounds);

      const sideMax = Math.max(
        0,
        ...sidePoints
          .filter(p => p.assignedSide === point.assignedSide && p !== point)
          .map(p => p.manualSeq || 0)
      );

      point.manualSeq = sideMax + 1;
    } else {
      dataType.ordered = false;
    }

    pushUndo({ type: "add", point });
    createPointElement(point);
    renderDataSelect(dataType.id);

    if (dataType.manual) {
      recalculateDataTypeOrder(dataType.id);
    }

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

      if (tapReorderState) {
        handleTapReorderPoint(point);
        return;
      }

      if (commentTool !== "none" || isDraggingPoint) return;
      editPoint(point);
    });

    element.addEventListener("contextmenu", event => {
      event.preventDefault();
      event.stopPropagation();
      if (tapReorderState) return;
      showPointContextMenu(event.clientX, event.clientY, point);
    });

    let timer = null;

    element.addEventListener("touchstart", event => {
      if (tapReorderState) return;
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
      setStatus("This data type has no points to order yet.");
      return;
    }

    openDirectionModal(dataType.direction || "clockwise", direction => {
      if (!direction) return;

      dataType.direction = direction;
      dataType.manual = false;
      assignMissingSidesForData(dataType.id);
      dataType.ordered = true;

      recalculateDataTypeOrder(dataType.id);

      showOrderLabels = true;
      updateLabelsButton();
      refreshAllPoints();
      renderDataSelect(dataType.id);

      setStatus(`${dataType.name} ordered ${direction}.`);

      scheduleAutoSave();
    });
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

  /*
    Ordering. By default this is the original bounding-box method: points are
    grouped into N/E/S/W by which edge of the bounding box they are nearest to,
    then each side is numbered along that edge.

    If the data type is in MANUAL mode (the user has adjusted the order by hand
    with Move Up/Down or Reorder-by-Tapping), the stored manual order is used
    instead of geometry. Pressing "Order Current Data" again clears manual mode
    and returns to automatic ordering.
  */
  function getOrderedPoints(dataId, direction) {
    const dataType = getDataType(dataId);

    if (dataType && dataType.manual) {
      return getManualOrderedPoints(dataId, direction);
    }

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

  /*
    Manual order: within each side, points are sorted by their stored
    manualSeq. buildOrderedList then renumbers them 1..n, so gaps left by
    deletions do not matter.
  */
  function getManualOrderedPoints(dataId, direction) {
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

    Object.keys(groups).forEach(side => {
      groups[side].sort((a, b) => (a.manualSeq || 0) - (b.manualSeq || 0));
    });

    const sideOrder = direction === "clockwise"
      ? ["N", "E", "S", "W"]
      : ["N", "W", "S", "E"];

    return buildOrderedList(groups, sideOrder);
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

  /* ---------- Manual sequence adjustments ---------- */

  /*
    Capture the full ordering state of one data type (the manual/ordered flags
    plus every point's side and manualSeq) so a reorder can be undone/redone as
    a single step, however many points it touched.
  */
  function snapshotOrder(dataId) {
    const dataType = getDataType(dataId);

    return {
      manual: !!(dataType && dataType.manual),
      ordered: !!(dataType && dataType.ordered),
      points: points
        .filter(p => p.dataId === dataId)
        .map(p => ({
          uid: p.uid,
          manualSeq: p.manualSeq,
          assignedSide: p.assignedSide
        }))
    };
  }

  function restoreOrder(dataId, snap) {
    const dataType = getDataType(dataId);

    if (dataType) {
      dataType.manual = snap.manual;
      dataType.ordered = snap.ordered;
    }

    const byUid = {};
    snap.points.forEach(entry => {
      byUid[entry.uid] = entry;
    });

    points
      .filter(p => p.dataId === dataId)
      .forEach(p => {
        const entry = byUid[p.uid];
        if (entry) {
          p.manualSeq = entry.manualSeq;
          p.assignedSide = entry.assignedSide;
        }
      });

    recalculateDataTypeOrder(dataId);
    refreshAllPoints();
    renderDataSelect(dataId);
  }

  /*
    Freeze the current automatic order into each point's manualSeq (numbered
    per side), and switch the data type into manual mode. Idempotent.
  */
  function enterManualMode(dataId) {
    const dataType = getDataType(dataId);
    if (!dataType || dataType.manual) return;

    const ordered = getOrderedPoints(
      dataId,
      dataType.direction || "clockwise"
    );

    ordered.forEach(item => {
      item.point.assignedSide = item.side;
      item.point.manualSeq = item.seq;
    });

    dataType.manual = true;
  }

  function movePointInSequence(point, delta) {
    const dataType = getDataType(point.dataId);
    if (!dataType) return;

    if (!dataType.ordered) {
      setStatus("Order this data first, then adjust the sequence.");
      return;
    }

    const side = point.assignedSide;

    // Current order of this side, honouring auto or manual mode.
    const sideList = getOrderedPoints(point.dataId, dataType.direction || "clockwise")
      .filter(item => item.side === side)
      .map(item => item.point);

    const index = sideList.indexOf(point);
    const swapIndex = index + delta;

    if (index < 0 || swapIndex < 0 || swapIndex >= sideList.length) {
      setStatus(
        delta < 0
          ? "Already first on this side."
          : "Already last on this side."
      );
      return;
    }

    const other = sideList[swapIndex];

    const before = snapshotOrder(point.dataId);
    enterManualMode(point.dataId);

    const temp = point.manualSeq;
    point.manualSeq = other.manualSeq;
    other.manualSeq = temp;

    const after = snapshotOrder(point.dataId);
    pushUndo({ type: "reorder", dataId: point.dataId, before, after });

    recalculateDataTypeOrder(point.dataId);
    refreshAllPoints();
    renderDataSelect(dataType.id);

    setStatus(
      `Moved ${point.measurement} ${delta < 0 ? "up" : "down"} on side ${side}.`
    );

    scheduleAutoSave();
  }

  function startTapReorder(point) {
    const dataType = getDataType(point.dataId);
    if (!dataType) return;

    if (!dataType.ordered) {
      setStatus("Order this data first, then reorder a side.");
      return;
    }

    const side = point.assignedSide;

    const total = points.filter(
      p => p.dataId === point.dataId && p.assignedSide === side
    ).length;

    tapReorderState = {
      dataId: point.dataId,
      side,
      total,
      order: []
    };

    clearPointSelection();
    updateReorderBar();
    els.reorderBar.classList.remove("hidden");
  }

  function handleTapReorderPoint(point) {
    if (!tapReorderState) return;

    if (
      point.dataId !== tapReorderState.dataId ||
      point.assignedSide !== tapReorderState.side
    ) {
      setStatus(`Tap points on side ${tapReorderState.side} only.`);
      return;
    }

    if (tapReorderState.order.includes(point)) return;

    tapReorderState.order.push(point);

    const element = findPointElement(point.uid);
    if (element) {
      element.classList.add("reorderPicked");
      element.textContent = String(tapReorderState.order.length);
    }

    updateReorderBar();

    if (tapReorderState.order.length === tapReorderState.total) {
      finishTapReorder();
    }
  }

  function updateReorderBar() {
    if (!tapReorderState) return;

    els.reorderBarText.textContent =
      `Tap side ${tapReorderState.side} points in order: ` +
      `${tapReorderState.order.length} / ${tapReorderState.total}`;
  }

  function finishTapReorder() {
    if (!tapReorderState) return;

    const { dataId, order } = tapReorderState;

    const before = snapshotOrder(dataId);

    // Baseline the other sides, then override this side with the tap order.
    enterManualMode(dataId);

    order.forEach((point, index) => {
      point.manualSeq = index + 1;
    });

    const dataType = getDataType(dataId);
    if (dataType) dataType.manual = true;

    const after = snapshotOrder(dataId);
    pushUndo({ type: "reorder", dataId, before, after });

    tapReorderState = null;
    els.reorderBar.classList.add("hidden");

    recalculateDataTypeOrder(dataId);
    refreshAllPoints();
    if (dataType) renderDataSelect(dataType.id);

    setStatus("Side reordered by tapping.");
    scheduleAutoSave();
  }

  function cancelTapReorder() {
    if (!tapReorderState) return;

    tapReorderState = null;
    els.reorderBar.classList.add("hidden");
    refreshAllPoints();
    setStatus("Reorder cancelled.");
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
    hideMeasurementError();
  }

  /*
    A valid measurement is: an optional minus sign, then a whole number,
    an optional whole number followed by a fraction, or a bare fraction.
    Denominators must be 1 or greater. Examples: 26, 26 3/8, -12 1/2, 3/16.
    Rejects junk like //, 3/8/16, 3/0, and stray extra minus signs.
  */
  function isValidMeasurement(value) {
    const fraction = "\\d+\\/[1-9]\\d*";
    const pattern = new RegExp(
      "^-?(\\d+(\\s" + fraction + ")?|" + fraction + ")$"
    );

    return pattern.test(String(value).trim());
  }

  function showMeasurementError(message) {
    if (!els.measurementError) return;
    els.measurementError.textContent = message;
    els.measurementError.classList.remove("hidden");
  }

  function hideMeasurementError() {
    if (!els.measurementError) return;
    els.measurementError.classList.add("hidden");
  }

  function appendMeasurementValue(value) {
    setMeasurementRawValue(measurementRawValue + value);
  }

  function appendMeasurementDenominator(denominator) {
    /*
      Example:
      3 + /8  -> 3/8
      26_3 + /8 -> 26_3/8

      If the current value already ends in a completed fraction, the button
      starts a new fraction after a visible space.
    */
    let nextValue = measurementRawValue;

    if (!nextValue) {
      setMeasurementRawValue("1/" + denominator);
      return;
    }

    const lastToken = nextValue.split(" ").pop();

    if (lastToken.includes("/")) {
      if (!nextValue.endsWith(" ")) nextValue += " ";
      nextValue += "1/" + denominator;
    } else {
      nextValue += "/" + denominator;
    }

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
    hideMeasurementError();
    els.measurementModal.classList.remove("hidden");
  }

  function confirmMeasurement() {
    // Collapse any repeated spaces the keypad may have produced.
    const value = measurementRawValue.trim().replace(/\s+/g, " ");

    // Pressing OK with nothing typed behaves like Cancel.
    if (!value) {
      cancelMeasurement();
      return;
    }

    if (!isValidMeasurement(value)) {
      showMeasurementError(
        "Check the format. Examples: 26, 26 3/8, -12 1/2, 3/16."
      );
      return;
    }

    const callback = measurementCallback;

    measurementCallback = null;
    hideMeasurementError();
    els.measurementModal.classList.add("hidden");

    if (callback) callback(value);
  }

  function cancelMeasurement() {
    measurementCallback = null;
    measurementRawValue = "";
    hideMeasurementError();
    els.measurementModal.classList.add("hidden");
  }

  /* ---------- Order-direction and file-name modals (replace prompt) ---------- */

  function openDirectionModal(current, callback) {
    directionCallback = callback;

    els.directionModal.querySelectorAll("[data-direction]").forEach(button => {
      button.classList.toggle(
        "selectedChoice",
        button.dataset.direction === current
      );
    });

    els.directionModal.classList.remove("hidden");
  }

  function chooseDirection(direction) {
    const callback = directionCallback;
    directionCallback = null;
    els.directionModal.classList.add("hidden");
    if (callback) callback(direction);
  }

  function openFileNameModal(title, defaultName, callback) {
    fileNameCallback = callback;
    els.fileNameModalTitle.textContent = title;
    els.fileNameInput.value = defaultName || "";
    els.fileNameModal.classList.remove("hidden");

    setTimeout(() => {
      els.fileNameInput.focus();
      els.fileNameInput.select();
    }, 50);
  }

  function confirmFileName() {
    const value = els.fileNameInput.value.trim();
    if (!value) return;
    closeFileNameModal(value);
  }

  function closeFileNameModal(value) {
    const callback = fileNameCallback;
    fileNameCallback = null;
    els.fileNameModal.classList.add("hidden");
    if (callback) callback(value);
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

    if (action.type === "reorder") {
      restoreOrder(action.dataId, action.before);
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

    if (action.type === "reorder") {
      restoreOrder(action.dataId, action.after);
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

    openFileNameModal("Export CSV", project?.name || "measurements", chosen => {
      if (!chosen) return;

      const fileName =
        chosen.toLowerCase().endsWith(".csv") ? chosen : chosen + ".csv";

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
    });
  }

  function exportPDF() {
    openFileNameModal("Export PDF", project?.name || "marked_drawing", chosen => {
      if (!chosen) return;

      const fileName =
        chosen.toLowerCase().endsWith(".pdf") ? chosen : chosen + ".pdf";

      renderPdf(fileName);
    });
  }

  async function renderPdf(fileName) {
    /*
      The old exporter used html2canvas at scale 4 on a PDF that was already
      rendered at high resolution. On iPad this can exceed Safari's canvas
      memory/pixel limit and produce a completely blank PDF.

      This exporter builds one controlled-size canvas directly from:
      1. the rendered PDF/image,
      2. pen comments,
      3. measurement text.

      It does not screenshot the webpage and is not affected by zoom.
    */
    try {
      const sourceWidth =
        project?.kind === "pdf"
          ? els.pdfCanvas.width
          : Number(project?.blankWidth || els.drawingArea.offsetWidth);

      const sourceHeight =
        project?.kind === "pdf"
          ? els.pdfCanvas.height
          : Number(project?.blankHeight || els.drawingArea.offsetHeight);

      if (!sourceWidth || !sourceHeight) {
        throw new Error("Drawing dimensions are unavailable.");
      }

      /*
        Conservative limits for older iPads.
        Keep output under roughly 12 million pixels and 8192 px per side.
      */
      const maxPixels = 12_000_000;
      const maxDimension = 8192;

      const areaScale = Math.sqrt(maxPixels / (sourceWidth * sourceHeight));
      const dimensionScale = Math.min(
        maxDimension / sourceWidth,
        maxDimension / sourceHeight
      );

      const exportScale = Math.min(1, areaScale, dimensionScale);

      const exportWidth = Math.max(1, Math.round(sourceWidth * exportScale));
      const exportHeight = Math.max(1, Math.round(sourceHeight * exportScale));

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;

      const context = exportCanvas.getContext("2d", {
        alpha: false
      });

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, exportWidth, exportHeight);
      context.save();
      context.scale(exportScale, exportScale);

      if (project?.kind === "pdf") {
        context.drawImage(els.pdfCanvas, 0, 0);
      } else if (
        els.drawingImage &&
        !els.drawingImage.classList.contains("hidden") &&
        els.drawingImage.complete
      ) {
        context.drawImage(
          els.drawingImage,
          0,
          0,
          sourceWidth,
          sourceHeight
        );
      }

      if (els.commentCanvas.width && els.commentCanvas.height) {
        context.drawImage(els.commentCanvas, 0, 0);
      }

      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "30px Arial, sans-serif";
      context.lineJoin = "round";

      points.forEach(point => {
        const dataType = getDataType(point.dataId);
        if (dataType?.export === false) return;

        const measurement = point.measurement || String(point.number);

        const label =
          showOrderLabels && point.assignedSide && point.assignedSeq
            ? `${point.assignedSide}${point.assignedSeq} ${measurement}`
            : measurement;

        // White outline first, then the coloured text on top.
        context.lineWidth = 6;
        context.strokeStyle = "#ffffff";
        context.strokeText(label, point.x, point.y);

        context.fillStyle = dataType?.color || "#000000";
        context.fillText(label, point.x, point.y);
      });

      context.restore();

      await html2pdf()
        .set({
          margin: 0,
          filename: fileName,
          image: {
            type: "jpeg",
            quality: 0.98
          },
          jsPDF: {
            unit: "px",
            format: [exportWidth, exportHeight],
            orientation:
              exportWidth > exportHeight
                ? "landscape"
                : "portrait",
            compress: true
          }
        })
        .from(exportCanvas)
        .save();

      setStatus(
        exportScale < 1
          ? `PDF exported at ${Math.round(exportScale * 100)}% resolution for iPad compatibility.`
          : "PDF exported."
      );
    } catch (error) {
      console.error("PDF export failed:", error);
      alert(
        "PDF export failed.\n\n" +
        (error?.message || String(error))
      );
    }
  }

  function scheduleAutoSave() {
    /*
      Version 5:
      Editing no longer writes to IndexedDB immediately.
      It only marks the project as Unsaved.
      Save occurs by:
      1. pressing Save,
      2. the 3-minute safety timer,
      3. returning to Library.
    */
    if (!project) return;

    isDirty = true;
    SaveController.markUnsaved();
  }

  async function persistProjectState() {
    if (!project) return;

    project.state = {
      points,
      dataTypes,
      pointMode,
      showOrderLabels,
      zoomLevel,
      selectedDataId: els.dataSelect.value,
      commentImageData,
      scrollLeft: els.drawingWrapper.scrollLeft,
      scrollTop: els.drawingWrapper.scrollTop
    };

    await ProjectDB.saveProject(project);

    isDirty = false;
  }

  async function saveNow(force = false) {
    return SaveController.save("workspace", force);
  }

  function showSaving() {
    SaveController.markSaving();
  }

  function showSaved() {
    SaveController.markSaved();
  }

  function changeZoom(delta) {
    const wrapper = els.drawingWrapper;
    const oldZoom = zoomLevel;

    const centerX = wrapper.scrollLeft + wrapper.clientWidth / 2;
    const centerY = wrapper.scrollTop + wrapper.clientHeight / 2;

    zoomLevel = Math.max(
      0.3,
      Math.min(5, Math.round((zoomLevel + delta) * 100) / 100)
    );

    if (zoomLevel === oldZoom) return;

    applyZoom();

    const ratio = zoomLevel / oldZoom;

    requestAnimationFrame(() => {
      wrapper.scrollLeft = centerX * ratio - wrapper.clientWidth / 2;
      wrapper.scrollTop = centerY * ratio - wrapper.clientHeight / 2;
    });

    scheduleAutoSave();
  }

  function applyZoom() {
    els.drawingArea.style.transform = `scale(${zoomLevel})`;

    if (els.zoomDisplay) {
      els.zoomDisplay.textContent = Math.round(zoomLevel * 100) + "%";
    }

    if (els.zoomOutBtn) {
      els.zoomOutBtn.disabled = zoomLevel <= 0.3;
    }

    if (els.zoomInBtn) {
      els.zoomInBtn.disabled = zoomLevel >= 5;
    }
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
