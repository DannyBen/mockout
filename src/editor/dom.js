// Stable native anchors for gestures, focus restoration and layout measurement.
export function editorDOM() {
  const workspace = document.querySelector('#workspace');
  const canvas = document.querySelector('#canvas');
  const inspector = document.querySelector('#inspector');
  const projectMenu = document.querySelector('#project-menu');
  const projectMenuHolder = document.querySelector('#project-menu-holder');
  const inspectorNav = document.querySelector('#inspector-nav');
  const saveOnceButton = document.querySelector('#save-once');
  const saveConnectedButton = document.querySelector('#save-connected-file');
  const openLocalCopyButton = document.querySelector('#open-local-copy');
  const propertySections = [
    { id: 'box', label: 'Box', element: document.querySelector('#box-appearance-properties') },
    { id: 'colors', label: 'Colors', element: document.querySelector('#color-properties') },
    { id: 'text', label: 'Text', element: document.querySelector('#text-properties') },
    { id: 'font', label: 'Font', element: document.querySelector('#font-properties') },
    { id: 'border', label: 'Border', element: document.querySelector('#border-properties') },
    { id: 'padding', label: 'Padding', element: document.querySelector('#padding-properties') },
  ];
  const canvasSections = [
    { id: 'canvas', label: 'Colors', element: document.querySelector('#canvas-properties') },
    { id: 'grid', label: 'Grid', element: document.querySelector('#grid-properties') },
  ];
  return { workspace, canvas, inspector, projectMenu, projectMenuHolder, inspectorNav, saveOnceButton, saveConnectedButton, openLocalCopyButton, propertySections, canvasSections };
}
