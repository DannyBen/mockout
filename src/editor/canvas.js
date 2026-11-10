import { editorSnapshot } from './snapshot.js';

export function createCanvas({ model, elements, actions, ui }) {
  function renderStyleMarkers() {
    const box = actions.inspectedBox(), visible = Boolean(actions.styleEditing() && box);
    const padding = model.activePropertySection === 'padding', items = [];
    if (visible) {
      const rect = elements.canvas.querySelector(`.box[data-id="${box.id}"]`).getBoundingClientRect();
      const frame = actions.boxStyle.markerFrame(rect), origin = elements.workspace.getBoundingClientRect();
      for (const target of actions.boxStyle.targets) {
        const x = frame.left + target.x * frame.width - origin.left, y = frame.top + target.y * frame.height - origin.top;
        items.push({ id: target.id, kind: target.corner ? 'corner' : 'edge', axis: target.x === .5 ? 'horizontal' : 'vertical',
          hidden: padding && Boolean(target.corner), active: target === actions.styleTarget(),
          label: `${target.name} ${padding ? 'padding' : target.corner ? 'corner' : 'border'}`, style: { left: `${x}px`, top: `${y}px` },
          line: { x1: rect.left + target.x * rect.width - origin.left, y1: rect.top + target.y * rect.height - origin.top, x2: x, y2: y } });
      }
    }
    ui.update({ markers: { visible, label: `${padding ? 'Padding' : 'Border'} targets`, items } });
  }
  function canvasData() {
    const grid = model.project.grid || (model.project.gridBase ?? 5), zoom = model.view.zoom;
    const handles = model.tool === 'select' && !model.textEditor && !model.placement && !model.fileLocked && !actions.styleEditing();
    const flags = { 'grid-off': model.project.grid === 0, 'tool-box': model.tool === 'box', panning: model.spaceDown || model.gesture?.kind === 'pan', 'alt-move': model.altDown, 'file-locked': model.fileLocked };
    const boxes = model.project.boxes.map(box => {
      const widths = actions.boxStyle.widths(box), family = actions.fonts.familyOf(box);
      return {
        id: box.id, text: box.text, editing: Boolean(model.textEditor) && box.id === model.selectedId,
        handles: Boolean(handles && model.selectedIds.size === 1 && model.selectedIds.has(box.id)),
        className: ['box', model.selectedIds.has(box.id) && 'selected', actions.styleEditing() && box.id === model.selectedId && 'editing-style',
          model.gesture?.kind === 'draw' && model.gesture.id === box.id && 'drawing', model.placement?.ids.has(box.id) && 'placing'].filter(Boolean).join(' '),
        style: { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`, borderRadius: actions.boxStyle.values(box, 'radius').map(value => `${value}px`).join(' '), '--box-opacity': box.opacity ?? 1 },
        contentStyle: { backgroundColor: actions.boxColor(box, 'fill'), color: actions.boxColor(box, 'textColor'),
          borderColor: [0, 1, 2, 3].map(side => actions.boxColor(box, 'borderColor', side)).join(' '), borderWidth: widths.map(value => `${value}px`).join(' '),
          padding: actions.boxStyle.paddings(box, widths).map(value => `${value}px`).join(' '), justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[box.alignX], alignItems: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[box.alignY] },
        labelStyle: { textAlign: box.alignX, fontFamily: family ? `"${family}", system-ui, sans-serif` : 'system-ui, sans-serif',
          fontSize: `${actions.fonts.sizeOf(box)}px`, fontWeight: actions.fonts.weightOf(box), fontStyle: actions.fonts.styleOf(box),
          ...(actions.fonts.isMaterial(family) ? { fontFeatureSettings: '"liga"', whiteSpace: 'nowrap' } : {}) },
      };
    });
    let bounds = null, marquee = null;
    if (handles && model.selectedIds.size > 1) {
      const selected = actions.selectedBoxes(), left = Math.min(...selected.map(box => box.x)), top = Math.min(...selected.map(box => box.y));
      bounds = { left: `${left}px`, top: `${top}px`, width: `${Math.max(...selected.map(box => box.x + box.w)) - left}px`, height: `${Math.max(...selected.map(box => box.y + box.h)) - top}px` };
    }
    if (model.gesture?.kind === 'marquee' && model.gesture.end) {
      const { start, end } = model.gesture;
      marquee = { left: `${Math.min(start.x, end.x)}px`, top: `${Math.min(start.y, end.y)}px`, width: `${Math.abs(end.x - start.x)}px`, height: `${Math.abs(end.y - start.y)}px` };
    }
    return { boxes, bounds, marquee, className: Object.keys(flags).filter(key => flags[key]).join(' '),
      workspaceStyle: { backgroundColor: actions.canvasColor('background'), '--grid-major-color': actions.canvasColor('gridMajor'), '--grid-minor-color': actions.canvasColor('gridMinor'),
        '--grid-size': `${grid * zoom}px`, '--major-grid-size': `${grid * zoom * (model.project.gridDivisions ?? 10)}px`, '--pan-x': `${model.view.x}px`, '--pan-y': `${model.view.y}px` },
      canvasStyle: { transform: `translate(${model.view.x}px, ${model.view.y}px) scale(${zoom})`, '--screen-pixel': `${1 / zoom}px`, '--handle-size': `${9 / zoom}px` } };
  }
  function render() {
    actions.updateFileStatus();
    syncFontStylesheets();
    ui.update({ editor: editorSnapshot(model), canvas: canvasData() });
    actions.renderInspector();
    renderStyleMarkers();
  }
  function syncFontStylesheets() {
    const urls = actions.fonts.stylesheets(model.project.boxes), links = [...document.querySelectorAll('link[data-mockout-font]')];
    for (const link of links) { if (!urls.includes(link.href)) link.remove(); }
    for (const url of urls) {
      if (links.some(link => link.isConnected && link.href === url)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = url; link.dataset.mockoutFont = '';
      document.head.append(link);
    }
  }
  return { actions: { renderStyleMarkers, render, syncFontStylesheets }, init() {} };
}
