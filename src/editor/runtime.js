import { createEditorState } from './state.js';
import { findElements } from './elements.js';
import { createSelectors } from './selectors.js';
import { createCanvas } from './canvas.js';
import { createInspector } from '../ui/inspector-controller.js';
import { createFileSync } from './file-sync.js';
import { createController } from './controller.js';
import { createProperties } from './properties.js';
import { createPresentation } from './presentation.js';

export function startEditor(ui) {
  // Access storage inside the loader's try/catch: browsers can deny even the
  // localStorage getter, while the canvas and manual file save must still work.
  const model = createEditorState({ getItem: key => localStorage.getItem(key) });
  const actions = {};
  const listeners = new AbortController();
  const intervals = new Set();
  const events = {
    on(target, name, handler, options) {
      // A native signal also cleans up transient swatch/text-editor listeners
      // without a JS disposer list retaining every discarded DOM node.
      target.addEventListener(name, handler, {
        ...(typeof options === 'boolean' ? { capture: options } : options),
        signal: listeners.signal,
      });
    },
    interval(handler, delay) {
      const timer = setInterval(handler, delay);
      intervals.add(timer);
      return timer;
    },
  };
  const context = { model, elements: findElements(), actions, events, ui };
  const modules = [createSelectors, createProperties, createPresentation, createCanvas, createInspector, createFileSync, createController].map(create => {
    const module = create(context);
    Object.assign(actions, module.actions);
    return module;
  });
  ui.actions = actions;
  // UI commands deliberately expose editor operations rather than the mutable
  // model or the internal cross-service action registry.
  ui.commands = {
    undo: () => actions.undo(),
    redo: () => actions.redo(),
    setTool: tool => actions.setTool(tool),
    setGrid: grid => actions.change(() => { model.project.grid = grid; }),
    toggleTheme: () => actions.toggleTheme(),
    toggleHelp: () => actions.toggleHelp(),
    toggleProjectMenu: () => actions.toggleToolbarMenu(actions.toolbarMenus[0]),
    closeProjectMenu: () => actions.closeProjectMenu(),
    newBlank: () => actions.newBlank(),
    loadWelcome: () => actions.loadWelcome(),
    openPreview: () => actions.openPreview(),
    saveProject: as => actions.saveProject(as),
    chooseProjectFile: () => actions.chooseProjectFile(),
    closeInspector: () => actions.closeInspector(),
    showInspectorParent: view => actions.showInspectorParent(view),
    setBoxField: (id, value) => actions.setBoxField(id, value),
    previewStyleField: (id, value) => actions.previewStyleField(id, value),
    finishStyleEdit: () => actions.finishStyleEdit(),
    previewOpacity: value => actions.previewOpacity(value),
    finishOpacityEdit: () => actions.finishOpacityEdit(),
    setGridSetting: (property, value) => actions.setGridSetting(property, value),
    setAlignment: (axis, value) => actions.setAlignment(axis, value),
    assignFontFamily: family => actions.assignFontFamily(family),
    setGoogleFont: value => actions.setGoogleFont(value),
    openColor: (property, side) => actions.openColor(property, side),
    openCanvasColor: property => actions.openCanvasColorEditor(property),
    openManageSwatches: event => actions.openManageSwatches(event),
    assignColor: id => actions.assignColor(id),
    openSwatchEditor: id => actions.openSwatchEditor(id),
    openEditorColorPicker: side => actions.openEditorColorPicker(side),
    setDarkBehavior: mode => actions.setDarkBehavior(mode),
    setColorMode: mode => actions.setColorMode(mode),
    setColorHex: text => actions.setColorHex(text),
    readColorHex: () => actions.readHex(),
    setSwatchName: name => actions.setSwatchName(name),
    setColorChannel: (index, value) => actions.updateFromChannels(index, value),
    acceptColor: () => actions.acceptColor(),
    deleteSwatch: () => actions.deleteSwatch(),
    saveColor: () => actions.saveColor(),
    openAI: () => actions.openAI(),
    copyAIPrompt: kind => actions.copyAIPrompt(kind),
    closeDialog: () => actions.closeDialog(),
    dialogClosed: name => actions.dialogClosed(name),
    saveChoice: connect => actions.saveProject(true, null, false, connect),
    openChoice: connect => actions.finishOpeningProject(connect),
    openProjectFile: file => actions.openProjectFile(file),
    reconnectFile: () => { if (model.projectFileHandle) actions.checkFileConnection(model.projectFileHandle, model.fileConnectionRevision, true); },
    workLocally: () => { actions.setProjectFileHandle(null); context.elements.workspace.focus(); },
    reloadFile: () => actions.checkExternalFile(true),
    saveOurs: () => { if (model.fileConflict && model.filePendingStamp !== null) actions.saveProject(false, model.filePendingStamp); },
    resetEverything: () => actions.resetEverything(),
    downloadSavedData: () => actions.downloadSavedData(),
    selectStyleTarget: id => { if (!model.spaceDown) actions.selectStyleTarget(actions.boxStyle.targets.find(target => target.id === id)); },
  };
  for (const module of modules) module.init();
  return {
    destroy() {
      listeners.abort();
      for (const timer of intervals) clearInterval(timer);
      clearTimeout(model.fileSaveTimer);
      clearTimeout(model.aiCopyTimer);
      model.fileObserver?.disconnect();
      model.fileConnectionRevision++;
      model.projectFileHandle = null;
      model.pendingProject = null;
      model.textEditor?.blur();
    },
  };
}
