const STORAGE_KEY = MockoutProject.storageKey;
const workspace = document.querySelector('#workspace');
const canvas = document.querySelector('#canvas');
const inspector = document.querySelector('#inspector');
const notice = document.querySelector('#notice');
const noticeMessage = document.querySelector('#notice-message');
const recoveryActions = document.querySelector('#recovery-actions');
const fileStatus = document.querySelector('#file-status');
const reconnectFileButton = document.querySelector('#reconnect-file');
const fileChangeActions = document.querySelector('#file-change-actions');
const reloadFileButton = document.querySelector('#reload-file');
const saveOursButton = document.querySelector('#save-ours');
const projectMenu = document.querySelector('#project-menu');
const projectMenuButton = document.querySelector('#project-menu-button');
const projectMenuHolder = document.querySelector('#project-menu-holder');
const themeButton = document.querySelector('#theme-button');
const themeMedia = matchMedia('(prefers-color-scheme: dark)');
const helpPanel = document.querySelector('#help-panel');
const helpButton = document.querySelector('#help-button');
const welcomeButton = document.querySelector('#welcome-button');
const welcomeHint = document.querySelector('#welcome-hint');
const toolButtons = [...document.querySelectorAll('[data-tool]')];
const gridButtons = [...document.querySelectorAll('[data-grid]')];
const boxColorButtons = [...document.querySelectorAll('[data-color-property]')];
const canvasColorButtons = [...document.querySelectorAll('[data-canvas-color-property]')];
const alignButtons = [...document.querySelectorAll('[data-align-axis]')];
const inspectorPath = document.querySelector('#inspector-path');
const swatchChoiceTemplate = document.querySelector('#swatch-choice-template');
const propertySections = [
  { id: 'shape', label: 'Shape', element: document.querySelector('#shape-properties') },
  { id: 'colors', label: 'Colors', element: document.querySelector('#color-properties') },
  { id: 'text', label: 'Text', element: document.querySelector('#text-properties') },
  { id: 'font', label: 'Font', element: document.querySelector('#font-properties') },
];
const toolbarIconsFont = document.querySelector('#toolbar-icons-font');
const channels = [1, 2, 3].map(n => document.querySelector(`#channel-${n}`));
const channelValues = [1, 2, 3].map(n => document.querySelector(`#channel-${n}-value`));
const { initialStyle } = MockoutProject;
const fonts = MockoutFonts;
const freshState = () => MockoutProject.freshState();
const validProject = value => MockoutProject.validProject(value);

async function showToolbarIcons() {
  try {
    const faces = await document.fonts.load('20px "Material Symbols Outlined"',
      'arrow_selector_tool check_circle crop_square error help link_off more_horiz warning_amber web_asset');
    if (faces.some(face => face.status === 'loaded')) document.body.classList.add('toolbar-icons-ready');
  } catch { /* Keep the text labels if Google Fonts is unavailable. */ }
}
toolbarIconsFont.addEventListener('load', showToolbarIcons);
if (toolbarIconsFont.sheet) showToolbarIcons();

let state = freshState();
let savedProjectIssue = '';
let firstLoad = false;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  firstLoad = raw === null;
  if (raw) {
    const saved = JSON.parse(raw);
    if (validProject(saved)) state = saved;
    else savedProjectIssue = 'Saved project is unsupported. Local data was left untouched; autosave is paused.';
  }
} catch {
  savedProjectIssue = 'Could not read the saved project. Local data was left untouched; autosave is paused.';
}

function showNotice(message) {
  notice.classList.remove('file-update');
  noticeMessage.textContent = message;
  recoveryActions.hidden = !savedProjectIssue;
  fileChangeActions.hidden = !fileConflict;
  notice.hidden = false;
}

const toolbarMenus = [
  { menu: projectMenu, button: projectMenuButton, holder: projectMenuHolder },
];
function closeToolbarMenu(item, focusCanvas = false) {
  item.menu.hidden = true;
  item.button.setAttribute('aria-expanded', 'false');
  if (focusCanvas) workspace.focus();
}
function closeProjectMenu() { closeToolbarMenu(toolbarMenus[0]); }
function toggleToolbarMenu(item) {
  const opening = item.menu.hidden;
  for (const other of toolbarMenus) closeToolbarMenu(other);
  if (!opening) { workspace.focus(); return; }
  item.menu.hidden = false;
  item.button.setAttribute('aria-expanded', 'true');
  (item.menu.querySelector('[aria-pressed="true"]') || item.menu.querySelector('button:not(:disabled)'))?.focus();
}
function syncThemeButton() {
  themeButton.setAttribute('aria-label', `Switch to ${document.documentElement.dataset.uiTheme === 'dark' ? 'light' : 'dark'} theme`);
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.uiTheme = theme;
  syncThemeButton();
  try { localStorage.setItem('mockout-ui-theme', theme); }
  catch { /* The selected theme still applies for this session. */ }
  render();
}
function toggleTheme() {
  setTheme(document.documentElement.dataset.uiTheme === 'dark' ? 'light' : 'dark');
}
themeMedia.addEventListener('change', event => {
  if (!document.documentElement.dataset.theme) {
    document.documentElement.dataset.uiTheme = event.matches ? 'dark' : 'light';
    syncThemeButton();
    render();
  }
});
syncThemeButton();
themeButton.addEventListener('click', toggleTheme);
projectMenuButton.addEventListener('click', () => toggleToolbarMenu(toolbarMenus[0]));
projectMenu.addEventListener('click', event => {
  if (!event.target.closest('.hold-action')) closeToolbarMenu(toolbarMenus[0], true);
});
document.addEventListener('pointerdown', event => {
  const toolbarButton = event.target.closest('.corner button');
  if (toolbarButton && !toolbarButton.closest('.toolbar-menu')) event.preventDefault();
  for (const item of toolbarMenus) {
    if (!item.holder.contains(event.target)) closeToolbarMenu(item);
  }
});

let selectedId = null;
let selectedIds = new Set();
let gesture = null;
let lastBoxClick = null;
let pointerPosition = null;
let placement = null;
let copiedBoxes = null;
let isolatedCopyIds = null;
let textEditor = null;
let projectFileHandle = null;
let fileConnectionRevision = 0;
let fileConnectionSave = Promise.resolve();
let fileObserver = null;
let fileStamp = null;
let fileBaseline = null;
let fileLocked = false;
let fileConflict = false;
let filePendingStamp = null;
let fileWriting = false;
let fileSaving = false;
let fileSaveTimer = null;
let fileSaveError = '';
let fileChecks = Promise.resolve();

function updateFileStatus() {
  const handle = projectFileHandle;
  const status = !handle ? 'local' : fileConflict ? filePendingStamp === null ? 'error' : 'conflict'
    : !reconnectFileButton.hidden ? 'reconnect'
    : fileSaveError ? 'error' : 'connected';
  const [icon, fallback, label] = {
    local: ['web_asset', '▣', ''],
    connected: ['check_circle', '✓', ''],
    reconnect: ['link_off', '↛', ''],
    conflict: ['warning_amber', '△', 'Conflict'],
    error: ['error', '!', fileSaveError ? 'Save failed' : 'File error'],
  }[status];
  const description = handle ? `${handle.name}: ${label || (status === 'reconnect' ? 'Reconnect' : 'Connected')}`
    : 'Local session, saved in this browser';
  const connected = String(Boolean(handle) && reconnectFileButton.hidden);
  if (fileStatus.dataset.state === status && fileStatus.getAttribute('aria-label') === description
    && fileStatus.dataset.connected === connected) return;
  fileStatus.dataset.state = status;
  fileStatus.dataset.connected = connected;
  fileStatus.querySelector('.toolbar-glyph').textContent = icon;
  fileStatus.querySelector('.toolbar-text').textContent = fallback;
  fileStatus.querySelector('.file-name').textContent = handle ? handle.name.replace(/\.json$/i, '') : 'Local session';
  fileStatus.querySelector('.file-detail').textContent = label;
  fileStatus.setAttribute('aria-label', description);
}

function clearFileSaveError() {
  if (!fileSaveError) return;
  fileSaveError = '';
  if (!savedProjectIssue && !fileConflict) notice.hidden = true;
}

function queueFileSave() {
  clearTimeout(fileSaveTimer);
  updateFileStatus();
  if (!projectFileHandle || fileLocked || fileSaving || fileSaveError || savedProjectIssue
    || !reconnectFileButton.hidden || gesture || placement || textEditor || snapshot() === fileBaseline) return;
  fileSaveTimer = setTimeout(() => saveProject(false, null, true), 0);
}

function setProjectFileHandle(handle, { remember = true, needsPermission = false, canRead = false, file = null, baseline = null } = {}) {
  const wasLocked = fileLocked;
  fileConnectionRevision++;
  projectFileHandle = handle;
  fileObserver?.disconnect();
  fileObserver = null;
  if (remember) {
    clearTimeout(fileSaveTimer);
    clearFileSaveError();
    fileStamp = file?.lastModified ?? null;
    fileBaseline = handle && file ? baseline ?? snapshot() : null;
    fileLocked = false;
    fileConflict = false;
    filePendingStamp = null;
    fileChangeActions.hidden = true;
  }
  const connected = Boolean(handle) && !needsPermission;
  reconnectFileButton.hidden = !needsPermission;
  updateFileStatus();
  if (handle && (connected || canRead) && typeof FileSystemObserver === 'function') {
    const observer = new FileSystemObserver(() => checkExternalFile());
    fileObserver = observer;
    observer.observe(handle).then(() => {
      if (fileObserver === observer) checkExternalFile();
    }).catch(() => { observer.disconnect(); if (fileObserver === observer) fileObserver = null; });
  }
  if (wasLocked && !fileLocked) {
    if (savedProjectIssue) showNotice(savedProjectIssue);
    else notice.hidden = true;
    render();
  }
  if (remember) return rememberFileConnection();
}

function rememberFileConnection() {
  const handle = projectFileHandle;
  const sync = { stamp: fileStamp, baseline: fileBaseline };
  fileConnectionSave = fileConnectionSave.then(() => storedFileConnection(true, handle, sync))
    .catch(error => showNotice(`Could not remember the file connection: ${error.message}`));
  return fileConnectionSave;
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
    if (revision !== fileConnectionRevision) return;
    setProjectFileHandle(handle, { remember: false, needsPermission: permission !== 'granted', canRead });
    if (canRead) {
      if (requestPermission) clearFileSaveError();
      await checkExternalFile();
      queueFileSave();
    }
  } catch (error) {
    if (revision !== fileConnectionRevision) return;
    if (error.name === 'NotFoundError') setProjectFileHandle(null);
    else {
      setProjectFileHandle(handle, { remember: false, needsPermission: true });
      showNotice(`Could not reconnect the file: ${error.message}`);
    }
  }
}

async function restoreFileConnection() {
  const revision = fileConnectionRevision;
  try {
    const { handle, sync } = await storedFileConnection();
    if (revision !== fileConnectionRevision || !handle) return;
    if (firstLoad) { setProjectFileHandle(null); return; }
    fileStamp = sync?.stamp ?? null;
    fileBaseline = sync?.baseline ?? null;
    await checkFileConnection(handle, revision);
  } catch (error) {
    if (revision === fileConnectionRevision) showNotice(`Could not restore the file connection: ${error.message}`);
  }
}
reconnectFileButton.addEventListener('click', () => {
  if (projectFileHandle) checkFileConnection(projectFileHandle, fileConnectionRevision, true);
});

function showFileUpdate(message) {
  showNotice(message);
  notice.classList.add('file-update');
  reloadFileButton.hidden = !fileConflict;
  saveOursButton.hidden = filePendingStamp === null;
}

