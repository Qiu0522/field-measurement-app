"use strict";

const ProjectDB = (() => {
  const DB_NAME = "FieldMeasurementV4";
  const DB_VERSION = 2;

  const PROJECTS = "projects";
  const FOLDERS = "folders";
  const ASSETS = "assets";

  let dbPromise = null;
  let writeQueue = Promise.resolve();

  function open() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = event.target.result;
        const transaction = event.target.transaction;

        let projectStore;

        if (!db.objectStoreNames.contains(PROJECTS)) {
          projectStore = db.createObjectStore(PROJECTS, { keyPath: "id" });
          projectStore.createIndex("updatedAt", "updatedAt");
          projectStore.createIndex("name", "name");
          projectStore.createIndex("folderId", "folderId");
        } else {
          projectStore = transaction.objectStore(PROJECTS);

          if (!projectStore.indexNames.contains("folderId")) {
            projectStore.createIndex("folderId", "folderId");
          }
        }

        if (!db.objectStoreNames.contains(FOLDERS)) {
          const folderStore = db.createObjectStore(FOLDERS, { keyPath: "id" });
          folderStore.createIndex("parentId", "parentId");
          folderStore.createIndex("updatedAt", "updatedAt");
          folderStore.createIndex("name", "name");
        }

        if (!db.objectStoreNames.contains(ASSETS)) {
          db.createObjectStore(ASSETS, { keyPath: "projectId" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;

        db.onversionchange = () => {
          db.close();
          dbPromise = null;

          // Let the UI warn the user that another tab took over the database.
          try {
            window.dispatchEvent(new CustomEvent("fielddb:conflict"));
          } catch (error) {
            /* CustomEvent unavailable: ignore */
          }
        };

        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn("IndexedDB upgrade is blocked by another open tab.");
      };
    });

    return dbPromise;
  }

  async function runRequest(storeName, mode, operation) {
    const db = await open();

    return new Promise((resolve, reject) => {
      let tx;

      try {
        tx = db.transaction(storeName, mode);
      } catch (error) {
        reject(error);
        return;
      }

      const store = tx.objectStore(storeName);
      let request;

      try {
        request = operation(store);
      } catch (error) {
        reject(error);
        return;
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error || new Error("Database transaction aborted."));
    });
  }

  function enqueueWrite(task) {
    const next = writeQueue.then(task, task);
    writeQueue = next.catch(() => {});
    return next;
  }

  async function getAllProjects() {
    const projects = await runRequest(
      PROJECTS,
      "readonly",
      store => store.getAll()
    );

    return (projects || []).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function getProject(id) {
    const project = await runRequest(
      PROJECTS,
      "readonly",
      store => store.get(id)
    );

    if (!project) return null;

    let asset = null;

    try {
      asset = await runRequest(
        ASSETS,
        "readonly",
        store => store.get(id)
      );
    } catch (error) {
      console.warn("Could not read separate PDF asset:", error);
    }

    /*
      Compatibility with older Version 4 records:
      - old records may still contain pdfData directly
      - newer records use the assets store
    */
    if (asset?.pdfData) {
      project.pdfData = asset.pdfData;
      project._assetSaved = true;
    } else if (project.pdfData) {
      project._assetSaved = false;
    }

    return project;
  }

  async function saveProject(project) {
    return enqueueWrite(async () => {
      const now = Date.now();

      const record = {
        ...project,
        folderId: project.folderId || null,
        updatedAt: now
      };

      const pdfData = record.pdfData;

      /*
        Never place the large PDF ArrayBuffer in the ordinary project record.
        Also remove private runtime flags.
      */
      delete record.pdfData;
      delete record._assetSaved;

      await runRequest(
        PROJECTS,
        "readwrite",
        store => store.put(record)
      );

      /*
        Save the PDF only once:
        - for a newly imported PDF
        - for an old record being migrated
        Ordinary point/autosave updates skip this large write.
      */
      if (pdfData && !project._assetSaved) {
        await runRequest(
          ASSETS,
          "readwrite",
          store => store.put({
            projectId: record.id,
            pdfData
          })
        );

        project._assetSaved = true;
      }

      project.updatedAt = now;
      return project;
    });
  }

  async function deleteProject(id) {
    return enqueueWrite(async () => {
      await runRequest(
        PROJECTS,
        "readwrite",
        store => store.delete(id)
      );

      try {
        await runRequest(
          ASSETS,
          "readwrite",
          store => store.delete(id)
        );
      } catch (error) {
        console.warn("Could not delete PDF asset:", error);
      }
    });
  }

  async function duplicateProject(id) {
    const original = await getProject(id);
    if (!original) throw new Error("Project not found.");

    const copy = cloneProject(original);
    copy.id = makeId("project");
    copy.name = original.name + " Copy";
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();

    /*
      The duplicate has a new ID, so its PDF must be written as a new asset.
    */
    copy._assetSaved = false;

    await saveProject(copy);
    return copy;
  }

  async function getAllFolders() {
    const folders = await runRequest(
      FOLDERS,
      "readonly",
      store => store.getAll()
    );

    return (folders || []).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }

  async function saveFolder(folder) {
    return enqueueWrite(async () => {
      const record = {
        ...folder,
        parentId: folder.parentId || null,
        updatedAt: Date.now()
      };

      await runRequest(
        FOLDERS,
        "readwrite",
        store => store.put(record)
      );

      folder.updatedAt = record.updatedAt;
      return folder;
    });
  }

  async function deleteFolder(folderId) {
    const projects = await getAllProjects();
    const folders = await getAllFolders();

    const hasProjects = projects.some(project => project.folderId === folderId);
    const hasSubfolders = folders.some(folder => folder.parentId === folderId);

    if (hasProjects || hasSubfolders) {
      throw new Error("Folder is not empty.");
    }

    return enqueueWrite(() =>
      runRequest(
        FOLDERS,
        "readwrite",
        store => store.delete(folderId)
      )
    );
  }

  function cloneProject(project) {
    if (typeof structuredClone === "function") {
      return structuredClone(project);
    }

    const clone = {
      ...project,
      state: JSON.parse(JSON.stringify(project.state || {}))
    };

    if (project.pdfData instanceof ArrayBuffer) {
      clone.pdfData = project.pdfData.slice(0);
    }

    return clone;
  }

  function makeId(prefix) {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : prefix + "_" + Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  function explainError(error) {
    if (!error) return "Unknown database error.";

    if (error.name === "QuotaExceededError") {
      return "This iPad is low on website storage. Delete unused work files or free device storage.";
    }

    if (error.name === "InvalidStateError") {
      return "The local database connection was interrupted. Close other tabs of this app and reload.";
    }

    if (error.name === "DataCloneError") {
      return "Some project data could not be stored. Reload the app and try again.";
    }

    return `${error.name || "Error"}: ${error.message || String(error)}`;
  }

  /* ---------- Whole-library backup and restore ---------- */

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + chunkSize)
      );
    }

    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
  }

  /*
    Read every folder, project, and PDF asset and return one JSON-safe object.
    ArrayBuffers (PDF data) are encoded as base64 so the result can be
    stringified to a .json backup file.
  */
  async function exportAll() {
    const projects = await runRequest(PROJECTS, "readonly", store => store.getAll());
    const folders = await runRequest(FOLDERS, "readonly", store => store.getAll());
    const assets = await runRequest(ASSETS, "readonly", store => store.getAll());

    const safeProjects = (projects || []).map(project => {
      const copy = { ...project };

      // Older Version 4 records may still hold the PDF inside the project.
      if (copy.pdfData instanceof ArrayBuffer) {
        copy.pdfData = arrayBufferToBase64(copy.pdfData);
        copy._pdfIsBase64 = true;
      } else {
        delete copy.pdfData;
      }

      delete copy._assetSaved;
      return copy;
    });

    const safeAssets = (assets || []).map(asset => ({
      projectId: asset.projectId,
      pdfData: asset.pdfData instanceof ArrayBuffer
        ? arrayBufferToBase64(asset.pdfData)
        : null
    }));

    return {
      format: "field-measurement-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      counts: {
        folders: (folders || []).length,
        projects: safeProjects.length,
        assets: safeAssets.length
      },
      data: {
        folders: folders || [],
        projects: safeProjects,
        assets: safeAssets
      }
    };
  }

  async function exportSelected(projectIds) {
    const wanted = new Set(Array.isArray(projectIds) ? projectIds : []);
    const allProjects = await runRequest(PROJECTS, "readonly", store => store.getAll());
    const allAssets = await runRequest(ASSETS, "readonly", store => store.getAll());
    const selectedProjects = (allProjects || []).filter(project => wanted.has(project.id));
    const selectedAssets = (allAssets || []).filter(asset => wanted.has(asset.projectId));

    const safeProjects = selectedProjects.map(project => {
      const copy = { ...project };
      if (copy.pdfData instanceof ArrayBuffer) {
        copy.pdfData = arrayBufferToBase64(copy.pdfData);
        copy._pdfIsBase64 = true;
      } else {
        delete copy.pdfData;
      }
      delete copy._assetSaved;
      return copy;
    });

    const safeAssets = selectedAssets.map(asset => ({
      projectId: asset.projectId,
      pdfData: asset.pdfData instanceof ArrayBuffer
        ? arrayBufferToBase64(asset.pdfData)
        : null
    }));

    return {
      format: "field-measurement-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      selectionOnly: true,
      counts: { folders: 0, projects: safeProjects.length, assets: safeAssets.length },
      data: { folders: [], projects: safeProjects, assets: safeAssets }
    };
  }

  async function exportProjectBundle(projectIds) {
    const files = [];
    for (const id of projectIds || []) files.push(await exportProject(id));
    return {
      format: "field-measurement-files",
      version: 1,
      exportedAt: new Date().toISOString(),
      files
    };
  }

  /*
    Restore a backup object produced by exportAll().
    - mode "merge"   : add or overwrite items that share an id, keep the rest.
    - mode "replace" : clear all three stores first, then load the backup.
    All writes run inside a single transaction so a failure leaves the
    database unchanged.
  */
  async function importAll(backup, options = {}) {
    const mode = options.mode === "replace" ? "replace" : "merge";

    if (!backup || backup.format !== "field-measurement-backup" || !backup.data) {
      throw new Error("This file is not a Field Measurement backup.");
    }

    const folders = Array.isArray(backup.data.folders) ? backup.data.folders : [];
    const projects = Array.isArray(backup.data.projects) ? backup.data.projects : [];
    const assets = Array.isArray(backup.data.assets) ? backup.data.assets : [];

    return enqueueWrite(async () => {
      const db = await open();

      return new Promise((resolve, reject) => {
        let tx;

        try {
          tx = db.transaction([PROJECTS, FOLDERS, ASSETS], "readwrite");
        } catch (error) {
          reject(error);
          return;
        }

        tx.oncomplete = () => resolve({
          mode,
          folders: folders.length,
          projects: projects.length,
          assets: assets.length
        });
        tx.onerror = () => reject(tx.error || new Error("Import failed."));
        tx.onabort = () => reject(tx.error || new Error("Import was aborted."));

        const projectStore = tx.objectStore(PROJECTS);
        const folderStore = tx.objectStore(FOLDERS);
        const assetStore = tx.objectStore(ASSETS);

        if (mode === "replace") {
          projectStore.clear();
          folderStore.clear();
          assetStore.clear();
        }

        folders.forEach(folder => {
          if (folder && folder.id) folderStore.put(folder);
        });

        projects.forEach(project => {
          if (!project || !project.id) return;

          const record = { ...project };

          // Legacy projects stored their PDF as base64 in the export.
          if (record._pdfIsBase64 && typeof record.pdfData === "string") {
            record.pdfData = base64ToArrayBuffer(record.pdfData);
            delete record._pdfIsBase64;
          }

          projectStore.put(record);
        });

        assets.forEach(asset => {
          if (!asset || !asset.projectId) return;

          assetStore.put({
            projectId: asset.projectId,
            pdfData: typeof asset.pdfData === "string"
              ? base64ToArrayBuffer(asset.pdfData)
              : null
          });
        });
      });
    });
  }

  /* ---------- Single-file export / import (share one work file) ---------- */

  async function exportProject(id) {
    const project = await getProject(id);
    if (!project) throw new Error("File not found.");

    const copy = { ...project };

    if (copy.pdfData instanceof ArrayBuffer) {
      copy.pdfData = arrayBufferToBase64(copy.pdfData);
      copy._pdfIsBase64 = true;
    } else {
      delete copy.pdfData;
    }
    delete copy._assetSaved;

    return {
      format: "field-measurement-file",
      version: 1,
      exportedAt: new Date().toISOString(),
      project: copy
    };
  }

  async function importProject(fileData, folderId) {
    if (!fileData || fileData.format !== "field-measurement-file" || !fileData.project) {
      throw new Error("This file is not a Field Measurement file export.");
    }

    const source = fileData.project;
    const newId = makeId("project");

    const record = {
      ...source,
      id: newId,
      folderId: folderId || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    let pdfBuffer = null;
    if (record._pdfIsBase64 && typeof record.pdfData === "string") {
      pdfBuffer = base64ToArrayBuffer(record.pdfData);
      delete record._pdfIsBase64;
    }
    delete record.pdfData;
    delete record._assetSaved;

    return enqueueWrite(async () => {
      await runRequest(PROJECTS, "readwrite", store => store.put(record));

      if (pdfBuffer) {
        await runRequest(ASSETS, "readwrite", store => store.put({
          projectId: newId,
          pdfData: pdfBuffer
        }));
      }

      return record;
    });
  }

  return {
    open,
    exportAll,
    exportSelected,
    exportProjectBundle,
    importAll,
    exportProject,
    importProject,
    getAllProjects,
    getProject,
    saveProject,
    deleteProject,
    duplicateProject,
    getAllFolders,
    saveFolder,
    deleteFolder,
    makeId,
    explainError
  };
})();
