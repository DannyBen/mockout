import { flushSync } from 'react-dom';

export function createUIStore() {
  let snapshot = { inspector: { visible: false, view: 'properties', kind: 'box', section: 'box', canvasSection: 'canvas', parts: [] }, palette: null };
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update(change) {
      snapshot = { ...snapshot, ...change };
      // Native editor actions measure the inspector and restore focus immediately
      // after changing views. Commit those view changes before they continue.
      flushSync(() => { for (const listener of listeners) listener(); });
    },
  };
}
