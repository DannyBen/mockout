const STORAGE_KEY = 'onion-ui-canvas-v1';
const workspace = document.querySelector('#workspace');
const canvas = document.querySelector('#canvas');
const inspector = document.querySelector('#inspector');
const dialog = document.querySelector('#color-dialog');
const toolButtons = [...document.querySelectorAll('[data-tool]')];
const gridButtons = [...document.querySelectorAll('[data-grid]')];
const colorButtons = [...document.querySelectorAll('[data-color-property]')];
const channels = [1, 2, 3].map(n => document.querySelector(`#channel-${n}`));

const freshState = () => ({
  version: 1,
  grid: 10,
  nextId: 4,
  swatches: [
    { id: 's1', name: 'White', color: '#ffffff' },
    { id: 's2', name: 'Ink', color: '#253047' },
    { id: 's3', name: 'Line', color: '#aeb6c5' },
  ],
  boxes: [],
});

function validProject(value) {
  return value && value.version === 1 && [0, 5, 10, 20, 40].includes(value.grid)
    && Number.isInteger(value.nextId) && Array.isArray(value.swatches) && Array.isArray(value.boxes)
    && value.swatches.every(s => typeof s.id === 'string' && typeof s.name === 'string' && /^#[0-9a-f]{6}$/i.test(s.color))
    && value.boxes.every(b => Number.isInteger(b.id) && ['x', 'y', 'w', 'h', 'radius', 'borderWidth'].every(k => Number.isFinite(b[k]))
      && b.w > 0 && b.h > 0 && typeof b.text === 'string'
      && ['paddingX', 'paddingY'].every(k => b[k] === undefined || (Number.isFinite(b[k]) && b[k] >= 0))
      && ['fill', 'textColor', 'borderColor'].every(k => b[k] === null || value.swatches.some(s => s.id === b[k]))
      && ['left', 'center', 'right'].includes(b.alignX) && ['top', 'center', 'bottom'].includes(b.alignY));
}

let state = freshState();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (validProject(saved)) state = saved;
} catch { /* Storage can be unavailable for local files. Save still works. */ }

let selectedId = null;
let selectedIds = new Set();
let gesture = null;
let lastBoxClick = null;
let textEditor = null;
let inspectorOpen = false;
let tool = 'select';
let spaceDown = false;
let altDown = false;
const view = { x: 0, y: 0, zoom: 1 };
let colorTarget = null;
let colorMode = 'rgb';
let editorColor = '#6746b7';
const undoStack = [];
const redoStack = [];

const snapshot = () => JSON.stringify(state);
const selectedBox = () => state.boxes.find(b => b.id === selectedId);
const selectedBoxes = () => state.boxes.filter(b => selectedIds.has(b.id));
const paddingX = box => box.paddingX ?? 3;
const paddingY = box => box.paddingY ?? 3;
function selectOnly(id) {
  selectedId = id;
  selectedIds = id === null ? new Set() : new Set([id]);
}
const swatch = id => state.swatches.find(s => s.id === id);
const colorOf = id => swatch(id)?.color || 'transparent';
const snap = n => state.grid ? Math.round(n / state.grid) * state.grid : Math.round(n);
const minimum = () => state.grid || 5;

