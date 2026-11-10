export function findElements() {
  const workspace = document.querySelector('#workspace');
  const canvas = document.querySelector('#canvas');
  const styleMarkers = document.querySelector('#style-markers');
  const styleGuides = document.querySelector('#style-guides');
  const inspector = document.querySelector('#inspector');
  const notice = document.querySelector('#notice');
  const noticeMessage = document.querySelector('#notice-message');
  const recoveryActions = document.querySelector('#recovery-actions');
  const fileStatus = document.querySelector('#file-status');
  const reconnectFileButton = document.querySelector('#reconnect-file');
  const workLocallyButton = document.querySelector('#work-locally');
  const fileChangeActions = document.querySelector('#file-change-actions');
  const reloadFileButton = document.querySelector('#reload-file');
  const saveOursButton = document.querySelector('#save-ours');
  const projectMenu = document.querySelector('#project-menu');
  const projectMenuButton = document.querySelector('#project-menu-button');
  const projectMenuHolder = document.querySelector('#project-menu-holder');
  const themeButton = document.querySelector('#theme-button');
  const helpPanel = document.querySelector('#help-panel');
  const helpButton = document.querySelector('#help-button');
  const aiDialog = document.querySelector('#ai-dialog');
  const aiCopyStatus = document.querySelector('#ai-copy-status');
  const openProjectDialog = document.querySelector('#open-project-dialog');
  const saveProjectDialog = document.querySelector('#save-project-dialog');
  const saveOnceButton = document.querySelector('#save-once');
  const saveConnectedButton = document.querySelector('#save-connected-file');
  const closeSaveButton = document.querySelector('#close-save-project');
  const saveDialogError = document.querySelector('#save-project-error');
  const openLocalCopyButton = document.querySelector('#open-local-copy');
  const openConnectedFileButton = document.querySelector('#open-connected-file');
  const welcomeButton = document.querySelector('#welcome-button');
  const welcomeHint = document.querySelector('#welcome-hint');
  const toolButtons = [...document.querySelectorAll('[data-tool]')];
  const gridButtons = [...document.querySelectorAll('[data-grid]')];
  const boxColorButtons = [...document.querySelectorAll('[data-color-property]')];
  const canvasColorButtons = [...document.querySelectorAll('[data-canvas-color-property]')];
  const alignButtons = [...document.querySelectorAll('[data-align-axis]')];
  const inspectorNav = document.querySelector('#inspector-nav');
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
  const channels = [1, 2, 3].map(n => document.querySelector(`#channel-${n}`));
  const channelValues = [1, 2, 3].map(n => document.querySelector(`#channel-${n}-value`));
  const opacityRange = document.querySelector('#box-opacity-range');
  const fontFamilySelect = document.querySelector('#box-font-family');
  const googleFontInput = document.querySelector('#box-google-font');
  const materialStyleSelect = document.querySelector('#box-material-style');
  const saveAsButton = document.querySelector('#save-as-button');
  return {
    workspace, canvas, styleMarkers, styleGuides, inspector,
    notice, noticeMessage, recoveryActions, fileStatus, reconnectFileButton,
    workLocallyButton, fileChangeActions, reloadFileButton, saveOursButton, projectMenu,
    projectMenuButton, projectMenuHolder, themeButton, helpPanel, helpButton,
    aiDialog, aiCopyStatus, openProjectDialog, saveProjectDialog, saveOnceButton,
    saveConnectedButton, closeSaveButton, saveDialogError, openLocalCopyButton, openConnectedFileButton,
    welcomeButton, welcomeHint, toolButtons, gridButtons, boxColorButtons,
    canvasColorButtons, alignButtons, inspectorNav, propertySections,
    canvasSections, channels, channelValues, opacityRange, fontFamilySelect,
    googleFontInput, materialStyleSelect, saveAsButton,
  };
}
