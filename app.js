const STORAGE_KEY = 'onion-ui-canvas-v1';
const workspace = document.querySelector('#workspace');
const canvas = document.querySelector('#canvas');
const inspector = document.querySelector('#inspector');
const helpPanel = document.querySelector('#help-panel');
const helpButton = document.querySelector('#help-button');
const toolButtons = [...document.querySelectorAll('[data-tool]')];
const gridButtons = [...document.querySelectorAll('[data-grid]')];
const colorButtons = [...document.querySelectorAll('[data-color-property], [data-canvas-color-property]')];
const alignButtons = [...document.querySelectorAll('[data-align-axis]')];
const channels = [1, 2, 3].map(n => document.querySelector(`#channel-${n}`));
const channelValues = [1, 2, 3].map(n => document.querySelector(`#channel-${n}-value`));
const defaultCanvasColors = { background: '#ffffff', gridMajor: '#f1f1f1', gridMinor: '#f1f1f1' };

const initialStyle = swatches => ({
  fill: swatches[0]?.id ?? null,
  textColor: swatches[1]?.id ?? swatches[0]?.id ?? null,
  borderColor: swatches[2]?.id ?? swatches[0]?.id ?? null,
  borderWidth: 1, radius: 0, paddingX: 3, paddingY: 0,
  alignX: 'center', alignY: 'center',
});

const freshState = () => {
  const swatches = [
    { id: 's1', name: 'White', color: '#ffffff' },
    { id: 's2', name: 'Ink', color: '#253047' },
    { id: 's3', name: 'Line', color: '#aeb6c5' },
  ];
  return {
    version: 1, grid: 10, nextId: 4, swatches, boxes: [], lastStyle: initialStyle(swatches),
    canvasColors: { ...defaultCanvasColors },
  };
};

function validStyle(style, swatches) {
  return style && ['fill', 'textColor', 'borderColor'].every(key =>
    style[key] === null || swatches.some(item => item.id === style[key]))
    && ['borderWidth', 'radius', 'paddingX', 'paddingY'].every(key => Number.isFinite(style[key]) && style[key] >= 0)
    && ['left', 'center', 'right'].includes(style.alignX)
    && ['top', 'center', 'bottom'].includes(style.alignY);
}

function validProject(value) {
  return value && value.version === 1 && [0, 5, 10, 20, 40].includes(value.grid)
    && Number.isInteger(value.nextId) && Array.isArray(value.swatches) && Array.isArray(value.boxes)
    && value.swatches.every(s => typeof s.id === 'string' && typeof s.name === 'string' && /^#[0-9a-f]{6}$/i.test(s.color))
    && (value.lastStyle === undefined || validStyle(value.lastStyle, value.swatches))
    && value.canvasColors && ['background', 'gridMajor', 'gridMinor'].every(key =>
      /^#[0-9a-f]{6}$/i.test(value.canvasColors[key]))
    && value.boxes.every(b => Number.isInteger(b.id) && ['x', 'y', 'w', 'h', 'radius', 'borderWidth'].every(k => Number.isFinite(b[k]))
      && b.w > 0 && b.h > 0 && typeof b.text === 'string'
      && ['paddingX', 'paddingY'].every(k => b[k] === undefined || (Number.isFinite(b[k]) && b[k] >= 0))
      && ['fill', 'textColor', 'borderColor'].every(k => b[k] === null || value.swatches.some(s => s.id === b[k]))
      && ['left', 'center', 'right'].includes(b.alignX) && ['top', 'center', 'bottom'].includes(b.alignY));
}

let state = freshState();
let savedProjectIssue = '';
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (validProject(saved)) state = saved;
    else savedProjectIssue = 'Saved project is unsupported. Local data was left untouched; autosave is paused.';
  }
} catch {
  savedProjectIssue = 'Could not read the saved project. Local data was left untouched; autosave is paused.';
}

let selectedId = null;
let selectedIds = new Set();
let gesture = null;
let lastBoxClick = null;
let textEditor = null;
let inspectorOpen = false;
let inspectorKind = 'box';
let inspectorPoint = { x: 12, y: 12 };
let inspectorView = 'properties';
let tool = 'select';
let spaceDown = false;
let altDown = false;
const view = { x: 0, y: 0, zoom: 1 };
let colorTarget = null;
let colorMode = 'hsb';
let editorColor = '#6746b7';
const undoStack = [];
const redoStack = [];