function persist() {
  try { localStorage.setItem(STORAGE_KEY, snapshot()); } catch { /* File save remains available. */ }
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

function render() {
  workspace.style.setProperty('--grid-size', `${(state.grid || 10) * view.zoom}px`);
  workspace.style.setProperty('--major-grid-size', `${(state.grid || 10) * view.zoom * 10}px`);
  workspace.style.setProperty('--pan-x', `${view.x}px`);
  workspace.style.setProperty('--pan-y', `${view.y}px`);
  workspace.classList.toggle('grid-off', state.grid === 0);
  workspace.classList.toggle('tool-box', tool === 'box');
  workspace.classList.toggle('panning', spaceDown || gesture?.kind === 'pan');
  workspace.classList.toggle('alt-move', altDown);
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

  canvas.replaceChildren();
  for (const box of state.boxes) {
    const element = document.createElement('div');
    element.className = 'box';
    if (selectedIds.has(box.id)) element.classList.add('selected');
    if (gesture?.kind === 'draw' && gesture.id === box.id) element.classList.add('drawing');
    element.dataset.id = box.id;
    Object.assign(element.style, {
      left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`,
      backgroundColor: colorOf(box.fill), color: colorOf(box.textColor),
      borderColor: colorOf(box.borderColor), borderWidth: `${box.borderWidth}px`,
      borderRadius: `${box.radius}px`, padding: `${paddingY(box)}px ${paddingX(box)}px`,
      justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[box.alignX],
      alignItems: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[box.alignY],
    });
    element.style.setProperty('--box-border-width', `${box.borderWidth}px`);
    const label = document.createElement('span');
    label.className = 'box-label';
    label.textContent = box.text;
    label.style.textAlign = box.alignX;
    element.append(label);

    if (selectedIds.has(box.id) && tool === 'select' && !textEditor) {
      for (const direction of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
        const handle = document.createElement('span');
        handle.className = 'handle';
        handle.dataset.handle = direction;
        element.append(handle);
      }
    }
    canvas.append(element);
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

function renderInspector() {
  const box = selectedIds.size === 1 && inspectorOpen ? selectedBox() : null;
  inspector.hidden = !box;
  if (!box) return;
  for (const [field, value] of Object.entries({
    'box-text': box.text, 'box-width': box.w, 'box-height': box.h,
    'box-radius': box.radius, 'box-border-width': box.borderWidth,
    'box-padding-x': paddingX(box), 'box-padding-y': paddingY(box),
    'box-align-x': box.alignX, 'box-align-y': box.alignY,
  })) {
    const input = document.getElementById(field);
    if (document.activeElement !== input) input.value = value;
  }
  for (const button of colorButtons) {
    const id = box[button.dataset.colorProperty];
    const item = swatch(id);
    button.replaceChildren(colorChip(item?.color), document.createTextNode(item?.name || 'None'));
  }
  const list = document.querySelector('#swatch-list');
  list.replaceChildren();
  for (const item of state.swatches) {
    const row = document.createElement('div');
    row.className = 'swatch-row';
    const button = document.createElement('button');
    button.type = 'button';
    button.title = `Edit ${item.name}; changes every box using it`;
    button.append(colorChip(item.color), document.createTextNode(item.name));
    button.addEventListener('click', () => openColor({ kind: 'edit', id: item.id }));
    const code = document.createElement('code');
    code.textContent = item.color;
    row.append(button, code);
    list.append(row);
  }
  positionInspector();
}

function positionInspector() {
  const box = selectedBox();
  if (!box || inspector.hidden) return;
  const boxRect = [...canvas.querySelectorAll('.box')].find(element => Number(element.dataset.id) === box.id)?.getBoundingClientRect();
  if (!boxRect) return;
  const boxLeft = boxRect.left;
  const boxTop = boxRect.top;
  const width = inspector.offsetWidth;
  const height = inspector.offsetHeight;
  let left = boxRect.right + 12;
  if (left + width > window.innerWidth - 12) left = boxLeft - width - 12;
  inspector.style.left = `${Math.max(12, Math.min(left, window.innerWidth - width - 12))}px`;
  inspector.style.top = `${Math.max(12, Math.min(boxTop, window.innerHeight - height - 12))}px`;
}

window.addEventListener('resize', positionInspector);

function colorChip(color) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  if (color) chip.style.setProperty('--chip-color', color);
  else chip.classList.add('transparent');
  return chip;
}

function point(event) {
  const rect = workspace.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - view.x) / view.zoom,
    y: (event.clientY - rect.top - view.y) / view.zoom,
  };
}

function newBox(x, y) {
  return {
    id: state.nextId++, x, y, w: minimum(), h: minimum(), text: '',
    fill: 's1', textColor: 's2', borderColor: 's3', borderWidth: 1, radius: 0, paddingX: 3, paddingY: 3,
    alignX: 'center', alignY: 'center',
  };
}

function dragTargets(box, solo, resizing) {
  if (solo) return [{ ...box }];
  const selected = selectedBoxes();
  if (resizing) return selected.map(item => ({ ...item }));
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

function setTool(next) {
  tool = next;
  lastBoxClick = null;
  render();
  workspace.focus();
}

for (const button of toolButtons) button.addEventListener('click', () => setTool(button.dataset.tool));

function openInspector(id = selectedId, focus = false) {
  if (id === null) return;
  selectOnly(id);
  inspectorOpen = true;
  render();
  if (focus) document.querySelector('#box-text').focus();
}

workspace.addEventListener('contextmenu', event => {
  const boxElement = event.target.closest('.box');
  if (!boxElement) return;
  event.preventDefault();
  openInspector(Number(boxElement.dataset.id));
});

workspace.addEventListener('pointerdown', event => {
  if (textEditor || (event.button !== 0 && event.button !== 1)) return;
  const boxElement = event.target.closest('.box');
  const p = point(event);
  const boxId = boxElement ? Number(boxElement.dataset.id) : null;
  if (event.button === 1 || spaceDown) {
    gesture = { kind: 'pan', startX: event.clientX, startY: event.clientY, x: view.x, y: view.y };
  } else if (boxId && !event.shiftKey && !event.altKey && lastBoxClick?.id === boxId
    && event.timeStamp - lastBoxClick.time < 450
    && Math.hypot(p.x - lastBoxClick.x, p.y - lastBoxClick.y) < 7 / view.zoom) {
    lastBoxClick = null;
    event.preventDefault();
    editText(boxId);
    return;
  } else {
    lastBoxClick = null;
    if (tool === 'box' && !(event.altKey && boxId)) {
      gesture = { kind: 'draw', start: { x: snap(p.x), y: snap(p.y) }, clickPoint: p,
        before: snapshot(), id: null, hitId: boxId };
    } else if (boxId) {
      if (event.shiftKey && !event.altKey) {
        if (selectedIds.has(boxId)) selectedIds.delete(boxId);
        else selectedIds.add(boxId);
        selectedId = selectedIds.values().next().value ?? null;
        render();
        event.preventDefault();
        return;
      }
      if (!selectedIds.has(boxId)) selectOnly(boxId);
      const box = state.boxes.find(b => b.id === boxId);
      const resizing = Boolean(event.target.dataset.handle);
      gesture = {
        kind: resizing ? 'resize' : 'move',
        handle: event.target.dataset.handle || '',
        start: p, original: { ...box },
        originals: dragTargets(box, event.altKey, resizing),
        before: snapshot(), id: box.id,
      };
    } else {
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
  if ((kind === 'move' || (kind === 'draw' && gesture.id === null && gesture.hitId)) && before === snapshot()) {
    lastBoxClick = { id: gesture.hitId || gesture.id, ...(gesture.clickPoint || gesture.start), time: event.timeStamp };
  } else {
    lastBoxClick = null;
  }
  gesture = null;
  if (workspace.hasPointerCapture(event.pointerId)) workspace.releasePointerCapture(event.pointerId);
  if (before) commit(before);
  render();
}
workspace.addEventListener('pointerup', endGesture);
workspace.addEventListener('pointercancel', event => {
  if (!gesture) return;
  if (gesture.before) state = JSON.parse(gesture.before);
  gesture = null;
  lastBoxClick = null;
  if (workspace.hasPointerCapture(event.pointerId)) workspace.releasePointerCapture(event.pointerId);
  render();
});

function editText(id) {
  const box = state.boxes.find(b => b.id === id);
  if (!box) return;
  selectOnly(id);
  render();
  const before = snapshot();
  const editor = document.createElement('textarea');
  editor.className = 'text-editor';
  editor.value = box.text;
  Object.assign(editor.style, {
    left: `${box.x}px`, top: `${box.y}px`, width: `${Math.max(60, box.w)}px`,
    height: `${Math.max(30, box.h)}px`, color: colorOf(box.textColor),
    backgroundColor: colorOf(box.fill), textAlign: box.alignX,
    padding: `${paddingY(box)}px ${paddingX(box)}px`,
  });
  canvas.append(editor);
  textEditor = editor;
  editor.focus();
  editor.select();
  let finished = false;
  const finish = save => {
    if (finished) return;
    finished = true;
    if (save) box.text = editor.value;
    selectedId = id;
    editor.remove();
    textEditor = null;
    if (save) commit(before);
    render();
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
  ['box-align-x', 'alignX', value => value],
  ['box-align-y', 'alignY', value => value],
]) {
  document.getElementById(id).addEventListener('change', event => {
    if (selectedBox()) change(() => { selectedBox()[key] = transform(event.target.value); });
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
document.querySelector('#delete-button').addEventListener('click', deleteSelected);

for (const button of gridButtons) {
  button.addEventListener('click', () => change(() => { state.grid = Number(button.dataset.grid); }));
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  state = JSON.parse(undoStack.pop());
  selectedIds = new Set([...selectedIds].filter(id => state.boxes.some(b => b.id === id)));
  selectedId = selectedIds.values().next().value ?? null;
  persist();
  render();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  state = JSON.parse(redoStack.pop());
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
  const next = Math.max(0.2, Math.min(5, view.zoom * factor));
  view.x = x - worldX * next;
  view.y = y - worldY * next;
  view.zoom = next;
  render();
}

function cycleSelection(step) {
  if (!state.boxes.length) return;
  const currentIndex = state.boxes.findIndex(box => box.id === selectedId);
  const nextIndex = currentIndex < 0
    ? (step > 0 ? 0 : state.boxes.length - 1)
    : (currentIndex + step + state.boxes.length) % state.boxes.length;
  const best = state.boxes[nextIndex];
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

workspace.addEventListener('wheel', event => {
  if (event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  if (textEditor) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? workspace.clientHeight : 1;
  view.x -= event.deltaX * unit;
  view.y -= event.deltaY * unit;
  render();
}, { passive: false });

document.addEventListener('wheel', event => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  if (textEditor) return;
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
  if (event.key === 'Alt') {
    altDown = true;
    workspace.classList.add('alt-move');
  }
  const ctrl = event.ctrlKey || event.metaKey;
  if (ctrl && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); return; }
  if (ctrl && event.key.toLowerCase() === 'o') { event.preventDefault(); document.querySelector('#open-file').click(); return; }
  if (ctrl && ['0', '+', '=', '-'].includes(event.key)) {
    event.preventDefault();
    if (!textEditor) zoomAt(event.key === '0' ? 1 / view.zoom : event.key === '-' ? 1 / 1.2 : 1.2,
      workspace.clientWidth / 2, workspace.clientHeight / 2);
    return;
  }
  if (!dialog.open && inspectorOpen && event.key === 'Escape' && inspector.contains(document.activeElement)) {
    event.preventDefault();
    inspectorOpen = false;
    workspace.focus();
    render();
    return;
  }
  if (dialog.open || textEditor || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (event.code === 'Space' && !ctrl && !event.altKey) {
    event.preventDefault();
    if (!spaceDown) { spaceDown = true; render(); }
    return;
  }
  if (ctrl && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  if (ctrl && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
  if (['+', '=', '-'].includes(event.key) && !event.altKey && !ctrl) {
    event.preventDefault();
    zoomAt(event.key === '-' ? 1 / 1.2 : 1.2, workspace.clientWidth / 2, workspace.clientHeight / 2);
    return;
  }
  if (ctrl && event.key.toLowerCase() === 'd' && selectedIds.size) {
    event.preventDefault();
    change(() => {
      const copies = selectedBoxes().map(box => ({
        ...box, id: state.nextId++, x: box.x + (state.grid || 10), y: box.y + (state.grid || 10),
      }));
      state.boxes.push(...copies);
      selectedIds = new Set(copies.map(box => box.id));
      selectedId = copies[0].id;
    });
    return;
  }
  if (!ctrl && !event.altKey && /^[1-5]$/.test(event.key)) {
    change(() => { state.grid = [40, 20, 10, 5, 0][Number(event.key) - 1]; });
    return;
  }
  if (!ctrl && !event.altKey && event.key.toLowerCase() === 'v') { event.preventDefault(); setTool('select'); return; }
  if (!ctrl && !event.altKey && event.key.toLowerCase() === 'b') { event.preventDefault(); setTool('box'); return; }
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
  if (direction && !event.altKey && selectedIds.size) {
    event.preventDefault();
    const amount = (state.grid || 1) * (ctrl ? 5 : 1);
    change(() => {
      for (const box of selectedBoxes()) {
        if (event.shiftKey) {
          if (direction[0]) box.w = Math.max(minimum(), snap(box.x + box.w + direction[0] * amount) - box.x);
          if (direction[1]) box.h = Math.max(minimum(), snap(box.y + box.h + direction[1] * amount) - box.y);
        } else {
          box.x += direction[0] * amount;
          box.y += direction[1] * amount;
        }
      }
    });
  }
});

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
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

function showChannels() {
  const hsb = colorMode === 'hsb';
  const values = hsb ? rgbToHsb(...hexToRgb(editorColor)) : hexToRgb(editorColor);
  ['channel-1-label', 'channel-2-label', 'channel-3-label'].forEach((id, i) => {
    document.getElementById(id).textContent = (hsb ? ['H', 'S', 'B'] : ['R', 'G', 'B'])[i];
    channels[i].max = hsb ? [360, 100, 100][i] : 255;
    channels[i].value = values[i];
  });
  document.querySelector('#color-preview').style.setProperty('--preview-color', editorColor);
  document.querySelector('#color-hex').textContent = editorColor;
}

function openColor(target) {
  colorTarget = target;
  colorMode = 'rgb';
  document.querySelector('#color-mode').value = colorMode;
  const editing = target.kind === 'edit';
  document.querySelector('#color-dialog-title').textContent = editing ? `Edit ${swatch(target.id).name}` : 'Choose swatch';
  document.querySelector('#add-color').textContent = editing ? 'Update shared swatch' : 'Create swatch & use';
  const options = document.querySelector('#color-options');
  options.replaceChildren();
  options.hidden = editing;
  if (editing) editorColor = swatch(target.id).color;
  else {
    const box = selectedBox();
    editorColor = swatch(box?.[target.property])?.color || '#6746b7';
    if (target.property !== 'textColor') {
      const none = document.createElement('button');
      none.type = 'button';
      none.append(colorChip(null), document.createTextNode('Transparent'));
      none.addEventListener('click', () => assignColor(null));
      options.append(none);
    }
    for (const item of state.swatches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.append(colorChip(item.color), document.createTextNode(`${item.name} · ${item.color}`));
      button.addEventListener('click', () => assignColor(item.id));
      options.append(button);
    }
  }
  showChannels();
  dialog.showModal();
}

function assignColor(id) {
  if (selectedBox() && colorTarget?.kind === 'assign') {
    change(() => { selectedBox()[colorTarget.property] = id; });
  }
  dialog.close();
}

for (const button of colorButtons) {
  button.addEventListener('click', () => openColor({ kind: 'assign', property: button.dataset.colorProperty }));
}
document.querySelector('#color-mode').addEventListener('change', event => {
  colorMode = event.target.value;
  showChannels();
});
for (const input of channels) {
  input.addEventListener('input', () => {
    const numbers = channels.map((field, i) => Math.max(0, Math.min(Number(field.max), Number(field.value) || 0)));
    editorColor = rgbToHex(...(colorMode === 'hsb' ? hsbToRgb(...numbers) : numbers));
    document.querySelector('#color-preview').style.setProperty('--preview-color', editorColor);
    document.querySelector('#color-hex').textContent = editorColor;
  });
}
document.querySelector('#add-color').addEventListener('click', () => {
  if (!colorTarget) return;
  if (colorTarget.kind === 'edit') {
    change(() => { swatch(colorTarget.id).color = editorColor; });
  } else {
    change(() => {
      let item = state.swatches.find(s => s.color === editorColor);
      if (!item) {
        item = { id: `s${state.nextId++}`, name: `Color ${state.swatches.length + 1}`, color: editorColor };
        state.swatches.push(item);
      }
      if (selectedBox()) selectedBox()[colorTarget.property] = item.id;
    });
  }
  dialog.close();
});

function saveProject() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'onion-mock.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelector('#save-button').addEventListener('click', saveProject);
document.querySelector('#open-button').addEventListener('click', () => document.querySelector('#open-file').click());
document.querySelector('#open-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const loaded = JSON.parse(await file.text());
    if (!validProject(loaded)) throw new Error('This is not an Onion UI project.');
    change(() => { state = loaded; selectOnly(null); inspectorOpen = false; });
    document.querySelector('#notice').hidden = true;
  } catch (error) {
    const notice = document.querySelector('#notice');
    notice.textContent = `Could not open project: ${error.message}`;
    notice.hidden = false;
  }
  event.target.value = '';
});

render();
