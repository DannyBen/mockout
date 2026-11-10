import { useSyncExternalStore } from 'react';
import { Modal } from './Modal.jsx';

export function Dialogs({ ui }) {
  const { dialogs: d } = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  return <>
  <Modal ui={ui} name="ai" open={d?.open === 'ai'} busy={false} id="ai-dialog" className="modal-dialog" aria-labelledby="ai-heading" aria-describedby="ai-description">
    <header>
      <h2 id="ai-heading">Work with AI</h2>
      <button type="button" id="close-ai-dialog" onClick={() => ui.commands.closeDialog()} aria-label="Close AI dialog" className="icon-button"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#close"></use></svg></button>
    </header>
    <p id="ai-description">Create and refine mockups with your own AI assistant while you watch. Your assistant needs access to files on your computer. Copy a prompt into your AI app, and it will guide you through connecting a shared project file so changes appear on the canvas.</p>
    <section>
      <h3>Install the skill <span className="recommendation">Recommended</span></h3>
      <p>Add Mockout to your AI app for this and future conversations.</p>
      <button type="button" data-ai-prompt="install" onClick={() => ui.commands.copyAIPrompt('install')}>Copy skill setup prompt</button>
    </section>
    <section>
      <h3>Quick run</h3>
      <p>Get started for this conversation without installation.</p>
      <button type="button" data-ai-prompt="quick" onClick={() => ui.commands.copyAIPrompt('quick')}>Copy quick-run prompt</button>
    </section>
    <p id="ai-copy-status" role="status" aria-atomic="true">{d?.aiCopyStatus}</p>
  </Modal>

  <Modal ui={ui} name="open" open={d?.open === 'open'} busy={false} id="open-project-dialog" className="modal-dialog" aria-labelledby="open-project-heading" aria-describedby="open-project-description">
    <header>
      <h2 id="open-project-heading">Open mockup</h2>
      <button type="button" id="close-open-project" onClick={() => ui.commands.closeDialog()} aria-label="Cancel opening mockup" className="icon-button"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#close"></use></svg></button>
    </header>
    <p id="open-project-description">Choose how to open <strong id="open-project-name">{d?.fileName}</strong>.</p>
    <button type="button" id="open-local-copy" disabled={d?.opening} onClick={() => ui.commands.openChoice(false)} className="dialog-option" autoFocus>
      <strong>Open a local copy</strong>
      <span>Explore and edit without changing the original file. Your work stays in Local Session; Ctrl+S lets you choose how to save.</span>
    </button>
    <button type="button" id="open-connected-file" disabled={d?.opening || !d?.canConnectOpen} onClick={() => ui.commands.openChoice(true)} className="dialog-option">
      <strong>Open connected file</strong>
      <span>Automatically save changes to this file and load changes made by other tools, including AI.</span>
    </button>
    <p id="open-project-unavailable" hidden={d?.canConnectOpen}>This browser cannot connect this file. You can still open a local copy.</p>
  </Modal>

  <Modal ui={ui} name="save" open={d?.open === 'save'} busy={d?.saving} id="save-project-dialog" className="modal-dialog" aria-labelledby="save-project-heading" aria-describedby="save-project-description">
    <header>
      <h2 id="save-project-heading">Save mockup</h2>
      <button type="button" id="close-save-project" onClick={() => ui.commands.closeDialog()} disabled={d?.saving} aria-label="Cancel saving mockup" className="icon-button"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#close"></use></svg></button>
    </header>
    <p id="save-project-description">Choose how to save your mockup.</p>
    <button type="button" id="save-once" disabled={d?.saving} onClick={() => ui.commands.saveChoice(false)} className="dialog-option" autoFocus>
      <strong>Save once</strong>
      <span>Save a JSON file and continue editing in Local Session. The file stays unchanged as you work.</span>
    </button>
    <button type="button" id="save-connected-file" disabled={d?.saving || !d?.canConnectSave} onClick={() => ui.commands.saveChoice(true)} className="dialog-option">
      <strong>Save and connect</strong>
      <span>Save a JSON file, then automatically save changes and load edits made by other tools, including AI.</span>
    </button>
    <p id="save-project-unavailable" hidden={d?.canConnectSave}>This browser cannot connect files. You can still save once.</p>
    <p id="save-project-error" role="alert" hidden={!d?.error}>{d?.error}</p>
  </Modal>


  </>;
}
