export function createPresentation({ model, elements, actions, ui }) {
  function publishPresentation() {
    const handle = model.projectFileHandle;
    const status = !handle ? 'local' : model.fileConflict ? model.filePendingStamp === null ? 'error' : 'conflict'
      : model.fileNeedsPermission ? 'reconnect' : model.fileSaveError ? 'error' : 'connected';
    const [icon, label] = {
      local: ['web_asset', ''], connected: ['check_circle', ''], reconnect: ['link_off', ''],
      conflict: ['warning', 'Conflict'], error: ['error', model.fileSaveError ? 'Save failed' : 'File error'],
    }[status];
    ui.update({
      file: {
        status, icon, label, name: handle ? handle.name.replace(/\.json$/i, '') : 'Local session',
        description: handle ? `${handle.name}: ${label || (status === 'reconnect' ? 'Reconnect' : 'Connected')}` : 'Local session, saved in this browser',
        connected: Boolean(handle) && !model.fileNeedsPermission, needsPermission: model.fileNeedsPermission,
      },
      notice: { ...model.notice, recovery: Boolean(model.savedProjectIssue), reload: model.fileConflict, saveOurs: model.filePendingStamp !== null },
      dialogs: {
        open: model.dialog, saving: model.fileSaving, opening: model.fileOpenBusy, error: model.saveDialogError,
        fileName: model.pendingProject?.file.name || '', canConnectOpen: Boolean(model.pendingProject?.handle),
        canConnectSave: Boolean(window.showSaveFilePicker), aiCopyStatus: model.aiCopyStatus,
      },
    });
  }
  function showNotice(message, kind = '') {
    model.notice = { visible: true, message, kind, fileUpdate: false, showFileActions: model.fileConflict };
    publishPresentation();
  }
  function hideNotice() { model.notice.visible = false; publishPresentation(); }
  function hideFileActions() { model.notice.showFileActions = false; publishPresentation(); }
  function openDialog(name) { model.dialog = name; publishPresentation(); }
  function closeDialog() { model.dialog = null; publishPresentation(); }
  function dialogClosed(name) {
    if (model.dialog === name) model.dialog = null;
    if (name === 'ai') { clearTimeout(model.aiCopyTimer); model.aiCopyStatus = ''; }
    if (name === 'open') model.pendingProject = null;
    publishPresentation();
    elements.workspace.focus();
    if (name === 'save') { actions.checkExternalFile(); actions.queueFileSave(); }
  }
  return { actions: { publishPresentation, showNotice, hideNotice, hideFileActions, openDialog, closeDialog, dialogClosed }, init() {} };
}
