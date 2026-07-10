"use strict";

const ProjectDB = (() => {
  const DB_NAME = "FieldMeasurementV4";
  const DB_VERSION = 2;

  const PROJECTS = "projects";
  const FOLDERS = "folders";
  const ASSETS = "assets";

  let dbPromise = null;

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

        /*
          Existing Version 4 records may contain a large pdfData ArrayBuffer.
          Move it to the asset store once, so ordinary autosaves only write
          the much smaller project state.
        */
        if (event.oldVersion < 2 && projectStore) {
          const assetStore = transaction.objectStore(ASSETS);
          const cursorRequest = projectStore.openCursor();

          cursorRequest.onsuccess = cursorEvent => {
            const cursor = cursorEvent.target.result;
            if (!cursor) return;

            const project = cursor.value;

            if (project.pdfData) {
              assetStore.put({
                projectId: project.id,
                pdfData: project.pdfData
              });

              delete project.pdfData;
              project.folderId = project.folderId || null;
              cursor.update(project);
            } else if (project.folderId === undefined) {
              project.folderId = null;
              cursor.update(project);
            }

            cursor.continue();
          };
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function requestResult(storeName, mode, operation) {
    const db = await open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function transactionComplete(storeNames, mode, callback) {
    const db = await open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);

      try {
        callback(tx);
      } catch (error) {
        reject(error);
        return;
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function getAllProjects() {
    const projects = await requestResult(
      PROJECTS,
      "readonly",
      store => store.getAll()
    );

    return (projects || []).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function getProject(id) {
    const project = await requestResult(
      PROJECTS,
      "readonly",
      store => store.get(id)
    );

    if (!project) return null;

    const asset = await requestResult(
      ASSETS,
      "readonly",
      store => store.get(id)
    );

    if (asset?.pdfData) {
      project.pdfData = asset.pdfData;
    }

    return project;
  }

  async function saveProject(project) {
    const record = {
      ...project,
      folderId: project.folderId || null,
      updatedAt: Date.now()
    };

    const pdfData = record.pdfData;
    delete record.pdfData;

    const stores = pdfData
      ? [PROJECTS, ASSETS]
      : [PROJECTS];

    await transactionComplete(stores, "readwrite", tx => {
      tx.objectStore(PROJECTS).put(record);

      if (pdfData) {
        tx.objectStore(ASSETS).put({
          projectId: record.id,
          pdfData
        });
      }
    });

    project.updatedAt = record.updatedAt;
    return project;
  }

  async function deleteProject(id) {
    await transactionComplete([PROJECTS, ASSETS], "readwrite", tx => {
      tx.objectStore(PROJECTS).delete(id);
      tx.objectStore(ASSETS).delete(id);
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

    await saveProject(copy);
    return copy;
  }

  async function getAllFolders() {
    const folders = await requestResult(
      FOLDERS,
      "readonly",
      store => store.getAll()
    );

    return (folders || []).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }

  async function saveFolder(folder) {
    const record = {
      ...folder,
      parentId: folder.parentId || null,
      updatedAt: Date.now()
    };

    await requestResult(
      FOLDERS,
      "readwrite",
      store => store.put(record)
    );

    return record;
  }

  async function deleteFolder(folderId) {
    const projects = await getAllProjects();
    const folders = await getAllFolders();

    const hasProjects = projects.some(project => project.folderId === folderId);
    const hasSubfolders = folders.some(folder => folder.parentId === folderId);

    if (hasProjects || hasSubfolders) {
      throw new Error("Folder is not empty.");
    }

    await requestResult(
      FOLDERS,
      "readwrite",
      store => store.delete(folderId)
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

  return {
    open,
    getAllProjects,
    getProject,
    saveProject,
    deleteProject,
    duplicateProject,
    getAllFolders,
    saveFolder,
    deleteFolder,
    makeId
  };
})();