function clearFileUpdate() {
  fileChangeActions.hidden = true;
  if (!notice.classList.contains('file-update')) return;
  if (savedProjectIssue) showNotice(savedProjectIssue);
  else notice.hidden = true;
}

function pauseFileEditing() {
  if (placement) finishPlacement(false);
  if (textEditor) textEditor.blur();
  const before = gesture?.before;
  gesture = null;
  lastBoxClick = null;
  if (before) commit(before);
  inspectorOpen = false;
  fileLocked = true;
}

function checkExternalFile(replace = false) {
  fileChecks = fileChecks.then(() => loadExternalFile(replace)).catch(error => {
    showNotice(`Could not check the connected file: ${error.message}`);
    return true;
  });
  return fileChecks;
}

async function loadExternalFile(replace) {
  const handle = projectFileHandle;
  const revision = fileConnectionRevision;
  if (!handle || fileWriting) return false;
  let loading = false;
  try {
    if (!reconnectFileButton.hidden && await handle.queryPermission({ mode: 'read' }) !== 'granted') return false;
    if (revision !== fileConnectionRevision) return false;
    const file = await handle.getFile();
    if (revision !== fileConnectionRevision) return false;
    if (!replace && fileStamp === file.lastModified) return false;
    pauseFileEditing();
    loading = true;
    render();
    const loaded = JSON.parse(await file.text());
    if (revision !== fileConnectionRevision) return false;
    if (!validProject(loaded)) throw Error('The file is not a supported Mockout project.');
    // Older connections have no timestamp yet. Recognise an unchanged exported board.
    if (!replace && fileStamp === null && JSON.stringify(MockoutProject.forExport(loaded)) === JSON.stringify(MockoutProject.forExport(state))) {
      fileStamp = file.lastModified;
      fileBaseline = snapshot();
      fileConflict = false;
      filePendingStamp = null;
      await rememberFileConnection();
      if (revision === fileConnectionRevision) clearFileUpdate();
      return false;
    }
    filePendingStamp = file.lastModified;
    fileConflict = !replace && (fileBaseline === null || snapshot() !== fileBaseline);
    if (fileConflict) {
      showFileUpdate('The file and your canvas both changed. Reload file to use its version, or Save ours to replace it with your canvas.');
      return true;
    }
    const before = snapshot();
    state = loaded;
    selectedIds = new Set([...selectedIds].filter(id => state.boxes.some(box => box.id === id)));
    selectedId = selectedIds.values().next().value ?? null;
    isolatedCopyIds = null;
    commit(before);
    fileStamp = file.lastModified;
    fileBaseline = snapshot();
    filePendingStamp = null;
    await rememberFileConnection();
    if (revision !== fileConnectionRevision) return false;
    clearFileUpdate();
    return true;
  } catch (error) {
    if (revision !== fileConnectionRevision) return false;
    if (error.name === 'NotFoundError') setProjectFileHandle(null);
    else if (error.name === 'NotAllowedError') {
      fileLocked = fileConflict;
      setProjectFileHandle(handle, { remember: false, needsPermission: true });
      render();
    }
    else {
      pauseFileEditing();
      loading = true;
      fileConflict = true;
      filePendingStamp = null;
      showFileUpdate(`Could not load the external change: ${error.message} Current canvas kept.`);
    }
    return true;
  } finally {
    if (loading && revision === fileConnectionRevision) {
      fileLocked = fileConflict;
      render();
    }
  }
}

reloadFileButton.addEventListener('click', () => checkExternalFile(true));
saveOursButton.addEventListener('click', () => {
  if (fileConflict && filePendingStamp !== null) saveProject(false, filePendingStamp);
});
window.addEventListener('focus', () => checkExternalFile());
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExternalFile(); });
let inspectorOpen = false;
let inspectorKind = 'box';
let inspectorPoint = { x: 12, y: 12 };
let inspectorView = 'properties';
let activePropertySection = 'shape';
const lastPropertyFocus = new Map();
let tool = 'select';
let spaceDown = false;
let altDown = false;
const view = { x: 0, y: 0, zoom: 1 };
function focusProject(boxes) {
  view.zoom = 1;
  view.x = 0;
  view.y = 0;
  if (!boxes.length) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  const top = document.querySelector('.corner').getBoundingClientRect().bottom
    - workspace.getBoundingClientRect().top + 20;
  const availableHeight = Math.max(1, workspace.clientHeight - top - 24);
  view.zoom = Math.max(0.2, Math.min(1,
    (workspace.clientWidth - 48) / (maxX - minX), availableHeight / (maxY - minY)));
  view.x = (workspace.clientWidth - (maxX - minX) * view.zoom) / 2 - minX * view.zoom;
  view.y = top + (availableHeight - (maxY - minY) * view.zoom) / 2 - minY * view.zoom;
}
let colorTarget = null;
let colorMode = 'hsb';
let editorColor = '#6746b7';
let editorSide = 'light';
let editorLight = { color: editorColor, mode: colorMode };
let editorDark = { mode: 'invert', color: null, colorMode: colorMode };
let pickerOnAccept = null;
const undoStack = [];
const redoStack = [];

const snapshot = () => JSON.stringify(state);
const selectedBox = () => state.boxes.find(b => b.id === selectedId);
const selectedBoxes = () => state.boxes.filter(b => selectedIds.has(b.id));
const propertySectionIndex = () => propertySections.findIndex(section => section.id === activePropertySection);
const paddingX = box => box.paddingX ?? 3;
const paddingY = box => box.paddingY ?? 3;
const styleOf = box => ({
  fill: box.fill, textColor: box.textColor, borderColor: box.borderColor,
  borderWidth: box.borderWidth, radius: box.radius,
  paddingX: paddingX(box), paddingY: paddingY(box), alignX: box.alignX, alignY: box.alignY,
  fontFamily: fonts.familyOf(box), fontSize: fonts.sizeOf(box),
  fontWeight: fonts.weightOf(box), fontStyle: fonts.styleOf(box),
});
function rememberStyle(box) { state.lastStyle = styleOf(box); }
function selectOnly(id) {
  const next = MockoutSelection.selectOnly({ selectedId, selectedIds, isolatedCopyIds, inspectorOpen }, id);
  selectedId = next.selectedId;
  selectedIds = next.selectedIds;
  isolatedCopyIds = next.isolatedCopyIds;
  inspectorOpen = next.inspectorOpen;
}
const inspectedBox = () => MockoutSelection.inspectedBox(state.boxes,
  { selectedId, selectedIds, inspectorOpen, inspectorKind });
const swatch = id => state.swatches.find(s => s.id === id);
const activeTheme = () => document.documentElement.dataset.uiTheme || 'light';
const resolvedColor = (color, dark) => MockoutProject.resolveColor(color, dark, activeTheme());
const draftColor = () => {
  const light = inspectorView === 'picker' && editorSide === 'light' ? editorColor : editorLight.color;
  const dark = inspectorView === 'picker' && editorSide === 'dark'
    ? { ...editorDark, color: editorColor }
    : editorDark;
  return resolvedColor(light, dark);
};
const colorOf = id => inspectorOpen && ['edit', 'picker'].includes(inspectorView)
  && colorTarget?.editId && colorTarget.editId === id
  ? draftColor() : id ? resolvedColor(swatch(id).color, swatch(id).dark) : 'transparent';
function canvasColor(property) {
  if (inspectorOpen && ['edit', 'picker'].includes(inspectorView) && colorTarget?.direct
    && colorTarget.property === property) return draftColor();
  return resolvedColor(state.canvasColors[property], state.canvasDark?.[property]);
}
function boxColor(box, property) {
  if (inspectorOpen && ['edit', 'picker'].includes(inspectorView) && colorTarget) {
    if (colorTarget.editId && box[property] === colorTarget.editId) return draftColor();
    if (inspectorKind === 'box' && !colorTarget.editId && selectedIds.has(box.id)
      && property === colorTarget.property) return draftColor();
  }
  return colorOf(box[property]);
}
const snap = n => MockoutPlacement.snap(n, state.grid);
const minimum = () => 1;

function persist() {
  try { MockoutProject.persist(localStorage, STORAGE_KEY, state, savedProjectIssue); }
  catch { /* File save remains available. */ }
  queueFileSave();
}

function commit(before) {
  if (before === snapshot()) return;
  undoStack.push(before);
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
  persist();
  render();
}

function change(fn) {
  const before = snapshot();
  fn();
  commit(before);
}

function addResizeHandles(element) {
  for (const direction of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.dataset.handle = direction;
    element.append(handle);
  }
}

