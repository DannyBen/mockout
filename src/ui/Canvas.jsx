import { useSyncExternalStore } from 'react';

function Handles() {
  return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(direction => <span key={direction} className="handle" data-handle={direction} />);
}

export function Canvas({ ui }) {
  const { canvas: c, markers: m } = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  return <main id="workspace" tabIndex="-1" aria-label="Mock canvas" className={c?.className} style={c?.workspaceStyle}>
    <div id="canvas" aria-label="Boxes" style={c?.canvasStyle}>
      {c?.boxes.map(box => <div key={box.id} className={box.className} data-id={box.id} style={box.style}>
        <div className="box-content" style={box.contentStyle}>
          {/* Keep the editable node until finishing; a new key then restores
              saved text even when the browser draft was canceled. */}
          <span key={box.editing ? 'editing' : 'label'} className={`box-label${box.editing ? ' text-editor' : ''}`} style={box.labelStyle}
            contentEditable={box.editing ? 'plaintext-only' : undefined} suppressContentEditableWarning>{box.text}</span>
        </div>
        {box.handles && <Handles />}
      </div>)}
      {c?.bounds && <div className="selection-bounds" style={c.bounds}><Handles /></div>}
      {c?.marquee && <div className="marquee" style={c.marquee} />}
    </div>
    <svg id="style-guides" aria-hidden="true" hidden={!m?.visible}>
      {m?.items.filter(marker => !marker.hidden).map(marker => <line key={marker.id} {...marker.line} className={marker.active ? 'active' : undefined} />)}
    </svg>
    <div id="style-markers" role="group" aria-label={m?.label ?? 'Box style targets'} hidden={!m?.visible}>
      {m?.items.map(marker => <button key={marker.id} type="button" className="style-marker" data-style-target={marker.id} data-kind={marker.kind} data-axis={marker.axis}
        hidden={marker.hidden} aria-pressed={marker.active} aria-label={marker.label} aria-controls="inspector" style={marker.style} onClick={() => ui.commands.selectStyleTarget(marker.id)} />)}
    </div>
  </main>;
}