const snapshot = () => JSON.stringify(state);
const selectedBox = () => state.boxes.find(b => b.id === selectedId);
const selectedBoxes = () => state.boxes.filter(b => selectedIds.has(b.id));
const paddingX = box => box.paddingX ?? 3;
const paddingY = box => box.paddingY ?? 3;
const styleOf = box => ({
  fill: box.fill, textColor: box.textColor, borderColor: box.borderColor,
  borderWidth: box.borderWidth, radius: box.radius,
  paddingX: paddingX(box), paddingY: paddingY(box), alignX: box.alignX, alignY: box.alignY,
});
function rememberStyle(box) { state.lastStyle = styleOf(box); }
function selectOnly(id) {
  selectedId = id;
  selectedIds = id === null ? new Set() : new Set([id]);
}
const swatch = id => state.swatches.find(s => s.id === id);
const colorOf = id => inspectorOpen && inspectorView === 'edit' && colorTarget?.editId && colorTarget.editId === id
  ? editorColor : swatch(id)?.color || 'transparent';
function canvasColor(property) {
  if (inspectorOpen && inspectorView === 'edit' && colorTarget?.direct
    && colorTarget.property === property) return editorColor;
  return state.canvasColors[property];
}
function boxColor(box, property) {
  if (inspectorOpen && inspectorView === 'edit' && colorTarget) {
    if (colorTarget.editId && box[property] === colorTarget.editId) return editorColor;
    if (inspectorKind === 'box' && !colorTarget.editId && box.id === selectedId
      && property === colorTarget.property) return editorColor;
  }
  return colorOf(box[property]);
}
const snap = n => state.grid ? Math.round(n / state.grid) * state.grid : Math.round(n);
const minimum = () => state.grid || 5;

