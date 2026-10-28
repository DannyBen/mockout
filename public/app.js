const STORAGE_KEY = MinimockProject.storageKey;
const workspace = document.querySelector('#workspace');
const canvas = document.querySelector('#canvas');
const inspector = document.querySelector('#inspector');
const notice = document.querySelector('#notice');
const noticeMessage = document.querySelector('#notice-message');
const recoveryActions = document.querySelector('#recovery-actions');
const projectMenu = document.querySelector('#project-menu');
const projectMenuButton = document.querySelector('#project-menu-button');
const projectMenuHolder = document.querySelector('#project-menu-holder');
const helpPanel = document.querySelector('#help-panel');
const helpButton = document.querySelector('#help-button');
const toolButtons = [...document.querySelectorAll('[data-tool]')];
const gridButtons = [...document.querySelectorAll('[data-grid]')];
const colorButtons = [...document.querySelectorAll('[data-color-property], [data-canvas-color-property]')];
const alignButtons = [...document.querySelectorAll('[data-align-axis]')];
const channels = [1, 2, 3].map(n => document.querySelector(`#channel-${n}`));
const channelValues = [1, 2, 3].map(n => document.querySelector(`#channel-${n}-value`));
const { initialStyle } = MinimockProject;
const freshState = () => MinimockProject.freshState();
const validProject = value => MinimockProject.validProject(value);

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

function showNotice(message) {
  noticeMessage.textContent = message;
  recoveryActions.hidden = !savedProjectIssue;
  notice.hidden = false;
}

function closeProjectMenu(focus = false) {
  projectMenu.hidden = true;
  projectMenuButton.setAttribute('aria-expanded', 'false');
  if (focus) projectMenuButton.focus();
}
projectMenuButton.addEventListener('click', () => {
  projectMenu.hidden = !projectMenu.hidden;
  projectMenuButton.setAttribute('aria-expanded', String(!projectMenu.hidden));
});
projectMenu.addEventListener('click', event => {
  if (!event.target.closest('.hold-action')) closeProjectMenu();
});
document.addEventListener('pointerdown', event => {
  if (!projectMenuHolder.contains(event.target)) closeProjectMenu();
});

let selectedId = null;
let selectedIds = new Set();
let gesture = null;
let lastBoxClick = null;
let pointerPosition = null;
let placement = null;
let isolatedCopyIds = null;
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
  const next = MinimockSelection.selectOnly({ selectedId, selectedIds, isolatedCopyIds, inspectorOpen }, id);
  selectedId = next.selectedId;
  selectedIds = next.selectedIds;
  isolatedCopyIds = next.isolatedCopyIds;
  inspectorOpen = next.inspectorOpen;
}
const inspectedBox = () => MinimockSelection.inspectedBox(state.boxes,
  { selectedId, selectedIds, inspectorOpen, inspectorKind });
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
const snap = n => MinimockPlacement.snap(n, state.grid);
const minimum = () => 1;