function render() {
  updateFileStatus();
  welcomeButton.disabled = Boolean(state.boxes.length || savedProjectIssue || fileLocked);
  inspector.inert = fileLocked;
  welcomeHint.hidden = !welcomeButton.disabled;
  welcomeHint.textContent = savedProjectIssue ? 'Resolve the saved project issue first.'
    : 'Start a new blank project first to show Welcome.';
  syncFontStylesheets();
  workspace.style.backgroundColor = canvasColor('background');
  workspace.style.setProperty('--grid-major-color', canvasColor('gridMajor'));
  workspace.style.setProperty('--grid-minor-color', canvasColor('gridMinor'));
  workspace.style.setProperty('--grid-size', `${(state.grid || 10) * view.zoom}px`);
  workspace.style.setProperty('--major-grid-size', `${(state.grid || 10) * view.zoom * 10}px`);
  workspace.style.setProperty('--pan-x', `${view.x}px`);
  workspace.style.setProperty('--pan-y', `${view.y}px`);
  workspace.classList.toggle('grid-off', state.grid === 0);
  workspace.classList.toggle('tool-box', tool === 'box');
  workspace.classList.toggle('panning', spaceDown || gesture?.kind === 'pan');
  workspace.classList.toggle('alt-move', altDown);
  workspace.classList.toggle('file-locked', fileLocked);
  canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
  canvas.style.setProperty('--screen-pixel', `${1 / view.zoom}px`);
  canvas.style.setProperty('--handle-size', `${9 / view.zoom}px`);
  for (const button of toolButtons) {
    const active = button.dataset.tool === tool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const button of gridButtons) {
    const active = Number(button.dataset.grid) === state.grid;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const button of document.querySelectorAll('.corner button:not(#help-button)')) button.disabled = Boolean(placement);
  if (fileLocked) {
    for (const button of [...toolButtons, ...gridButtons, document.querySelector('#save-button')]) button.disabled = true;
  }
  document.querySelector('#placement-hint').hidden = !placement;

  canvas.replaceChildren();
  for (const box of state.boxes) {
    const thinLine = box.w === 1 || box.h === 1;
    const borderWidth = thinLine ? box.borderWidth : Math.min(box.borderWidth, box.w / 2, box.h / 2);
    const insetX = Math.min(paddingX(box), Math.max(0, (box.w - borderWidth * 2) / 2));
    const insetY = Math.min(paddingY(box), Math.max(0, (box.h - borderWidth * 2) / 2));
    const element = document.createElement('div');
    element.className = 'box';
    if (selectedIds.has(box.id)) element.classList.add('selected');
    if (gesture?.kind === 'draw' && gesture.id === box.id) element.classList.add('drawing');
    if (placement?.ids.has(box.id)) element.classList.add('placing');
    element.dataset.id = box.id;
    Object.assign(element.style, {
      left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`,
      backgroundColor: boxColor(box, 'fill'), color: boxColor(box, 'textColor'),
      borderColor: boxColor(box, 'borderColor'),
      borderWidth: box.h === 1 ? `${borderWidth}px 0 0 0` : box.w === 1 ? `0 0 0 ${borderWidth}px` : `${borderWidth}px`,
      borderRadius: `${box.radius}px`, padding: `${insetY}px ${insetX}px`,
      justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[box.alignX],
      alignItems: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[box.alignY],
    });
    element.style.setProperty('--box-border-width', `${borderWidth}px`);
    const label = document.createElement('span');
    label.className = 'box-label';
    label.textContent = box.text;
    label.style.textAlign = box.alignX;
    const family = fonts.familyOf(box);
    label.style.fontFamily = family ? `"${family}", system-ui, sans-serif` : 'system-ui, sans-serif';
    label.style.fontSize = `${fonts.sizeOf(box)}px`;
    label.style.fontWeight = fonts.weightOf(box);
    label.style.fontStyle = fonts.styleOf(box);
    if (fonts.isMaterial(family)) {
      label.style.fontFeatureSettings = '"liga"';
      label.style.whiteSpace = 'nowrap';
    }
    element.append(label);

    if (selectedIds.size === 1 && selectedIds.has(box.id) && tool === 'select' && !textEditor && !placement && !fileLocked) {
      addResizeHandles(element);
    }
    canvas.append(element);
  }
  if (selectedIds.size > 1 && tool === 'select' && !textEditor && !placement && !fileLocked) {
    const boxes = selectedBoxes();
    const left = Math.min(...boxes.map(box => box.x));
    const top = Math.min(...boxes.map(box => box.y));
    const right = Math.max(...boxes.map(box => box.x + box.w));
    const bottom = Math.max(...boxes.map(box => box.y + box.h));
    const bounds = document.createElement('div');
    bounds.className = 'selection-bounds';
    Object.assign(bounds.style, { left: `${left}px`, top: `${top}px`,
      width: `${right - left}px`, height: `${bottom - top}px` });
    addResizeHandles(bounds);
    canvas.append(bounds);
  }
  if (gesture?.kind === 'marquee' && gesture.end) {
    const marquee = document.createElement('div');
    marquee.className = 'marquee';
    const left = Math.min(gesture.start.x, gesture.end.x);
    const top = Math.min(gesture.start.y, gesture.end.y);
    Object.assign(marquee.style, {
      left: `${left}px`, top: `${top}px`,
      width: `${Math.abs(gesture.end.x - gesture.start.x)}px`,
      height: `${Math.abs(gesture.end.y - gesture.start.y)}px`,
    });
    canvas.append(marquee);
  }
  renderInspector();
}

function syncFontStylesheets() {
  const urls = fonts.stylesheets(state.boxes);
  const links = [...document.querySelectorAll('link[data-mockout-font]')];
  for (const link of links) {
    if (!urls.includes(link.href)) link.remove();
  }
  for (const url of urls) {
    if (links.some(link => link.isConnected && link.href === url)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.mockoutFont = '';
    document.head.append(link);
  }
}

function renderInspector() {
  const box = inspectedBox();
  const boxes = selectedBoxes();
  const visible = inspectorOpen && (inspectorKind === 'canvas' || box);
  inspector.hidden = !visible;
  if (!visible) return;
  document.querySelector('#box-properties').hidden = inspectorView !== 'properties' || inspectorKind !== 'box';
  document.querySelector('#canvas-properties').hidden = inspectorView !== 'properties' || inspectorKind !== 'canvas';
  document.querySelector('#swatch-chooser').hidden = inspectorView !== 'choose';
  document.querySelector('#swatch-manager').hidden = inspectorView !== 'manage';
  document.querySelector('#color-editor').hidden = inspectorView !== 'edit';
  document.querySelector('#color-picker').hidden = inspectorView !== 'picker';
  const sectionIndex = propertySectionIndex();
  for (const section of propertySections) section.element.hidden = section.id !== activePropertySection;
  renderInspectorHeader();
  if (inspectorView === 'edit') {
    document.querySelector('#dark-behavior').value = editorDark.mode;
    document.querySelector('#swatch-name-field').hidden = !!colorTarget?.direct;
    document.querySelector('#save-color').textContent = colorTarget?.direct ? 'Save colors' : 'Save swatch';
    renderColorEditorPreview();
  }
  if (box) {
    for (const [field, getValue] of Object.entries({
      'box-text': item => item.text, 'box-width': item => item.w, 'box-height': item => item.h,
      'box-radius': item => item.radius, 'box-border-width': item => item.borderWidth,
      'box-padding-x': paddingX, 'box-padding-y': paddingY,
    })) {
      const input = document.getElementById(field);
      const value = MockoutSelection.commonValue(boxes, getValue);
      const mixed = value === undefined;
      if (document.activeElement !== input) input.value = mixed ? '' : value;
      input.parentElement.classList.toggle('mixed', mixed);
      if (mixed) input.setAttribute('aria-description', 'Mixed values');
      else input.removeAttribute('aria-description');
      if (field === 'box-text') {
        const family = MockoutSelection.commonValue(boxes, fonts.familyOf);
        input.placeholder = mixed ? 'Mixed values' : boxes.every(item => fonts.isMaterial(fonts.familyOf(item)))
          ? 'Icon name, e.g. arrow_forward' : 'Optional text';
      }
    }
    const family = MockoutSelection.commonValue(boxes, fonts.familyOf);
    const familyChoice = MockoutSelection.commonValue(boxes, item => fonts.categoryOf(fonts.familyOf(item))) ?? 'mixed';
    const familySelect = document.querySelector('#box-font-family');
    if (document.activeElement !== familySelect) familySelect.value = familyChoice;
    familySelect.parentElement.classList.toggle('mixed', familyChoice === 'mixed');
    for (const option of document.querySelectorAll('#box-font-weight option')) {
      option.disabled = fonts.isSymbol(family) && Number(option.value) > 700;
    }
    const classicOnly = boxes.every(item => fonts.isClassicIcon(fonts.familyOf(item)));
    document.querySelector('#box-font-weight').disabled = classicOnly;
    document.querySelector('#box-font-style').disabled = classicOnly;
    document.querySelector('#google-font-field').hidden = familyChoice !== 'google';
    const googleInput = document.querySelector('#box-google-font');
    if (document.activeElement !== googleInput) googleInput.value = familyChoice === 'google' && family !== undefined ? family : '';
    googleInput.placeholder = familyChoice === 'google' && family === undefined ? 'Mixed values' : 'e.g. Roboto';
    googleInput.parentElement.classList.toggle('mixed', familyChoice === 'google' && family === undefined);
    document.querySelector('#material-style-field').hidden = familyChoice !== 'material';
    const materialStyle = document.querySelector('#box-material-style');
    materialStyle.value = familyChoice === 'material' && family !== undefined ? family : 'mixed';
    materialStyle.parentElement.classList.toggle('mixed', familyChoice === 'material' && family === undefined);
    const browseIcons = document.querySelector('#browse-icons');
    browseIcons.hidden = familyChoice !== 'material';
    browseIcons.href = fonts.isClassicIcon(family)
      ? 'https://fonts.google.com/icons?icon.set=Material+Icons' : 'https://fonts.google.com/icons';
    for (const [id, getValue] of [
      ['box-font-size', fonts.sizeOf], ['box-font-weight', fonts.weightOf],
      ['box-font-style', fonts.styleOf],
    ]) {
      const input = document.getElementById(id);
      const value = MockoutSelection.commonValue(boxes, getValue);
      const mixed = value === undefined;
      if (document.activeElement !== input) input.value = mixed ? input.tagName === 'SELECT' ? 'mixed' : '' : value;
      input.parentElement.classList.toggle('mixed', mixed);
      if (mixed) input.setAttribute('aria-description', 'Mixed values');
      else input.removeAttribute('aria-description');
    }
    for (const button of alignButtons) {
      const value = MockoutSelection.commonValue(boxes, item => item[button.dataset.alignAxis]);
      const mixed = value === undefined;
      button.closest('.align-group').querySelector('span').classList.toggle('mixed', mixed);
      const active = value === button.dataset.alignValue;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
  if (inspectorKind === 'box') for (const button of boxColorButtons) renderBoxColorButton(button, boxes);
  if (inspectorKind === 'canvas') for (const button of canvasColorButtons) {
    const canvasProperty = button.dataset.canvasColorProperty;
    const displayed = canvasColor(canvasProperty);
    button.setAttribute('aria-label', `${colorLabel(canvasProperty)}: ${displayed.toUpperCase()}`);
    button.replaceChildren(colorChip(displayed), document.createTextNode(colorLabel(canvasProperty)));
  }
  if (inspectorView === 'choose' || inspectorView === 'manage') renderSwatchList();
  positionInspector();
}

const colorLabel = property => ({
  fill: 'Fill', textColor: 'Text', borderColor: 'Border',
  background: 'Background', gridMajor: 'Major grid', gridMinor: 'Minor grid',
})[property];

function renderColorEditorPreview() {
  const light = document.querySelector('#swatch-light');
  light.replaceChildren(colorChip(editorLight.color), document.createTextNode(editorLight.color.toUpperCase()));
  light.setAttribute('aria-label', `Edit light color: ${editorLight.color.toUpperCase()}`);
  const darkColor = MockoutProject.resolveColor(editorLight.color, editorDark, 'dark');
  const custom = editorDark.mode === 'custom';
  const darkButton = document.querySelector('#swatch-dark');
  const darkPreview = document.querySelector('#swatch-dark-preview');
  darkButton.hidden = !custom;
  darkPreview.hidden = custom;
  const darkValue = custom ? darkButton : darkPreview;
  darkValue.replaceChildren(colorChip(darkColor), document.createTextNode(darkColor.toUpperCase()));
  if (custom) darkButton.setAttribute('aria-label', `Edit dark color: ${darkColor.toUpperCase()}`);
}

function renderBoxColorButton(button, boxes) {
  const value = MockoutSelection.commonValue(boxes, box => box[button.dataset.colorProperty]);
  const mixed = value === undefined;
  const item = swatch(value);
  const chip = colorChip(item ? resolvedColor(item.color, item.dark) : null);
  chip.classList.toggle('mixed', mixed);
  button.parentElement.firstElementChild.classList.toggle('mixed', mixed);
  if (mixed) button.setAttribute('aria-description', 'Mixed values');
  else button.removeAttribute('aria-description');
  button.setAttribute('aria-label', `${colorLabel(button.dataset.colorProperty)}: ${mixed ? 'Mixed' : item?.name || 'Transparent'}`);
  button.replaceChildren(chip, document.createTextNode(mixed ? 'Mixed' : item?.name || 'Transparent'));
}

function showInspectorParent(viewName) {
  const previousView = inspectorView;
  inspectorView = viewName;
  if (previousView === 'picker') pickerOnAccept = null;
  render();
  if (viewName === 'edit') document.querySelector(`[data-editor-side="${editorSide}"]`).focus();
  else if (viewName === 'manage') focusSwatchEditorOpener();
  else if (inspectorKind === 'box') {
    if (previousView === 'choose') focusColorField();
    else document.querySelector('#manage-swatches').focus();
  }
  else focusColorField();
}

function renderInspectorHeader() {
  const properties = inspectorView === 'properties';
  const sectionIndex = propertySectionIndex();
  document.querySelector('#delete-swatch').hidden = inspectorView !== 'edit' || !colorTarget?.editId
    || state.swatches.length <= 1 || state.boxes.some(item =>
      ['fill', 'textColor', 'borderColor'].some(property => item[property] === colorTarget.editId));
  const parts = properties
    ? [{ label: inspectorKind === 'canvas' ? 'Canvas' : propertySections[sectionIndex].label }]
    : inspectorKind === 'canvas'
      ? [{ label: 'Canvas', view: 'properties' },
        { label: colorLabel(colorTarget.property), ...(inspectorView === 'picker' ? { view: 'edit' } : {}) },
        ...(inspectorView === 'picker' ? [{ label: editorSide === 'light' ? 'Light' : 'Dark' }] : [])]
      : inspectorView === 'choose'
        ? [{ label: 'Colors', view: 'properties' }, { label: colorLabel(colorTarget.property) }]
        : inspectorView === 'manage'
          ? [{ label: 'Colors', view: 'properties' }, { label: 'Swatches' }]
          : inspectorView === 'edit'
            ? [{ label: 'Swatches', view: 'manage' },
              { label: colorTarget.editId ? swatch(colorTarget.editId)?.name || 'Swatch' : 'New' }]
            : [{ label: 'Swatches', view: 'manage' },
              { label: colorTarget.editId ? swatch(colorTarget.editId)?.name || 'Swatch' : 'New', view: 'edit' },
              { label: editorSide === 'light' ? 'Light' : 'Dark' }];
  const pathKey = `${inspectorKind}:${inspectorView}:${parts.map(part => part.label).join('/')}`;
  if (inspectorPath.dataset.key === pathKey) return;
  inspectorPath.dataset.key = pathKey;
  inspectorPath.replaceChildren();
  for (const [index, part] of parts.entries()) {
    if (index) {
      const separator = document.createElement('span');
      separator.className = 'dialog-separator';
      separator.textContent = '/';
      separator.setAttribute('aria-hidden', 'true');
      inspectorPath.append(separator);
    }
    const item = document.createElement(part.view ? 'button' : 'strong');
    item.className = 'dialog-crumb';
    item.textContent = part.label;
    if (part.view) {
      item.type = 'button';
      item.addEventListener('click', () => showInspectorParent(part.view));
    } else item.setAttribute('aria-current', 'page');
    inspectorPath.append(item);
  }
}

function renderSwatchList() {
  const choosing = inspectorView === 'choose';
  const list = document.querySelector(choosing ? '#choice-swatch-list' : '#swatch-list');
  const focused = list.contains(document.activeElement) ? document.activeElement : null;
  const focusedId = focused?.dataset.swatchId;
  const selected = choosing ? MockoutSelection.commonValue(selectedBoxes(), box => box[colorTarget.property]) : null;
  const items = choosing && colorTarget.property !== 'textColor'
    ? [{ id: null, name: 'Transparent' }, ...state.swatches] : state.swatches;
  list.replaceChildren();
  for (const item of items) {
    const choice = swatchChoiceTemplate.content.firstElementChild.cloneNode(true);
    choice.dataset.swatchId = item.id ?? '';
    const chip = choice.querySelector('.chip');
    if (item.id) chip.style.setProperty('--chip-color', resolvedColor(item.color, item.dark));
    else chip.classList.add('transparent');
    choice.querySelector('.swatch-name').textContent = item.name;
    if (choosing) {
      choice.setAttribute('role', 'option');
      choice.setAttribute('aria-selected', String(selected === item.id));
    }
    choice.addEventListener('click', () => choosing ? assignColor(item.id) : openSwatchEditor(item.id));
    list.append(choice);
  }
  const buttons = [...list.querySelectorAll('button')];
  const active = buttons.find(button => button.dataset.swatchId === focusedId)
    || (choosing && selected !== undefined && buttons.find(button => button.dataset.swatchId === (selected ?? '')))
    || buttons[0];
  if (active) active.tabIndex = 0;
  if (focused) active?.focus();
}

for (const list of document.querySelectorAll('.dialog-choice-list')) {
  list.addEventListener('focusin', event => {
    for (const button of list.querySelectorAll('button')) button.tabIndex = button === event.target ? 0 : -1;
  });
  list.addEventListener('keydown', event => {
    const direction = { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' }[event.key];
    if (!direction) return;
    event.preventDefault();
    const buttons = [...list.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    const next = direction === 'first' ? 0 : direction === 'last' ? buttons.length - 1
      : (index + direction + buttons.length) % buttons.length;
    buttons[next]?.focus();
    buttons[next]?.scrollIntoView({ block: 'nearest' });
  });
}

function positionInspector() {
  if (inspector.hidden) return;
  if (inspectorKind === 'canvas') {
    inspector.style.left = `${Math.max(12, Math.min(inspectorPoint.x, window.innerWidth - inspector.offsetWidth - 12))}px`;
    inspector.style.top = `${Math.max(12, Math.min(inspectorPoint.y, window.innerHeight - inspector.offsetHeight - 12))}px`;
    return;
  }
  const box = inspectedBox();
  if (!box) return;
  const boxRect = [...canvas.querySelectorAll('.box')].find(element => Number(element.dataset.id) === box.id)?.getBoundingClientRect();
  if (!boxRect) return;
  const position = MockoutSelection.inspectorPosition(boxRect);
  inspector.style.left = `${position.left}px`;
  inspector.style.top = `${position.top}px`;
}

function revealInspector() {
  if (inspector.hidden || inspectorKind !== 'box') return;
  const pan = MockoutSelection.inspectorPan(inspector.getBoundingClientRect(),
    { width: window.innerWidth, height: window.innerHeight });
  if (!pan.x && !pan.y) return;
  view.x += pan.x;
  view.y += pan.y;
  render();
}

window.addEventListener('resize', positionInspector);

function colorChip(color) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.setAttribute('aria-hidden', 'true');
  if (color) chip.style.setProperty('--chip-color', color);
  else chip.classList.add('transparent');
  return chip;
}

function point(event) {
  return MockoutPlacement.worldPoint(event, workspace.getBoundingClientRect(), view);
}

function newBox(x, y) {
  const style = state.lastStyle ?? (state.boxes.length ? styleOf(state.boxes.at(-1)) : initialStyle(state.swatches));
  return {
    id: state.nextId++, x, y, w: minimum(), h: minimum(), text: '',
    ...style,
  };
}

function dragTargets(box, solo, resizing) {
  if (solo) return [{ ...box }];
  const selected = selectedBoxes();
  if (resizing || (isolatedCopyIds && selected.length === isolatedCopyIds.size
    && selected.every(item => isolatedCopyIds.has(item.id)))) return selected.map(item => ({ ...item }));
  const ids = new Set(selected.map(item => item.id));
  for (const parent of selected) {
    for (const child of state.boxes) {
      if (child.id !== parent.id && child.x >= parent.x && child.y >= parent.y
        && child.x + child.w <= parent.x + parent.w
        && child.y + child.h <= parent.y + parent.h) ids.add(child.id);
    }
  }
  return state.boxes.filter(item => ids.has(item.id)).map(item => ({ ...item }));
}

function startCopyPlacement(originals, cursor) {
  if (!originals?.length || gesture) return;
  closeProjectMenu();
  const previous = {
    before: snapshot(), selectedIds: new Set(selectedIds), selectedId,
    inspectorOpen, tool, isolatedCopyIds,
  };
  const { x: dx, y: dy } = MockoutPlacement.duplicateOffset(originals[0], cursor, state.grid);
  const copies = originals.map(box => ({
    ...box, id: state.nextId++, x: box.x + dx, y: box.y + dy,
  }));
  state.boxes.push(...copies);
  selectedIds = new Set(copies.map(box => box.id));
  selectedId = copies[0].id;
  inspectorOpen = false;
  tool = 'select';
  isolatedCopyIds = null;
  rememberStyle(copies[0]);
  placement = {
    ...previous, ids: new Set(selectedIds), firstId: copies[0].id,
  };
  lastBoxClick = null;
  workspace.focus();
  render();
}

function startDuplicatePlacement() {
  const source = selectedBoxes();
  if (source.length) startCopyPlacement(dragTargets(source[0], false, false), null);
}

function copySelection() {
  const source = selectedBoxes();
  if (source.length) copiedBoxes = dragTargets(source[0], false, false);
}

function startPastePlacement() {
  const cursor = pointerPosition && point({ clientX: pointerPosition.x, clientY: pointerPosition.y });
  startCopyPlacement(copiedBoxes, cursor);
}

function shiftPlacement(dx, dy) {
  for (const box of state.boxes) {
    if (!placement.ids.has(box.id)) continue;
    box.x += dx;
    box.y += dy;
  }
  render();
}

function movePlacement(clientX, clientY) {
  const first = state.boxes.find(box => box.id === placement.firstId);
  const cursor = point({ clientX, clientY });
  const { x: dx, y: dy } = MockoutPlacement.duplicateOffset(first, cursor, state.grid);
  shiftPlacement(dx, dy);
}

function finishPlacement(save) {
  const current = placement;
  placement = null;
  if (save) {
    isolatedCopyIds = current.ids;
    commit(current.before);
  } else {
    state = JSON.parse(current.before);
    selectedIds = current.selectedIds;
    selectedId = current.selectedId;
    inspectorOpen = current.inspectorOpen;
    tool = current.tool;
    isolatedCopyIds = current.isolatedCopyIds;
    render();
  }
  workspace.focus();
  queueFileSave();
}

const containsBox = MockoutSelection.containsBox;

function overlapsBox(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x
    && a.y < b.y + b.h && a.y + a.h > b.y;
}

function arrangeStack(movingIds = []) {
  const moving = new Set(movingIds);
  if (moving.size && state.boxes.some(a => moving.has(a.id)
    && state.boxes.some(b => !moving.has(b.id) && overlapsBox(a, b)))) {
    state.boxes = [
      ...state.boxes.filter(box => !moving.has(box.id)),
      ...state.boxes.filter(box => moving.has(box.id)),
    ];
  }
  const shouldStackBehind = (parent, child) => containsBox(parent, child)
    && (!moving.has(parent.id) || moving.has(child.id));
  for (;;) {
    const parentIndex = state.boxes.findIndex((parent, i) =>
      state.boxes.some((child, j) => j < i && shouldStackBehind(parent, child)));
    if (parentIndex < 0) break;
    const [parent] = state.boxes.splice(parentIndex, 1);
    const childIndex = state.boxes.findIndex(child => shouldStackBehind(parent, child));
    state.boxes.splice(childIndex, 0, parent);
  }
}

function setTool(next) {
  tool = next;
  lastBoxClick = null;
  render();
  workspace.focus();
}

for (const button of toolButtons) button.addEventListener('click', () => setTool(button.dataset.tool));

function toggleHelp() {
  helpPanel.hidden = !helpPanel.hidden;
  helpButton.setAttribute('aria-expanded', String(!helpPanel.hidden));
}

helpButton.addEventListener('click', toggleHelp);
document.querySelector('#close-help').addEventListener('click', toggleHelp);
async function fetchWelcomeProject() {
  const response = await fetch('welcome.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const loaded = await response.json();
  if (!validProject(loaded)) throw new Error('The Welcome project is invalid.');
  return loaded;
}
async function loadWelcome(first = false) {
  if (state.boxes.length || savedProjectIssue) return;
  try {
    const loaded = await fetchWelcomeProject();
    if (state.boxes.length || savedProjectIssue) return;
    if (first && localStorage.getItem(STORAGE_KEY) !== null) return;
    change(() => {
      state = loaded;
      selectOnly(null);
      inspectorOpen = false;
      focusProject(state.boxes);
    });
    if (first) { undoStack.length = 0; redoStack.length = 0; }
    helpPanel.hidden = true;
    helpButton.setAttribute('aria-expanded', 'false');
    workspace.focus();
  } catch (error) {
    showNotice(`Could not load Welcome example: ${error.message}`);
  }
}
welcomeButton.addEventListener('click', () => loadWelcome());
document.querySelector('#box-properties').addEventListener('focusin', event => {
  if (inspectorKind === 'box' && inspectorView === 'properties') lastPropertyFocus.set(activePropertySection, event.target);
});
function focusPropertySection() {
  const field = lastPropertyFocus.get(activePropertySection);
  if (field?.isConnected && !field.closest('[hidden]')) field.focus();
  else propertySections[propertySectionIndex()].element.querySelector('input, select, button')?.focus();
}
document.querySelector('#close-inspector').addEventListener('click', () => {
  inspectorOpen = false;
  workspace.focus();
  render();
});

inspector.addEventListener('keydown', event => {
  if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
  const fields = [...inspector.querySelectorAll('button, input, select, a[href]')]
    .filter(field => !field.disabled && field.tabIndex >= 0 && field.getClientRects().length);
  const index = fields.indexOf(document.activeElement);
  if (index === -1 || (event.shiftKey ? index !== 0 : index !== fields.length - 1)) return;
  event.preventDefault();
  fields[event.shiftKey ? fields.length - 1 : 0].focus();
});

function openInspector(id = selectedId) {
  if (id === null) return;
  if (inspector.contains(document.activeElement)) document.activeElement.blur();
  if (selectedIds.has(id)) selectedId = id;
  else selectOnly(id);
  inspectorOpen = true;
  inspectorKind = 'box';
  inspectorView = 'properties';
  render();
  revealInspector();
  focusPropertySection();
}

function openCanvasInspector(point = null) {
  selectOnly(null);
  inspectorOpen = true;
  inspectorKind = 'canvas';
  inspectorView = 'properties';
  inspectorPoint = point || { x: 12, y: 12 };
  render();
  if (!point) {
    inspectorPoint = { x: (window.innerWidth - inspector.offsetWidth) / 2,
      y: (window.innerHeight - inspector.offsetHeight) / 2 };
    positionInspector();
  }
  document.querySelector('#canvas-properties button').focus();
}

workspace.addEventListener('contextmenu', event => {
  if (fileLocked) { event.preventDefault(); return; }
  if (placement) { event.preventDefault(); return; }
  const boxElement = event.target.closest('.box');
  event.preventDefault();
  if (boxElement) openInspector(Number(boxElement.dataset.id));
  else openCanvasInspector({ x: event.clientX, y: event.clientY });
});

document.addEventListener('pointerdown', event => {
  pointerPosition = { x: event.clientX, y: event.clientY };
});
document.addEventListener('pointermove', event => {
  pointerPosition = { x: event.clientX, y: event.clientY };
});

workspace.addEventListener('pointerdown', event => {
  if (fileLocked && event.button !== 1 && !spaceDown) { event.preventDefault(); return; }
  if (inspector.contains(document.activeElement)) document.activeElement.blur();
  if (placement) {
    event.preventDefault();
    if (event.button === 0) {
      finishPlacement(true);
    }
    return;
  }
  if (textEditor || (event.button !== 0 && event.button !== 1)) return;
  const boxElement = event.target.closest('.box');
  const handle = event.target.dataset.handle || '';
  const p = point(event);
  const boxId = boxElement ? Number(boxElement.dataset.id) : handle ? selectedId : null;
  if (event.button === 1 || spaceDown) {
    gesture = { kind: 'pan', startX: event.clientX, startY: event.clientY, x: view.x, y: view.y };
  } else if (boxId && !handle && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && lastBoxClick?.id === boxId
    && event.timeStamp - lastBoxClick.time < 450
    && Math.hypot(p.x - lastBoxClick.x, p.y - lastBoxClick.y) < 7 / view.zoom) {
    lastBoxClick = null;
    event.preventDefault();
    editText(boxId);
    return;
  } else {
    lastBoxClick = null;
    if (event.shiftKey && !event.altKey) {
      isolatedCopyIds = null;
      gesture = { kind: 'marquee', start: p, end: null, base: new Set(selectedIds), clickId: boxId };
    } else if (tool === 'box' && !(boxId && (event.altKey || event.ctrlKey || event.metaKey))) {
      gesture = { kind: 'draw', start: { x: snap(p.x), y: snap(p.y) }, clickPoint: p,
        before: snapshot(), id: null, hitId: boxId };
    } else if (boxId) {
      const hit = state.boxes.find(b => b.id === boxId);
      const resizing = Boolean(handle);
      const box = !resizing && !event.altKey && (event.ctrlKey || event.metaKey)
        ? MockoutSelection.nearestContainer(state.boxes, hit) ?? hit : hit;
      if (!selectedIds.has(box.id)) {
        selectOnly(box.id);
        inspectorView = 'properties';
      }
      gesture = {
        kind: resizing ? 'resize' : 'move',
        handle,
        start: p, original: { ...box },
        originals: dragTargets(box, event.altKey, resizing),
        before: snapshot(), id: box.id,
      };
    } else {
      isolatedCopyIds = null;
      const base = event.shiftKey ? new Set(selectedIds) : new Set();
      selectedIds = new Set(base);
      selectedId = selectedIds.values().next().value ?? null;
      if (!event.shiftKey) inspectorOpen = false;
      gesture = { kind: 'marquee', start: p, end: null, base };
    }
  }
  workspace.setPointerCapture(event.pointerId);
  render();
  event.preventDefault();
});

workspace.addEventListener('pointermove', event => {
  if (placement) { movePlacement(event.clientX, event.clientY); return; }
  if (!gesture) return;
  if (gesture.kind === 'pan') {
    view.x = gesture.x + event.clientX - gesture.startX;
    view.y = gesture.y + event.clientY - gesture.startY;
    render();
    return;
  }
  const p = point(event);
  if (gesture.kind === 'draw') {
    const end = { x: snap(p.x), y: snap(p.y) };
    if (gesture.id === null && end.x === gesture.start.x && end.y === gesture.start.y) return;
    if (gesture.id === null) {
      const box = newBox(gesture.start.x, gesture.start.y);
      state.boxes.push(box);
      selectOnly(box.id);
      gesture.id = box.id;
    }
    const box = selectedBox();
    box.x = Math.min(gesture.start.x, end.x);
    box.y = Math.min(gesture.start.y, end.y);
    box.w = Math.max(minimum(), Math.abs(end.x - gesture.start.x));
    box.h = Math.max(minimum(), Math.abs(end.y - gesture.start.y));
  } else if (gesture.kind === 'marquee') {
    if (gesture.clickId && !gesture.end
      && Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) * view.zoom < 4) return;
    gesture.end = p;
    const left = Math.min(gesture.start.x, p.x);
    const right = Math.max(gesture.start.x, p.x);
    const top = Math.min(gesture.start.y, p.y);
    const bottom = Math.max(gesture.start.y, p.y);
    selectedIds = new Set(gesture.base);
    for (const box of state.boxes) {
      if (box.x >= left && box.y >= top && box.x + box.w <= right && box.y + box.h <= bottom) selectedIds.add(box.id);
    }
    selectedId = selectedIds.values().next().value ?? null;
  } else {
    const original = gesture.original;
    const dx = p.x - gesture.start.x;
    const dy = p.y - gesture.start.y;
    if (gesture.kind === 'move') {
      const moveX = snap(original.x + dx) - original.x;
      const moveY = snap(original.y + dy) - original.y;
      for (const start of gesture.originals) {
        const moved = state.boxes.find(item => item.id === start.id);
        moved.x = start.x + moveX;
        moved.y = start.y + moveY;
      }
    } else {
      const h = gesture.handle;
      for (const start of gesture.originals) {
        const resized = state.boxes.find(item => item.id === start.id);
        let left = start.x, top = start.y;
        let right = start.x + start.w, bottom = start.y + start.h;
        if (h.includes('w')) left = Math.min(right - minimum(), snap(start.x + dx));
        if (h.includes('e')) right = Math.max(left + minimum(), snap(start.x + start.w + dx));
        if (h.includes('n')) top = Math.min(bottom - minimum(), snap(start.y + dy));
        if (h.includes('s')) bottom = Math.max(top + minimum(), snap(start.y + start.h + dy));
        Object.assign(resized, { x: left, y: top, w: right - left, h: bottom - top });
      }
    }
  }
  render();
});

function endGesture(event) {
  if (!gesture) return;
  const { before, kind } = gesture;
  if (kind === 'marquee' && gesture.clickId && !gesture.end) {
    if (selectedIds.has(gesture.clickId)) selectedIds.delete(gesture.clickId);
    else selectedIds.add(gesture.clickId);
    selectedId = selectedIds.values().next().value ?? null;
  }
  if ((kind === 'move' || (kind === 'draw' && gesture.id === null && gesture.hitId)) && before === snapshot()) {
    lastBoxClick = { id: gesture.hitId || gesture.id, ...(gesture.clickPoint || gesture.start), time: event.timeStamp };
  } else {
    lastBoxClick = null;
  }
  if (before && before !== snapshot() && ['draw', 'move', 'resize'].includes(kind)) {
    arrangeStack(kind === 'move' ? gesture.originals.map(box => box.id) : []);
  }
  gesture = null;
  if (workspace.hasPointerCapture(event.pointerId)) workspace.releasePointerCapture(event.pointerId);
  if (before) commit(before);
  render();
  queueFileSave();
}
workspace.addEventListener('pointerup', endGesture);
workspace.addEventListener('pointercancel', event => {
  if (!gesture) return;
  if (gesture.before) state = JSON.parse(gesture.before);
  gesture = null;
  lastBoxClick = null;
  if (workspace.hasPointerCapture(event.pointerId)) workspace.releasePointerCapture(event.pointerId);
  render();
  queueFileSave();
});

function editText(id) {
  const box = state.boxes.find(b => b.id === id);
  if (!box) return;
  selectOnly(id);
  const before = snapshot();
  textEditor = true;
  render();
  const editor = canvas.querySelector(`.box[data-id="${id}"] .box-label`);
  editor.classList.add('text-editor');
  editor.contentEditable = 'plaintext-only';
  textEditor = editor;
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  let finished = false;
  const finish = save => {
    if (finished) return;
    finished = true;
    if (save) box.text = editor.innerText;
    selectedId = id;
    textEditor = null;
    if (save) commit(before);
    render();
    queueFileSave();
  };
  editor.addEventListener('blur', () => finish(true));
  editor.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); }
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); finish(true); }
    if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); finish(true); cycleSelection(event.shiftKey ? -1 : 1); }
  });
}

for (const [id, key, transform] of [
  ['box-text', 'text', value => value],
  ['box-width', 'w', value => Math.max(minimum(), snap(Number(value) || minimum()))],
  ['box-height', 'h', value => Math.max(minimum(), snap(Number(value) || minimum()))],
  ['box-radius', 'radius', value => Math.max(0, Number(value) || 0)],
  ['box-border-width', 'borderWidth', value => Math.max(0, Number(value) || 0)],
  ['box-padding-x', 'paddingX', value => Math.max(0, Number(value) || 0)],
  ['box-padding-y', 'paddingY', value => Math.max(0, Number(value) || 0)],
  ['box-font-size', 'fontSize', value => Math.max(1, Number(value) || 1)],
  ['box-font-weight', 'fontWeight', Number],
  ['box-font-style', 'fontStyle', value => value],
]) {
  const input = document.getElementById(id);
  input.addEventListener('change', event => {
    if (!selectedIds.size || (input.type === 'number' && event.target.value === '')) return;
    change(() => {
      MockoutSelection.applyProperty(state.boxes, selectedIds, key, transform(event.target.value));
      rememberStyle(selectedBox());
    });
  });
}
const fontFamilySelect = document.querySelector('#box-font-family');
const googleFontInput = document.querySelector('#box-google-font');
const materialStyleSelect = document.querySelector('#box-material-style');
function assignFontFamily(family) {
  change(() => {
    MockoutSelection.applyProperty(state.boxes, selectedIds, 'fontFamily', family);
    for (const box of selectedBoxes()) {
      if (fonts.isSymbol(family)) box.fontWeight = Math.min(fonts.weightOf(box), 700);
      if (fonts.isClassicIcon(family)) { box.fontWeight = 400; box.fontStyle = 'normal'; }
    }
    rememberStyle(selectedBox());
  });
}
fontFamilySelect.addEventListener('change', () => {
  const category = fontFamilySelect.value;
  if (category === 'google') {
    const current = MockoutSelection.commonValue(selectedBoxes(), fonts.familyOf);
    document.querySelector('#google-font-field').hidden = false;
    document.querySelector('#material-style-field').hidden = true;
    googleFontInput.value = current && !fonts.isMaterial(current) ? current : '';
    googleFontInput.focus();
    return;
  }
  if (category === 'mixed' || !selectedIds.size) return;
  const current = MockoutSelection.commonValue(selectedBoxes(), fonts.familyOf);
  let family = category;
  if (category === 'material') family = fonts.isMaterial(current) ? current : 'Material Symbols Outlined';
  assignFontFamily(family);
  if (category === 'material') materialStyleSelect.focus();
});
materialStyleSelect.addEventListener('change', () => {
  const family = materialStyleSelect.value;
  if (!fonts.isMaterial(family) || !selectedIds.size) return;
  assignFontFamily(family);
});
googleFontInput.addEventListener('change', () => {
  const family = googleFontInput.value.trim().replace(/\s+/g, ' ');
  if (!family || !fonts.validFamily(family) || !selectedIds.size) {
    if (family) showNotice('Enter the family name as shown on Google Fonts.');
    return;
  }
  change(() => {
    MockoutSelection.applyProperty(state.boxes, selectedIds, 'fontFamily', family);
    rememberStyle(selectedBox());
  });
});
googleFontInput.addEventListener('blur', () => {
  if (!googleFontInput.value.trim()) renderInspector();
});
document.querySelector('#box-text').addEventListener('keydown', event => {
  if (!['Backspace', 'Delete'].includes(event.key) || event.target.value !== '') return;
  if (MockoutSelection.commonValue(selectedBoxes(), box => box.text) !== undefined) return;
  event.preventDefault();
  change(() => {
    MockoutSelection.applyProperty(state.boxes, selectedIds, 'text', '');
    rememberStyle(selectedBox());
  });
});
for (const button of alignButtons) {
  button.addEventListener('click', () => {
    if (selectedIds.size) change(() => {
      MockoutSelection.applyProperty(state.boxes, selectedIds, button.dataset.alignAxis, button.dataset.alignValue);
      rememberStyle(selectedBox());
    });
  });
}

function deleteSelected() {
  if (!selectedIds.size) return;
  change(() => {
    state.boxes = state.boxes.filter(b => !selectedIds.has(b.id));
    selectOnly(null);
    inspectorOpen = false;
  });
}

for (const button of gridButtons) {
  button.addEventListener('click', () => change(() => { state.grid = Number(button.dataset.grid); }));
}

function undo() {
  if (!undoStack.length) return;
  const wasEmpty = !state.boxes.length;
  isolatedCopyIds = null;
  redoStack.push(snapshot());
  state = JSON.parse(undoStack.pop());
  if (wasEmpty !== !state.boxes.length) focusProject(state.boxes);
  selectedIds = new Set([...selectedIds].filter(id => state.boxes.some(b => b.id === id)));
  selectedId = selectedIds.values().next().value ?? null;
  persist();
  render();
}
function redo() {
  if (!redoStack.length) return;
  const wasEmpty = !state.boxes.length;
  isolatedCopyIds = null;
  undoStack.push(snapshot());
  state = JSON.parse(redoStack.pop());
  if (wasEmpty !== !state.boxes.length) focusProject(state.boxes);
  selectedIds = new Set([...selectedIds].filter(id => state.boxes.some(b => b.id === id)));
  selectedId = selectedIds.values().next().value ?? null;
  persist();
  render();
}

function zoomAt(factor, clientX, clientY) {
  const rect = workspace.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const worldX = (x - view.x) / view.zoom;
  const worldY = (y - view.y) / view.zoom;
  const next = Math.max(0.2, Math.min(20, view.zoom * factor));
  view.x = x - worldX * next;
  view.y = y - worldY * next;
  view.zoom = next;
  render();
}

function cycleSelection(step) {
  if (!state.boxes.length) return;
  const boxes = [...state.boxes].sort((a, b) => a.id - b.id);
  const currentIndex = boxes.findIndex(box => box.id === selectedId);
  const nextIndex = currentIndex < 0
    ? (step > 0 ? 0 : boxes.length - 1)
    : (currentIndex + step + boxes.length) % boxes.length;
  const best = boxes[nextIndex];
  selectOnly(best.id);
  inspectorOpen = false;
  const margin = 32;
  const left = view.x + best.x * view.zoom;
  const top = view.y + best.y * view.zoom;
  const right = left + best.w * view.zoom;
  const bottom = top + best.h * view.zoom;
  if (left < margin) view.x += margin - left;
  else if (right > workspace.clientWidth - margin) view.x -= right - workspace.clientWidth + margin;
  if (top < margin) view.y += margin - top;
  else if (bottom > workspace.clientHeight - margin) view.y -= bottom - workspace.clientHeight + margin;
  workspace.focus();
  render();
}

function panCanvasWithWheel(event) {
  if (event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  if (textEditor) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? workspace.clientHeight : 1;
  const panX = (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * unit;
  const panY = event.shiftKey ? 0 : event.deltaY * unit;
  view.x -= panX;
  view.y -= panY;
  if (placement) {
    shiftPlacement(panX / view.zoom, panY / view.zoom);
  } else render();
}
workspace.addEventListener('wheel', panCanvasWithWheel, { passive: false });
inspector.addEventListener('wheel', event => {
  if (event.target.closest('select, input[type="range"]')) return;
  const list = event.target.closest('.dialog-choice-list');
  if (list && list.scrollHeight > list.clientHeight
    && ((event.deltaY < 0 && list.scrollTop > 0)
      || (event.deltaY > 0 && list.scrollTop + list.clientHeight < list.scrollHeight))) return;
  panCanvasWithWheel(event);
}, { passive: false });

document.addEventListener('wheel', event => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  if (textEditor || placement) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? workspace.clientHeight : 1;
  zoomAt(Math.exp(-event.deltaY * unit * 0.002), event.clientX, event.clientY);
}, { passive: false });

document.addEventListener('keyup', event => {
  if (event.key === 'Alt') {
    altDown = false;
    workspace.classList.remove('alt-move');
  }
  if (event.code === 'Space' && spaceDown) {
    spaceDown = false;
    render();
  }
});
window.addEventListener('blur', () => {
  altDown = false;
  workspace.classList.remove('alt-move');
  if (spaceDown) { spaceDown = false; render(); }
});

document.addEventListener('keydown', event => {
  const openMenu = toolbarMenus.find(item => !item.menu.hidden);
  if (openMenu && openMenu.holder.contains(document.activeElement)) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      closeToolbarMenu(openMenu, true);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const buttons = [...openMenu.menu.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
      return;
    }
    return;
  }
  if (openMenu && event.key === 'Escape') {
    event.preventDefault();
    closeToolbarMenu(openMenu, true);
    return;
  }
  if (event.key === 'Alt') {
    altDown = true;
    workspace.classList.add('alt-move');
  }
  const ctrl = event.ctrlKey || event.metaKey;
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(event.code)?.[1];
  const zoomInKey = event.code === 'Equal' || event.code === 'NumpadAdd';
  const zoomOutKey = (event.code === 'Minus' && !event.shiftKey) || event.code === 'NumpadSubtract';
  if (fileLocked) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (direction) {
      event.preventDefault(); view.x -= direction[0] * 40; view.y -= direction[1] * 40; render(); return;
    }
    const viewing = event.key === 'Escape' || event.code === 'Space' || zoomInKey || zoomOutKey
      || (ctrl && (['KeyO', 'KeyP', 'KeyC', 'KeyA'].includes(event.code) || digit === '0' || (event.code === 'KeyS' && event.shiftKey)))
      || (!ctrl && !event.altKey && (event.code === 'KeyT' || (event.shiftKey && ['Slash', 'KeyN'].includes(event.code))));
    if (!viewing) { event.preventDefault(); return; }
  }
  if (placement) {
    if (event.key === 'Escape') { event.preventDefault(); finishPlacement(false); return; }
    if (event.key === 'Enter') { event.preventDefault(); finishPlacement(true); return; }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (direction && !event.altKey) {
      event.preventDefault();
      const amount = (state.grid || 1) * (ctrl ? 5 : 1);
      shiftPlacement(direction[0] * amount, direction[1] * amount);
      return;
    }
    if (ctrl || event.code === 'Space' || event.key === 'Tab' || event.key.length === 1) event.preventDefault();
    return;
  }
  if (event.altKey && !ctrl && !event.shiftKey && /^[1-4]$/.test(digit || '') && !textEditor && selectedIds.size) {
    event.preventDefault();
    activePropertySection = propertySections[Number(digit) - 1].id;
    if (inspectorOpen && inspectorKind === 'box') {
      inspectorView = 'properties';
      renderInspector();
      focusPropertySection();
    } else {
      openInspector(selectedId);
    }
    return;
  }
  if (ctrl && event.code === 'KeyS') { event.preventDefault(); saveProject(event.shiftKey); return; }
  if (ctrl && event.code === 'KeyO') { event.preventDefault(); chooseProjectFile(); return; }
  if (ctrl && event.code === 'KeyP') { event.preventDefault(); openPreview(); return; }
  if (ctrl && event.code === 'KeyD') {
    event.preventDefault();
    if (!textEditor) {
      if (inspector.contains(document.activeElement)) document.activeElement.blur();
      if (selectedIds.size) startDuplicatePlacement();
    }
    return;
  }
  if (ctrl && !event.altKey && !event.shiftKey && (event.code === 'KeyC' || event.code === 'KeyV')) {
    const focus = document.activeElement;
    if (textEditor || focus.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(focus.tagName)) return;
    if (event.code === 'KeyC' && selectedIds.size) {
      event.preventDefault();
      copySelection();
    } else if (event.code === 'KeyV' && copiedBoxes?.length) {
      event.preventDefault();
      if (inspector.contains(focus)) focus.blur();
      startPastePlacement();
    }
    return;
  }
  if (ctrl && ((digit === '0' && !event.shiftKey) || zoomInKey || zoomOutKey)) {
    event.preventDefault();
    if (!textEditor) zoomAt(digit === '0' ? 1 / view.zoom : zoomOutKey ? 1 / 1.2 : 1.2,
      workspace.clientWidth / 2, workspace.clientHeight / 2);
    return;
  }
  if (inspectorOpen && event.key === 'Escape' && inspector.contains(document.activeElement)) {
    event.preventDefault();
    if (inspectorView === 'properties') {
      inspectorOpen = false;
      workspace.focus();
      render();
    } else returnFromColorView();
    return;
  }
  if (inspector.contains(document.activeElement) || textEditor
    || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (!ctrl && !event.altKey && !event.shiftKey && event.code === 'KeyT') {
    event.preventDefault();
    if (!event.repeat) toggleTheme();
    return;
  }
  if (event.shiftKey && !ctrl && !event.altKey && event.code === 'KeyN') {
    event.preventDefault();
    newBlank();
    return;
  }
  if (ctrl && !event.altKey && !event.shiftKey && event.code === 'KeyA') {
    event.preventDefault();
    isolatedCopyIds = null;
    selectedIds = new Set(state.boxes.map(box => box.id));
    selectedId = state.boxes[0]?.id ?? null;
    inspectorOpen = false;
    tool = 'select';
    workspace.focus();
    render();
    return;
  }
  if (event.code === 'Slash' && event.shiftKey && !ctrl && !event.altKey) {
    event.preventDefault();
    if (!event.repeat) toggleHelp();
    return;
  }
  if (event.code === 'Space' && !ctrl && !event.altKey) {
    event.preventDefault();
    if (!spaceDown) { spaceDown = true; render(); }
    return;
  }
  if (ctrl && event.code === 'KeyZ') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  if (ctrl && event.code === 'KeyY') { event.preventDefault(); redo(); return; }
  if ((zoomInKey || zoomOutKey) && !event.altKey && !ctrl) {
    event.preventDefault();
    zoomAt(zoomOutKey ? 1 / 1.2 : 1.2, workspace.clientWidth / 2, workspace.clientHeight / 2);
    return;
  }
  if (!ctrl && !event.altKey && !event.shiftKey && /^[1-5]$/.test(digit || '')) {
    change(() => { state.grid = [40, 20, 10, 5, 0][Number(digit) - 1]; });
    return;
  }
  if (!ctrl && !event.altKey && event.code === 'KeyV') { event.preventDefault(); setTool('select'); return; }
  if (!ctrl && !event.altKey && event.code === 'KeyB') { event.preventDefault(); setTool('box'); return; }
  if (!ctrl && !event.altKey && event.code === 'KeyP') {
    event.preventDefault();
    if (inspectorOpen) { inspectorOpen = false; render(); }
    else if (selectedIds.size) openInspector(selectedId);
    else if (!selectedIds.size) openCanvasInspector();
    return;
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.size) { event.preventDefault(); deleteSelected(); return; }
  if (event.key === 'Escape') {
    event.preventDefault();
    if (inspectorOpen) { inspectorOpen = false; workspace.focus(); }
    else selectOnly(null);
    render();
    return;
  }
  if (event.key === 'Enter' && !event.altKey && selectedIds.size === 1) { event.preventDefault(); editText(selectedId); return; }
  if (event.key === 'F2' && selectedIds.size === 1) { event.preventDefault(); editText(selectedId); return; }
  if (event.key === 'Tab') { event.preventDefault(); cycleSelection(event.shiftKey ? -1 : 1); return; }
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (direction && selectedIds.size) {
    event.preventDefault();
    const amount = (state.grid || 1) * (ctrl ? 5 : 1);
    change(() => {
      const targets = event.shiftKey
        ? (event.altKey ? [selectedBox()] : selectedBoxes())
        : dragTargets(selectedBox(), event.altKey, false);
      for (const target of targets) {
        const box = state.boxes.find(item => item.id === target.id);
        if (event.shiftKey) {
          if (direction[0]) box.w = Math.max(minimum(), snap(box.x + box.w + direction[0] * amount) - box.x);
          if (direction[1]) box.h = Math.max(minimum(), snap(box.y + box.h + direction[1] * amount) - box.y);
        } else {
          box.x += direction[0] * amount;
          box.y += direction[1] * amount;
        }
      }
      if (!event.shiftKey) arrangeStack(targets.map(box => box.id));
    });
    return;
  }
  if (direction && !selectedIds.size && !ctrl && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    view.x -= direction[0] * 40;
    view.y -= direction[1] * 40;
    render();
  }
});

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function grayValue(hex) {
  const [r, g, b] = hexToRgb(hex);
  return Math.round(.299 * r + .587 * g + .114 * b);
}
function rgbToHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
  }
  return [Math.round((hue + 360) % 360), Math.round(max ? delta / max * 100 : 0), Math.round(max * 100)];
}
function hsbToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360; s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return parts.map(n => Math.round((n + m) * 255));
}

function showColor() {
  const rgb = colorMode === 'rgb';
  const gray = colorMode === 'gray';
  document.querySelector('#color-picker').classList.toggle('gray-mode', gray);
  const values = gray ? [grayValue(editorColor)]
    : rgb ? hexToRgb(editorColor) : rgbToHsb(...hexToRgb(editorColor));
  channels.forEach((input, i) => {
    input.closest('.color-channel').hidden = gray && i > 0;
    const label = (gray ? ['Gray', '', ''] : rgb ? ['R', 'G', 'B'] : ['H', 'S', 'B'])[i];
    const max = rgb || gray ? 255 : [360, 100, 100][i];
    input.max = max;
    channelValues[i].max = max;
    document.getElementById(`channel-${i + 1}-label`).textContent = label;
    channelValues[i].setAttribute('aria-label', `${gray ? 'Gray' : rgb ? ['Red', 'Green', 'Blue'][i] : ['Hue', 'Saturation', 'Brightness'][i]} value`);
    input.value = values[i] ?? 0;
    channelValues[i].value = values[i] ?? 0;
  });
  document.querySelector('#color-preview').style.setProperty('--preview-color', editorColor);
  document.querySelector('#color-hex').value = editorColor.slice(1).toUpperCase();
  document.querySelector('#color-error').hidden = true;
  render();
}

function openColorPicker(color, mode, onAccept) {
  editorColor = color;
  colorMode = mode;
  pickerOnAccept = onAccept;
  inspectorView = 'picker';
  document.querySelector('#color-mode').value = colorMode;
  showColor();
  revealInspector();
  document.querySelector('#color-hex').focus();
}

function openManageSwatches() {
  colorTarget = { editId: null };
  inspectorView = 'manage';
  renderInspector();
  revealInspector();
  (document.querySelector('#swatch-list .dialog-choice') || document.querySelector('#new-swatch')).focus();
}

function openColor(property) {
  colorTarget = { property };
  inspectorView = 'choose';
  renderInspector();
  revealInspector();
  document.querySelector('#choice-swatch-list .dialog-choice[tabindex="0"]')?.focus();
}

function assignColor(id) {
  if (!selectedIds.size || !colorTarget) return;
  change(() => {
    MockoutSelection.applyProperty(state.boxes, selectedIds, colorTarget.property, id);
    rememberStyle(selectedBox());
  });
  inspectorView = 'properties';
  renderInspector();
  focusColorField();
}

function openCanvasColorEditor(property) {
  colorTarget = { property, direct: true };
  document.querySelector('#swatch-error').hidden = true;
  editorLight = { color: state.canvasColors[property], mode: state.canvasColorModes?.[property] ?? 'gray' };
  editorDark = { mode: 'invert', color: null, colorMode: editorLight.mode,
    ...state.canvasDark?.[property] };
  editorSide = 'light';
  inspectorView = 'edit';
  renderInspector();
  revealInspector();
  document.querySelector('#swatch-light').focus();
}

function focusColorField() {
  const selector = inspectorKind === 'box'
    ? `[data-color-property="${colorTarget.property}"]`
    : `[data-canvas-color-property="${colorTarget.property}"]`;
  document.querySelector(selector).focus();
}

function focusSwatchEditorOpener() {
  const edit = [...document.querySelectorAll('#swatch-list .dialog-choice')]
    .find(button => button.dataset.swatchId === colorTarget.editId);
  (edit || document.querySelector('#new-swatch')).focus();
}

function returnFromColorView() {
  showInspectorParent(inspectorView === 'picker' ? 'edit'
    : colorTarget?.direct ? 'properties' : 'manage');
}

function openSwatchEditor(id = null) {
  colorTarget.editId = id;
  const item = swatch(id);
  editorLight = { color: item?.color || '#6746b7',
    mode: item?.mode ?? 'hsb' };
  editorDark = { mode: 'invert', color: null, colorMode: editorLight.mode, ...item?.dark };
  editorSide = 'light';
  document.querySelector('#swatch-name').value = item?.name || '';
  document.querySelector('#swatch-error').hidden = true;
  inspectorView = 'edit';
  renderInspector();
  revealInspector();
  document.querySelector('#swatch-name').focus();
}

function openEditorColorPicker(side) {
  if (side === 'dark' && editorDark.mode !== 'custom') return;
  editorSide = side;
  const color = side === 'light' ? editorLight.color : editorDark.color;
  const mode = side === 'light' ? editorLight.mode : editorDark.colorMode || editorLight.mode;
  openColorPicker(color, mode, (chosenColor, chosenMode) => {
    const next = MockoutProject.withPickerColor(editorLight, editorDark,
      side, chosenColor, chosenMode);
    editorLight = next.light;
    editorDark = next.dark;
  });
}

for (const button of boxColorButtons) button.addEventListener('click', () => openColor(button.dataset.colorProperty));
for (const button of canvasColorButtons) button.addEventListener('click', () =>
  openCanvasColorEditor(button.dataset.canvasColorProperty));
document.querySelector('#manage-swatches').addEventListener('click', openManageSwatches);
for (const button of document.querySelectorAll('[data-editor-side]')) button.addEventListener('click', () =>
  openEditorColorPicker(button.dataset.editorSide));
document.querySelector('#dark-behavior').addEventListener('change', event => {
  editorDark.mode = event.target.value;
  if (editorDark.mode === 'custom' && !editorDark.color) {
    editorDark.color = MockoutProject.invertColor(editorLight.color);
    editorDark.colorMode = editorLight.mode;
  }
  render();
});
document.querySelector('#new-swatch').addEventListener('click', () => openSwatchEditor());
document.querySelector('#delete-swatch').addEventListener('click', () => {
  const id = colorTarget?.editId;
  if (!id || state.swatches.length <= 1 || state.boxes.some(box =>
    ['fill', 'textColor', 'borderColor'].some(property => box[property] === id))) return;
  change(() => {
    state.swatches = state.swatches.filter(item => item.id !== id);
    if (state.lastStyle) {
      for (const property of ['fill', 'textColor', 'borderColor']) {
        if (state.lastStyle[property] === id) state.lastStyle[property] = state.swatches[0].id;
      }
    }
  });
  inspectorView = 'manage';
  colorTarget.editId = null;
  renderInspector();
  document.querySelector('#new-swatch').focus();
});
document.querySelector('#color-mode').addEventListener('change', event => {
  colorMode = event.target.value;
  if (colorMode === 'gray') {
    const value = grayValue(editorColor);
    editorColor = rgbToHex(value, value, value);
  }
  showColor();
  revealInspector();
});

function updateFromChannels(source, index) {
  const value = Math.max(0, Math.min(Number(source.max), Number(source.value) || 0));
  channels[index].value = value;
  channelValues[index].value = value;
  const values = channels.map(input => Number(input.value));
  editorColor = rgbToHex(...(colorMode === 'gray' ? [value, value, value]
    : colorMode === 'hsb' ? hsbToRgb(...values) : values));
  document.querySelector('#color-preview').style.setProperty('--preview-color', editorColor);
  document.querySelector('#color-hex').value = editorColor.slice(1).toUpperCase();
  document.querySelector('#color-error').hidden = true;
  render();
}
channels.forEach((input, i) => input.addEventListener('input', () => updateFromChannels(input, i)));
channelValues.forEach((input, i) => input.addEventListener('input', () => updateFromChannels(input, i)));

function readHex() {
  const input = document.querySelector('#color-hex');
  const value = input.value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    const error = document.querySelector('#color-error');
    error.textContent = 'Enter six hex digits (RRGGBB).';
    error.hidden = false;
    return false;
  }
  if (`#${value.toLowerCase()}` !== editorColor) useHex(value);
  return true;
}
function useHex(value) {
  editorColor = `#${value.toLowerCase()}`;
  if (colorMode === 'gray' && new Set(hexToRgb(editorColor)).size > 1) {
    colorMode = 'rgb';
    document.querySelector('#color-mode').value = colorMode;
  }
  showColor();
}
document.querySelector('#color-hex').addEventListener('change', readHex);
document.querySelector('#color-hex').addEventListener('input', event => {
  const value = event.target.value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(value)) useHex(value);
});
document.querySelector('#swatch-name').addEventListener('input', () => {
  document.querySelector('#swatch-error').hidden = true;
});

document.querySelector('#use-color').addEventListener('click', () => {
  if (!pickerOnAccept || !readHex()) return;
  pickerOnAccept(editorColor, colorMode);
  pickerOnAccept = null;
  inspectorView = 'edit';
  render();
  document.querySelector(`[data-editor-side="${editorSide}"]`).focus();
});

document.querySelector('#save-color').addEventListener('click', () => {
  if (!colorTarget) return;
  if (colorTarget.direct) {
    change(() => {
      state.canvasColors[colorTarget.property] = editorLight.color;
      state.canvasColorModes = { ...state.canvasColorModes, [colorTarget.property]: editorLight.mode };
      state.canvasDark = { ...state.canvasDark, [colorTarget.property]: { ...editorDark } };
    });
    inspectorView = 'properties';
    renderInspector();
    focusColorField();
    return;
  }
  const name = document.querySelector('#swatch-name').value.trim();
  if (!name) {
    const error = document.querySelector('#swatch-error');
    error.textContent = 'Give the swatch a name.';
    error.hidden = false;
    document.querySelector('#swatch-name').focus();
    return;
  }
  const dark = { mode: editorDark.mode };
  if (editorDark.color) dark.color = editorDark.color;
  if (editorDark.colorMode) dark.colorMode = editorDark.colorMode;
  if (colorTarget.editId) {
    change(() => { Object.assign(swatch(colorTarget.editId),
      { name, color: editorLight.color, mode: editorLight.mode, dark }); });
    inspectorView = 'manage';
  } else {
    change(() => {
      const id = `s${state.nextId++}`;
      state.swatches.push({ id, name, color: editorLight.color, mode: editorLight.mode, dark });
      colorTarget.editId = id;
    });
    inspectorView = 'manage';
  }
  renderInspector();
  focusSwatchEditorOpener();
});

function downloadProject() {
  const blob = new Blob([JSON.stringify(MockoutProject.forExport(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = MockoutProject.suggestedFileName();
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function saveProject(asNew = false, overwriteStamp = null, automatic = false) {
  if (fileSaving || (fileLocked && !asNew && overwriteStamp === null)) return;
  if (automatic && (!projectFileHandle || fileSaveError || savedProjectIssue
    || !reconnectFileButton.hidden || gesture || placement || textEditor || snapshot() === fileBaseline)) return;
  if (!window.showSaveFilePicker) { downloadProject(); return; }
  clearTimeout(fileSaveTimer);
  if (!automatic) clearFileSaveError();
  fileSaving = true;
  updateFileStatus();
  const revision = fileConnectionRevision;
  try {
    const handle = !asNew && projectFileHandle ? projectFileHandle : await window.showSaveFilePicker({
      suggestedName: MockoutProject.suggestedFileName(),
      types: [{ description: 'Mockout project', accept: { 'application/json': ['.json'] } }],
    });
    if (revision !== fileConnectionRevision) return;
    if (handle === projectFileHandle && !asNew) {
      if (!reconnectFileButton.hidden) { showNotice('Reconnect the file before saving.'); return; }
      if (automatic && await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
        if (revision === fileConnectionRevision) setProjectFileHandle(handle, { remember: false, needsPermission: true, canRead: true });
        return;
      }
      if (revision !== fileConnectionRevision) return;
      if (overwriteStamp !== null) {
        const file = await handle.getFile();
        if (revision !== fileConnectionRevision) return;
        if (file.lastModified !== overwriteStamp) { await checkExternalFile(); return; }
      } else if (await checkExternalFile() || fileLocked || revision !== fileConnectionRevision) return;
    }
    if (automatic && (gesture || placement || textEditor)) return;
    const savedState = snapshot();
    const contents = JSON.stringify(MockoutProject.forExport(state), null, 2);
    fileWriting = true;
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
    const file = await handle.getFile();
    if (revision === fileConnectionRevision) await setProjectFileHandle(handle, { file, baseline: savedState });
  } catch (error) {
    if (revision !== fileConnectionRevision) return;
    if (error.name === 'NotAllowedError' && projectFileHandle) {
      setProjectFileHandle(projectFileHandle, { remember: false, needsPermission: true });
    } else if (error.name !== 'AbortError' || automatic) {
      fileSaveError = error.message;
      showNotice(`Could not save project: ${error.message}`);
    }
  } finally {
    fileWriting = false;
    fileSaving = false;
    checkExternalFile();
    queueFileSave();
  }
}
document.querySelector('#save-button').addEventListener('click', () => saveProject());
const saveAsButton = document.querySelector('#save-as-button');
if (window.showSaveFilePicker) saveAsButton.addEventListener('click', () => saveProject(true));
else saveAsButton.remove();
function newBlank() {
  closeProjectMenu();
  setProjectFileHandle(null);
  change(() => {
    state = freshState();
    selectOnly(null);
    inspectorOpen = false;
    isolatedCopyIds = null;
    focusProject(state.boxes);
  });
  render();
  workspace.focus();
}
document.querySelector('#new-blank-button').addEventListener('click', newBlank);
async function resetEverything() {
  if (placement) return;
  closeProjectMenu();
  let loaded;
  try { loaded = await fetchWelcomeProject(); }
  catch (error) { showNotice(`Could not load Welcome example: ${error.message}`); return; }
  try { MockoutProject.reset(localStorage, STORAGE_KEY); }
  catch { showNotice('Could not clear saved data. Nothing was reset.'); return; }
  state = loaded;
  setProjectFileHandle(null);
  savedProjectIssue = '';
  undoStack.length = 0;
  redoStack.length = 0;
  selectOnly(null);
  inspectorOpen = false;
  activePropertySection = 'shape';
  lastPropertyFocus.clear();
  isolatedCopyIds = null;
  placement = null;
  gesture = null;
  tool = 'select';
  focusProject(state.boxes);
  notice.hidden = true;
  recoveryActions.hidden = true;
  workspace.focus();
  persist();
  render();
}
for (const button of document.querySelectorAll('.hold-action')) {
  let timer = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    button.classList.remove('holding');
  };
  const start = () => {
    if (timer || button.disabled) return;
    button.classList.add('holding');
    timer = setTimeout(() => { cancel(); resetEverything(); }, 1200);
  };
  button.addEventListener('pointerdown', event => { if (event.button === 0) start(); });
  button.addEventListener('pointerleave', cancel);
  button.addEventListener('pointercancel', cancel);
  window.addEventListener('pointerup', cancel);
  button.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    start();
  });
  button.addEventListener('keyup', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  });
  button.addEventListener('blur', cancel);
  button.addEventListener('click', event => event.preventDefault());
}
document.querySelector('#download-saved-button').addEventListener('click', () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) { showNotice('No saved data was found.'); return; }
    const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mockout-saved-data-backup.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { showNotice('Could not download saved data. It was left untouched.'); }
});

function previewHTML(css) {
  const margin = 20;
  const left = Math.min(...state.boxes.map(box => box.x));
  const top = Math.min(...state.boxes.map(box => box.y));
  const right = Math.max(...state.boxes.map(box => box.x + box.w));
  const bottom = Math.max(...state.boxes.map(box => box.y + box.h));
  const boxes = [...canvas.querySelectorAll('.box')].map(element => {
    const box = state.boxes.find(item => item.id === Number(element.dataset.id));
    const copy = element.cloneNode(true);
    copy.classList.remove('selected', 'drawing', 'placing');
    copy.querySelectorAll('.handle').forEach(handle => handle.remove());
    copy.style.left = `${box.x - left + margin}px`;
    copy.style.top = `${box.y - top + margin}px`;
    return copy.outerHTML;
  }).join('\n');
  const width = right - left + margin * 2;
  const height = bottom - top + margin * 2;
  const fontLinks = fonts.stylesheets(state.boxes)
    .map(url => `<link rel="stylesheet" href="${url.replaceAll('&', '&amp;')}">`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mockout preview</title>
${fontLinks}
<style>${css}</style>
<style>
  :root, body { background: ${canvasColor('background')}; }
  body { min-height: 100vh; display: flex; }
  #mock { position: relative; flex: none; width: ${width}px; height: ${height}px; margin: auto; }
  .box { cursor: default; }
</style>
</head>
<body><main id="mock" style="background-color: ${canvasColor('background')}">${boxes}</main></body>
</html>`;
}

async function openPreview() {
  if (!state.boxes.length) {
    showNotice('Draw a box before opening a preview.');
    return;
  }
  const tab = window.open('', '_blank');
  if (!tab) {
    showNotice('Allow pop-ups to open the preview.');
    return;
  }
  try {
    const cssUrl = new URL('style.css', location.href);
    cssUrl.searchParams.set('v', Date.now().toString(36));
    const response = await fetch(cssUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load CSS (${response.status}).`);
    const html = previewHTML(await response.text());
    tab.location.replace(URL.createObjectURL(new Blob([html], { type: 'text/html' })));
    if (savedProjectIssue) showNotice(savedProjectIssue);
    else if (!fileLocked) notice.hidden = true;
  } catch (error) {
    tab.close();
    showNotice(`Could not open preview: ${error.message}`);
  }
}
document.querySelector('#preview-button').addEventListener('click', openPreview);
async function chooseProjectFile() {
  if (!window.showOpenFilePicker) { document.querySelector('#open-file').click(); return; }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Mockout project', accept: { 'application/json': ['.json'] } }],
    });
    if (handle) await openProjectFile(await handle.getFile(), handle);
  } catch (error) {
    if (error.name !== 'AbortError') showNotice(`Could not open project: ${error.message}`);
  }
}
document.querySelector('#open-button').addEventListener('click', chooseProjectFile);
async function openProjectFile(file, handle = null) {
  if (placement) return;
  try {
    const loaded = JSON.parse(await file.text());
    if (!validProject(loaded)) throw new Error('This is not a Mockout project.');
    change(() => { state = loaded; selectOnly(null); inspectorOpen = false; focusProject(state.boxes); });
    if (savedProjectIssue) showNotice(savedProjectIssue);
    else notice.hidden = true;
    await setProjectFileHandle(handle, { file });
    undoStack.length = 0;
    redoStack.length = 0;
    render();
  } catch (error) {
    showNotice(`Could not open project: ${error.message}`);
  }
}

document.querySelector('#open-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  await openProjectFile(file);
  event.target.value = '';
});

document.addEventListener('dragover', event => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = placement ? 'none' : 'copy';
});

document.addEventListener('drop', async event => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  if (placement) return;
  if (event.dataTransfer.files.length !== 1) {
    showNotice('Drop one JSON project file at a time.');
    return;
  }
  const file = event.dataTransfer.files[0];
  try {
    const item = [...event.dataTransfer.items].find(item => item.kind === 'file');
    const handle = await item?.getAsFileSystemHandle?.();
    if (handle?.kind === 'directory') {
      showNotice('Drop one JSON project file at a time.');
      return;
    }
    await openProjectFile(file, handle || null);
  } catch (error) {
    showNotice(`Could not open project: ${error.message}`);
  }
});

focusProject(state.boxes);
render();
if (savedProjectIssue) {
  showNotice(savedProjectIssue);
}
if (firstLoad) loadWelcome(true);
if (!savedProjectIssue && window.showOpenFilePicker) restoreFileConnection();
