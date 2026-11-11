import previewCss from '../style.css?inline';
import { toBlob } from 'html-to-image';
import MockoutProject from '../core/project.js';
import MockoutSelection from '../core/selection.js';
import MockoutPlacement from '../core/placement.js';

export function createController({ model, elements, actions, events, ui }) {
  const themeMedia = matchMedia('(prefers-color-scheme: dark)');
  const modalOpen = () => model.dialog !== null;
  let exportingPNG = false;
  const toolbarMenus = [
    { menu: elements.projectMenu, holder: elements.projectMenuHolder },
  ];
  function closeToolbarMenu(item, focusCanvas = false) {
    model.projectMenuOpen = false;
    publishToolbar();
    if (focusCanvas) elements.workspace.focus();
  }
  function closeProjectMenu() { closeToolbarMenu(toolbarMenus[0]); }
  function toggleToolbarMenu(item) {
    const opening = !model.projectMenuOpen;
    for (const other of toolbarMenus) closeToolbarMenu(other);
    if (!opening) { elements.workspace.focus(); return; }
    model.projectMenuOpen = true;
    publishToolbar();
    (item.menu.querySelector('[aria-pressed="true"]') || item.menu.querySelector('button:not(:disabled)'))?.focus();
  }
  function publishToolbar() {
    ui.update({ toolbar: { menuOpen: model.projectMenuOpen, helpOpen: model.helpOpen, exportingPNG, theme: document.documentElement.dataset.uiTheme || 'light' } });
  }
  function syncThemeButton() {
    publishToolbar();
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim() || '#ca5e11';
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.uiTheme = theme;
    syncThemeButton();
    try { localStorage.setItem('mockout-ui-theme', theme); }
    catch { /* The selected theme still applies for this session. */ }
    actions.render();
  }
  function toggleTheme() {
    setTheme(document.documentElement.dataset.uiTheme === 'dark' ? 'light' : 'dark');
  }
  function focusProject(boxes) {
    model.view.zoom = 1;
    model.view.x = 0;
    model.view.y = 0;
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
      - elements.workspace.getBoundingClientRect().top + 20;
    const availableHeight = Math.max(1, elements.workspace.clientHeight - top - 24);
    model.view.zoom = Math.max(0.2, Math.min(1,
      (elements.workspace.clientWidth - 48) / (maxX - minX), availableHeight / (maxY - minY)));
    model.view.x = (elements.workspace.clientWidth - (maxX - minX) * model.view.zoom) / 2 - minX * model.view.zoom;
    model.view.y = top + (availableHeight - (maxY - minY) * model.view.zoom) / 2 - minY * model.view.zoom;
  }
  function persist() {
    try { MockoutProject.persist(localStorage, actions.STORAGE_KEY, model.project, model.savedProjectIssue); }
    catch { /* File save remains available. */ }
    actions.queueFileSave();
  }
  function commit(before) {
    if (before === actions.snapshot()) return;
    model.undoStack.push(before);
    if (model.undoStack.length > 100) model.undoStack.shift();
    model.redoStack.length = 0;
    persist();
    actions.render();
  }
  function change(fn) {
    const before = actions.snapshot();
    fn();
    commit(before);
  }
  function point(event) {
    return MockoutPlacement.worldPoint(event, elements.workspace.getBoundingClientRect(), model.view);
  }
  function newBox(x, y) {
    const style = model.project.lastStyle ?? (model.project.boxes.length ? actions.styleOf(model.project.boxes.at(-1)) : actions.initialStyle(model.project.swatches));
    return {
      id: model.project.nextId++, x, y, w: actions.minimum(), h: actions.minimum(), text: '',
      ...style, ...actions.boxStyle.copy(style),
    };
  }
  function dragTargets(box, solo, resizing) {
    if (solo) return [{ ...box }];
    const selected = actions.selectedBoxes();
    if (resizing || (model.isolatedCopyIds && selected.length === model.isolatedCopyIds.size
      && selected.every(item => model.isolatedCopyIds.has(item.id)))) return selected.map(item => ({ ...item }));
    const ids = new Set(selected.map(item => item.id));
    for (const parent of selected) {
      for (const child of model.project.boxes) {
        if (child.id !== parent.id && child.x >= parent.x && child.y >= parent.y
          && child.x + child.w <= parent.x + parent.w
          && child.y + child.h <= parent.y + parent.h) ids.add(child.id);
      }
    }
    return model.project.boxes.filter(item => ids.has(item.id)).map(item => ({ ...item }));
  }
  function startCopyPlacement(originals, cursor) {
    if (!originals?.length || model.gesture) return;
    closeProjectMenu();
    const previous = {
      before: actions.snapshot(), selectedIds: new Set(model.selectedIds), selectedId: model.selectedId,
      inspectorOpen: model.inspectorOpen, tool: model.tool, isolatedCopyIds: model.isolatedCopyIds,
    };
    const { x: dx, y: dy } = MockoutPlacement.duplicateOffset(originals[0], cursor, model.project.grid);
    const copies = originals.map(box => ({
      ...box, id: model.project.nextId++, x: box.x + dx, y: box.y + dy,
    }));
    model.project.boxes.push(...copies);
    model.selectedIds = new Set(copies.map(box => box.id));
    model.selectedId = copies[0].id;
    model.inspectorOpen = false;
    model.tool = 'select';
    model.isolatedCopyIds = null;
    actions.rememberStyle(copies[0]);
    model.placement = {
      ...previous, ids: new Set(model.selectedIds), firstId: copies[0].id,
    };
    model.lastBoxClick = null;
    elements.workspace.focus();
    actions.render();
  }
  function startDuplicatePlacement() {
    const source = actions.selectedBoxes();
    if (source.length) startCopyPlacement(dragTargets(source[0], false, false), null);
  }
  function copySelection() {
    const source = actions.selectedBoxes();
    if (source.length) model.copiedBoxes = dragTargets(source[0], false, false);
  }
  function startPastePlacement() {
    const cursor = model.pointerPosition && point({ clientX: model.pointerPosition.x, clientY: model.pointerPosition.y });
    startCopyPlacement(model.copiedBoxes, cursor);
  }
  function shiftPlacement(dx, dy) {
    for (const box of model.project.boxes) {
      if (!model.placement.ids.has(box.id)) continue;
      box.x += dx;
      box.y += dy;
    }
    actions.render();
  }
  function movePlacement(clientX, clientY) {
    const first = model.project.boxes.find(box => box.id === model.placement.firstId);
    const cursor = point({ clientX, clientY });
    const { x: dx, y: dy } = MockoutPlacement.duplicateOffset(first, cursor, model.project.grid);
    shiftPlacement(dx, dy);
  }
  function finishPlacement(save) {
    const current = model.placement;
    model.placement = null;
    if (save) {
      model.isolatedCopyIds = current.ids;
      commit(current.before);
    } else {
      model.project = JSON.parse(current.before);
      model.selectedIds = current.selectedIds;
      model.selectedId = current.selectedId;
      model.inspectorOpen = current.inspectorOpen;
      model.tool = current.tool;
      model.isolatedCopyIds = current.isolatedCopyIds;
      actions.render();
    }
    elements.workspace.focus();
    actions.queueFileSave();
  }
  const containsBox = MockoutSelection.containsBox;
  function overlapsBox(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x
      && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function arrangeStack(movingIds = []) {
    const moving = new Set(movingIds);
    if (moving.size && model.project.boxes.some(a => moving.has(a.id)
      && model.project.boxes.some(b => !moving.has(b.id) && overlapsBox(a, b)))) {
      model.project.boxes = [
        ...model.project.boxes.filter(box => !moving.has(box.id)),
        ...model.project.boxes.filter(box => moving.has(box.id)),
      ];
    }
    const shouldStackBehind = (parent, child) => containsBox(parent, child)
      && (!moving.has(parent.id) || moving.has(child.id));
    for (;;) {
      const parentIndex = model.project.boxes.findIndex((parent, i) =>
        model.project.boxes.some((child, j) => j < i && shouldStackBehind(parent, child)));
      if (parentIndex < 0) break;
      const [parent] = model.project.boxes.splice(parentIndex, 1);
      const childIndex = model.project.boxes.findIndex(child => shouldStackBehind(parent, child));
      model.project.boxes.splice(childIndex, 0, parent);
    }
  }
  function setTool(next) {
    if (model.inspectorOpen && model.inspectorKind === 'box' && actions.styleSections.includes(model.activePropertySection)) {
      model.inspectorOpen = false;
      actions.resetInspectorView();
    }
    model.tool = next;
    model.lastBoxClick = null;
    actions.render();
    elements.workspace.focus();
  }
  function toggleHelp() {
    model.helpOpen = !model.helpOpen;
    publishToolbar();
  }
  const aiPrompts = {
    install: 'Install or update the Mockout skill from https://github.com/DannyBen/mockout/tree/master/public/skills/mockout. Then help me create or edit a mockup through a shared project file.',
    quick: 'Read and follow https://mockout.sector-seven.com/skills/mockout/SKILL.md for this conversation. Then help me create or edit a mockup through a shared project file.',
  };
  async function fetchWelcomeProject() {
    const response = await fetch('welcome.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const loaded = await response.json();
    if (!actions.validProject(loaded)) throw new Error('The Welcome project is invalid.');
    return loaded;
  }
  async function loadWelcome(first = false) {
    if (model.project.boxes.length || model.savedProjectIssue) return;
    try {
      const loaded = await fetchWelcomeProject();
      if (model.project.boxes.length || model.savedProjectIssue) return;
      if (first && localStorage.getItem(actions.STORAGE_KEY) !== null) return;
      change(() => {
        model.project = loaded;
        actions.selectOnly(null);
        model.inspectorOpen = false;
        focusProject(model.project.boxes);
      });
      if (first) { model.undoStack.length = 0; model.redoStack.length = 0; }
      model.helpOpen = false;
      publishToolbar();
      elements.workspace.focus();
    } catch (error) {
      actions.showNotice(`Could not load Welcome example: ${error.message}`);
    }
  }
  function startCanvasPan(event) {
    model.gesture = { kind: 'pan', startX: event.clientX, startY: event.clientY, x: model.view.x, y: model.view.y };
    elements.workspace.setPointerCapture(event.pointerId);
    actions.render();
    event.preventDefault();
  }
  function endGesture(event) {
    if (!model.gesture) return;
    const { before, kind } = model.gesture;
    if (kind === 'marquee' && model.gesture.clickId && !model.gesture.end) {
      if (model.selectedIds.has(model.gesture.clickId)) model.selectedIds.delete(model.gesture.clickId);
      else model.selectedIds.add(model.gesture.clickId);
      model.selectedId = model.selectedIds.values().next().value ?? null;
    }
    if ((kind === 'move' || (kind === 'draw' && model.gesture.id === null && model.gesture.hitId)) && before === actions.snapshot()) {
      model.lastBoxClick = { id: model.gesture.hitId || model.gesture.id, ...(model.gesture.clickPoint || model.gesture.start), time: event.timeStamp };
    } else {
      model.lastBoxClick = null;
    }
    if (before && before !== actions.snapshot() && ['draw', 'move', 'resize'].includes(kind)) {
      arrangeStack(kind === 'move' ? model.gesture.originals.map(box => box.id) : []);
    }
    model.gesture = null;
    if (elements.workspace.hasPointerCapture(event.pointerId)) elements.workspace.releasePointerCapture(event.pointerId);
    if (before) commit(before);
    actions.render();
    actions.queueFileSave();
  }
  function editText(id) {
    const box = model.project.boxes.find(b => b.id === id);
    if (!box) return;
    actions.selectOnly(id);
    const before = actions.snapshot();
    model.textEditor = true;
    actions.render();
    const editor = elements.canvas.querySelector(`.box[data-id="${id}"] .box-label`);
    model.textEditor = editor;
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
      model.selectedId = id;
      model.textEditor = null;
      if (save) commit(before);
      actions.render();
      actions.queueFileSave();
    };
    events.on(editor, 'blur', () => finish(true));
    events.on(editor, 'keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); }
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); finish(true); }
      if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); finish(true); cycleSelection(event.shiftKey ? -1 : 1); }
    });
  }
  function deleteSelected() {
    if (!model.selectedIds.size) return;
    change(() => {
      model.project.boxes = model.project.boxes.filter(b => !model.selectedIds.has(b.id));
      actions.selectOnly(null);
      model.inspectorOpen = false;
    });
  }
  function undo() {
    if (!model.undoStack.length) return;
    const wasEmpty = !model.project.boxes.length;
    model.isolatedCopyIds = null;
    model.redoStack.push(actions.snapshot());
    model.project = JSON.parse(model.undoStack.pop());
    if (wasEmpty !== !model.project.boxes.length) focusProject(model.project.boxes);
    model.selectedIds = new Set([...model.selectedIds].filter(id => model.project.boxes.some(b => b.id === id)));
    model.selectedId = model.selectedIds.values().next().value ?? null;
    persist();
    actions.render();
  }
  function redo() {
    if (!model.redoStack.length) return;
    const wasEmpty = !model.project.boxes.length;
    model.isolatedCopyIds = null;
    model.undoStack.push(actions.snapshot());
    model.project = JSON.parse(model.redoStack.pop());
    if (wasEmpty !== !model.project.boxes.length) focusProject(model.project.boxes);
    model.selectedIds = new Set([...model.selectedIds].filter(id => model.project.boxes.some(b => b.id === id)));
    model.selectedId = model.selectedIds.values().next().value ?? null;
    persist();
    actions.render();
  }
  function zoomAt(factor, clientX, clientY) {
    const rect = elements.workspace.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const worldX = (x - model.view.x) / model.view.zoom;
    const worldY = (y - model.view.y) / model.view.zoom;
    const next = Math.max(0.2, Math.min(20, model.view.zoom * factor));
    model.view.x = x - worldX * next;
    model.view.y = y - worldY * next;
    model.view.zoom = next;
    actions.render();
  }
  function cycleSelection(step) {
    if (!model.project.boxes.length) return;
    const boxes = [...model.project.boxes].sort((a, b) => a.id - b.id);
    const currentIndex = boxes.findIndex(box => box.id === model.selectedId);
    const nextIndex = currentIndex < 0
      ? (step > 0 ? 0 : boxes.length - 1)
      : (currentIndex + step + boxes.length) % boxes.length;
    const best = boxes[nextIndex];
    actions.selectOnly(best.id);
    model.inspectorOpen = false;
    const margin = 32;
    const left = model.view.x + best.x * model.view.zoom;
    const top = model.view.y + best.y * model.view.zoom;
    const right = left + best.w * model.view.zoom;
    const bottom = top + best.h * model.view.zoom;
    if (left < margin) model.view.x += margin - left;
    else if (right > elements.workspace.clientWidth - margin) model.view.x -= right - elements.workspace.clientWidth + margin;
    if (top < margin) model.view.y += margin - top;
    else if (bottom > elements.workspace.clientHeight - margin) model.view.y -= bottom - elements.workspace.clientHeight + margin;
    elements.workspace.focus();
    actions.render();
  }
  function panCanvasWithWheel(event) {
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (model.textEditor) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? elements.workspace.clientHeight : 1;
    const panX = (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * unit;
    const panY = event.shiftKey ? 0 : event.deltaY * unit;
    model.view.x -= panX;
    model.view.y -= panY;
    if (model.placement) {
      shiftPlacement(panX / model.view.zoom, panY / model.view.zoom);
    } else actions.render();
  }
  function newBlank() {
    closeProjectMenu();
    actions.setProjectFileHandle(null);
    change(() => {
      model.project = actions.freshState();
      actions.selectOnly(null);
      model.inspectorOpen = false;
      model.isolatedCopyIds = null;
      focusProject(model.project.boxes);
    });
    actions.render();
    elements.workspace.focus();
  }
  async function resetEverything() {
    if (model.placement) return;
    closeProjectMenu();
    let loaded;
    try { loaded = await fetchWelcomeProject(); }
    catch (error) { actions.showNotice(`Could not load Welcome example: ${error.message}`); return; }
    try { MockoutProject.reset(localStorage, actions.STORAGE_KEY); }
    catch { actions.showNotice('Could not clear saved data. Nothing was reset.'); return; }
    model.project = loaded;
    actions.setProjectFileHandle(null);
    model.savedProjectIssue = '';
    model.undoStack.length = 0;
    model.redoStack.length = 0;
    actions.selectOnly(null);
    model.inspectorOpen = false;
    model.activePropertySection = 'box';
    model.activeCanvasSection = 'canvas';
    model.lastPropertyFocus.clear();
    model.isolatedCopyIds = null;
    model.placement = null;
    model.gesture = null;
    model.tool = 'select';
    focusProject(model.project.boxes);
    actions.hideNotice();
    elements.workspace.focus();
    persist();
    actions.render();
  }
  function mockNode() {
    const margin = 20;
    const left = Math.min(...model.project.boxes.map(box => box.x));
    const top = Math.min(...model.project.boxes.map(box => box.y));
    const right = Math.max(...model.project.boxes.map(box => box.x + box.w));
    const bottom = Math.max(...model.project.boxes.map(box => box.y + box.h));
    const mock = document.createElement('main');
    mock.id = 'mock';
    Object.assign(mock.style, {
      position: 'relative', flex: 'none', width: `${right - left + margin * 2}px`,
      height: `${bottom - top + margin * 2}px`, backgroundColor: actions.canvasColor('background'),
    });
    for (const element of elements.canvas.querySelectorAll('.box')) {
      const box = model.project.boxes.find(item => item.id === Number(element.dataset.id));
      const copy = element.cloneNode(true);
      copy.classList.remove('selected', 'drawing', 'placing', 'editing-style');
      copy.querySelectorAll('.handle').forEach(handle => handle.remove());
      copy.style.left = `${box.x - left + margin}px`;
      copy.style.top = `${box.y - top + margin}px`;
      mock.append(copy);
    }
    return mock;
  }
  function previewHTML(css) {
    const fontLinks = actions.fonts.stylesheets(model.project.boxes)
      .map(url => `<link rel="stylesheet" crossorigin="anonymous" href="${url.replaceAll('&', '&amp;')}">`).join('\n');
    return `<!doctype html>
  <html lang="en">
  <head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mockout preview</title>
  ${fontLinks}
  <style>${css}</style>
  <style>
    :root, body { background: ${actions.canvasColor('background')}; }
    body { min-height: 100vh; display: flex; }
    #mock { margin: auto; }
    .box { cursor: default; }
  </style>
  </head>
  <body>${mockNode().outerHTML}</body>
  </html>`;
  }
  async function openPreview() {
    if (!model.project.boxes.length) {
      actions.showNotice('Draw a box before opening a preview.');
      return;
    }
    const tab = window.open('', '_blank');
    if (!tab) {
      actions.showNotice('Allow pop-ups to open the preview.');
      return;
    }
    try {
      const html = previewHTML(previewCss);
      tab.location.replace(URL.createObjectURL(new Blob([html], { type: 'text/html' })));
      if (model.savedProjectIssue) actions.showNotice(model.savedProjectIssue);
      else if (!model.fileLocked) actions.hideNotice();
    } catch (error) {
      tab.close();
      actions.showNotice(`Could not open preview: ${error.message}`);
    }
  }

  async function exportPNG() {
    if (exportingPNG) return;
    if (!model.project.boxes.length) {
      actions.showNotice('Draw a box before exporting a PNG.');
      return;
    }
    exportingPNG = true;
    closeProjectMenu();
    let container;
    try {
      const mock = mockNode();
      const name = MockoutProject.suggestedFileName().replace(/\.json$/, '.png');
      // Request the picker before rendering so the click's user activation is kept.
      const handle = window.showSaveFilePicker ? await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
      }) : null;
      container = document.createElement('div');
      Object.assign(container.style, { position: 'fixed', left: '-100000px', top: '0' });
      container.setAttribute('aria-hidden', 'true');
      container.append(mock);
      document.body.append(container);
      // Stylesheets must arrive before fonts.ready can account for their fonts.
      await actions.waitForFonts();
      const blob = await toBlob(mock, { pixelRatio: 2, skipAutoScale: true });
      if (!blob) throw new Error('The browser could not render the image.');
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      if (error.name !== 'AbortError') actions.showNotice(`Could not export PNG: ${error.message}`);
    } finally {
      container?.remove();
      exportingPNG = false;
      publishToolbar();
    }
  }

  function openAI() {
    closeProjectMenu();
    clearTimeout(model.aiCopyTimer);
    model.aiCopyStatus = '';
    actions.openDialog('ai');
  }
  async function copyAIPrompt(kind) {
    clearTimeout(model.aiCopyTimer);
    try {
      await navigator.clipboard.writeText(aiPrompts[kind]);
      if (model.dialog !== 'ai') return;
      model.aiCopyStatus = 'Copied. Paste it into your AI app.';
      model.aiCopyTimer = setTimeout(() => { model.aiCopyStatus = ''; actions.publishPresentation(); }, 2500);
    } catch {
      if (model.dialog !== 'ai') return;
      model.aiCopyStatus = window.isSecureContext ? 'Could not copy. Allow clipboard access and try again.'
        : 'Clipboard access needs HTTPS. Open https://mockout.sector-seven.com/.';
    }
    actions.publishPresentation();
  }
  function downloadSavedData() {
        try {
          const raw = localStorage.getItem(actions.STORAGE_KEY);
          if (raw === null) { actions.showNotice('No saved data was found.'); return; }
          const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'mockout-saved-data-backup.txt';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch { actions.showNotice('Could not download saved data. It was left untouched.'); }
  }

  return {
    actions: {
      modalOpen, toolbarMenus, closeProjectMenu, toggleToolbarMenu, toggleTheme, focusProject, commit,
      change, finishPlacement, setTool, toggleHelp, loadWelcome, undo, redo, newBlank, resetEverything,
      openPreview, exportPNG, openAI, copyAIPrompt, downloadSavedData
    },
    init() {
      events.on(themeMedia, 'change', event => {
        if (!document.documentElement.dataset.theme) {
          document.documentElement.dataset.uiTheme = event.matches ? 'dark' : 'light';
          syncThemeButton();
          actions.render();
        }
      });
      syncThemeButton();
      events.on(document, 'pointerdown', event => {
        for (const item of toolbarMenus) {
          if (!item.holder.contains(event.target)) closeToolbarMenu(item);
        }
      });
      events.on(elements.workspace, 'contextmenu', event => {
        if (model.fileLocked) { event.preventDefault(); return; }
        if (model.placement) { event.preventDefault(); return; }
        const boxElement = event.target.closest('.box');
        event.preventDefault();
        if (boxElement) actions.openInspector(Number(boxElement.dataset.id));
        else actions.openCanvasInspector({ x: event.clientX, y: event.clientY });
      });
      events.on(document, 'pointerdown', event => {
        model.pointerPosition = { x: event.clientX, y: event.clientY };
        if (event.button === 0 && model.inspectorOpen && model.inspectorKind === 'canvas'
          && !elements.inspector.contains(event.target)) actions.closeInspector();
      });
      events.on(document, 'pointermove', event => {
        model.pointerPosition = { x: event.clientX, y: event.clientY };
      });
      events.on(elements.inspector, 'pointerdown', event => {
        if (model.gesture || model.placement || model.textEditor) return;
        if (event.button !== 1 && !(event.button === 0 && model.spaceDown)) return;
        event.stopPropagation();
        startCanvasPan(event);
      }, { capture: true });
      events.on(elements.workspace, 'pointerdown', event => {
        if (event.target.closest('.style-marker') && event.button === 0 && !model.spaceDown) return;
        if (model.fileLocked && event.button !== 1 && !model.spaceDown) { event.preventDefault(); return; }
        if (elements.inspector.contains(document.activeElement)) document.activeElement.blur();
        if (model.placement) {
          event.preventDefault();
          if (event.button === 0) {
            finishPlacement(true);
          }
          return;
        }
        if (model.textEditor || (event.button !== 0 && event.button !== 1)) return;
        const boxElement = event.target.closest('.box');
        const handle = event.target.dataset.handle || '';
        const p = point(event);
        const boxId = boxElement ? Number(boxElement.dataset.id) : handle ? model.selectedId : null;
        if (event.button === 1 || model.spaceDown) {
          startCanvasPan(event);
          return;
        } else if (boxId && !handle && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && model.lastBoxClick?.id === boxId
          && event.timeStamp - model.lastBoxClick.time < 450
          && Math.hypot(p.x - model.lastBoxClick.x, p.y - model.lastBoxClick.y) < 7 / model.view.zoom) {
          model.lastBoxClick = null;
          event.preventDefault();
          editText(boxId);
          return;
        } else {
          model.lastBoxClick = null;
          if (event.shiftKey && !event.altKey) {
            model.isolatedCopyIds = null;
            model.gesture = { kind: 'marquee', start: p, end: null, base: new Set(model.selectedIds), clickId: boxId };
          } else if (model.tool === 'box' && !(boxId && (event.altKey || event.ctrlKey || event.metaKey))) {
            model.gesture = { kind: 'draw', start: { x: actions.snap(p.x), y: actions.snap(p.y) }, clickPoint: p,
              before: actions.snapshot(), id: null, hitId: boxId };
          } else if (boxId) {
            const hit = model.project.boxes.find(b => b.id === boxId);
            const resizing = Boolean(handle);
            const box = !resizing && !event.altKey && (event.ctrlKey || event.metaKey)
              ? MockoutSelection.nearestContainer(model.project.boxes, hit) ?? hit : hit;
            if (!model.selectedIds.has(box.id)) {
              actions.selectOnly(box.id);
              const choosingSection = model.inspectorView === 'sections';
              actions.resetInspectorView();
              if (choosingSection) model.inspectorView = 'sections';
            }
            model.gesture = {
              kind: resizing ? 'resize' : 'move',
              handle,
              start: p, original: { ...box },
              originals: dragTargets(box, event.altKey, resizing),
              before: actions.snapshot(), id: box.id,
            };
          } else {
            model.isolatedCopyIds = null;
            const base = event.shiftKey ? new Set(model.selectedIds) : new Set();
            model.selectedIds = new Set(base);
            model.selectedId = model.selectedIds.values().next().value ?? null;
            if (!event.shiftKey && model.inspectorKind !== 'canvas') model.inspectorOpen = false;
            model.gesture = { kind: 'marquee', start: p, end: null, base };
          }
        }
        elements.workspace.setPointerCapture(event.pointerId);
        actions.render();
        event.preventDefault();
      });
      events.on(elements.workspace, 'pointermove', event => {
        if (model.placement) { movePlacement(event.clientX, event.clientY); return; }
        if (!model.gesture) return;
        if (model.gesture.kind === 'pan') {
          model.view.x = model.gesture.x + event.clientX - model.gesture.startX;
          model.view.y = model.gesture.y + event.clientY - model.gesture.startY;
          actions.render();
          return;
        }
        const p = point(event);
        if (model.gesture.kind === 'draw') {
          const end = { x: actions.snap(p.x), y: actions.snap(p.y) };
          if (model.gesture.id === null && end.x === model.gesture.start.x && end.y === model.gesture.start.y) return;
          if (model.gesture.id === null) {
            const box = newBox(model.gesture.start.x, model.gesture.start.y);
            model.project.boxes.push(box);
            actions.selectOnly(box.id);
            model.gesture.id = box.id;
          }
          const box = actions.selectedBox();
          box.x = Math.min(model.gesture.start.x, end.x);
          box.y = Math.min(model.gesture.start.y, end.y);
          box.w = Math.max(actions.minimum(), Math.abs(end.x - model.gesture.start.x));
          box.h = Math.max(actions.minimum(), Math.abs(end.y - model.gesture.start.y));
        } else if (model.gesture.kind === 'marquee') {
          if (model.gesture.clickId && !model.gesture.end
            && Math.hypot(p.x - model.gesture.start.x, p.y - model.gesture.start.y) * model.view.zoom < 4) return;
          model.gesture.end = p;
          const left = Math.min(model.gesture.start.x, p.x);
          const right = Math.max(model.gesture.start.x, p.x);
          const top = Math.min(model.gesture.start.y, p.y);
          const bottom = Math.max(model.gesture.start.y, p.y);
          model.selectedIds = new Set(model.gesture.base);
          for (const box of model.project.boxes) {
            if (box.x >= left && box.y >= top && box.x + box.w <= right && box.y + box.h <= bottom) model.selectedIds.add(box.id);
          }
          model.selectedId = model.selectedIds.values().next().value ?? null;
        } else {
          const original = model.gesture.original;
          const dx = p.x - model.gesture.start.x;
          const dy = p.y - model.gesture.start.y;
          if (model.gesture.kind === 'move') {
            const moveX = actions.snap(original.x + dx) - original.x;
            const moveY = actions.snap(original.y + dy) - original.y;
            for (const start of model.gesture.originals) {
              const moved = model.project.boxes.find(item => item.id === start.id);
              moved.x = start.x + moveX;
              moved.y = start.y + moveY;
            }
          } else {
            const h = model.gesture.handle;
            for (const start of model.gesture.originals) {
              const resized = model.project.boxes.find(item => item.id === start.id);
              let left = start.x, top = start.y;
              let right = start.x + start.w, bottom = start.y + start.h;
              if (h.includes('w')) left = Math.min(right - actions.minimum(), actions.snap(start.x + dx));
              if (h.includes('e')) right = Math.max(left + actions.minimum(), actions.snap(start.x + start.w + dx));
              if (h.includes('n')) top = Math.min(bottom - actions.minimum(), actions.snap(start.y + dy));
              if (h.includes('s')) bottom = Math.max(top + actions.minimum(), actions.snap(start.y + start.h + dy));
              Object.assign(resized, { x: left, y: top, w: right - left, h: bottom - top });
            }
          }
        }
        actions.render();
      });
      events.on(elements.workspace, 'pointerup', endGesture);
      events.on(elements.workspace, 'pointercancel', event => {
        if (!model.gesture) return;
        if (model.gesture.before) model.project = JSON.parse(model.gesture.before);
        model.gesture = null;
        model.lastBoxClick = null;
        if (elements.workspace.hasPointerCapture(event.pointerId)) elements.workspace.releasePointerCapture(event.pointerId);
        actions.render();
        actions.queueFileSave();
      });
      events.on(elements.workspace, 'wheel', panCanvasWithWheel, { passive: false });
      events.on(elements.inspector, 'wheel', event => {
        if (event.target.closest('select, input[type="range"]')) return;
        const list = event.target.closest('.dialog-choice-list');
        if (list && list.scrollHeight > list.clientHeight) return;
        panCanvasWithWheel(event);
      }, { passive: false });
      events.on(document, 'wheel', event => {
        if (modalOpen()) return;
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        if (model.textEditor || model.placement) return;
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? elements.workspace.clientHeight : 1;
        zoomAt(Math.exp(-event.deltaY * unit * 0.002), event.clientX, event.clientY);
      }, { passive: false });
      events.on(document, 'keyup', event => {
        if (event.key === 'Alt') {
          model.altDown = false;
          actions.render();
        }
        if (event.code === 'Space' && model.spaceDown) {
          model.spaceDown = false;
          actions.render();
        }
      });
      events.on(window, 'blur', () => {
        model.altDown = false;
        actions.render();
        if (model.spaceDown) { model.spaceDown = false; actions.render(); }
      });
      events.on(document, 'keydown', event => {
        if (modalOpen()) {
          if ((event.ctrlKey || event.metaKey) && ['KeyS', 'KeyO', 'KeyP', 'KeyD', 'KeyE'].includes(event.code)) event.preventDefault();
          return;
        }
        const openMenu = model.projectMenuOpen ? toolbarMenus[0] : null;
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
          model.altDown = true;
          actions.render();
        }
        const ctrl = event.ctrlKey || event.metaKey;
        const digit = /^(?:Digit|Numpad)([0-9])$/.exec(event.code)?.[1];
        const zoomInKey = event.code === 'Equal' || event.code === 'NumpadAdd';
        const zoomOutKey = (event.code === 'Minus' && !event.shiftKey) || event.code === 'NumpadSubtract';
        if (model.fileLocked) {
          const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (direction) {
            event.preventDefault(); model.view.x -= direction[0] * 40; model.view.y -= direction[1] * 40; actions.render(); return;
          }
          const viewing = event.key === 'Escape' || event.code === 'Space' || zoomInKey || zoomOutKey
            || (ctrl && (['KeyO', 'KeyP', 'KeyC', 'KeyA', 'KeyE'].includes(event.code) || digit === '0' || (event.code === 'KeyS' && event.shiftKey)))
            || (!ctrl && !event.altKey && (event.code === 'KeyT' || (event.shiftKey && ['Slash', 'KeyN'].includes(event.code))));
          if (!viewing) { event.preventDefault(); return; }
        }
        if (model.placement) {
          if (event.key === 'Escape') { event.preventDefault(); finishPlacement(false); return; }
          if (event.key === 'Enter') { event.preventDefault(); finishPlacement(true); return; }
          const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (direction && !event.altKey) {
            event.preventDefault();
            const amount = (model.project.grid || 1) * (ctrl ? 5 : 1);
            shiftPlacement(direction[0] * amount, direction[1] * amount);
            return;
          }
          if (ctrl || event.code === 'Space' || event.key === 'Tab' || event.key.length === 1) event.preventDefault();
          return;
        }
        const focus = document.activeElement;
        const sectionMenu = model.inspectorOpen && model.inspectorView === 'sections' && elements.inspector.contains(focus);
        if (!ctrl && !event.shiftKey && /^[1-4]$/.test(digit || '') && !model.textEditor && model.selectedIds.size
          && (event.altKey || sectionMenu)) {
          event.preventDefault();
          if (event.repeat) return;
          if (elements.inspector.contains(focus)) focus.blur();
          model.activePropertySection = elements.propertySections[Number(digit) - 1].id;
          actions.openInspector(model.selectedId, false);
          return;
        }
        if (!ctrl && !event.altKey && !event.shiftKey && event.code === 'Slash' && !model.textEditor
          && !focus.isContentEditable && !/INPUT|SELECT|TEXTAREA/.test(focus.tagName)) {
          event.preventDefault();
          if (event.repeat) return;
          if (model.selectedIds.size) actions.openInspector(model.selectedId, true);
          else actions.openCanvasInspector(null, true);
          return;
        }
        if (ctrl && event.code === 'KeyS') { event.preventDefault(); actions.saveProject(event.shiftKey); return; }
        if (ctrl && event.code === 'KeyO') { event.preventDefault(); actions.chooseProjectFile(); return; }
        if (ctrl && event.code === 'KeyP') { event.preventDefault(); openPreview(); return; }
        if (ctrl && !event.shiftKey && !event.altKey && event.code === 'KeyE') {
          event.preventDefault();
          if (!event.repeat) exportPNG();
          return;
        }
        if (ctrl && event.code === 'KeyD') {
          event.preventDefault();
          if (!model.textEditor) {
            if (elements.inspector.contains(document.activeElement)) document.activeElement.blur();
            if (model.selectedIds.size) startDuplicatePlacement();
          }
          return;
        }
        if (ctrl && !event.altKey && !event.shiftKey && (event.code === 'KeyC' || event.code === 'KeyV')) {
          const focus = document.activeElement;
          if (model.textEditor || focus.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(focus.tagName)) return;
          if (event.code === 'KeyC' && model.selectedIds.size) {
            event.preventDefault();
            copySelection();
          } else if (event.code === 'KeyV' && model.copiedBoxes?.length) {
            event.preventDefault();
            if (elements.inspector.contains(focus)) focus.blur();
            startPastePlacement();
          }
          return;
        }
        if (ctrl && ((digit === '0' && !event.shiftKey) || zoomInKey || zoomOutKey)) {
          event.preventDefault();
          if (!model.textEditor) zoomAt(digit === '0' ? 1 / model.view.zoom : zoomOutKey ? 1 / 1.2 : 1.2,
            elements.workspace.clientWidth / 2, elements.workspace.clientHeight / 2);
          return;
        }
        if (model.inspectorOpen && event.key === 'Escape') {
          event.preventDefault();
          if (event.repeat) return;
          if (event.shiftKey || !model.inspectorHistory.length) actions.closeInspector();
          else actions.showInspectorParent();
          return;
        }
        if (actions.styleEditing() && model.inspectorView === 'properties' && event.altKey && !ctrl && !event.shiftKey
          && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault();
          const targets = actions.styleTargets();
          const index = targets.indexOf(actions.styleTarget());
          actions.selectStyleTarget(targets[(index + (event.key === 'ArrowRight' ? 1 : targets.length - 1)) % targets.length]);
          return;
        }
        if (!ctrl && !event.altKey && !event.shiftKey && ['KeyO', 'KeyP'].includes(event.code) && model.selectedIds.size
          && !model.textEditor && !focus.isContentEditable && !/INPUT|SELECT|TEXTAREA/.test(focus.tagName)
          && (!elements.inspector.contains(focus) || model.inspectorView === 'sections')) {
          event.preventDefault();
          const section = event.code === 'KeyP' ? 'padding' : 'border';
          if (actions.styleEditing() && model.activePropertySection === section) actions.closeInspector();
          else { model.activePropertySection = section; model.tool = 'select'; actions.openInspector(model.selectedId, false); }
          return;
        }
        if (event.code === 'Space' && !ctrl && !event.altKey && !model.textEditor
          && !focus.isContentEditable && !/INPUT|SELECT|TEXTAREA/.test(focus.tagName)) {
          event.preventDefault();
          if (!model.spaceDown) { model.spaceDown = true; actions.render(); }
          return;
        }
        if (elements.inspector.contains(document.activeElement) || model.textEditor
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
          model.isolatedCopyIds = null;
          model.selectedIds = new Set(model.project.boxes.map(box => box.id));
          model.selectedId = model.project.boxes[0]?.id ?? null;
          model.inspectorOpen = false;
          model.tool = 'select';
          elements.workspace.focus();
          actions.render();
          return;
        }
        if (event.code === 'Slash' && event.shiftKey && !ctrl && !event.altKey) {
          event.preventDefault();
          if (!event.repeat) toggleHelp();
          return;
        }
        if (ctrl && event.code === 'KeyZ') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
        if (ctrl && event.code === 'KeyY') { event.preventDefault(); redo(); return; }
        if ((zoomInKey || zoomOutKey) && !event.altKey && !ctrl) {
          event.preventDefault();
          zoomAt(zoomOutKey ? 1 / 1.2 : 1.2, elements.workspace.clientWidth / 2, elements.workspace.clientHeight / 2);
          return;
        }
        if (!ctrl && !event.altKey && !event.shiftKey && /^[1-5]$/.test(digit || '')) {
          change(() => { model.project.grid = MockoutProject.gridSizes(model.project)[Number(digit) - 1]; });
          return;
        }
        if (!ctrl && !event.altKey && event.code === 'KeyS') { event.preventDefault(); setTool('select'); return; }
        if (!ctrl && !event.altKey && event.code === 'KeyD') { event.preventDefault(); setTool('box'); return; }
        if ((event.key === 'Delete' || event.key === 'Backspace') && model.selectedIds.size) { event.preventDefault(); deleteSelected(); return; }
        if (event.key === 'Escape') {
          event.preventDefault();
          actions.selectOnly(null);
          actions.render();
          return;
        }
        if (event.key === 'Enter' && !event.altKey && model.selectedIds.size === 1) { event.preventDefault(); editText(model.selectedId); return; }
        if (event.key === 'F2' && model.selectedIds.size === 1) { event.preventDefault(); editText(model.selectedId); return; }
        if (event.key === 'Tab') { event.preventDefault(); cycleSelection(event.shiftKey ? -1 : 1); return; }
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (direction && model.selectedIds.size) {
          event.preventDefault();
          const nudge = (value, axis) => MockoutPlacement.nudge(value, axis, model.project.grid, ctrl ? 5 : 1);
          const anchor = actions.selectedBox();
          const dx = nudge(anchor.x, direction[0]) - anchor.x;
          const dy = nudge(anchor.y, direction[1]) - anchor.y;
          change(() => {
            const targets = event.shiftKey
              ? (event.altKey ? [actions.selectedBox()] : actions.selectedBoxes())
              : dragTargets(actions.selectedBox(), event.altKey, false);
            for (const target of targets) {
              const box = model.project.boxes.find(item => item.id === target.id);
              if (event.shiftKey) {
                if (direction[0]) box.w = Math.max(actions.minimum(), nudge(box.x + box.w, direction[0]) - box.x);
                if (direction[1]) box.h = Math.max(actions.minimum(), nudge(box.y + box.h, direction[1]) - box.y);
              } else {
                box.x += dx;
                box.y += dy;
              }
            }
            if (!event.shiftKey) arrangeStack(targets.map(box => box.id));
          });
          return;
        }
        if (direction && !model.selectedIds.size && !ctrl && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          model.view.x -= direction[0] * 40;
          model.view.y -= direction[1] * 40;
          actions.render();
        }
      });
      focusProject(model.project.boxes);
      actions.render();
      if (model.savedProjectIssue) {
        actions.showNotice(model.savedProjectIssue);
      }
      if (model.firstLoad) loadWelcome(true);
      if (!model.savedProjectIssue && window.showOpenFilePicker) actions.restoreFileConnection();
    },
  };
}
