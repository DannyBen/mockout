import MockoutProject from '../core/project.js';

export function createFileSync({ model, elements, actions, events }) {
  function updateFileStatus() {
    const handle = model.projectFileHandle;
    const status = !handle ? 'local' : model.fileConflict ? model.filePendingStamp === null ? 'error' : 'conflict'
      : !elements.reconnectFileButton.hidden ? 'reconnect'
      : model.fileSaveError ? 'error' : 'connected';
    const [icon, label] = {
      local: ['web_asset', ''],
      connected: ['check_circle', ''],
      reconnect: ['link_off', ''],
      conflict: ['warning', 'Conflict'],
      error: ['error', model.fileSaveError ? 'Save failed' : 'File error'],
    }[status];
    const description = handle ? `${handle.name}: ${label || (status === 'reconnect' ? 'Reconnect' : 'Connected')}`
      : 'Local session, saved in this browser';
    const connected = String(Boolean(handle) && elements.reconnectFileButton.hidden);
    if (elements.fileStatus.dataset.state === status && elements.fileStatus.getAttribute('aria-label') === description
      && elements.fileStatus.dataset.connected === connected) return;
    elements.fileStatus.dataset.state = status;
    elements.fileStatus.dataset.connected = connected;
    elements.fileStatus.querySelector('use').setAttribute('href', `assets/material-symbols/sprite.svg#${icon}`);
    elements.fileStatus.querySelector('.file-name').textContent = handle ? handle.name.replace(/\.json$/i, '') : 'Local session';
    elements.fileStatus.querySelector('.file-detail').textContent = label;
    elements.fileStatus.setAttribute('aria-label', description);
  }
  function clearFileSaveError() {
    if (!model.fileSaveError) return;
    model.fileSaveError = '';
    if (!model.savedProjectIssue && !model.fileConflict) elements.notice.hidden = true;
  }
  function queueFileSave() {
    clearTimeout(model.fileSaveTimer);
    updateFileStatus();
    if (!model.projectFileHandle || model.fileLocked || model.fileSaving || model.fileSaveError || model.savedProjectIssue
      || elements.saveProjectDialog.open || !elements.reconnectFileButton.hidden || model.gesture || model.opacityBefore !== null || model.styleBefore !== null || model.placement || model.textEditor || actions.snapshot() === model.fileBaseline) return;
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
      elements.fileChangeActions.hidden = true;
    }
    const connected = Boolean(handle) && !needsPermission;
    elements.reconnectFileButton.hidden = !needsPermission;
    elements.workLocallyButton.hidden = !needsPermission;
    updateFileStatus();
    if (!needsPermission && elements.notice.dataset.kind === 'file-connection') {
      if (model.savedProjectIssue) actions.showNotice(model.savedProjectIssue);
      else elements.notice.hidden = true;
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
      else elements.notice.hidden = true;
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
    elements.notice.classList.add('file-update');
    elements.reloadFileButton.hidden = !model.fileConflict;
    elements.saveOursButton.hidden = model.filePendingStamp === null;
  }
  function clearFileUpdate() {
    elements.fileChangeActions.hidden = true;
    if (!elements.notice.classList.contains('file-update')) return;
    if (model.savedProjectIssue) actions.showNotice(model.savedProjectIssue);
    else elements.notice.hidden = true;
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
    if (!handle || model.fileWriting || elements.saveProjectDialog.open) return false;
    let loading = false;
    try {
      if (!elements.reconnectFileButton.hidden && await handle.queryPermission({ mode: 'read' }) !== 'granted') return false;
      if (revision !== model.fileConnectionRevision) return false;
      const file = await handle.getFile();
      if (revision !== model.fileConnectionRevision) return false;
      if (elements.saveProjectDialog.open) return false;
      if (!replace && model.fileStamp === file.lastModified) return false;
      pauseFileEditing();
      loading = true;
      actions.render();
      const loaded = JSON.parse(await file.text());
      if (revision !== model.fileConnectionRevision) return false;
      if (elements.saveProjectDialog.open) return false;
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
      elements.saveDialogError.hidden = true;
      elements.saveOnceButton.disabled = false;
      elements.saveConnectedButton.disabled = !window.showSaveFilePicker;
      elements.closeSaveButton.disabled = false;
      document.querySelector('#save-project-unavailable').hidden = Boolean(window.showSaveFilePicker);
      elements.saveProjectDialog.showModal();
      elements.saveOnceButton.focus();
      return;
    }
    const choosing = connect !== null;
    if (choosing && !elements.saveProjectDialog.open) return;
    if (automatic && (elements.saveProjectDialog.open || !model.projectFileHandle || model.fileSaveError || model.savedProjectIssue
      || !elements.reconnectFileButton.hidden || model.gesture || model.styleBefore !== null || model.placement || model.textEditor || actions.snapshot() === model.fileBaseline)) return;
    clearTimeout(model.fileSaveTimer);
    if (!automatic && !choosing) clearFileSaveError();
    model.fileSaving = true;
    if (choosing) {
      elements.saveDialogError.hidden = true;
      elements.saveOnceButton.disabled = elements.saveConnectedButton.disabled = elements.closeSaveButton.disabled = true;
    }
    updateFileStatus();
    const revision = model.fileConnectionRevision;
    try {
      if (!window.showSaveFilePicker) {
        if (connect === true) return;
        downloadProject();
        if (choosing) {
          await setProjectFileHandle(null);
          elements.saveProjectDialog.close();
        }
        return;
      }
      const handle = !asNew && model.projectFileHandle ? model.projectFileHandle : await window.showSaveFilePicker({
        suggestedName: MockoutProject.suggestedFileName(),
        types: [{ description: 'Mockout project', accept: { 'application/json': ['.json'] } }],
      });
      if (revision !== model.fileConnectionRevision) return;
      if (choosing && !elements.saveProjectDialog.open) return;
      if (handle === model.projectFileHandle && !asNew) {
        if (!elements.reconnectFileButton.hidden) { actions.showNotice('Reconnect the file before saving.', 'file-connection'); return; }
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
        if (choosing) elements.saveProjectDialog.close();
      }
    } catch (error) {
      if (revision !== model.fileConnectionRevision) return;
      if (choosing) {
        if (error.name !== 'AbortError') {
          elements.saveDialogError.textContent = `Could not save project: ${error.message}`;
          elements.saveDialogError.hidden = false;
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
      if (choosing && elements.saveProjectDialog.open) {
        elements.saveOnceButton.disabled = elements.closeSaveButton.disabled = false;
        elements.saveConnectedButton.disabled = !window.showSaveFilePicker;
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
      document.querySelector('#open-project-name').textContent = file.name;
      document.querySelector('#open-project-unavailable').hidden = Boolean(handle);
      elements.openLocalCopyButton.disabled = false;
      elements.openConnectedFileButton.disabled = !handle;
      actions.closeProjectMenu();
      elements.openProjectDialog.showModal();
      elements.openLocalCopyButton.focus();
    } catch (error) {
      actions.showNotice(`Could not open project: ${error.message}`);
    } finally {
      model.fileOpenBusy = false;
    }
  }
  async function finishOpeningProject(connect) {
    const pending = model.pendingProject;
    if (!pending || model.fileOpenBusy) return;
    model.fileOpenBusy = true;
    elements.openLocalCopyButton.disabled = true;
    elements.openConnectedFileButton.disabled = true;
    try {
      let connected = false;
      if (connect && pending.handle) {
        // This explicit choice supplies the user activation for Chrome's permission prompt.
        try { connected = await pending.handle.requestPermission({ mode: 'readwrite' }) === 'granted'; }
        catch (error) {
          if (error.name !== 'SecurityError' && error.name !== 'NotAllowedError') throw error;
        }
      }
      if (model.pendingProject !== pending || !elements.openProjectDialog.open) return;
      actions.change(() => { model.project = pending.loaded; actions.selectOnly(null); model.inspectorOpen = false; actions.focusProject(model.project.boxes); });
      if (model.savedProjectIssue) actions.showNotice(model.savedProjectIssue);
      else elements.notice.hidden = true;
      await setProjectFileHandle(connected ? pending.handle : null, { file: pending.file });
      model.undoStack.length = 0;
      model.redoStack.length = 0;
      actions.render();
    } catch (error) {
      actions.showNotice(`Could not open project: ${error.message}`);
    } finally {
      model.pendingProject = null;
      model.fileOpenBusy = false;
      elements.openProjectDialog.close();
    }
  }

  return {
    actions: {
      updateFileStatus, clearFileSaveError, queueFileSave, setProjectFileHandle, rememberFileConnection,
      storedFileConnection, checkFileConnection, restoreFileConnection, showFileUpdate, clearFileUpdate,
      pauseFileEditing, checkExternalFile, loadExternalFile, downloadProject, saveProject,
      chooseProjectFile, openProjectFile, finishOpeningProject,
    },
    init() {
      events.on(elements.reconnectFileButton, 'click', () => {
        if (model.projectFileHandle) checkFileConnection(model.projectFileHandle, model.fileConnectionRevision, true);
      });
      events.on(elements.workLocallyButton, 'click', () => {
        setProjectFileHandle(null);
        elements.workspace.focus();
      });
      events.on(elements.reloadFileButton, 'click', () => checkExternalFile(true));
      events.on(elements.saveOursButton, 'click', () => {
        if (model.fileConflict && model.filePendingStamp !== null) saveProject(false, model.filePendingStamp);
      });
      events.on(window, 'focus', () => checkExternalFile());
      events.on(document, 'visibilitychange', () => { if (!document.hidden) checkExternalFile(); });
      events.interval(async () => {
        if (!model.projectFileHandle || model.filePolling) return;
        model.filePolling = true;
        try { await checkExternalFile(); }
        finally { model.filePolling = false; }
      }, 1000);
      events.on(elements.saveOnceButton, 'click', () => saveProject(true, null, false, false));
      events.on(elements.saveConnectedButton, 'click', () => saveProject(true, null, false, true));
      events.on(elements.closeSaveButton, 'click', () => elements.saveProjectDialog.close());
      events.on(elements.saveProjectDialog, 'cancel', event => { if (model.fileSaving) event.preventDefault(); });
      events.on(elements.saveProjectDialog, 'close', () => {
        elements.workspace.focus();
        checkExternalFile();
        queueFileSave();
      });
      events.on(elements.openLocalCopyButton, 'click', () => finishOpeningProject(false));
      events.on(elements.openConnectedFileButton, 'click', () => finishOpeningProject(true));
      events.on(document.querySelector('#close-open-project'), 'click', () => elements.openProjectDialog.close());
      events.on(elements.openProjectDialog, 'close', () => {
        model.pendingProject = null;
        elements.workspace.focus();
      });
      events.on(document.querySelector('#open-file'), 'change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        await openProjectFile(file);
        event.target.value = '';
      });
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
