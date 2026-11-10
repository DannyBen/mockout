import MockoutProject from '../core/project.js';
import { editorSnapshot } from '../editor/snapshot.js';

export function createCanvas({ model, elements, actions, ui }) {
  function addResizeHandles(element) {
    for (const direction of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      const handle = document.createElement('span');
      handle.className = 'handle';
      handle.dataset.handle = direction;
      element.append(handle);
    }
  }
  function renderStyleMarkers() {
    const box = actions.inspectedBox();
    const visible = actions.styleEditing() && !!box;
    elements.styleMarkers.hidden = !visible;
    elements.styleGuides.toggleAttribute('hidden', !visible);
    if (!visible) return;
    const rect = elements.canvas.querySelector(`.box[data-id="${box.id}"]`).getBoundingClientRect();
    const frame = actions.boxStyle.markerFrame(rect);
    const origin = elements.workspace.getBoundingClientRect();
    elements.styleGuides.replaceChildren();
    elements.styleMarkers.setAttribute('aria-label', `${model.activePropertySection === 'padding' ? 'Padding' : 'Border'} targets`);
    for (const target of actions.boxStyle.targets) {
      const x = frame.left + target.x * frame.width - origin.left;
      const y = frame.top + target.y * frame.height - origin.top;
      const marker = elements.styleMarkers.querySelector(`[data-style-target="${target.id}"]`);
      marker.hidden = model.activePropertySection === 'padding' && !!target.corner;
      marker.setAttribute('aria-pressed', String(target === actions.styleTarget()));
      if (marker.hidden) continue;
      marker.setAttribute('aria-label', `${target.name} ${model.activePropertySection === 'padding' ? 'padding' : target.corner ? 'corner' : 'border'}`);
      Object.assign(marker.style, { left: `${x}px`, top: `${y}px` });
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      for (const [name, value] of Object.entries({ x1: rect.left + target.x * rect.width - origin.left,
        y1: rect.top + target.y * rect.height - origin.top, x2: x, y2: y })) line.setAttribute(name, value);
      line.classList.toggle('active', target === actions.styleTarget());
      elements.styleGuides.append(line);
    }
  }
  function render() {
    actions.updateFileStatus();
    elements.welcomeButton.disabled = Boolean(model.project.boxes.length || model.savedProjectIssue || model.fileLocked);
    elements.welcomeHint.hidden = !elements.welcomeButton.disabled;
    elements.welcomeHint.textContent = model.savedProjectIssue ? 'Resolve the saved project issue first.'
      : 'Start a new blank project first to show Welcome.';
    syncFontStylesheets();
    elements.workspace.style.backgroundColor = actions.canvasColor('background');
    elements.workspace.style.setProperty('--grid-major-color', actions.canvasColor('gridMajor'));
    elements.workspace.style.setProperty('--grid-minor-color', actions.canvasColor('gridMinor'));
    const gridSize = model.project.grid || (model.project.gridBase ?? 5);
    elements.workspace.style.setProperty('--grid-size', `${gridSize * model.view.zoom}px`);
    elements.workspace.style.setProperty('--major-grid-size', `${gridSize * model.view.zoom * (model.project.gridDivisions ?? 10)}px`);
    elements.workspace.style.setProperty('--pan-x', `${model.view.x}px`);
    elements.workspace.style.setProperty('--pan-y', `${model.view.y}px`);
    elements.workspace.classList.toggle('grid-off', model.project.grid === 0);
    elements.workspace.classList.toggle('tool-box', model.tool === 'box');
    elements.workspace.classList.toggle('panning', model.spaceDown || model.gesture?.kind === 'pan');
    elements.workspace.classList.toggle('alt-move', model.altDown);
    elements.workspace.classList.toggle('file-locked', model.fileLocked);
    elements.canvas.style.transform = `translate(${model.view.x}px, ${model.view.y}px) scale(${model.view.zoom})`;
    elements.canvas.style.setProperty('--screen-pixel', `${1 / model.view.zoom}px`);
    elements.canvas.style.setProperty('--handle-size', `${9 / model.view.zoom}px`);
    for (const button of elements.toolButtons) {
      const active = button.dataset.tool === model.tool;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    const gridSizes = MockoutProject.gridSizes(model.project);
    for (const [index, button] of elements.gridButtons.entries()) {
      const size = gridSizes[index];
      button.dataset.grid = size;
      button.textContent = size || 'Off';
      const active = size === model.project.grid;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    for (const button of document.querySelectorAll('.corner button:not(#help-button)')) button.disabled = Boolean(model.placement);
    if (model.fileLocked) {
      for (const button of [...elements.toolButtons, ...elements.gridButtons, document.querySelector('#save-button')]) button.disabled = true;
    }
    document.querySelector('#placement-hint').hidden = !model.placement;

    elements.canvas.replaceChildren();
    for (const box of model.project.boxes) {
      const widths = actions.boxStyle.widths(box);
      const paddings = actions.boxStyle.paddings(box, widths);
      const element = document.createElement('div');
      element.className = 'box';
      if (model.selectedIds.has(box.id)) element.classList.add('selected');
      if (actions.styleEditing() && box.id === model.selectedId) element.classList.add('editing-style');
      if (model.gesture?.kind === 'draw' && model.gesture.id === box.id) element.classList.add('drawing');
      if (model.placement?.ids.has(box.id)) element.classList.add('placing');
      element.dataset.id = box.id;
      Object.assign(element.style, {
        left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`,
        borderRadius: actions.boxStyle.values(box, 'radius').map(value => `${value}px`).join(' '),
      });
      element.style.setProperty('--box-opacity', box.opacity ?? 1);
      const content = document.createElement('div');
      content.className = 'box-content';
      Object.assign(content.style, {
        backgroundColor: actions.boxColor(box, 'fill'), color: actions.boxColor(box, 'textColor'),
        borderColor: [0, 1, 2, 3].map(side => actions.boxColor(box, 'borderColor', side)).join(' '),
        borderWidth: widths.map(value => `${value}px`).join(' '),
        padding: paddings.map(value => `${value}px`).join(' '),
        justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[box.alignX],
        alignItems: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[box.alignY],
      });
      const label = document.createElement('span');
      label.className = 'box-label';
      label.textContent = box.text;
      label.style.textAlign = box.alignX;
      const family = actions.fonts.familyOf(box);
      label.style.fontFamily = family ? `"${family}", system-ui, sans-serif` : 'system-ui, sans-serif';
      label.style.fontSize = `${actions.fonts.sizeOf(box)}px`;
      label.style.fontWeight = actions.fonts.weightOf(box);
      label.style.fontStyle = actions.fonts.styleOf(box);
      if (actions.fonts.isMaterial(family)) {
        label.style.fontFeatureSettings = '"liga"';
        label.style.whiteSpace = 'nowrap';
      }
      content.append(label);
      element.append(content);

      if (model.selectedIds.size === 1 && model.selectedIds.has(box.id) && model.tool === 'select' && !model.textEditor && !model.placement && !model.fileLocked && !actions.styleEditing()) {
        addResizeHandles(element);
      }
      elements.canvas.append(element);
    }
    if (model.selectedIds.size > 1 && model.tool === 'select' && !model.textEditor && !model.placement && !model.fileLocked && !actions.styleEditing()) {
      const boxes = actions.selectedBoxes();
      const left = Math.min(...boxes.map(box => box.x));
      const top = Math.min(...boxes.map(box => box.y));
      const right = Math.max(...boxes.map(box => box.x + box.w));
      const bottom = Math.max(...boxes.map(box => box.y + box.h));
      const bounds = document.createElement('div');
      bounds.className = 'selection-bounds';
      Object.assign(bounds.style, { left: `${left}px`, top: `${top}px`,
        width: `${right - left}px`, height: `${bottom - top}px` });
      addResizeHandles(bounds);
      elements.canvas.append(bounds);
    }
    if (model.gesture?.kind === 'marquee' && model.gesture.end) {
      const marquee = document.createElement('div');
      marquee.className = 'marquee';
      const left = Math.min(model.gesture.start.x, model.gesture.end.x);
      const top = Math.min(model.gesture.start.y, model.gesture.end.y);
      Object.assign(marquee.style, {
        left: `${left}px`, top: `${top}px`,
        width: `${Math.abs(model.gesture.end.x - model.gesture.start.x)}px`,
        height: `${Math.abs(model.gesture.end.y - model.gesture.start.y)}px`,
      });
      elements.canvas.append(marquee);
    }
    actions.renderInspector();
    renderStyleMarkers();
    ui.update({ editor: editorSnapshot(model) });
  }
  function syncFontStylesheets() {
    const urls = actions.fonts.stylesheets(model.project.boxes);
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

  return {
    actions: {
      addResizeHandles, renderStyleMarkers, render, syncFontStylesheets,
    },
    init() {
    },
  };
}
