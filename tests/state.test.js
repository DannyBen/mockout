import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../src/editor/state.js';
import Project from '../src/core/project.js';

test('editor initialization preserves an existing version-1 project byte for byte', () => {
  const project = Project.freshState();
  delete project.gridBase;
  delete project.gridDivisions;
  const raw = JSON.stringify(project, null, 2);
  const storage = { getItem: key => { assert.equal(key, 'mockout-project'); return raw; } };
  const editor = createEditorState(storage);
  assert.deepEqual(editor.project, project);
  assert.equal(editor.firstLoad, false);
  assert.equal(editor.savedProjectIssue, '');
  assert.deepEqual(editor.undoStack, []);
  assert.equal(raw, JSON.stringify(editor.project, null, 2));
});

test('unsupported, malformed and unreadable saved data stays untouched and blocks autosave', () => {
  for (const raw of ['{"version":2,"important":"keep"}', '{broken']) {
    const writes = [];
    const storage = { getItem: () => raw, setItem: (...args) => writes.push(args) };
    const editor = createEditorState(storage);
    {
      assert.match(editor.savedProjectIssue, /left untouched; autosave is paused/);
      Project.persist(storage, Project.storageKey, editor.project, editor.savedProjectIssue);
      assert.deepEqual(writes, []);
    }
  }
  const editor = createEditorState({ getItem() { throw Error('Unavailable'); } });
  assert.match(editor.savedProjectIssue, /left untouched; autosave is paused/);
});
