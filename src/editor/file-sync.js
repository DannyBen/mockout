import MockoutProject from '../core/project.js';

export function createFileSync({ model, elements, actions, events }) {
  function updateFileStatus() {
    actions.publishPresentation();
  }
  function clearFileSaveError() {
    if (!model.fileSaveError) return;
    model.fileSaveError = '';
    if (!model.savedProjectIssue && !model.fileConflict) actions.hideNotice();
  }
  function queueFileSave() {
    clearTimeout(model.fileSaveTimer);
    updateFileStatus();
    if (!model.projectFileHandle || model.fileLocked || model.fileSaving || model.fileSaveError || model.savedProjectIssue
      || (model.dialog === 'save') || model.fileNeedsPermission || model.gesture || model.opacityBefore !== null || model.styleBefore !== null || model.placement || model.textEditor || actions.snapshot() === model.fileBaseline) return;
    model.fileSaveTimer = setTimeout(() => saveProject(false, null, true), 0);
  }
  function setProjectFileHandle(handle, { remember = true, needsPermission = false, canRead = false, file = null, baseline = null } = {}) {
    const wasLocked = model.fileLocked;
    model.fileConnectionRevision++;
    model.projectFileHandle = handle;
    model.fileObserver?.disconnect();
    model.fileObserver = null;
    if (remember) {
      clearTimeout(model.fileSaveTimer);
      clearFileSaveError();
      model.fileStamp = file?.lastModified ?? null;
      model.fileBaseline = handle && file ? baseline ?? actions.snapshot() : null;
      model.fileLocked = false;
      model.fileConflict = false;
      model.filePendingStamp = null;
      actions.hideFileActions();
    }
    const connected = Boolean(handle) && !needsPermission;
    model.fileNeedsPermission = needsPermission;
    updateFileStatus();
    if (!needsPermission && model.notice.kind === 'file-connection') {
      if (model.savedProjectIssue) actions.showNotice(model.savedProjectIssue);
      else actions.hideNotice();
    }
    if (handle && (connected || canRead) && typeof FileSystemObserver === 'function') {
      const observer = new FileSystemObserver(() => checkExternalFile());
      model.fileObserver = observer;
      observer.observe(handle).then(() => {
        if (model.fileObserver === observer) checkExternalFile();
      }).catch(() => { observer.disconnect(); if (model.fileObserver === observer) model.fileObserver = null; });
    }
    if (wasLocked && !model.fileLocked) {
      if (model.savedProjectIssue) actions.showNotice(model.savedProjectIssue);
      else actions.hideNotice();
      actions.render();
    }
    if (remember) return rememberFileConnection();
  }
  function rememberFileConnection() {
    const handle = model.projectFileHandle;
    const sync = { stamp: model.fileStamp, baseline: model.fileBaseline };
    model.fileConnectionSave = model.fileConnectionSave.then(() => storedFileConnection(true, handle, sync))
      .catch(error => actions.showNotice(`Could not remember the file connection: ${error.message}`));
    return model.fileConnectionSave;
  }
  function storedFileConnection(write = false, handle = null, sync = null) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('mockout-file-connection', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('connection');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        try {
          const transaction = database.transaction('connection', write ? 'readwrite' : 'readonly');
          const store = transaction.objectStore('connection');
          const operation = write ? handle ? store.put(handle, 'current') : store.delete('current') : store.get('current');
          const metadata = write ? handle ? store.put(sync, 'sync') : store.delete('sync') : store.get('sync');
          transaction.oncomplete = () => { database.close(); resolve(write ? undefined : { handle: operation.result, sync: metadata.result }); };
          transaction.onabort = () => { database.close(); reject(transaction.error || new Error('Storage was interrupted.')); };
        } catch (error) { database.close(); reject(error); }
      };
    });
  }
  async function checkFileConnection(handle, revision, requestPermission = false) {
    try {
      const permission = requestPermission ? await handle.requestPermission({ mode: 'readwrite' })
        : await handle.queryPermission({ mode: 'readwrite' });
      const canRead = permission === 'granted' || await handle.queryPermission({ mode: 'read' }) === 'granted';
      if (canRead) await handle.getFile();
      if (revision !== model.fileConnectionRevision) return;
      setProjectFileHandle(handle, { remember: false, needsPermission: permission !== 'granted', canRead });
      if (canRead) {
        if (requestPermission) clearFileSaveError();
        await checkExternalFile();
        queueFileSave();
      }
    } catch (error) {
      if (revision !== model.fileConnectionRevision) return;
      if (error.name === 'NotFoundError') setProjectFileHandle(null);
      else {
        setProjectFileHandle(handle, { remember: false, needsPermission: true });
        actions.showNotice(`Could not reconnect the file: ${error.message}`, 'file-connection');
      }
    }
  }
  async function restoreFileConnection() {
    const revision = model.fileConnectionRevision;
    try {
      const { handle, sync } = await storedFileConnection();
      if (revision !== model.fileConnectionRevision || !handle) return;
      if (model.firstLoad) { setProjectFileHandle(null); return; }
      model.fileStamp = sync?.stamp ?? null;
      model.fileBaseline = sync?.baseline ?? null;
      await checkFileConnection(handle, revision);
    } catch (error) {
      if (revision === model.fileConnectionRevision) actions.showNotice(`Could not restore the file connection: ${error.message}`);
    }
  }
  function showFileUpdate(message) {
    actions.showNotice(message);
    model.notice.fileUpdate = true;
    actions.publishPresentation();
  }
  function clearFileUpdate() {
    actions.hideFileActions();
    if (!model.notice.fileUpdate) return;
    if (model.savedProjectIssue) actions.showNotice(model.savedProjectIssue);
    else actions.hideNotice();
  }
  function pauseFileEditing() {
    if (model.placement) actions.finishPlacement(false);
    if (model.textEditor) model.textEditor.blur();
    actions.finishOpacityEdit();
    actions.finishStyleEdit();
    const before = model.gesture?.before;
    model.gesture = null;
    model.lastBoxClick = null;
    if (before) actions.commit(before);
    model.inspectorOpen = false;
    model.fileLocked = true;
  }
  function checkExternalFile(replace = false) {
    model.fileChecks = model.fileChecks.then(() => loadExternalFile(replace)).catch(error => {
      actions.showNotice(`Could not check the connected file: ${error.message}`);
      return true;
    });
    return model.fileChecks;
  }
  async function loadExternalFile(replace) {
    const handle = model.projectFileHandle;
    const revision = model.fileConnectionRevision;
    if (!handle || model.fileWriting || (model.dialog === 'save')) return false;
    let loading = false;
    try {
      if (model.fileNeedsPermission && await handle.queryPermission({ mode: 'read' }) !== 'granted') return false;
      if (revision !== model.fileConnectionRevision) return false;
      const file = await handle.getFile();
      if (revision !== model.fileConnectionRevision) return false;
      if ((model.dialog === 'save')) return false;
      if (!replace && model.fileStamp === file.lastModified) return false;
      pauseFileEditing();
      loading = true;
      actions.render();
      const loaded = JSON.parse(await file.text());
      if (revision !== model.fileConnectionRevision) return false;
      if ((model.dialog === 'save')) return false;
      if (!actions.validProject(loaded)) throw Error('The file is not a supported Mockout project.');
      // Older connections have no timestamp yet. Recognise an unchanged exported board.
      if (!replace && model.fileStamp === null && JSON.stringify(MockoutProject.forExport(loaded)) === JSON.stringify(MockoutProject.forExport(model.project))) {
        model.fileStamp = file.lastModified;
        model.fileBaseline = actions.snapshot();
        model.fileConflict = false;
        model.filePendingStamp = null;
        await rememberFileConnection();
        if (revision === model.fileConnectionRevision) clearFileUpdate();
        return false;
      }
      model.filePendingStamp = file.lastModified;
      model.fileConflict = !replace && (model.fileBaseline === null || actions.snapshot() !== model.fileBaseline);
      if (model.fileConflict) {
        showFileUpdate('The file and your canvas both changed. Reload file to use its version, or Save ours to replace it with your canvas.');
        return true;
      }
      const before = actions.snapshot();
      model.project = loaded;
      model.selectedIds = new Set([...model.selectedIds].filter(id => model.project.boxes.some(box => box.id === id)));
      model.selectedId = model.selectedIds.values().next().value ?? null;
      model.isolatedCopyIds = null;
      actions.commit(before);
      model.fileStamp = file.lastModified;
      model.fileBaseline = actions.snapshot();
      model.filePendingStamp = null;
      await rememberFileConnection();
      if (revision !== model.fileConnectionRevision) return false;
      clearFileUpdate();
      return true;
    } catch (error) {
      if (revision !== model.fileConnectionRevision) return false;
      if (error.name === 'NotFoundError') setProjectFileHandle(null);
      else if (error.name === 'NotAllowedError') {
        model.fileLocked = model.fileConflict;
        setProjectFileHandle(handle, { remember: false, needsPermission: true });
        actions.render();
      }
      else {
        pauseFileEditing();
        loading = true;
        model.fileConflict = true;
        model.filePendingStamp = null;
        showFileUpdate(`Could not load the external change: ${error.message} Current canvas kept.`);
      }
      return true;
    } finally {
      if (loading && revision === model.fileConnectionRevision) {
        model.fileLocked = model.fileConflict;
        actions.render();
      }
    }
  }
  function downloadProject() {
    const blob = new Blob([JSON.stringify(MockoutProject.forExport(model.project), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = MockoutProject.suggestedFileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function saveProject(asNew = false, overwriteStamp = null, automatic = false, connect = null) {
    if (model.fileSaving || (model.fileLocked && !asNew && overwriteStamp === null)) return;
    if (!automatic && overwriteStamp === null && connect === null && (!model.projectFileHandle || asNew)) {
      if (actions.modalOpen()) return;
      actions.closeProjectMenu();
      clearTimeout(model.fileSaveTimer);
      model.saveDialogError = '';
      actions.openDialog('save');
      elements.saveOnceButton.focus();
      return;
    }
    const choosing = connect !== null;
    if (choosing && !(model.dialog === 'save')) return;
    if (automatic && ((model.dialog === 'save') || !model.projectFileHandle || model.fileSaveError || model.savedProjectIssue
      || model.fileNeedsPermission || model.gesture || model.styleBefore !== null || model.placement || model.textEditor || actions.snapshot() === model.fileBaseline)) return;
    clearTimeout(model.fileSaveTimer);
    if (!automatic && !choosing) clearFileSaveError();
    model.fileSaving = true;
    if (choosing) {
      model.saveDialogError = '';
      actions.publishPresentation();
    }
    updateFileStatus();
    const revision = model.fileConnectionRevision;
    try {
      if (!window.showSaveFilePicker) {
        if (connect === true) return;
        downloadProject();
        if (choosing) {
          await setProjectFileHandle(null);
          actions.closeDialog();
        }
        return;
      }
      const handle = !asNew && model.projectFileHandle ? model.projectFileHandle : await window.showSaveFilePicker({
        suggestedName: MockoutProject.suggestedFileName(),
        types: [{ description: 'Mockout project', accept: { 'application/json': ['.json'] } }],
      });
      if (revision !== model.fileConnectionRevision) return;
      if (choosing && !(model.dialog === 'save')) return;
      if (handle === model.projectFileHandle && !asNew) {
        if (model.fileNeedsPermission) { actions.showNotice('Reconnect the file before saving.', 'file-connection'); return; }
        if (automatic && await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
          if (revision === model.fileConnectionRevision) setProjectFileHandle(handle, { remember: false, needsPermission: true, canRead: true });
          return;
        }
        if (revision !== model.fileConnectionRevision) return;
        if (overwriteStamp !== null) {
          const file = await handle.getFile();
          if (revision !== model.fileConnectionRevision) return;
          if (file.lastModified !== overwriteStamp) { await checkExternalFile(); return; }
        } else if (await checkExternalFile() || model.fileLocked || revision !== model.fileConnectionRevision) return;
      }
      if (automatic && (model.gesture || model.placement || model.textEditor)) return;
      const savedState = actions.snapshot();
      const contents = JSON.stringify(MockoutProject.forExport(model.project), null, 2);
      model.fileWriting = true;
      const writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
      const file = await handle.getFile();
      if (revision === model.fileConnectionRevision) {
        await setProjectFileHandle(connect === false ? null : handle, { file, baseline: savedState });
        if (choosing) actions.closeDialog();
      }
    } catch (error) {
      if (revision !== model.fileConnectionRevision) return;
      if (choosing) {
        if (error.name !== 'AbortError') {
          model.saveDialogError = `Could not save project: ${error.message}`;
          actions.publishPresentation();
        }
      } else if (error.name === 'NotAllowedError' && model.projectFileHandle) {
        setProjectFileHandle(model.projectFileHandle, { remember: false, needsPermission: true });
      } else if (error.name !== 'AbortError' || automatic) {
        model.fileSaveError = error.message;
        actions.showNotice(`Could not save project: ${error.message}`);
      }
    } finally {
      model.fileWriting = false;
      model.fileSaving = false;
      if (choosing && (model.dialog === 'save')) {
        actions.publishPresentation();
        (connect ? elements.saveConnectedButton : elements.saveOnceButton).focus();
      }
      checkExternalFile();
      queueFileSave();
    }
  }
  async function chooseProjectFile() {
    if (model.fileOpenBusy || actions.modalOpen()) return;
    if (!window.showOpenFilePicker) { document.querySelector('#open-file').click(); return; }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Mockout project', accept: { 'application/json': ['.json'] } }],
      });
      if (handle) await openProjectFile(null, handle);
    } catch (error) {
      if (error.name !== 'AbortError') actions.showNotice(`Could not open project: ${error.message}`);
    }
  }
  async function openProjectFile(file, handle = null) {
    if (model.placement || model.fileOpenBusy || actions.modalOpen()) return;
    model.fileOpenBusy = true;
    try {
      if (!file) file = await handle.getFile();
      const loaded = JSON.parse(await file.text());
      if (!actions.validProject(loaded)) throw new Error('This is not a Mockout project.');
      model.pendingProject = { file, handle, loaded };
      actions.closeProjectMenu();
      actions.openDialog('open');
      elements.openLocalCopyButton.focus();
    } catch (error) {
      actions.showNotice(`Could not open project: ${error.message}`);
    } finally {
      model.fileOpenBusy = false;
      actions.publishPresentation();
      if (model.dialog === 'open') elements.openLocalCopyButton.focus();
    }
  }
  async function finishOpeningProject(connect) {
    const pending = model.pendingProject;
    if (!pending || model.fileOpenBusy) return;
    model.fileOpenBusy = true;
    actions.publishPresentation();
    try {
      let connected = false;
      if (connect && pending.handle) {
        // This explicit choice supplies the user activation for Chrome's permission prompt.
        try { connected = await pending.handle.requestPermission({ mode: 'readwrite' }) === 'granted'; }
        catch (error) {
          if (error.name !== 'SecurityError' && error.name !== 'NotAllowedError') throw error;
        }
      }
      if (model.pendingProject !== pending || !(model.dialog === 'open')) return;
      actions.change(() => { model.project = pending.loaded; actions.selectOnly(null); model.inspectorOpen = false; actions.focusProject(model.project.boxes); });
      if (model.savedProjectIssue) actions.showNotice(model.savedProjectIssue);
      else actions.hideNotice();
      await setProjectFileHandle(connected ? pending.handle : null, { file: pending.file });
      model.undoStack.length = 0;
      model.redoStack.length = 0;
      actions.render();
    } catch (error) {
      actions.showNotice(`Could not open project: ${error.message}`);
    } finally {
      model.pendingProject = null;
      model.fileOpenBusy = false;
      actions.closeDialog();
    }
  }

  return {
    actions: {
      updateFileStatus, queueFileSave, setProjectFileHandle, checkFileConnection, restoreFileConnection,
      checkExternalFile, saveProject, chooseProjectFile, openProjectFile, finishOpeningProject
    },
    init() {
      events.on(window, 'focus', () => checkExternalFile());
      events.on(document, 'visibilitychange', () => { if (!document.hidden) checkExternalFile(); });
      events.interval(async () => {
        if (!model.projectFileHandle || model.filePolling) return;
        model.filePolling = true;
        try { await checkExternalFile(); }
        finally { model.filePolling = false; }
      }, 1000);
      events.on(document, 'dragover', event => {
        if (!event.dataTransfer?.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = model.placement || actions.modalOpen() || model.fileOpenBusy ? 'none' : 'copy';
      });
      events.on(document, 'drop', async event => {
        if (!event.dataTransfer?.types.includes('Files')) return;
        event.preventDefault();
        if (model.placement || actions.modalOpen() || model.fileOpenBusy) return;
        if (event.dataTransfer.files.length !== 1) {
          actions.showNotice('Drop one JSON project file at a time.');
          return;
        }
        const file = event.dataTransfer.files[0];
        try {
          const item = [...event.dataTransfer.items].find(item => item.kind === 'file');
          const handle = await item?.getAsFileSystemHandle?.();
          if (handle?.kind === 'directory') {
            actions.showNotice('Drop one JSON project file at a time.');
            return;
          }
          await openProjectFile(file, handle || null);
        } catch (error) {
          actions.showNotice(`Could not open project: ${error.message}`);
        }
      });
    },
  };
}
