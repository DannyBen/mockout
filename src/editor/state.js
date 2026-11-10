import MockoutProject from '../core/project.js';
import MockoutBoxStyle from '../core/box-style.js';

export function createEditorState(storage) {
  const model = {};
  model.project = MockoutProject.freshState();
  model.savedProjectIssue = '';
  model.firstLoad = false;
  model.selectedId = null;
  model.selectedIds = new Set();
  model.gesture = null;
  model.opacityBefore = null;
  model.styleBefore = null;
  model.lastBoxClick = null;
  model.pointerPosition = null;
  model.placement = null;
  model.copiedBoxes = null;
  model.isolatedCopyIds = null;
  model.textEditor = null;
  model.projectFileHandle = null;
  model.fileConnectionRevision = 0;
  model.fileConnectionSave = Promise.resolve();
  model.fileObserver = null;
  model.fileStamp = null;
  model.fileBaseline = null;
  model.fileLocked = false;
  model.fileConflict = false;
  model.filePendingStamp = null;
  model.fileWriting = false;
  model.fileSaving = false;
  model.fileSaveTimer = null;
  model.fileSaveError = '';
  model.fileChecks = Promise.resolve();
  model.pendingProject = null;
  model.fileOpenBusy = false;
  model.filePolling = false;
  model.inspectorOpen = false;
  model.inspectorKind = 'box';
  model.inspectorPoint = { x: 12, y: 12 };
  model.inspectorView = 'properties';
  model.inspectorHistory = [];
  model.activePropertySection = 'box';
  model.activeCanvasSection = 'canvas';
  model.borderTarget = MockoutBoxStyle.targets[1];
  model.paddingTarget = MockoutBoxStyle.targets[1];
  model.lastPropertyFocus = new Map();
  model.tool = 'select';
  model.projectMenuOpen = false;
  model.helpOpen = false;
  model.spaceDown = false;
  model.altDown = false;
  model.view = { x: 0, y: 0, zoom: 1 };
  model.colorTarget = null;
  model.colorMode = 'hsb';
  model.editorColor = '#6746b7';
  model.editorSide = 'light';
  model.editorLight = { color: model.editorColor, mode: model.colorMode };
  model.editorDark = { mode: 'invert', color: null, colorMode: model.colorMode };
  model.pickerOnAccept = null;
  model.undoStack = [];
  model.redoStack = [];
  model.aiCopyTimer = null;

  try {
    const raw = storage.getItem(MockoutProject.storageKey);
    model.firstLoad = raw === null;
    if (raw) {
      const saved = JSON.parse(raw);
      if (MockoutProject.validProject(saved)) model.project = saved;
      else model.savedProjectIssue = 'Saved project is unsupported. Local data was left untouched; autosave is paused.';
    }
  } catch {
    model.savedProjectIssue = 'Could not read the saved project. Local data was left untouched; autosave is paused.';
  }
  return model;
}
