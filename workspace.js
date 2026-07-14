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
  let brushColor = "#ff0000";
  let brushWidth = 5;
  let showOrderLabels = false;
  let zoomLevel = 1;
  let labelFontSize = 30;

  let pinchActive = false;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  let clickStartX = 0;
  let clickStartY = 0;
  let clickMoved = false;

  let contextPoint = null;
  let movingPoint = null;

  let tapReorderState = null;
  let batchAssignMode = false;
  let batchAssignPoints = new Set();

  let isDraggingPoint = false;
  let draggedPoint = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragLockedScrollLeft = 0;
  let dragLockedScrollTop = 0;

  let isDrawingComment = false;
  let lastCommentX = 0;
  let lastCommentY = 0;
  let lastCommentPressure = 0.5;
  let commentBeforeStroke = "";
  let commentImageData = "";
  let commentFingerPan = null;
  let pendingTextPosition = null;
  let highlightPoints = [];

  let textNotes = [];
  let selectedNoteId = null;
  let editingNoteId = null;
  let noteDrag = null;
  let textNoteColor = "#ff0000";
  let reviewFilter = "all";
  let currentSide = "";
  let setPositionPoint = null;
  let pendingExportTypes = null;
  let workspaceMode = "measure";

  let measurementCallback = null;
  let measurementRawValue = "";

  let directionCallback = null;
  let fileNameCallback = null;
  let lastAutoSortDataId = null;
  let lastAutoSortSide = "N";
  let lastAutoSortDirection = "clockwise";

  let pdfDocument = null;
  let currentPdfPage = 1;
  let totalPdfPages = 1;
  let pageStates = {};
  let pageThumbnailObserver = null;
  let pageThumbnailRenderToken = 0;
  let switchingPage = false;
  let activePdfRenderTask = null;
  const thumbnailRenderTasks = new Set();

  // Keep the original scale-5 coordinate system so existing points and markup
  // stay in the correct locations, but render the PDF backing canvas at a
  // smaller adaptive resolution. This is much faster on iPad and avoids huge
  // canvas allocations while the CSS size remains unchanged.
  const PDF_LOGICAL_SCALE = 5;
  const PDF_MAX_RENDER_PIXELS = 10_000_000;
  const PDF_MAX_RENDER_DIMENSION = 4096;

  let undoStack = [];
  let redoStack = [];

  let isDirty = false;

  const els = {};

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "lib/pdf.worker.min.js";

  function init() {
    els.workspaceView = document.getElementById("workspaceView");
    els.workspaceProjectName = document.getElementById("workspaceProjectName");
    els.backHomeBtn = document.getElementById("backHomeBtn");

    els.dataSelect = document.getElementById("dataSelect");
    els.addBtn = document.getElementById("addBtn");
    els.lockBtn = document.getElementById("lockBtn");
    els.textBtn = document.getElementById("textBtn");
    els.markupMenu = document.getElementById("markupMenu");
    els.markupSummary = document.getElementById("markupSummary");
    els.highlighterBtn = document.getElementById("highlighterBtn");
    els.penBtn = document.getElementById("penBtn");
    els.eraserBtn = document.getElementById("eraserBtn");
    els.colorSwatches = Array.from(document.querySelectorAll("[data-brush-color]"));
    els.textColorSwatches = Array.from(document.querySelectorAll("[data-text-color]"));
    els.sizeChoices = Array.from(document.querySelectorAll("[data-brush-size]"));
    els.undoBtn = document.getElementById("undoBtn");
    els.redoBtn = document.getElementById("redoBtn");
    els.zoomOutBtn = document.getElementById("zoomOutBtn");
    els.zoomInBtn = document.getElementById("zoomInBtn");
    els.zoomDisplay = document.getElementById("zoomDisplay");
    els.labelSizeDownBtn = document.getElementById("labelSizeDownBtn");
    els.labelSizeUpBtn = document.getElementById("labelSizeUpBtn");
    els.labelSizeDisplay = document.getElementById("labelSizeDisplay");
    els.fitBtn = document.getElementById("fitBtn");
    els.pageBtn = document.getElementById("pageBtn");
    els.pageDisplay = document.getElementById("pageDisplay");
    els.pageModal = document.getElementById("pageModal");
    els.pageModalSummary = document.getElementById("pageModalSummary");
    els.pageList = document.getElementById("pageList");
    els.closePageModalBtn = document.getElementById("closePageModalBtn");

    els.reviewBtn = document.getElementById("reviewBtn");
    els.reviewSidebar = document.getElementById("reviewSidebar");
    els.reviewList = document.getElementById("reviewList");
    els.closeReviewBtn = document.getElementById("closeReviewBtn");
    els.orderBtn = document.getElementById("orderBtn");
    els.measureModeBtn = document.getElementById("measureModeBtn");
    els.reviewModeBtn = document.getElementById("reviewModeBtn");
    els.drawingToolsRow = document.querySelector(".drawingTools");
    els.dataTypeSwatch = document.getElementById("dataTypeSwatch");
    els.batchAssignBtn = document.getElementById("batchAssignBtn");
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
    els.pointSetPositionAction = document.getElementById("pointSetPositionAction");
    els.pointMoveAction = document.getElementById("pointMoveAction");
    els.pointExcludeAction = document.getElementById("pointExcludeAction");
    els.pointDeleteAction = document.getElementById("pointDeleteAction");

    els.autoSortModal = document.getElementById("autoSortModal");
    els.autoSortDataType = document.getElementById("autoSortDataType");
    els.autoSortSide = document.getElementById("autoSortSide");
    els.autoSortDirectionChoices = Array.from(document.querySelectorAll('input[name="autoSortDirection"]'));
    els.confirmAutoSortBtn = document.getElementById("confirmAutoSortBtn");
    els.cancelAutoSortBtn = document.getElementById("cancelAutoSortBtn");
    els.sideChoices = Array.from(document.querySelectorAll(".sideBtn"));

    els.setPositionModal = document.getElementById("setPositionModal");
    els.setPositionInfo = document.getElementById("setPositionInfo");
    els.setPositionInput = document.getElementById("setPositionInput");
    els.confirmSetPositionBtn = document.getElementById("confirmSetPositionBtn");
    els.cancelSetPositionBtn = document.getElementById("cancelSetPositionBtn");

    els.noSideModal = document.getElementById("noSideModal");
    els.noSideModalText = document.getElementById("noSideModalText");
    els.assignSideBtn = document.getElementById("assignSideBtn");
    els.exportAnywayBtn = document.getElementById("exportAnywayBtn");
    els.noSideBanner = document.getElementById("noSideBanner");
    els.noSideBannerText = document.getElementById("noSideBannerText");

    els.reorderBar = document.getElementById("reorderBar");
    els.reorderBarText = document.getElementById("reorderBarText");
    els.reorderCancelBtn = document.getElementById("reorderCancelBtn");
    els.batchAssignBar = document.getElementById("batchAssignBar");
    els.batchAssignText = document.getElementById("batchAssignText");
    els.batchAutoBtn = document.getElementById("batchAutoBtn");
    els.batchCancelBtn = document.getElementById("batchCancelBtn");
    els.batchSideButtons = Array.from(document.querySelectorAll("[data-batch-side]"));

    els.measurementModal = document.getElementById("measurementModal");
    els.measurementTitle = document.getElementById("measurementTitle");
    els.measurementDisplay = document.getElementById("measurementDisplay");
    els.measurementError = document.getElementById("measurementError");
    els.missingValueBtn = document.getElementById("missingValueBtn");
    els.textModal = document.getElementById("textModal");
    els.textInput = document.getElementById("textInput");
    els.cancelTextBtn = document.getElementById("cancelTextBtn");
    els.confirmTextBtn = document.getElementById("confirmTextBtn");
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
    els.textBtn.addEventListener("click", () => toggleCommentTool("text"));
    els.highlighterBtn.addEventListener("click", () => toggleCommentTool("highlighter"));
    if (els.penBtn) els.penBtn.addEventListener("click", () => toggleCommentTool("pen"));
    els.eraserBtn.addEventListener("click", () => toggleCommentTool("eraser"));

    if (els.markupSummary) {
      els.markupSummary.addEventListener("click", event => {
        // If a markup tool is active, one tap on "Markup" turns it off
        // (and does not re-open the menu).
        if (commentTool !== "none") {
          event.preventDefault();
          toggleCommentTool(commentTool);
        }
      });
    }
    els.colorSwatches.forEach(button => {
      button.addEventListener("click", () => {
        brushColor = button.dataset.brushColor;
        updateBrushControls();
        scheduleAutoSave();
      });
    });

    els.textColorSwatches.forEach(button => {
      button.addEventListener("click", () => {
        setTextColor(button.dataset.textColor);
      });
    });

    if (els.markupMenu) {
      els.markupMenu.addEventListener("toggle", () => {
        if (els.markupMenu.open) positionMarkupPanel();
      });
    }

    els.sizeChoices.forEach(button => {
      button.addEventListener("click", () => {
        brushWidth = Number(button.dataset.brushSize) || 5;
        updateBrushControls();
        scheduleAutoSave();
      });
    });

    els.undoBtn.addEventListener("click", undo);
    els.redoBtn.addEventListener("click", redo);

    els.orderBtn.addEventListener("click", () => {
      openAutoSortModal();
    });

    if (els.measureModeBtn) {
      els.measureModeBtn.addEventListener("click", () => setWorkspaceMode("measure"));
    }
    if (els.reviewModeBtn) {
      els.reviewModeBtn.addEventListener("click", () => setWorkspaceMode("review"));
    }
    els.batchAssignBtn.addEventListener("click", startBatchAssign);
    els.batchSideButtons.forEach(button => {
      button.addEventListener("click", () => applyBatchSide(button.dataset.batchSide));
    });
    els.batchAutoBtn.addEventListener("click", resetBatchToAuto);
    els.batchCancelBtn.addEventListener("click", cancelBatchAssign);
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

    els.drawingArea.addEventListener("pointerdown", event => {
      clickStartX = event.clientX;
      clickStartY = event.clientY;
      clickMoved = false;
    });
    els.drawingArea.addEventListener("pointermove", event => {
      if (!clickMoved &&
          Math.hypot(event.clientX - clickStartX, event.clientY - clickStartY) > 10) {
        clickMoved = true;
      }
    });
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

    els.zoomDisplay.addEventListener("click", () => resetZoom());
    if (els.fitBtn) els.fitBtn.addEventListener("click", fitDrawing);
    els.pageBtn.addEventListener("click", openPageModal);
    els.closePageModalBtn.addEventListener("click", closePageModal);

    if (els.reviewBtn) els.reviewBtn.addEventListener("click", toggleReviewSidebar);
    if (els.closeReviewBtn) els.closeReviewBtn.addEventListener("click", () => {
      els.reviewSidebar.classList.add("hidden");
    });

    if (els.labelSizeDownBtn) {
      els.labelSizeDownBtn.addEventListener("click", () => changeLabelFontSize(-2));
    }
    if (els.labelSizeUpBtn) {
      els.labelSizeUpBtn.addEventListener("click", () => changeLabelFontSize(2));
    }
    if (els.labelSizeDisplay) {
      els.labelSizeDisplay.addEventListener("click", resetLabelFontSize);
    }

    /*
      Two-finger pinch zooms the drawing only. The toolbar and page stay put
      because the toolbar lives outside the scroll area and page zoom is
      disabled in the viewport meta tag.
    */
    els.drawingWrapper.addEventListener("touchstart", event => {
      if (event.touches.length !== 2) return;
      pinchActive = true;
      abortActiveInteraction();
      pinchStartDist = touchDistance(event.touches[0], event.touches[1]);
      pinchStartZoom = zoomLevel;
      event.preventDefault();
    }, { passive: false });

    els.drawingWrapper.addEventListener("touchmove", event => {
      if (!pinchActive || event.touches.length !== 2) return;
      event.preventDefault();

      const wrapper = els.drawingWrapper;
      const rect = wrapper.getBoundingClientRect();
      const dist = touchDistance(event.touches[0], event.touches[1]);
      if (pinchStartDist <= 0) return;

      const oldZoom = zoomLevel;
      const newZoom = Math.max(
        0.3,
        Math.min(5, Math.round(pinchStartZoom * (dist / pinchStartDist) * 100) / 100)
      );
      if (newZoom === oldZoom) return;

      const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;

      const contentX = (wrapper.scrollLeft + midX) / oldZoom;
      const contentY = (wrapper.scrollTop + midY) / oldZoom;

      zoomLevel = newZoom;
      applyZoom();

      wrapper.scrollLeft = contentX * newZoom - midX;
      wrapper.scrollTop = contentY * newZoom - midY;
    }, { passive: false });

    const endPinch = event => {
      if (!pinchActive) return;
      if (event.touches.length < 2) {
        pinchActive = false;
        scheduleAutoSave();
      }
    };
    els.drawingWrapper.addEventListener("touchend", endPinch);
    els.drawingWrapper.addEventListener("touchcancel", endPinch);

    els.pointSetPositionAction.addEventListener("click", () => {
      hidePointContextMenu();
      if (contextPoint) openSetPosition(contextPoint);
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

    els.pointExcludeAction.addEventListener("click", () => {
      hidePointContextMenu();
      if (contextPoint) togglePointExclude(contextPoint);
    });

    // Keypad side selection.
    els.sideChoices.forEach(button => {
      button.addEventListener("click", () => setCurrentSide(button.dataset.side || ""));
    });

    // Auto Sort dialog.
    els.confirmAutoSortBtn.addEventListener("click", confirmAutoSort);
    els.cancelAutoSortBtn.addEventListener("click", closeAutoSortModal);
    els.autoSortModal.addEventListener("click", event => {
      if (event.target === els.autoSortModal) closeAutoSortModal();
    });

    // Set Position modal.
    els.confirmSetPositionBtn.addEventListener("click", confirmSetPosition);
    els.cancelSetPositionBtn.addEventListener("click", () => {
      setPositionPoint = null;
      els.setPositionModal.classList.add("hidden");
    });
    els.setPositionInput.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); confirmSetPosition(); }
    });

    // No-side export gate + banner.
    els.assignSideBtn.addEventListener("click", () => {
      els.noSideModal.classList.add("hidden");
      pendingExportTypes = null;
      jumpToNextNoSide();
    });
    els.exportAnywayBtn.addEventListener("click", () => {
      els.noSideModal.classList.add("hidden");
      const types = pendingExportTypes;
      pendingExportTypes = null;
      if (types) proceedExportCSV(types);
    });
    els.noSideBanner.addEventListener("click", jumpToNextNoSide);

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
    els.cancelTextBtn.addEventListener("click", cancelTextPlacement);
    els.confirmTextBtn.addEventListener("click", confirmTextPlacement);

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
      .querySelector('[data-action="clear"]')
      .addEventListener("click", clearMeasurement);

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

    pageStates = clone(state.pageStates || {});
    currentPdfPage = Math.max(1, Number(state.currentPdfPage || 1));
    if (!Object.keys(pageStates).length) {
      pageStates[1] = {
        points: clone(state.points || []), dataTypes: clone(state.dataTypes || DEFAULT_DATA_TYPES),
        textNotes: clone(state.textNotes || []), commentImageData: state.commentImageData || "",
        selectedDataId: state.selectedDataId || null, scrollLeft: state.scrollLeft || 0, scrollTop: state.scrollTop || 0
      };
    }
    const initialPageState = pageStates[currentPdfPage] || pageStates[1] || {};
    points = clone(initialPageState.points || []);
    dataTypes = clone(initialPageState.dataTypes || DEFAULT_DATA_TYPES);
    textNotes = clone(initialPageState.textNotes || []);

    dataTypes.forEach(dataType => {
      if (typeof dataType.ordered !== "boolean") dataType.ordered = false;
      if (!dataType.direction) dataType.direction = "clockwise";
    });

    pointMode = state.pointMode || "lock";
    commentTool = "none";
    brushColor = state.brushColor || "#ff0000";
    brushWidth = Number(state.brushWidth || 5);
    updateBrushControls();
    showOrderLabels = Boolean(state.showOrderLabels);
    zoomLevel = Number(state.zoomLevel || 1);
    labelFontSize = Number(state.labelFontSize || 30);

    commentImageData = initialPageState.commentImageData || "";
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();

    els.workspaceProjectName.textContent = project.name;
    renderDataSelect(state.selectedDataId);
    updateToolButtons();
    updateLabelsButton();

    removeAllPointElements();

    if (project.kind === "pdf") {
      await renderStoredPdf(project.pdfData, currentPdfPage);
    } else {
      createBlankDrawing(
        project.blankWidth || 2400,
        project.blankHeight || 1600
      );
      updatePageDisplay();
    }

    points.forEach(createPointElement);

    // New model: ensure every data type has a lockedSides list.
    dataTypes.forEach(dt => {
      if (!Array.isArray(dt.lockedSides)) dt.lockedSides = [];
    });
    setCurrentSide("");
    reviewFilter = "all";
    updateNoSideBanner();
    setWorkspaceMode("measure");

    removeAllTextNoteElements();
    selectedNoteId = null;
    textNotes.forEach(createTextNoteElement);

    if (commentImageData) {
      await restoreCommentImage(commentImageData);
    }

    applyZoom();
    applyLabelFontSize();

    requestAnimationFrame(() => {
      els.drawingWrapper.scrollLeft = initialPageState.scrollLeft || 0;
      els.drawingWrapper.scrollTop = initialPageState.scrollTop || 0;
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
    pdfDocument = null;
    currentPdfPage = 1; totalPdfPages = 1; pageStates = {};
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

  function getAdaptivePdfRenderQuality(viewport) {
    const width = Math.max(1, viewport.width);
    const height = Math.max(1, viewport.height);
    const pixelScale = Math.sqrt(PDF_MAX_RENDER_PIXELS / (width * height));
    const dimensionScale = Math.min(
      PDF_MAX_RENDER_DIMENSION / width,
      PDF_MAX_RENDER_DIMENSION / height
    );

    // Desktop can use a little more detail; iPad benefits from the lower cap.
    const deviceCap = /iPad|iPhone|iPod/.test(navigator.userAgent) ? 0.48 : 0.65;
    return Math.max(0.25, Math.min(1, deviceCap, pixelScale, dimensionScale));
  }

  async function renderStoredPdf(pdfData, pageNumber = 1) {
    if (!pdfData) throw new Error("This project has no stored PDF.");
    if (!pdfDocument) {
      pdfDocument = await pdfjsLib.getDocument(new Uint8Array(pdfData)).promise;
      totalPdfPages = pdfDocument.numPages || 1;
    }

    currentPdfPage = Math.min(Math.max(1, Number(pageNumber) || 1), totalPdfPages);
    const page = await pdfDocument.getPage(currentPdfPage);
    const logicalViewport = page.getViewport({ scale: PDF_LOGICAL_SCALE });
    const renderQuality = getAdaptivePdfRenderQuality(logicalViewport);
    const backingWidth = Math.max(1, Math.round(logicalViewport.width * renderQuality));
    const backingHeight = Math.max(1, Math.round(logicalViewport.height * renderQuality));
    const logicalWidth = Math.round(logicalViewport.width);
    const logicalHeight = Math.round(logicalViewport.height);

    if (activePdfRenderTask) {
      try { activePdfRenderTask.cancel(); } catch (_) {}
      activePdfRenderTask = null;
    }

    const context = els.pdfCanvas.getContext("2d", { alpha: false });
    els.pdfCanvas.width = backingWidth;
    els.pdfCanvas.height = backingHeight;
    els.pdfCanvas.style.width = logicalWidth + "px";
    els.pdfCanvas.style.height = logicalHeight + "px";
    els.pdfCanvas.dataset.logicalWidth = String(logicalWidth);
    els.pdfCanvas.dataset.logicalHeight = String(logicalHeight);
    els.drawingArea.style.width = logicalWidth + "px";
    els.drawingArea.style.height = logicalHeight + "px";
    els.drawingImage.classList.add("hidden");
    els.pdfCanvas.classList.remove("hidden");

    activePdfRenderTask = page.render({
      canvasContext: context,
      viewport: logicalViewport,
      transform: renderQuality === 1
        ? null
        : [renderQuality, 0, 0, renderQuality, 0, 0]
    });

    try {
      await activePdfRenderTask.promise;
    } catch (error) {
      if (error?.name !== "RenderingCancelledException") throw error;
    } finally {
      activePdfRenderTask = null;
    }

    // Markup and point coordinates keep using the original logical dimensions.
    setupCommentCanvas(logicalWidth, logicalHeight);
    updatePageDisplay();
  }

  function captureCurrentPageState() {
    if (!project) return;
    pageStates[currentPdfPage] = {
      points: clone(points), dataTypes: clone(dataTypes), textNotes: clone(textNotes),
      commentImageData, selectedDataId: els.dataSelect ? els.dataSelect.value : null,
      scrollLeft: els.drawingWrapper.scrollLeft, scrollTop: els.drawingWrapper.scrollTop
    };
  }

  function emptyPageState() {
    return { points: [], dataTypes: clone(DEFAULT_DATA_TYPES), textNotes: [], commentImageData: "",
      selectedDataId: DEFAULT_DATA_TYPES[0].id, scrollLeft: 0, scrollTop: 0 };
  }

  async function goToPdfPage(pageNumber) {
    if (!project || project.kind !== "pdf" || switchingPage) return;
    const target = Math.min(Math.max(1, Number(pageNumber) || 1), totalPdfPages);
    if (target === currentPdfPage) { closePageModal(); return; }

    switchingPage = true;
    captureCurrentPageState();
    closePageModal();
    setStatus(`Loading page ${target} of ${totalPdfPages}…`);

    // Let the sidebar close and the loading text paint before PDF.js starts.
    await new Promise(resolve => requestAnimationFrame(() => resolve()));

    try {
      removeAllPointElements();
      removeAllTextNoteElements();
      els.commentCanvas.getContext("2d").clearRect(0, 0, els.commentCanvas.width, els.commentCanvas.height);
      currentPdfPage = target;

      const state = pageStates[target] || emptyPageState();
      points = clone(state.points || []);
      dataTypes = clone(state.dataTypes || DEFAULT_DATA_TYPES);
      textNotes = clone(state.textNotes || []);
      commentImageData = state.commentImageData || "";
      dataTypes.forEach(dt => { if (!Array.isArray(dt.lockedSides)) dt.lockedSides = []; });

      await renderStoredPdf(project.pdfData, target);
      renderDataSelect(state.selectedDataId);
      points.forEach(createPointElement);
      textNotes.forEach(createTextNoteElement);
      if (commentImageData) await restoreCommentImage(commentImageData);
      applyZoom();
      applyLabelFontSize();
      els.drawingWrapper.scrollLeft = state.scrollLeft || 0;
      els.drawingWrapper.scrollTop = state.scrollTop || 0;
      undoStack = [];
      redoStack = [];
      updateUndoRedoButtons();
      updateNoSideBanner();
      scheduleAutoSave();
      setStatus(`Page ${currentPdfPage} of ${totalPdfPages}.`);
    } catch (error) {
      console.error("Page change failed:", error);
      setStatus(`Could not open page ${target}.`);
      alert("Could not open this PDF page. Please try again.");
    } finally {
      switchingPage = false;
    }
  }

  function updatePageDisplay() {
    if (!els.pageBtn) return;
    const isPdf = !!(project && project.kind === "pdf");
    els.pageBtn.classList.toggle("hidden", !isPdf);
    if (els.pageDisplay) els.pageDisplay.textContent = `${currentPdfPage}/${totalPdfPages}`;
  }

  async function renderPageThumbnail(canvas, pageNumber, token) {
    if (!pdfDocument || token !== pageThumbnailRenderToken || canvas.dataset.rendered === "true") return;
    try {
      const page = await pdfDocument.getPage(pageNumber);
      if (token !== pageThumbnailRenderToken) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const targetWidth = 176;
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const context = canvas.getContext("2d", { alpha: false });
      const renderTask = page.render({ canvasContext: context, viewport });
      thumbnailRenderTasks.add(renderTask);
      try {
        await renderTask.promise;
        if (token === pageThumbnailRenderToken) canvas.dataset.rendered = "true";
      } finally {
        thumbnailRenderTasks.delete(renderTask);
      }
    } catch (error) {
      console.warn(`Could not render thumbnail for page ${pageNumber}:`, error);
      canvas.classList.add("thumbnailError");
    }
  }

  function openPageModal() {
    if (!project || project.kind !== "pdf") return;
    captureCurrentPageState();
    els.pageModalSummary.textContent = `${totalPdfPages} pages · scroll and tap to jump`;
    els.pageList.innerHTML = "";
    pageThumbnailRenderToken += 1;
    const token = pageThumbnailRenderToken;

    if (pageThumbnailObserver) pageThumbnailObserver.disconnect();
    pageThumbnailObserver = "IntersectionObserver" in window
      ? new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const canvas = entry.target.querySelector("canvas");
            const pageNumber = Number(entry.target.dataset.pageNumber);
            renderPageThumbnail(canvas, pageNumber, token);
            pageThumbnailObserver.unobserve(entry.target);
          });
        }, { root: els.pageList, rootMargin: "240px 0px" })
      : null;

    for (let n = 1; n <= totalPdfPages; n += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pageJumpButton";
      button.dataset.pageNumber = String(n);
      if (n === currentPdfPage) button.classList.add("active");
      const pageState = pageStates[n];
      const hasData = pageState && ((pageState.points && pageState.points.length) || pageState.commentImageData || (pageState.textNotes && pageState.textNotes.length));
      if (hasData) button.classList.add("hasData");

      const preview = document.createElement("div");
      preview.className = "pageThumbnailFrame";
      const canvas = document.createElement("canvas");
      canvas.className = "pageThumbnail";
      canvas.setAttribute("aria-hidden", "true");
      preview.appendChild(canvas);

      const label = document.createElement("span");
      label.className = "pageJumpLabel";
      label.textContent = `Page ${n}`;
      if (hasData) {
        const badge = document.createElement("span");
        badge.className = "pageDataBadge";
        badge.textContent = "Data";
        label.appendChild(badge);
      }

      button.append(preview, label);
      button.addEventListener("click", () => goToPdfPage(n));
      els.pageList.appendChild(button);
      if (pageThumbnailObserver) pageThumbnailObserver.observe(button);
      else renderPageThumbnail(canvas, n, token);
    }

    els.pageModal.classList.remove("hidden");
    requestAnimationFrame(() => {
      const active = els.pageList.querySelector(".pageJumpButton.active");
      if (active) active.scrollIntoView({ block: "center" });
    });
  }

  function closePageModal() {
    if (pageThumbnailObserver) {
      pageThumbnailObserver.disconnect();
      pageThumbnailObserver = null;
    }
    pageThumbnailRenderToken += 1;
    thumbnailRenderTasks.forEach(task => {
      try { task.cancel(); } catch (_) {}
    });
    thumbnailRenderTasks.clear();
    if (els.pageModal) els.pageModal.classList.add("hidden");
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

      const option = document.createElement("option");
      option.value = dataType.id;
      option.textContent = (pointCount ? "● " : "○ ") + dataType.name;
      option.style.color = dataType.color || "#111";
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

    updateDataTypeSwatch();
  }

  function updateDataTypeSwatch() {
    if (!els.dataTypeSwatch) return;
    const dataType = getDataType(els.dataSelect.value);
    els.dataTypeSwatch.style.background = dataType ? (dataType.color || "#111") : "transparent";
  }

  function handleDataSelectChange() {
    if (els.dataSelect.value !== "__add_data_type__") {
      updateDataTypeSwatch();
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
    if (els.markupMenu) els.markupMenu.open = false;

    if (commentTool === "text") {
      setStatus("Text ON: tap the drawing to place a text box.");
    } else if (commentTool === "pen") {
      setStatus("Pen ON: Apple Pencil draws; finger scrolls.");
    } else if (commentTool === "highlighter") {
      setStatus("Highlighter ON: Apple Pencil highlights; finger scrolls.");
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
      els.textBtn,
      els.penBtn,
      els.highlighterBtn,
      els.eraserBtn
    ].forEach(button => button && button.classList.remove("activeTool"));

    if (pointMode === "add") els.addBtn.classList.add("activeTool");
    if (pointMode === "lock") els.lockBtn.classList.add("activeTool");
    if (commentTool === "text") els.textBtn.classList.add("activeTool");
    if (commentTool === "pen" && els.penBtn) els.penBtn.classList.add("activeTool");
    if (commentTool === "highlighter") els.highlighterBtn.classList.add("activeTool");
    if (commentTool === "eraser") els.eraserBtn.classList.add("activeTool");
    if (els.markupSummary) {
      const names = { text: "T Text", pen: "✏️ Pen", highlighter: "🖍 Highlight", eraser: "Eraser" };
      els.markupSummary.textContent = commentTool === "none"
        ? "✎ Markup ▾"
        : `${names[commentTool]} ▾`;
      els.markupSummary.classList.toggle("activeTool", commentTool !== "none");
    }
    els.commentCanvas.classList.toggle("inkActive", commentTool !== "none");
    els.drawingArea.classList.toggle("inkMode", commentTool !== "none");
    els.drawingWrapper.classList.toggle("inkMode", commentTool !== "none");
  }

  function updateBrushControls() {
    if (!els.colorSwatches || !els.sizeChoices) return;
    els.colorSwatches.forEach(button => {
      button.classList.toggle("selected", button.dataset.brushColor === brushColor);
    });
    els.sizeChoices.forEach(button => {
      button.classList.toggle("selected", Number(button.dataset.brushSize) === brushWidth);
    });
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

    deselectTextNotes();

    // A drag (pan) should not drop a point.
    if (clickMoved) {
      clickMoved = false;
      return;
    }

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
      excluded: false,
      assignedSide: currentSide,
      assignedSeq: ""
    };

    points.push(point);
    dataType.counter += 1;

    // If this side is already locked (manually ordered), append the new point
    // at the end of that side; otherwise it just keeps creation order.
    if (isSideLocked(dataType, currentSide)) {
      const sideMax = Math.max(
        0,
        ...pointsInSide(dataType.id, currentSide)
          .filter(p => p !== point)
          .map(p => p.manualSeq || 0)
      );
      point.manualSeq = sideMax + 1;
    }

    pushUndo({ type: "add", point });
    createPointElement(point);
    recalculateDataTypeOrder(dataType.id);
    renderDataSelect(dataType.id);
    updateNoSideBanner();

    setStatus(`${dataType.name}: ${measurement} added${currentSide ? " (" + currentSide + ")" : " (no side)"}.`);
    scheduleAutoSave();
  }

  function createPointElement(point) {
    removePointElement(point.uid);

    const element = document.createElement("div");
    element.className = "point";
    element.dataset.uid = point.uid;

    element.addEventListener("click", event => {
      event.stopPropagation();

      if (batchAssignMode) {
        toggleBatchPoint(point);
        return;
      }

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
      if (tapReorderState || batchAssignMode) return;
      showPointContextMenu(event.clientX, event.clientY, point);
    });

    let timer = null;

    element.addEventListener("touchstart", event => {
      if (tapReorderState || batchAssignMode) return;
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
      if (pinchActive) return;

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
        ? `${point.assignedSide}${point.assignedSeq}`
        : measurement;

    element.style.left = point.x + "px";
    element.style.top = point.y + "px";
    element.style.color = dataType?.color || "black";
    element.style.fontSize = labelFontSize + "px";
    element.classList.toggle("excludedPoint", !!point.excluded);
    element.classList.toggle("noSidePoint", !point.excluded && !(point.assignedSide || ""));
  }

  function editPoint(point) {
    const oldValue = point.measurement;
    const oldSide = point.assignedSide || "";

    // Editing a point starts from that point's own side. The operator can
    // change it on the keypad and the new side is saved together with value.
    setCurrentSide(oldSide);

    openMeasurementModal(
      oldValue,
      "Edit Measurement",
      value => {
        const newValue = value.trim();
        const newSide = currentSide || "";
        if (!newValue) return;
        if (newValue === oldValue && newSide === oldSide) return;

        point.measurement = newValue;
        point.assignedSide = newSide;
        point.sideLocked = true;

        pushUndo({
          type: "edit",
          point,
          oldValue,
          newValue,
          oldSide,
          newSide
        });

        recalculateDataTypeOrder(point.dataId);
        updatePointElement(point);
        updateNoSideBanner();
        renderDataSelect(point.dataId);
        scheduleAutoSave();
      }
    );
  }

  function deletePoint(point) {
    if (!confirm("Delete this point?")) return;

    points = points.filter(item => item.uid !== point.uid);
    removePointElement(point.uid);

    recalculateDataTypeOrder(point.dataId);

    pushUndo({ type: "delete", point });
    renderDataSelect(point.dataId);
    updateNoSideBanner();
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

    if (els.pointExcludeAction) {
      els.pointExcludeAction.textContent = point.excluded
        ? "Include in export"
        : "Exclude from export";
    }

    const left = Math.min(x, window.innerWidth - 195);
    const top = Math.min(y, window.innerHeight - 210);

    els.pointContextMenu.style.left = Math.max(8, left) + "px";
    els.pointContextMenu.style.top = Math.max(8, top) + "px";
    els.pointContextMenu.classList.remove("hidden");
  }

  function hidePointContextMenu() {
    els.pointContextMenu.classList.add("hidden");
  }

  function startBatchAssign() {
    if (commentTool !== "none") toggleCommentTool(commentTool);
    batchAssignMode = true;
    batchAssignPoints.clear();
    els.batchAssignBtn.classList.add("activeTool");
    els.batchAssignBar.classList.remove("hidden");
    updateBatchAssignBar();
    setStatus("Batch Side: tap points, then choose N, E, S, W, or Reset Auto.");
  }

  function toggleBatchPoint(point) {
    const currentDataId = els.dataSelect.value;
    if (point.dataId !== currentDataId) {
      setStatus("Batch Side only selects points from the current Data type.");
      return;
    }

    if (batchAssignPoints.has(point)) {
      batchAssignPoints.delete(point);
    } else {
      batchAssignPoints.add(point);
    }

    const element = findPointElement(point.uid);
    if (element) element.classList.toggle("batchSelected", batchAssignPoints.has(point));
    updateBatchAssignBar();
  }

  function updateBatchAssignBar() {
    els.batchAssignText.textContent =
      `Batch Side: ${batchAssignPoints.size} selected`;
    const disabled = batchAssignPoints.size === 0;
    els.batchSideButtons.forEach(button => { button.disabled = disabled; });
    els.batchAutoBtn.disabled = disabled;
  }

  function applyBatchSide(side) {
    if (!batchAssignPoints.size) return;
    const dataId = els.dataSelect.value;
    const before = snapshotOrder(dataId);
    const dataType = getDataType(dataId);

    batchAssignPoints.forEach(point => {
      point.assignedSide = side;
      point.sideLocked = true;
    });

    if (dataType) {
      dataType.manual = false;
      dataType.ordered = true;
    }
    recalculateDataTypeOrder(dataId);
    const after = snapshotOrder(dataId);
    pushUndo({ type: "reorder", dataId, before, after });
    finishBatchAssign(`${batchAssignPoints.size} points assigned to ${side}.`);
    scheduleAutoSave();
  }

  function resetBatchToAuto() {
    if (!batchAssignPoints.size) return;
    const dataId = els.dataSelect.value;
    const before = snapshotOrder(dataId);
    const dataType = getDataType(dataId);
    const typePoints = points.filter(point => point.dataId === dataId);
    const bounds = getBounds(typePoints);

    batchAssignPoints.forEach(point => {
      point.sideLocked = false;
      point.assignedSide = guessSide(point, bounds);
    });

    if (dataType) {
      dataType.manual = false;
      dataType.ordered = true;
    }
    recalculateDataTypeOrder(dataId);
    const after = snapshotOrder(dataId);
    pushUndo({ type: "reorder", dataId, before, after });
    finishBatchAssign(`${batchAssignPoints.size} points reset to Auto.`);
    scheduleAutoSave();
  }

  function finishBatchAssign(message) {
    batchAssignMode = false;
    batchAssignPoints.clear();
    els.batchAssignBtn.classList.remove("activeTool");
    els.batchAssignBar.classList.add("hidden");
    showOrderLabels = true;
    updateLabelsButton();
    refreshAllPoints();
    renderDataSelect(els.dataSelect.value);
    setStatus(message);
  }

  function cancelBatchAssign() {
    document.querySelectorAll(".point.batchSelected")
      .forEach(element => element.classList.remove("batchSelected"));
    finishBatchAssign("Batch Side cancelled.");
  }

  function assignContextPointSide(side) {
    if (!contextPoint) return;

    const dataId = contextPoint.dataId;
    const before = snapshotOrder(dataId);
    const oldSide = contextPoint.assignedSide || "";

    contextPoint.assignedSide = side;
    contextPoint.sideLocked = true;

    /*
      Assigning a side is a geometric correction. Return to automatic mode so
      the moved point is inserted according to its position on the new edge,
      and both the old and new sides are renumbered without duplicates.
    */
    const dataType = getDataType(dataId);
    if (dataType) {
      dataType.manual = false;
      dataType.ordered = true;
    }

    recalculateDataTypeOrder(dataId);
    const after = snapshotOrder(dataId);

    pushUndo({
      type: "assignSide",
      point: contextPoint,
      oldSide,
      newSide: side,
      dataId,
      before,
      after
    });

    showOrderLabels = true;
    updateLabelsButton();
    refreshAllPoints();
    renderDataSelect(contextPoint.dataId);

    els.sideModal.classList.add("hidden");
    scheduleAutoSave();
  }

  function recalculateDataTypeOrder(dataId) {
    const dataType = getDataType(dataId);
    if (!dataType) return;

    const ordered = getOrderedPoints(dataId);

    ordered.forEach(item => {
      item.point.assignedSide = item.side;
      item.point.assignedSeq = item.seq;
      updatePointElement(item.point);
    });

    refreshReviewIfOpen();
  }

  /*
    Use v6.2 geometric ordering by default. Move Up/Down temporarily stores a
    manual order; adding/moving a point, assigning a side, or ordering again
    returns safely to the v6.2 geometric result.
  */
  const SIDE_ORDER = ["N", "E", "S", "W", ""];

  function isSideLocked(dataType, side) {
    return !!(dataType &&
      Array.isArray(dataType.lockedSides) &&
      dataType.lockedSides.includes(side));
  }

  function pointsInSide(dataId, side) {
    return points.filter(p =>
      p.dataId === dataId &&
      !p.excluded &&
      (p.assignedSide || "") === side
    );
  }

  /*
    Display order within one side. By default points keep their creation order
    (the order they appear in the points array). Once a side is "locked" (Auto
    Sort / Set Position), it is ordered by the stored manualSeq instead, and new
    points append to the end.
  */
  function orderedSidePoints(dataId, side) {
    const dataType = getDataType(dataId);
    const inSide = pointsInSide(dataId, side);

    if (isSideLocked(dataType, side)) {
      return inSide.slice().sort((a, b) => (a.manualSeq || 0) - (b.manualSeq || 0));
    }
    return inSide;
  }

  function getOrderedPoints(dataId) {
    const result = [];

    SIDE_ORDER.forEach(side => {
      orderedSidePoints(dataId, side).forEach((point, index) => {
        result.push({ point, side, seq: index + 1 });
      });
    });

    return result;
  }

  function lockSide(dataId, side) {
    const dataType = getDataType(dataId);
    if (!dataType) return;

    if (!Array.isArray(dataType.lockedSides)) dataType.lockedSides = [];

    orderedSidePoints(dataId, side).forEach((point, index) => {
      point.manualSeq = index + 1;
    });

    if (!dataType.lockedSides.includes(side)) dataType.lockedSides.push(side);
  }

  function autoSortSide(dataId, side, direction = "clockwise") {
    const dataType = getDataType(dataId);
    if (!dataType) return;

    const sorted = pointsInSide(dataId, side).slice();
    const clockwise = direction !== "counterclockwise";

    // Clockwise: N left→right, E top→bottom, S right→left, W bottom→top.
    // Counterclockwise reverses each side.
    const ascending = clockwise
      ? (side === "N" || side === "E")
      : (side === "S" || side === "W");

    if (side === "E" || side === "W") {
      sorted.sort((a, b) => ascending ? a.y - b.y : b.y - a.y);
    } else {
      sorted.sort((a, b) => ascending ? a.x - b.x : b.x - a.x);
    }

    if (!Array.isArray(dataType.lockedSides)) dataType.lockedSides = [];
    sorted.forEach((point, index) => { point.manualSeq = index + 1; });
    if (!dataType.lockedSides.includes(side)) dataType.lockedSides.push(side);
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
      lockedSides: dataType && Array.isArray(dataType.lockedSides)
        ? dataType.lockedSides.slice()
        : [],
      points: points
        .filter(p => p.dataId === dataId)
        .map(p => ({
          uid: p.uid,
          manualSeq: p.manualSeq,
          assignedSide: p.assignedSide,
          excluded: !!p.excluded
        }))
    };
  }

  function restoreOrder(dataId, snap) {
    const dataType = getDataType(dataId);

    if (dataType) {
      dataType.lockedSides = Array.isArray(snap.lockedSides)
        ? snap.lockedSides.slice()
        : [];
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
          p.excluded = !!entry.excluded;
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

    point.orderNote = delta < 0 ? "up" : "down";

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

  /* ---------- New ordering actions (Auto Sort / Set Position / Exclude) ---------- */

  function currentDataId() {
    return els.dataSelect ? els.dataSelect.value : null;
  }

  function openAutoSortModal() {
    if (!els.autoSortModal) return;

    const selectedDataId = lastAutoSortDataId || currentDataId() || (dataTypes[0] && dataTypes[0].id);
    els.autoSortDataType.innerHTML = "";
    const allTypesOption = document.createElement("option");
    allTypesOption.value = "__all__";
    allTypesOption.textContent = "All Data Types";
    els.autoSortDataType.appendChild(allTypesOption);

    dataTypes.forEach(dataType => {
      const option = document.createElement("option");
      option.value = dataType.id;
      option.textContent = dataType.name;
      els.autoSortDataType.appendChild(option);
    });

    if (selectedDataId === "__all__" || (selectedDataId && getDataType(selectedDataId))) {
      els.autoSortDataType.value = selectedDataId;
    }
    els.autoSortSide.value = ["__all__", "N", "E", "S", "W"].includes(lastAutoSortSide)
      ? lastAutoSortSide
      : "__all__";

    els.autoSortDirectionChoices.forEach(choice => {
      choice.checked = choice.value === lastAutoSortDirection;
    });

    els.autoSortModal.classList.remove("hidden");
  }

  function closeAutoSortModal() {
    if (els.autoSortModal) els.autoSortModal.classList.add("hidden");
  }

  function confirmAutoSort() {
    const dataSelection = els.autoSortDataType.value;
    const sideSelection = els.autoSortSide.value;
    const selectedDirection = els.autoSortDirectionChoices.find(choice => choice.checked);
    const direction = selectedDirection ? selectedDirection.value : "clockwise";
    const targetDataTypes = dataSelection === "__all__" ? dataTypes.slice() : [getDataType(dataSelection)].filter(Boolean);
    const targetSides = sideSelection === "__all__" ? ["N", "E", "S", "W"] : [sideSelection];
    if (!targetDataTypes.length) { setStatus("Choose a valid data type."); return; }
    const targets = [];
    targetDataTypes.forEach(dt => targetSides.forEach(side => { if (pointsInSide(dt.id, side).length) targets.push({dt, side}); }));
    if (!targets.length) { setStatus("No matching assigned points to sort."); return; }
    closeAutoSortModal();
    setStatus("Sorting…");
    lastAutoSortDataId = dataSelection; lastAutoSortSide = sideSelection; lastAutoSortDirection = direction;
    const before = {}; targetDataTypes.forEach(dt => { before[dt.id] = snapshotOrder(dt.id); });
    targets.forEach(({dt, side}) => autoSortSide(dt.id, side, direction));
    targetDataTypes.forEach(dt => { dt.direction = direction; recalculateDataTypeOrder(dt.id); });
    const after = {}; targetDataTypes.forEach(dt => { after[dt.id] = snapshotOrder(dt.id); });
    pushUndo({ type: "reorderBatch", before, after });
    refreshAllPoints(); renderDataSelect(currentDataId());
    const typeLabel = dataSelection === "__all__" ? "all data types" : targetDataTypes[0].name;
    const sideLabel = sideSelection === "__all__" ? "all sides" : sideSelection;
    setStatus(`Auto-sorted ${typeLabel} · ${sideLabel} · ${direction === "clockwise" ? "clockwise" : "counterclockwise"}.`);
    scheduleAutoSave();
  }

  function openSetPosition(point) {
    setPositionPoint = point;
    const side = point.assignedSide || "";
    const list = orderedSidePoints(point.dataId, side);
    const current = list.indexOf(point) + 1;

    els.setPositionInfo.textContent =
      `Side ${side || "Unassigned"} · ${list.length} point${list.length === 1 ? "" : "s"}`;
    els.setPositionInput.value = String(current > 0 ? current : 1);
    els.setPositionInput.max = String(Math.max(1, list.length));
    els.setPositionModal.classList.remove("hidden");

    setTimeout(() => {
      els.setPositionInput.focus();
      els.setPositionInput.select();
    }, 30);
  }

  function confirmSetPosition() {
    const point = setPositionPoint;
    els.setPositionModal.classList.add("hidden");
    setPositionPoint = null;
    if (!point) return;

    const target = parseInt(els.setPositionInput.value, 10);
    if (!Number.isFinite(target)) return;

    setPointPosition(point, target);
  }

  function setPointPosition(point, targetPos) {
    const dataId = point.dataId;
    const side = point.assignedSide || "";

    const before = snapshotOrder(dataId);
    lockSide(dataId, side);

    const list = orderedSidePoints(dataId, side);
    const from = list.indexOf(point);
    if (from < 0) return;

    const to = Math.max(0, Math.min(list.length - 1, targetPos - 1));
    list.splice(from, 1);
    list.splice(to, 0, point);
    list.forEach((p, i) => { p.manualSeq = i + 1; });

    const after = snapshotOrder(dataId);
    pushUndo({ type: "reorder", dataId, before, after });

    recalculateDataTypeOrder(dataId);
    refreshAllPoints();
    renderDataSelect(dataId);
    setStatus(`Moved to position ${to + 1} on side ${side || "Unassigned"}.`);
    scheduleAutoSave();
  }

  function togglePointExclude(point) {
    const dataId = point.dataId;
    const before = snapshotOrder(dataId);
    point.excluded = !point.excluded;
    const after = snapshotOrder(dataId);
    pushUndo({ type: "reorder", dataId, before, after });

    recalculateDataTypeOrder(dataId);
    refreshAllPoints();
    renderDataSelect(dataId);
    updateNoSideBanner();
    setStatus(point.excluded
      ? "Point excluded from export."
      : "Point included in export.");
    scheduleAutoSave();
  }

  /* ---------- Current side (chosen on the keypad, inherited by new points) ---------- */

  /* ---------- Measure / Review mode ---------- */

  function setWorkspaceMode(mode) {
    workspaceMode = mode === "review" ? "review" : "measure";

    if (els.drawingToolsRow) {
      els.drawingToolsRow.classList.toggle("mode-review", workspaceMode === "review");
      els.drawingToolsRow.classList.toggle("mode-measure", workspaceMode === "measure");
    }
    if (els.measureModeBtn) {
      els.measureModeBtn.classList.toggle("active", workspaceMode === "measure");
    }
    if (els.reviewModeBtn) {
      els.reviewModeBtn.classList.toggle("active", workspaceMode === "review");
    }

    if (workspaceMode === "review") {
      // Review locks input: no new points, no active markup tool.
      pointMode = "lock";
      commentTool = "none";
      if (els.markupMenu) els.markupMenu.open = false;
      setStatus("Review mode: refine order, labels and sides. Point input is locked.");
    } else {
      setStatus("Measure mode: place points and mark up the drawing.");
    }

    updateToolButtons();
  }

  function setCurrentSide(side) {
    currentSide = side || "";
    if (els.sideChoices) {
      els.sideChoices.forEach(button => {
        button.classList.toggle("activeSide", (button.dataset.side || "") === currentSide);
      });
    }
  }

  function noSidePoints() {
    return points.filter(p => !p.excluded && !(p.assignedSide || ""));
  }

  function updateNoSideBanner() {
    if (!els.noSideBanner) return;
    const count = noSidePoints().length;

    if (count > 0) {
      els.noSideBannerText.textContent =
        `${count} measurement${count === 1 ? "" : "s"} have no Side. Tap to locate them.`;
      els.noSideBanner.classList.remove("hidden");
    } else {
      els.noSideBanner.classList.add("hidden");
    }
  }

  function jumpToNextNoSide() {
    const list = noSidePoints();
    if (!list.length) return;
    jumpToPoint(list[0]);
    setStatus("Assign a side on the keypad, then re-tap this point, or use it as-is.");
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
    if (String(value).trim().toUpperCase() === "X") return true;
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
    if (String(value).toUpperCase() === "X") {
      setMeasurementRawValue("X");
      return;
    }
    const base = measurementRawValue.toUpperCase() === "X" ? "" : measurementRawValue;
    setMeasurementRawValue(base + value);
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

  function clearMeasurement() {
    setMeasurementRawValue("");
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
    const activeType = getDataType(els.dataSelect.value);
    if (els.missingValueBtn) els.missingValueBtn.style.setProperty("--missing-color", activeType?.color || "#1f6feb");
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
    ["contextmenu", "selectstart", "dragstart"].forEach(type => {
      els.drawingArea.addEventListener(type, event => {
        if (commentTool !== "none") event.preventDefault();
      });
    });

    els.commentCanvas.addEventListener("pointerdown", event => {
      if (commentTool === "none") return;
      if (pinchActive) return;

      if (commentTool === "text") {
        event.preventDefault();
        const position = getCanvasPosition(event);
        pendingTextPosition = position;
        editingNoteId = null;
        els.textInput.value = "";
        setTextColor(textNoteColor);
        els.textModal.classList.remove("hidden");
        setTimeout(() => els.textInput.focus(), 0);
        return;
      }

      // In ink mode a finger pans the drawing, while Pencil only writes.
      if (event.pointerType === "touch") {
        event.preventDefault();
        commentFingerPan = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: els.drawingWrapper.scrollLeft,
          top: els.drawingWrapper.scrollTop
        };
        try { els.commentCanvas.setPointerCapture(event.pointerId); } catch (_) {}
        return;
      }

      if (!["pen", "mouse"].includes(event.pointerType)) return;

      event.preventDefault();

      try {
        els.commentCanvas.setPointerCapture(event.pointerId);
      } catch (_) {}

      // Reuse the already-saved previous image instead of encoding the huge
      // canvas when Pencil first touches the screen.
      commentBeforeStroke = commentImageData;
      isDrawingComment = true;

      const position = getCanvasPosition(event);
      lastCommentX = position.x;
      lastCommentY = position.y;
      lastCommentPressure = normalisePressure(event);

      if (commentTool === "highlighter") {
        highlightPoints = [{ x: position.x, y: position.y }];
      }
    });

    els.commentCanvas.addEventListener("pointermove", event => {
      if (commentFingerPan && event.pointerId === commentFingerPan.pointerId) {
        event.preventDefault();
        els.drawingWrapper.scrollLeft =
          commentFingerPan.left - (event.clientX - commentFingerPan.x);
        els.drawingWrapper.scrollTop =
          commentFingerPan.top - (event.clientY - commentFingerPan.y);
        return;
      }

      if (!isDrawingComment || commentTool === "none") return;
      if (!["pen", "mouse"].includes(event.pointerType)) return;

      event.preventDefault();
      const context = els.commentCanvas.getContext("2d");
      context.lineCap = "round";
      context.lineJoin = "round";

      const samples = typeof event.getCoalescedEvents === "function"
        ? event.getCoalescedEvents()
        : [event];

      if (!samples.length) return;

      const positions = samples.map(sample => ({
        ...getCanvasPosition(sample),
        pressure: normalisePressure(sample)
      }));
      const averagePressure = positions.reduce(
        (sum, item) => sum + item.pressure,
        lastCommentPressure
      ) / (positions.length + 1);

      context.globalAlpha = 1;
      if (commentTool === "eraser") {
        context.globalCompositeOperation = "destination-out";
        context.lineWidth = 36;
      } else if (commentTool === "highlighter") {
        // Draw behind all existing ink on the annotation canvas, while the
        // whole annotation canvas still remains above the PDF drawing.
        context.globalCompositeOperation = "destination-over";
        context.globalAlpha = 0.75;
        context.strokeStyle = brushColor;
        context.lineWidth = brushWidth * 4;
      } else {
        context.globalCompositeOperation = "source-over";
        context.strokeStyle = brushColor;
        context.lineWidth = brushWidth * (0.82 + averagePressure * 0.36);
      }

      // Draw all coalesced Pencil samples in one path and one stroke call.
      // The previous version issued a full Canvas stroke for every sample.
      context.beginPath();
      context.moveTo(lastCommentX, lastCommentY);
      positions.forEach(position => {
        const midX = (lastCommentX + position.x) / 2;
        const midY = (lastCommentY + position.y) / 2;
        context.quadraticCurveTo(lastCommentX, lastCommentY, midX, midY);
        lastCommentX = position.x;
        lastCommentY = position.y;
        lastCommentPressure = position.pressure;
        if (commentTool === "highlighter") {
          highlightPoints.push({ x: position.x, y: position.y });
        }
      });
      context.lineTo(lastCommentX, lastCommentY);
      context.stroke();
      context.globalAlpha = 1;
    });

    els.commentCanvas.addEventListener("pointerup", event => {
      if (commentFingerPan && event.pointerId === commentFingerPan.pointerId) {
        commentFingerPan = null;
        return;
      }
      finishStroke();
    });
    els.commentCanvas.addEventListener("pointercancel", event => {
      if (commentFingerPan && event.pointerId === commentFingerPan.pointerId) {
        commentFingerPan = null;
        return;
      }
      finishStroke();
    });
  }

  function normalisePressure(event) {
    const pressure = Number(event.pressure);
    return pressure > 0 ? Math.max(0.05, Math.min(1, pressure)) : 0.5;
  }

  function cancelTextPlacement() {
    pendingTextPosition = null;
    editingNoteId = null;
    els.textModal.classList.add("hidden");
  }

  function confirmTextPlacement() {
    const value = els.textInput.value.trim();

    if (editingNoteId) {
      const note = textNotes.find(item => item.id === editingNoteId);
      if (note && value) {
        const before = snapshotTextNotes();
        note.text = value;
        note.color = textNoteColor;
        updateTextNoteElement(note);
        pushUndo({ type: "textNotes", before, after: snapshotTextNotes() });
        scheduleAutoSave();
      }
      editingNoteId = null;
      els.textModal.classList.add("hidden");
      return;
    }

    if (!value || !pendingTextPosition) {
      pendingTextPosition = null;
      els.textModal.classList.add("hidden");
      return;
    }

    addTextNote(pendingTextPosition.x, pendingTextPosition.y, value, 24, textNoteColor);
    pendingTextPosition = null;
    els.textModal.classList.add("hidden");

    // Turn the Text tool off after placing one, so the next tap doesn't add
    // another box. (Tap Text again to place more.) This also makes the new
    // box immediately draggable/editable.
    if (commentTool === "text") toggleCommentTool("text");

    setStatus("Text added. Tap it to move, resize, or edit.");
  }

  function setTextColor(color) {
    textNoteColor = color || "#111111";
    if (els.textColorSwatches) {
      els.textColorSwatches.forEach(button => {
        button.classList.toggle("selected", button.dataset.textColor === textNoteColor);
      });
    }
  }

  /* Keep the markup dropdown fully on-screen (it can open off the right edge). */
  function positionMarkupPanel() {
    const panel = els.markupMenu.querySelector(".markupMenuPanel");
    if (!panel) return;

    panel.style.left = "0px";
    panel.style.right = "auto";

    requestAnimationFrame(() => {
      const margin = 8;
      let rect = panel.getBoundingClientRect();

      const overflowRight = rect.right - (window.innerWidth - margin);
      if (overflowRight > 0) {
        panel.style.left = (-overflowRight) + "px";
      }

      rect = panel.getBoundingClientRect();
      if (rect.left < margin) {
        const current = parseFloat(panel.style.left) || 0;
        panel.style.left = (current + (margin - rect.left)) + "px";
      }
    });
  }

  /* ---------- Movable / resizable text notes (DOM elements) ---------- */

  function makeNoteId() {
    return "note_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function snapshotTextNotes() {
    return textNotes.map(note => ({ ...note }));
  }

  function restoreTextNotes(snapshot) {
    textNotes = snapshot.map(note => ({ ...note }));
    selectedNoteId = null;
    removeAllTextNoteElements();
    textNotes.forEach(createTextNoteElement);
  }

  function addTextNote(x, y, text, size, color) {
    const before = snapshotTextNotes();

    const note = {
      id: makeNoteId(),
      x,
      y,
      text,
      size: size || 24,
      color: color || "#000000"
    };

    textNotes.push(note);
    createTextNoteElement(note);
    selectTextNote(note.id);

    pushUndo({ type: "textNotes", before, after: snapshotTextNotes() });
    scheduleAutoSave();
  }

  function removeTextNote(id) {
    const index = textNotes.findIndex(note => note.id === id);
    if (index < 0) return;

    const before = snapshotTextNotes();
    textNotes.splice(index, 1);

    const element = findTextNoteElement(id);
    if (element) element.remove();
    if (selectedNoteId === id) selectedNoteId = null;

    pushUndo({ type: "textNotes", before, after: snapshotTextNotes() });
    scheduleAutoSave();
    setStatus("Text deleted.");
  }

  function editTextNote(id) {
    const note = textNotes.find(item => item.id === id);
    if (!note) return;

    editingNoteId = id;
    pendingTextPosition = null;
    els.textInput.value = note.text;
    setTextColor(note.color || "#111111");
    els.textModal.classList.remove("hidden");
    setTimeout(() => els.textInput.focus(), 0);
  }

  function selectTextNote(id) {
    selectedNoteId = id;
    els.drawingArea.querySelectorAll(".textNote").forEach(element => {
      element.classList.toggle("selected", element.dataset.id === id);
    });
  }

  function deselectTextNotes() {
    if (!selectedNoteId) return;
    selectedNoteId = null;
    els.drawingArea.querySelectorAll(".textNote.selected")
      .forEach(element => element.classList.remove("selected"));
  }

  function findTextNoteElement(id) {
    return els.drawingArea.querySelector(`.textNote[data-id="${id}"]`);
  }

  function removeAllTextNoteElements() {
    els.drawingArea.querySelectorAll(".textNote")
      .forEach(element => element.remove());
  }

  function updateTextNoteElement(note) {
    const element = findTextNoteElement(note.id);
    if (!element) return;

    const textSpan = element.querySelector(".textNoteText");
    if (textSpan) textSpan.textContent = note.text;

    element.style.left = note.x + "px";
    element.style.top = note.y + "px";
    element.style.fontSize = note.size + "px";
    element.style.color = note.color || "#000000";
  }

  function createTextNoteElement(note) {
    const existing = findTextNoteElement(note.id);
    if (existing) existing.remove();

    const element = document.createElement("div");
    element.className = "textNote";
    element.dataset.id = note.id;

    const textSpan = document.createElement("span");
    textSpan.className = "textNoteText";
    textSpan.textContent = note.text;
    element.appendChild(textSpan);

    const del = document.createElement("button");
    del.className = "textNoteDelete";
    del.type = "button";
    del.textContent = "×";
    del.setAttribute("aria-label", "Delete text");
    element.appendChild(del);

    const handle = document.createElement("div");
    handle.className = "textNoteHandle";
    element.appendChild(handle);

    del.addEventListener("pointerdown", event => event.stopPropagation());
    del.addEventListener("click", event => {
      event.stopPropagation();
      removeTextNote(note.id);
    });

    element.addEventListener("click", event => event.stopPropagation());

    // Resize by dragging the corner handle: the note's height follows the
    // handle, so font size = pointer Y minus the note's top.
    handle.addEventListener("pointerdown", event => {
      event.stopPropagation();
      event.preventDefault();
      selectTextNote(note.id);

      noteDrag = { id: note.id, mode: "resize", before: snapshotTextNotes() };
      try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    });

    handle.addEventListener("pointermove", event => {
      if (!noteDrag || noteDrag.mode !== "resize" || noteDrag.id !== note.id) return;
      event.preventDefault();
      const position = getDrawingPosition(event);
      note.size = Math.max(12, Math.min(240, Math.round(position.y - note.y)));
      updateTextNoteElement(note);
    });

    const endResize = event => {
      if (!noteDrag || noteDrag.mode !== "resize" || noteDrag.id !== note.id) return;
      pushUndo({ type: "textNotes", before: noteDrag.before, after: snapshotTextNotes() });
      noteDrag = null;
      scheduleAutoSave();
    };
    handle.addEventListener("pointerup", endResize);
    handle.addEventListener("pointercancel", endResize);

    // Move by dragging the body; a tap (no move) selects, then edits.
    element.addEventListener("pointerdown", event => {
      if (pinchActive) return;
      event.stopPropagation();

      noteDrag = {
        id: note.id,
        mode: "move",
        startX: event.clientX,
        startY: event.clientY,
        origX: note.x,
        origY: note.y,
        moved: false,
        before: snapshotTextNotes()
      };
      try { element.setPointerCapture(event.pointerId); } catch (_) {}
    });

    element.addEventListener("pointermove", event => {
      if (!noteDrag || noteDrag.mode !== "move" || noteDrag.id !== note.id) return;
      event.preventDefault();

      const dx = (event.clientX - noteDrag.startX) / zoomLevel;
      const dy = (event.clientY - noteDrag.startY) / zoomLevel;

      if (!noteDrag.moved && Math.hypot(dx, dy) > 3) noteDrag.moved = true;

      note.x = noteDrag.origX + dx;
      note.y = noteDrag.origY + dy;
      updateTextNoteElement(note);
    });

    const endMove = () => {
      if (!noteDrag || noteDrag.mode !== "move" || noteDrag.id !== note.id) return;

      if (noteDrag.moved) {
        pushUndo({ type: "textNotes", before: noteDrag.before, after: snapshotTextNotes() });
        scheduleAutoSave();
      } else if (selectedNoteId === note.id) {
        editTextNote(note.id);
      } else {
        selectTextNote(note.id);
      }

      noteDrag = null;
    };
    element.addEventListener("pointerup", endMove);
    element.addEventListener("pointercancel", endMove);

    els.drawingArea.appendChild(element);
    updateTextNoteElement(note);
  }

  function finishStroke() {
    if (!isDrawingComment) return;

    isDrawingComment = false;

    if (commentTool === "highlighter" && highlightPoints.length > 0) {
      commitHighlighterStroke();
      return;
    }

    const after = els.commentCanvas.toDataURL();

    pushUndo({
      type: "comment",
      before: commentBeforeStroke,
      after
    });

    commentImageData = after;
    scheduleAutoSave();
  }

  /*
    Re-draw the whole highlighter stroke once, as a single semi-transparent
    path behind the ink. Drawing it in one pass (instead of one short segment
    per pointer move) removes the "string of beads" look caused by round caps
    on overlapping destination-over segments.
  */
  function commitHighlighterStroke() {
    const points = highlightPoints;
    highlightPoints = [];

    const before = commentBeforeStroke;
    const context = els.commentCanvas.getContext("2d");

    const paint = () => {
      context.save();
      context.globalCompositeOperation = "destination-over";
      context.globalAlpha = 0.75;
      context.strokeStyle = brushColor;
      context.lineWidth = brushWidth * 4;
      context.lineCap = "round";
      context.lineJoin = "round";

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        context.lineTo(points[i].x, points[i].y);
      }
      if (points.length === 1) {
        context.lineTo(points[0].x + 0.01, points[0].y);
      }
      context.stroke();
      context.restore();

      const after = els.commentCanvas.toDataURL();
      pushUndo({ type: "comment", before, after });
      commentImageData = after;
      scheduleAutoSave();
    };

    const clearAndPaint = () => {
      context.clearRect(0, 0, els.commentCanvas.width, els.commentCanvas.height);
      paint();
    };

    if (before) {
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, els.commentCanvas.width, els.commentCanvas.height);
        context.drawImage(image, 0, 0);
        paint();
      };
      image.onerror = clearAndPaint;
      image.src = before;
    } else {
      clearAndPaint();
    }
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
    // Bound memory: comment strokes store full-canvas images, so an unbounded
    // history can exhaust memory on long sessions.
    if (undoStack.length > 40) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    if (!els.undoBtn || !els.redoBtn) return;

    els.undoBtn.disabled = undoStack.length === 0;
    els.redoBtn.disabled = redoStack.length === 0;
    els.undoBtn.title = undoStack.length ? "Undo" : "Nothing to undo";
    els.redoBtn.title = redoStack.length ? "Redo" : "Nothing to redo";
  }

  function undo() {
    const action = undoStack.pop();
    if (!action) {
      updateUndoRedoButtons();
      return;
    }

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
      if (Object.prototype.hasOwnProperty.call(action, "oldSide")) {
        action.point.assignedSide = action.oldSide || "";
      }
      recalculateDataTypeOrder(action.point.dataId);
      updatePointElement(action.point);
      updateNoSideBanner();
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
      if (action.before) {
        restoreOrder(action.dataId, action.before);
      } else {
        action.point.assignedSide = action.oldSide;
        const dataType = getDataType(action.dataId);
        if (dataType) dataType.manual = false;
        recalculateDataTypeOrder(action.dataId);
        renderDataSelect(action.dataId);
      }
    }

    if (action.type === "reorder") {
      restoreOrder(action.dataId, action.before);
    }

    if (action.type === "reorderBatch") {
      Object.entries(action.before || {}).forEach(([dataId, snap]) => restoreOrder(dataId, snap));
    }

    if (action.type === "comment") {
      restoreCommentImage(action.before);
    }

    if (action.type === "textNotes") {
      restoreTextNotes(action.before);
    }

    redoStack.push(action);
    updateUndoRedoButtons();
    scheduleAutoSave();
  }

  function redo() {
    const action = redoStack.pop();
    if (!action) {
      updateUndoRedoButtons();
      return;
    }

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
      if (Object.prototype.hasOwnProperty.call(action, "newSide")) {
        action.point.assignedSide = action.newSide || "";
      }
      recalculateDataTypeOrder(action.point.dataId);
      updatePointElement(action.point);
      updateNoSideBanner();
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
      if (action.after) {
        restoreOrder(action.dataId, action.after);
      } else {
        action.point.assignedSide = action.newSide;
        const dataType = getDataType(action.dataId);
        if (dataType) dataType.manual = false;
        recalculateDataTypeOrder(action.dataId);
        renderDataSelect(action.dataId);
      }
    }

    if (action.type === "reorder") {
      restoreOrder(action.dataId, action.after);
    }

    if (action.type === "reorderBatch") {
      Object.entries(action.after || {}).forEach(([dataId, snap]) => restoreOrder(dataId, snap));
    }

    if (action.type === "comment") {
      restoreCommentImage(action.after);
    }

    if (action.type === "textNotes") {
      restoreTextNotes(action.after);
    }

    undoStack.push(action);
    updateUndoRedoButtons();
    scheduleAutoSave();
  }

  function exportCSV() {
    const exportTypes = dataTypes.filter(dataType =>
      dataType.export &&
      points.some(point => point.dataId === dataType.id && !point.excluded)
    );

    if (!exportTypes.length) {
      setStatus("No points to export.");
      return;
    }

    const noSideCount = points.filter(point =>
      !point.excluded &&
      !(point.assignedSide || "") &&
      exportTypes.some(dt => dt.id === point.dataId)
    ).length;

    if (noSideCount > 0) {
      pendingExportTypes = exportTypes;
      els.noSideModalText.textContent =
        `${noSideCount} measurement${noSideCount === 1 ? "" : "s"} have no Side. Resolve now?`;
      els.noSideModal.classList.remove("hidden");
      return;
    }

    proceedExportCSV(exportTypes);
  }

  function proceedExportCSV(exportTypes) {
    exportTypes.forEach(dataType => recalculateDataTypeOrder(dataType.id));

    openFileNameModal("Export CSV", project?.name || "measurements", chosen => {
      if (!chosen) return;

      const fileName =
        chosen.toLowerCase().endsWith(".csv") ? chosen : chosen + ".csv";

      const grouped = {};
      exportTypes.forEach(dataType => {
        grouped[dataType.id] = getOrderedPoints(dataType.id);
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

          row.push(item.side || "Unassigned");
          row.push(item.seq);
          row.push(point.measurement);

          const notes = [];
          if (point.moveDistance > 80) {
            notes.push("Point moved a large distance; check order");
          } else if (point.moved) {
            notes.push("Point moved");
          }
          row.push(notes.join("; "));
        });

        csv += row.map(cleanCSV).join(",") + "\n";
      }

      downloadBlob(
        new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
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
          ? Number(els.pdfCanvas.dataset.logicalWidth || els.drawingArea.offsetWidth)
          : Number(project?.blankWidth || els.drawingArea.offsetWidth);

      const sourceHeight =
        project?.kind === "pdf"
          ? Number(els.pdfCanvas.dataset.logicalHeight || els.drawingArea.offsetHeight)
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
        context.drawImage(els.pdfCanvas, 0, 0, sourceWidth, sourceHeight);
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
      context.font = labelFontSize + "px Arial, sans-serif";
      context.lineJoin = "round";

      points.forEach(point => {
        const dataType = getDataType(point.dataId);
        if (dataType?.export === false) return;

        const measurement = point.measurement || String(point.number);

        const label =
          showOrderLabels && point.assignedSide && point.assignedSeq
            ? `${point.assignedSide}${point.assignedSeq}`
            : measurement;

        // White outline first, then the coloured text on top.
        context.lineWidth = Math.max(2, labelFontSize / 5);
        context.strokeStyle = "#ffffff";
        context.strokeText(label, point.x, point.y);

        context.fillStyle = dataType?.color || "#000000";
        context.fillText(label, point.x, point.y);
      });

      // Movable text notes.
      context.textAlign = "left";
      context.textBaseline = "top";
      textNotes.forEach(note => {
        context.font = `600 ${note.size}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
        context.lineWidth = Math.max(2, note.size / 7);
        context.strokeStyle = "#ffffff";
        context.strokeText(note.text, note.x, note.y);
        context.fillStyle = note.color || "#000000";
        context.fillText(note.text, note.x, note.y);
      });

      context.restore();

      const orientation = exportWidth > exportHeight ? "landscape" : "portrait";

      // Prefer embedding the finished canvas directly (jsPDF ships inside the
      // html2pdf bundle). This avoids html2pdf's html2canvas screenshot step,
      // which can drop content on some iPads.
      const JsPdf = window.jspdf && window.jspdf.jsPDF;

      if (JsPdf) {
        const pdf = new JsPdf({
          unit: "px",
          format: [exportWidth, exportHeight],
          orientation,
          compress: true
        });
        pdf.addImage(
          exportCanvas.toDataURL("image/jpeg", 0.98),
          "JPEG",
          0,
          0,
          exportWidth,
          exportHeight
        );
        pdf.save(fileName);
      } else {
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
              orientation,
              compress: true
            }
          })
          .from(exportCanvas)
          .save();
      }

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
    captureCurrentPageState();

    project.state = {
      points,
      pageStates,
      currentPdfPage,
      dataTypes,
      textNotes,
      pointMode,
      showOrderLabels,
      zoomLevel,
      labelFontSize,
      selectedDataId: els.dataSelect.value,
      currentSide,
      commentImageData,
      brushColor,
      brushWidth,
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

  function resetZoom() {
    if (zoomLevel === 1) return;
    changeZoom(1 - zoomLevel);
  }

  /* ---------- Review sidebar (on-screen measurement checklist) ---------- */

  function toggleReviewSidebar() {
    if (!els.reviewSidebar) return;

    if (els.reviewSidebar.classList.contains("hidden")) {
      renderReviewList();
      els.reviewSidebar.classList.remove("hidden");
    } else {
      els.reviewSidebar.classList.add("hidden");
    }
  }

  function refreshReviewIfOpen() {
    if (els.reviewSidebar && !els.reviewSidebar.classList.contains("hidden")) {
      renderReviewList();
    }
  }

  function renderReviewList() {
    const container = els.reviewList;
    if (!container) return;

    container.innerHTML = "";

    const typesWithPoints = dataTypes.filter(dt =>
      points.some(p => p.dataId === dt.id)
    );

    if (!typesWithPoints.length) {
      const empty = document.createElement("p");
      empty.className = "reviewEmpty";
      empty.textContent = "No points yet. Add points, then reopen Review.";
      container.appendChild(empty);
      return;
    }

    // If the filtered type no longer has points, fall back to All.
    if (reviewFilter !== "all" && !typesWithPoints.some(dt => dt.id === reviewFilter)) {
      reviewFilter = "all";
    }

    // Filter chips: All + one per data type that has points.
    const filterBar = document.createElement("div");
    filterBar.className = "reviewFilterBar";

    const makeChip = (label, value, color) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "reviewChip" + (reviewFilter === value ? " active" : "");
      chip.textContent = label;
      if (color && reviewFilter === value) {
        chip.style.background = color;
        chip.style.borderColor = color;
      }
      chip.addEventListener("click", () => {
        reviewFilter = value;
        renderReviewList();
      });
      return chip;
    };

    filterBar.appendChild(makeChip("All", "all", null));
    typesWithPoints.forEach(dt => {
      filterBar.appendChild(makeChip(dt.name, dt.id, dt.color));
    });
    container.appendChild(filterBar);

    const shownTypes = reviewFilter === "all"
      ? typesWithPoints
      : typesWithPoints.filter(dt => dt.id === reviewFilter);

    shownTypes.forEach(dt => {
      const section = document.createElement("div");
      section.className = "reviewSection";

      const header = document.createElement("div");
      header.className = "reviewTypeHeader";
      header.textContent = dt.name;
      header.style.color = dt.color || "#111";
      section.appendChild(header);

      const list = getOrderedPoints(dt.id);

      list.forEach(item => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "reviewRow";

        const tag = document.createElement("span");
        tag.className = "reviewTag";
        tag.textContent = (item.side || "U") + item.seq;

        const val = document.createElement("span");
        val.className = "reviewVal";
        val.textContent = item.point.measurement || "(empty)";

        row.appendChild(tag);
        row.appendChild(val);
        row.addEventListener("click", () => jumpToPoint(item.point));

        section.appendChild(row);
      });

      // Excluded points for this type, greyed at the bottom of the section.
      const excluded = points.filter(p => p.dataId === dt.id && p.excluded);
      if (excluded.length) {
        const exHeader = document.createElement("div");
        exHeader.className = "reviewTypeHeader reviewExcludedHeader";
        exHeader.textContent = "Excluded";
        section.appendChild(exHeader);

        excluded.forEach(point => {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "reviewRow reviewExcludedRow";

          const tag = document.createElement("span");
          tag.className = "reviewTag";
          tag.textContent = "—";

          const val = document.createElement("span");
          val.className = "reviewVal";
          val.textContent = point.measurement || "(empty)";

          row.appendChild(tag);
          row.appendChild(val);
          row.addEventListener("click", () => jumpToPoint(point));

          section.appendChild(row);
        });
      }

      container.appendChild(section);
    });
  }

  function jumpToPoint(point) {
    const wrapper = els.drawingWrapper;
    if (!wrapper) return;

    wrapper.scrollLeft = point.x * zoomLevel - wrapper.clientWidth / 2;
    wrapper.scrollTop = point.y * zoomLevel - wrapper.clientHeight / 2;

    const element = findPointElement(point.uid);
    if (element) {
      element.classList.add("pointFlash");
      setTimeout(() => element.classList.remove("pointFlash"), 1200);
    }
  }

  function fitDrawing() {
    const wrapperWidth = Math.max(1, els.drawingWrapper.clientWidth - 24);
    const wrapperHeight = Math.max(1, els.drawingWrapper.clientHeight - 24);
    const drawingWidth = Math.max(1, els.drawingArea.offsetWidth);
    const drawingHeight = Math.max(1, els.drawingArea.offsetHeight);
    const target = Math.max(0.3, Math.min(5, wrapperWidth / drawingWidth, wrapperHeight / drawingHeight));
    changeZoom(target - zoomLevel);
    requestAnimationFrame(() => {
      els.drawingWrapper.scrollLeft = 0;
      els.drawingWrapper.scrollTop = 0;
    });
  }

  function applyZoom() {
    els.drawingArea.style.transform = `scale(${zoomLevel})`;
    els.drawingArea.style.setProperty("--inv-zoom", String(1 / zoomLevel));

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

  function applyLabelFontSize() {
    points.forEach(point => {
      const element = findPointElement(point.uid);
      if (element) element.style.fontSize = labelFontSize + "px";
    });

    if (els.labelSizeDisplay) {
      els.labelSizeDisplay.textContent = String(labelFontSize);
    }
    if (els.labelSizeDownBtn) {
      els.labelSizeDownBtn.disabled = labelFontSize <= 14;
    }
    if (els.labelSizeUpBtn) {
      els.labelSizeUpBtn.disabled = labelFontSize >= 72;
    }
  }

  function changeLabelFontSize(delta) {
    const next = Math.max(14, Math.min(72, labelFontSize + delta));
    if (next === labelFontSize) return;

    labelFontSize = next;
    applyLabelFontSize();
    scheduleAutoSave();
  }

  function resetLabelFontSize() {
    if (labelFontSize === 30) return;
    labelFontSize = 30;
    applyLabelFontSize();
    scheduleAutoSave();
  }

  function touchDistance(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  /* Stop any in-progress point drag or pen stroke when a pinch begins. */
  function abortActiveInteraction() {
    isDraggingPoint = false;
    draggedPoint = null;
    movingPoint = null;
    isDrawingComment = false;
    noteDrag = null;
    els.drawingWrapper.classList.remove("pointDragActive");

    const moving = els.drawingArea.querySelector(".point.movingPoint");
    if (moving) moving.classList.remove("movingPoint");
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
    refreshReviewIfOpen();
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
