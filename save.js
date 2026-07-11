"use strict";

/*
  SaveController
  - Editing only marks the project as Unsaved.
  - The user can press Save at any time.
  - A safety save runs every 3 minutes if changes exist.
  - Closing the browser with unsaved changes shows a warning.
*/
const SaveController = (() => {
  const SAFETY_INTERVAL_MS = 3 * 60 * 1000;

  let saveFunction = null;
  let statusElement = null;
  let dirty = false;
  let dirtyGen = 0;
  let savingGen = 0;
  let savingPromise = null;
  let safetyTimer = null;

  function init(options) {
    saveFunction = options.saveFunction;
    statusElement = options.statusElement;

    stopSafetyTimer();

    safetyTimer = setInterval(() => {
      if (!dirty || !saveFunction || savingPromise) return;

      save("safety").catch(error => {
        console.error("Safety save failed:", error);
      });
    }, options.intervalMs || SAFETY_INTERVAL_MS);

    window.addEventListener("beforeunload", handleBeforeUnload);

    // beforeunload is unreliable in iOS Home-Screen (standalone) mode, so also
    // save when the app is hidden/backgrounded or the page is being unloaded.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushSave("visibility");
    });
    window.addEventListener("pagehide", () => flushSave("pagehide"));

    markSaved();
  }

  function flushSave(reason) {
    if (!dirty || !saveFunction || savingPromise) return;
    save(reason).catch(error => {
      console.error("Save on hide failed:", error);
    });
  }

  function markUnsaved() {
    dirty = true;
    dirtyGen += 1;
    setStatus("● Unsaved", "unsaved");
  }

  function markSaved() {
    dirty = false;
    setStatus("✓ Saved", "saved");
  }

  function markSaving() {
    setStatus("Saving…", "saving");
  }

  function markFailed(message = "Save failed") {
    dirty = true;
    setStatus("⚠ Save failed", "failed");

    if (statusElement) {
      statusElement.title = message;
    }
  }

  async function save(reason = "manual", force = false) {
    if (!saveFunction) return;
    if (!dirty && !force) return;
    if (savingPromise) return savingPromise;

    savingGen = dirtyGen;
    markSaving();

    savingPromise = Promise.resolve()
      .then(() => saveFunction({ reason, force }))
      .then(result => {
        // If edits happened while saving, stay Unsaved so they get written next.
        if (dirtyGen === savingGen) {
          markSaved();
        } else {
          setStatus("● Unsaved", "unsaved");
        }
        return result;
      })
      .catch(error => {
        const message = window.ProjectDB?.explainError
          ? ProjectDB.explainError(error)
          : String(error);

        markFailed(message);
        throw error;
      })
      .finally(() => {
        savingPromise = null;
      });

    return savingPromise;
  }

  function isDirty() {
    return dirty;
  }

  function isSaving() {
    return Boolean(savingPromise);
  }

  function stopSafetyTimer() {
    if (safetyTimer) {
      clearInterval(safetyTimer);
      safetyTimer = null;
    }
  }

  function handleBeforeUnload(event) {
    if (!dirty) return;

    event.preventDefault();
    event.returnValue = "";
  }

  function setStatus(text, state) {
    if (!statusElement) return;

    statusElement.textContent = text;
    statusElement.dataset.saveState = state;
    statusElement.classList.toggle("saving", state === "saving");
    statusElement.classList.toggle("unsaved", state === "unsaved");
    statusElement.classList.toggle("saveFailed", state === "failed");
  }

  return {
    init,
    markUnsaved,
    markSaved,
    markSaving,
    markFailed,
    save,
    isDirty,
    isSaving,
    stopSafetyTimer
  };
})();