function persist() {
  if (savedProjectIssue) return;
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
    const borderWidth = Math.min(box.borderWidth, box.w / 2, box.h / 2);
    const insetX = Math.min(paddingX(box), Math.max(0, (box.w - borderWidth * 2) / 2));
    const insetY = Math.min(paddingY(box), Math.max(0, (box.h - borderWidth * 2) / 2));
    const element = document.createElement('div');
    element.className = 'box';
    if (selectedIds.has(box.id)) element.classList.add('selected');
    if (gesture?.kind === 'draw' && gesture.id === box.id) element.classList.add('drawing');
    element.dataset.id = box.id;
    Object.assign(element.style, {
      left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`,
      backgroundColor: boxColor(box, 'fill'), color: boxColor(box, 'textColor'),
      borderColor: boxColor(box, 'borderColor'), borderWidth: `${borderWidth}px`,
      borderRadius: `${box.radius}px`, padding: `${insetY}px ${insetX}px`,
      justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[box.alignX],
      alignItems: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[box.alignY],
    });
    element.style.setProperty('--box-border-width', `${borderWidth}px`);
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
  const box = inspectorKind === 'box' && selectedIds.size === 1 && inspectorOpen ? selectedBox() : null;
  const visible = inspectorOpen && (inspectorKind === 'canvas' || box);
  inspector.hidden = !visible;
  if (!visible) return;
  document.querySelector('#box-properties').hidden = inspectorView !== 'properties' || inspectorKind !== 'box';
  document.querySelector('#canvas-properties').hidden = inspectorView !== 'properties' || inspectorKind !== 'canvas';
  document.querySelector('#swatch-chooser').hidden = inspectorView !== 'choose';
  document.querySelector('#swatch-editor').hidden = inspectorView !== 'edit';
  document.querySelector('#swatch-name').parentElement.hidden = inspectorView === 'edit' && Boolean(colorTarget?.direct);
  document.querySelector('#inspector-header').hidden = inspectorView === 'properties';
  if (inspectorView !== 'properties') {
    document.querySelector('#inspector-title').hidden = inspectorView === 'edit';
    document.querySelector('#delete-swatch').hidden = inspectorView !== 'edit' || !colorTarget?.editId
      || state.swatches.length <= 1 || state.boxes.some(item =>
        ['fill', 'textColor', 'borderColor'].some(property => item[property] === colorTarget.editId));
    if (inspectorView === 'choose') document.querySelector('#inspector-title').textContent = colorLabel(colorTarget.property);
  }
  if (box) {
    for (const [field, value] of Object.entries({
      'box-text': box.text, 'box-width': box.w, 'box-height': box.h,
      'box-radius': box.radius, 'box-border-width': box.borderWidth,
      'box-padding-x': paddingX(box), 'box-padding-y': paddingY(box),
    })) {
      const input = document.getElementById(field);
      if (document.activeElement !== input) input.value = value;
    }
    for (const button of alignButtons) {
      const active = box[button.dataset.alignAxis] === button.dataset.alignValue;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
  for (const button of colorButtons) {
    const canvasProperty = button.dataset.canvasColorProperty;
    if (Boolean(canvasProperty) !== (inspectorKind === 'canvas')) continue;
    const value = canvasProperty ? state.canvasColors[canvasProperty] : box[button.dataset.colorProperty];
    const item = canvasProperty ? null : swatch(value);
    const name = document.createElement('span');
    name.className = 'swatch-name';
    name.textContent = canvasProperty ? value.toUpperCase() : item?.name || 'Transparent';
    button.replaceChildren(colorChip(canvasProperty ? value : item?.color), name);
  }
  if (inspectorView === 'choose') renderSwatchList();
  positionInspector();
}

const colorLabel = property => ({
  fill: 'Fill', textColor: 'Text', borderColor: 'Border',
  background: 'Background', gridMajor: 'Grid major', gridMinor: 'Grid minor',
})[property];

function renderSwatchList() {
  const list = document.querySelector('#swatch-list');
  list.replaceChildren();
  if (inspectorKind === 'box' && colorTarget.property !== 'textColor') {
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'swatch-choice';
    none.append(colorChip(null), document.createTextNode('Transparent'));
    none.addEventListener('click', () => assignColor(null));
    list.append(none);
  }
  for (const item of state.swatches) {
    const row = document.createElement('div');
    row.className = 'swatch-row';
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'swatch-choice';
    choice.append(colorChip(item.color), document.createTextNode(item.name));
    choice.addEventListener('click', () => assignColor(item.id));
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'swatch-edit';
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', `Edit ${item.name}`);
    edit.addEventListener('click', () => openSwatchEditor(item.id));
    row.append(choice, edit);
    list.append(row);
  }
}

function positionInspector() {
  if (inspector.hidden) return;
  if (inspectorKind === 'canvas') {
    inspector.style.left = `${Math.max(12, Math.min(inspectorPoint.x, window.innerWidth - inspector.offsetWidth - 12))}px`;
    inspector.style.top = `${Math.max(12, Math.min(inspectorPoint.y, window.innerHeight - inspector.offsetHeight - 12))}px`;
    return;
  }
  const box = selectedBox();
  if (!box) return;
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
  const style = state.lastStyle ?? (state.boxes.length ? styleOf(state.boxes.at(-1)) : initialStyle(state.swatches));
  return {
    id: state.nextId++, x, y, w: minimum(), h: minimum(), text: '',
    ...style,
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

function containsBox(outer, inner) {
  return outer.id !== inner.id && outer.x <= inner.x && outer.y <= inner.y
    && outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h
    && (outer.x < inner.x || outer.y < inner.y
      || outer.x + outer.w > inner.x + inner.w || outer.y + outer.h > inner.y + inner.h);
}

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
  for (;;) {
    const parentIndex = state.boxes.findIndex((parent, i) =>
      state.boxes.some((child, j) => j < i && containsBox(parent, child)));
    if (parentIndex < 0) break;
    const [parent] = state.boxes.splice(parentIndex, 1);
    const childIndex = state.boxes.findIndex(child => containsBox(parent, child));
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

function openInspector(id = selectedId, focus = false) {
  if (id === null) return;
  selectOnly(id);
  inspectorOpen = true;
  inspectorKind = 'box';
  inspectorView = 'properties';
  render();
  if (focus) document.querySelector('#box-text').focus();
}

workspace.addEventListener('contextmenu', event => {
  const boxElement = event.target.closest('.box');
  event.preventDefault();
  if (boxElement) openInspector(Number(boxElement.dataset.id));
  else {
    selectOnly(null);
    inspectorOpen = true;
    inspectorKind = 'canvas';
    inspectorView = 'properties';
    inspectorPoint = { x: event.clientX, y: event.clientY };
    render();
  }
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
      if (!selectedIds.has(boxId)) {
        selectOnly(boxId);
        inspectorView = 'properties';
      }
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
  if (before && before !== snapshot() && ['draw', 'move', 'resize'].includes(kind)) {
    arrangeStack(kind === 'move' ? gesture.originals.map(box => box.id) : []);
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
]) {
  document.getElementById(id).addEventListener('change', event => {
    if (selectedBox()) change(() => {
      selectedBox()[key] = transform(event.target.value);
      rememberStyle(selectedBox());
    });
  });
}
for (const button of alignButtons) {
  button.addEventListener('click', () => {
    if (selectedBox()) change(() => {
      selectedBox()[button.dataset.alignAxis] = button.dataset.alignValue;
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

workspace.addEventListener('wheel', event => {
  if (event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  if (textEditor) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? workspace.clientHeight : 1;
  view.x -= (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * unit;
  if (!event.shiftKey) view.y -= event.deltaY * unit;
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
  if (ctrl && event.key.toLowerCase() === 'p') { event.preventDefault(); openPreview(); return; }
  if (ctrl && ['0', '+', '=', '-'].includes(event.key)) {
    event.preventDefault();
    if (!textEditor) zoomAt(event.key === '0' ? 1 / view.zoom : event.key === '-' ? 1 / 1.2 : 1.2,
      workspace.clientWidth / 2, workspace.clientHeight / 2);
    return;
  }
  if (inspectorOpen && event.key === 'Escape' && inspector.contains(document.activeElement)) {
    event.preventDefault();
    if (inspectorView === 'edit') inspectorView = colorTarget?.direct ? 'properties' : 'choose';
    else if (inspectorView === 'choose') inspectorView = 'properties';
    else { inspectorOpen = false; workspace.focus(); }
    render();
    if (inspectorOpen && colorTarget?.direct && inspectorView === 'properties') focusColorField();
    return;
  }
  if (textEditor || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    selectedIds = new Set(state.boxes.map(box => box.id));
    selectedId = state.boxes[0]?.id ?? null;
    inspectorOpen = false;
    tool = 'select';
    workspace.focus();
    render();
    return;
  }
  if (event.key === '?' && !ctrl && !event.altKey) {
    event.preventDefault();
    if (!event.repeat) toggleHelp();
    return;
  }
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
      rememberStyle(copies[0]);
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

function showColor() {
  const rgb = colorMode === 'rgb';
  const gray = colorMode === 'gray';
  document.querySelector('#swatch-editor').classList.toggle('gray-mode', gray);
  const values = gray ? [hexToRgb(editorColor)[0]]
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

function openColor(property) {
  colorTarget = { property, editId: null };
  inspectorView = 'choose';
  renderInspector();
  document.querySelector('#swatch-list .swatch-choice')?.focus();
}

function openDirectColor(property) {
  colorTarget = { property, direct: true };
  editorColor = state.canvasColors[property];
  colorMode = 'hsb';
  document.querySelector('#color-mode').value = colorMode;
  inspectorView = 'edit';
  renderInspector();
  showColor();
  document.querySelector('#color-hex').focus();
}

function focusColorField() {
  const attribute = inspectorKind === 'canvas' ? 'data-canvas-color-property' : 'data-color-property';
  document.querySelector(`[${attribute}="${colorTarget.property}"]`).focus();
}

function assignColor(id) {
  if (!selectedBox() || !colorTarget) return;
  change(() => {
    selectedBox()[colorTarget.property] = id;
    rememberStyle(selectedBox());
  });
  inspectorView = 'properties';
  renderInspector();
  focusColorField();
}

function openSwatchEditor(id = null) {
  colorTarget.editId = id;
  const item = swatch(id);
  editorColor = item?.color || swatch(selectedBox()?.[colorTarget.property])?.color || '#6746b7';
  colorMode = 'hsb';
  document.querySelector('#color-mode').value = colorMode;
  document.querySelector('#swatch-name').value = item?.name || '';
  inspectorView = 'edit';
  renderInspector();
  showColor();
  document.querySelector('#swatch-name').focus();
}

for (const button of colorButtons) button.addEventListener('click', () => {
  if (button.dataset.canvasColorProperty) openDirectColor(button.dataset.canvasColorProperty);
  else openColor(button.dataset.colorProperty);
});
document.querySelector('#new-swatch').addEventListener('click', () => openSwatchEditor());
document.querySelector('#color-back').addEventListener('click', () => {
  inspectorView = inspectorView === 'edit' && !colorTarget?.direct ? 'choose' : 'properties';
  render();
  if (inspectorView === 'choose') document.querySelector('#new-swatch').focus();
  else focusColorField();
});
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
  inspectorView = 'choose';
  colorTarget.editId = null;
  renderInspector();
  document.querySelector('#new-swatch').focus();
});
document.querySelector('#color-mode').addEventListener('change', event => {
  colorMode = event.target.value;
  if (colorMode === 'gray') {
    const [r, g, b] = hexToRgb(editorColor);
    const value = Math.round(.299 * r + .587 * g + .114 * b);
    editorColor = rgbToHex(value, value, value);
  }
  showColor();
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
  useHex(value);
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

document.querySelector('#save-swatch').addEventListener('click', () => {
  if (!colorTarget || !readHex()) return;
  if (colorTarget.direct) {
    change(() => { state.canvasColors[colorTarget.property] = editorColor; });
    inspectorView = 'properties';
    renderInspector();
    focusColorField();
    return;
  }
  const name = document.querySelector('#swatch-name').value.trim();
  if (!name) {
    const error = document.querySelector('#color-error');
    error.textContent = 'Give the swatch a name.';
    error.hidden = false;
    document.querySelector('#swatch-name').focus();
    return;
  }
  if (colorTarget.editId) {
    change(() => { Object.assign(swatch(colorTarget.editId), { name, color: editorColor }); });
    inspectorView = 'choose';
  } else {
    change(() => {
      const id = `s${state.nextId++}`;
      state.swatches.push({ id, name, color: editorColor });
      selectedBox()[colorTarget.property] = id;
      rememberStyle(selectedBox());
    });
    inspectorView = 'properties';
  }
  renderInspector();
  if (inspectorView === 'choose') document.querySelector('#new-swatch').focus();
  else focusColorField();
});

function saveProject() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'minimock.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelector('#save-button').addEventListener('click', saveProject);

function previewHTML(css) {
  const margin = 20;
  const left = Math.min(...state.boxes.map(box => box.x));
  const top = Math.min(...state.boxes.map(box => box.y));
  const right = Math.max(...state.boxes.map(box => box.x + box.w));
  const bottom = Math.max(...state.boxes.map(box => box.y + box.h));
  const boxes = [...canvas.querySelectorAll('.box')].map(element => {
    const box = state.boxes.find(item => item.id === Number(element.dataset.id));
    const copy = element.cloneNode(true);
    copy.classList.remove('selected', 'drawing');
    copy.querySelectorAll('.handle').forEach(handle => handle.remove());
    copy.style.left = `${box.x - left + margin}px`;
    copy.style.top = `${box.y - top + margin}px`;
    return copy.outerHTML;
  }).join('\n');
  const width = right - left + margin * 2;
  const height = bottom - top + margin * 2;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Minimock preview</title>
<style>${css}</style>
<style>
  :root, body { background: #fff; }
  body { min-height: 100vh; display: flex; }
  #mock { position: relative; flex: none; width: ${width}px; height: ${height}px; margin: auto; }
  .box { cursor: default; }
</style>
</head>
<body><main id="mock" style="background-color: ${canvasColor('background')}">${boxes}</main></body>
</html>`;
}

async function openPreview() {
  const notice = document.querySelector('#notice');
  if (!state.boxes.length) {
    notice.textContent = 'Draw a box before opening a preview.';
    notice.hidden = false;
    return;
  }
  const tab = window.open('', '_blank');
  if (!tab) {
    notice.textContent = 'Allow pop-ups to open the preview.';
    notice.hidden = false;
    return;
  }
  try {
    const response = await fetch(new URL('style.css', location.href));
    if (!response.ok) throw new Error(`Could not load CSS (${response.status}).`);
    const html = previewHTML(await response.text());
    tab.location.replace(URL.createObjectURL(new Blob([html], { type: 'text/html' })));
    notice.hidden = !savedProjectIssue;
  } catch (error) {
    tab.close();
    notice.textContent = `Could not open preview: ${error.message}`;
    notice.hidden = false;
  }
}
document.querySelector('#preview-button').addEventListener('click', openPreview);
document.querySelector('#open-button').addEventListener('click', () => document.querySelector('#open-file').click());
async function openProjectFile(file) {
  try {
    const loaded = JSON.parse(await file.text());
    if (!validProject(loaded)) throw new Error('This is not a Minimock project.');
    change(() => { state = loaded; savedProjectIssue = ''; selectOnly(null); inspectorOpen = false; });
    document.querySelector('#notice').hidden = true;
  } catch (error) {
    const notice = document.querySelector('#notice');
    notice.textContent = `Could not open project: ${error.message}`;
    notice.hidden = false;
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
  event.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', event => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  if (event.dataTransfer.files.length === 1) openProjectFile(event.dataTransfer.files[0]);
  else {
    const notice = document.querySelector('#notice');
    notice.textContent = 'Drop one JSON project file at a time.';
    notice.hidden = false;
  }
});

render();
if (savedProjectIssue) {
  const notice = document.querySelector('#notice');
  notice.textContent = savedProjectIssue;
  notice.hidden = false;
}