function persist() {
  try { MinimockProject.persist(localStorage, STORAGE_KEY, state, savedProjectIssue); }
  catch { /* File save remains available. */ }
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
  for (const button of document.querySelectorAll('.corner button:not(#help-button)')) button.disabled = Boolean(placement);
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
    element.append(label);

    if (selectedIds.has(box.id) && tool === 'select' && !textEditor && !placement) {
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
  const box = inspectedBox();
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
  const box = inspectedBox();
  if (!box) return;
  const boxRect = [...canvas.querySelectorAll('.box')].find(element => Number(element.dataset.id) === box.id)?.getBoundingClientRect();
  if (!boxRect) return;
  const position = MinimockSelection.inspectorPosition(boxRect,
    { width: inspector.offsetWidth, height: inspector.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight });
  inspector.style.left = `${position.left}px`;
  inspector.style.top = `${position.top}px`;
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
  return MinimockPlacement.worldPoint(event, workspace.getBoundingClientRect(), view);
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

function startDuplicatePlacement() {
  const source = selectedBoxes();
  if (!source.length || gesture) return;
  closeProjectMenu();
  const originals = dragTargets(source[0], false, false);
  const previous = {
    before: snapshot(), selectedIds: new Set(selectedIds), selectedId,
    inspectorOpen, tool, isolatedCopyIds,
  };
  const cursor = pointerPosition && point({ clientX: pointerPosition.x, clientY: pointerPosition.y });
  const { x: dx, y: dy } = MinimockPlacement.duplicateOffset(source[0], cursor, state.grid);
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
    ...previous, ids: new Set(selectedIds), starts: copies.map(box => ({ id: box.id, x: box.x, y: box.y })),
    pointerOrigin: pointerPosition && { ...pointerPosition }, pointer: pointerPosition && { ...pointerPosition },
    nudgeX: 0, nudgeY: 0,
  };
  lastBoxClick = null;
  workspace.focus();
  render();
}

function movePlacement(clientX, clientY) {
  if (clientX !== undefined && clientY !== undefined) {
    placement.pointerOrigin ||= { x: clientX, y: clientY };
    placement.pointer = { x: clientX, y: clientY };
  }
  const first = placement.starts[0];
  const { x: dx, y: dy } = MinimockPlacement.moveDelta(first, placement.pointerOrigin,
    placement.pointer, { x: placement.nudgeX, y: placement.nudgeY }, view.zoom, state.grid);
  for (const start of placement.starts) {
    const box = state.boxes.find(item => item.id === start.id);
    box.x = start.x + dx;
    box.y = start.y + dy;
  }
  render();
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
}

const containsBox = MinimockSelection.containsBox;

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

function openInspector(id = selectedId, focus = false) {
  if (id === null) return;
  selectOnly(id);
  inspectorOpen = true;
  inspectorKind = 'box';
  inspectorView = 'properties';
  render();
  if (focus) document.querySelector('#box-text').focus();
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
}

workspace.addEventListener('contextmenu', event => {
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
  if (placement) {
    event.preventDefault();
    if (event.button === 0) {
      movePlacement(event.clientX, event.clientY);
      finishPlacement(true);
    }
    return;
  }
  if (textEditor || (event.button !== 0 && event.button !== 1)) return;
  const boxElement = event.target.closest('.box');
  const p = point(event);
  const boxId = boxElement ? Number(boxElement.dataset.id) : null;
  if (event.button === 1 || spaceDown) {
    gesture = { kind: 'pan', startX: event.clientX, startY: event.clientY, x: view.x, y: view.y };
  } else if (boxId && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && lastBoxClick?.id === boxId
    && event.timeStamp - lastBoxClick.time < 450
    && Math.hypot(p.x - lastBoxClick.x, p.y - lastBoxClick.y) < 7 / view.zoom) {
    lastBoxClick = null;
    event.preventDefault();
    editText(boxId);
    return;
  } else {
    lastBoxClick = null;
    if (tool === 'box' && !(boxId && (event.altKey || event.ctrlKey || event.metaKey))) {
      gesture = { kind: 'draw', start: { x: snap(p.x), y: snap(p.y) }, clickPoint: p,
        before: snapshot(), id: null, hitId: boxId };
    } else if (boxId) {
      if (event.shiftKey && !event.altKey) {
        isolatedCopyIds = null;
        if (selectedIds.has(boxId)) selectedIds.delete(boxId);
        else selectedIds.add(boxId);
        selectedId = selectedIds.values().next().value ?? null;
        render();
        event.preventDefault();
        return;
      }
      const hit = state.boxes.find(b => b.id === boxId);
      const resizing = Boolean(event.target.dataset.handle);
      const box = !resizing && !event.altKey && (event.ctrlKey || event.metaKey)
        ? MinimockSelection.nearestContainer(state.boxes, hit) ?? hit : hit;
      if (!selectedIds.has(box.id)) {
        selectOnly(box.id);
        inspectorView = 'properties';
      }
      gesture = {
        kind: resizing ? 'resize' : 'move',
        handle: event.target.dataset.handle || '',
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
  isolatedCopyIds = null;
  redoStack.push(snapshot());
  state = JSON.parse(undoStack.pop());
  selectedIds = new Set([...selectedIds].filter(id => state.boxes.some(b => b.id === id)));
  selectedId = selectedIds.values().next().value ?? null;
  persist();
  render();
}
function redo() {
  if (!redoStack.length) return;
  isolatedCopyIds = null;
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
  if (textEditor || placement) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? workspace.clientHeight : 1;
  view.x -= (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * unit;
  if (!event.shiftKey) view.y -= event.deltaY * unit;
  render();
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
  if (event.key === 'Escape' && !projectMenu.hidden) {
    event.preventDefault();
    closeProjectMenu(true);
    return;
  }
  if (event.key === 'Alt') {
    altDown = true;
    workspace.classList.add('alt-move');
  }
  const ctrl = event.ctrlKey || event.metaKey;
  if (placement) {
    if (event.key === 'Escape') { event.preventDefault(); finishPlacement(false); return; }
    if (event.key === 'Enter') { event.preventDefault(); finishPlacement(true); return; }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (direction && !event.altKey) {
      event.preventDefault();
      const amount = (state.grid || 1) * (ctrl ? 5 : 1);
      placement.nudgeX += direction[0] * amount;
      placement.nudgeY += direction[1] * amount;
      movePlacement();
      return;
    }
    if (ctrl || event.code === 'Space' || event.key === 'Tab' || event.key.length === 1) event.preventDefault();
    return;
  }
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
  if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    clearCanvas();
    return;
  }
  if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'a') {
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
  if (ctrl && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    if (selectedIds.size) startDuplicatePlacement();
    return;
  }
  if (!ctrl && !event.altKey && /^[1-5]$/.test(event.key)) {
    change(() => { state.grid = [40, 20, 10, 5, 0][Number(event.key) - 1]; });
    return;
  }
  if (!ctrl && !event.altKey && event.key.toLowerCase() === 'v') { event.preventDefault(); setTool('select'); return; }
  if (!ctrl && !event.altKey && event.key.toLowerCase() === 'b') { event.preventDefault(); setTool('box'); return; }
  if (!ctrl && !event.altKey && event.key.toLowerCase() === 'p') {
    event.preventDefault();
    if (inspectorOpen) { inspectorOpen = false; render(); }
    else if (selectedIds.size === 1) openInspector(selectedId);
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
function clearCanvas() {
  closeProjectMenu();
  if (!state.boxes.length) return;
  change(() => { state = MinimockProject.clearBoard(state); selectOnly(null); inspectorOpen = false; isolatedCopyIds = null; });
  workspace.focus();
}
document.querySelector('#clear-button').addEventListener('click', clearCanvas);
function resetEverything() {
  if (placement) return;
  closeProjectMenu();
  try { state = MinimockProject.reset(localStorage, STORAGE_KEY); }
  catch { showNotice('Could not clear saved data. Nothing was reset.'); return; }
  savedProjectIssue = '';
  undoStack.length = 0;
  redoStack.length = 0;
  selectOnly(null);
  inspectorOpen = false;
  isolatedCopyIds = null;
  placement = null;
  gesture = null;
  tool = 'select';
  notice.hidden = true;
  recoveryActions.hidden = true;
  workspace.focus();
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
    link.download = 'minimock-saved-data-backup.txt';
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
    const response = await fetch(new URL('style.css', location.href));
    if (!response.ok) throw new Error(`Could not load CSS (${response.status}).`);
    const html = previewHTML(await response.text());
    tab.location.replace(URL.createObjectURL(new Blob([html], { type: 'text/html' })));
    if (savedProjectIssue) showNotice(savedProjectIssue);
    else notice.hidden = true;
  } catch (error) {
    tab.close();
    showNotice(`Could not open preview: ${error.message}`);
  }
}
document.querySelector('#preview-button').addEventListener('click', openPreview);
document.querySelector('#open-button').addEventListener('click', () => document.querySelector('#open-file').click());
async function openProjectFile(file) {
  if (placement) return;
  try {
    const loaded = JSON.parse(await file.text());
    if (!validProject(loaded)) throw new Error('This is not a Minimock project.');
    change(() => { state = loaded; selectOnly(null); inspectorOpen = false; });
    if (savedProjectIssue) showNotice(savedProjectIssue);
    else notice.hidden = true;
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

document.addEventListener('drop', event => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  if (placement) return;
  if (event.dataTransfer.files.length === 1) openProjectFile(event.dataTransfer.files[0]);
  else {
    showNotice('Drop one JSON project file at a time.');
  }
});

render();
if (savedProjectIssue) {
  showNotice(savedProjectIssue);
}
