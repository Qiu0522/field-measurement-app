"use strict";

const ProjectDB = (() => {
  const DB_NAME = "FieldMeasurementV4";
  const DB_VERSION = 1;
  const STORE_NAME = "projects";

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id"
          });

          store.createIndex("updatedAt", "updatedAt");
          store.createIndex("tower", "tower");
          store.createIndex("name", "name");
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function runTransaction(mode, callback) {
    const db = await open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);

      let result;

      try {
        result = callback(store);
      } catch (error) {
        reject(error);
        return;
      }

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async function getAllProjects() {
    const db = await open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const projects = request.result || [];
        projects.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(projects);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async function getProject(id) {
    const db = await open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveProject(project) {
    project.updatedAt = Date.now();

    await runTransaction("readwrite", store => {
      store.put(project);
    });

    return project;
  }

  async function deleteProject(id) {
    await runTransaction("readwrite", store => {
      store.delete(id);
    });
  }

  async function duplicateProject(id) {
    const original = await getProject(id);

    if (!original) {
      throw new Error("Project not found.");
    }

    const copy = structuredCloneProject(original);
    copy.id = crypto.randomUUID
      ? crypto.randomUUID()
      : "project_" + Date.now() + "_" + Math.random().toString(16).slice(2);

    copy.name = original.name + " Copy";
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();

    await saveProject(copy);
    return copy;
  }

  function structuredCloneProject(project) {
    if (typeof structuredClone === "function") {
      return structuredClone(project);
    }

    const clone = { ...project };

    clone.state = JSON.parse(JSON.stringify(project.state || {}));

    if (project.pdfData instanceof ArrayBuffer) {
      clone.pdfData = project.pdfData.slice(0);
    }

    return clone;
  }

  return {
    open,
    getAllProjects,
    getProject,
    saveProject,
    deleteProject,
    duplicateProject
  };
})();
