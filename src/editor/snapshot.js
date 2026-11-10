// Publish values, never the mutable document or native file/gesture resources.
// React keeps this snapshot until the editor explicitly publishes another one.
export function editorSnapshot(model) {
  return {
    project: structuredClone(model.project),
    selectedId: model.selectedId,
    selectedIds: [...model.selectedIds],
    view: { ...model.view },
    tool: model.tool,
    placing: Boolean(model.placement),
    locked: model.fileLocked,
    savedProjectIssue: model.savedProjectIssue,
    canUndo: model.undoStack.length > 0,
    canRedo: model.redoStack.length > 0,
  };
}
