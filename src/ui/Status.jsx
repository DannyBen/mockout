import { useSyncExternalStore } from 'react';
import { Icon } from './Icon.jsx';
import { HoldButton } from './HoldButton.jsx';

export function Status({ ui }) {
  const { file: f, notice: n } = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  return <>


  <input id="open-file" onChange={async event => { const input = event.currentTarget; const file = input.files?.[0]; if (file) await ui.commands.openProjectFile(file); input.value = ''; }} type="file" accept=".json,application/json" hidden />
  <div id="file-area">
    <div id="notice" role="alert" hidden={!n?.visible} data-kind={n?.kind} className={n?.fileUpdate ? 'file-update' : ''}>
      <span id="notice-message">{n?.message}</span>
      <div id="recovery-actions" hidden={!n?.recovery}>
        <button type="button" id="download-saved-button" onClick={() => ui.commands.downloadSavedData()}>Download saved data</button>
        <HoldButton ui={ui} id="recovery-reset-button">Hold to reset app</HoldButton>
      </div>
      <div id="file-change-actions" hidden={!n?.showFileActions}>
        <button type="button" id="reload-file" hidden={!n?.reload} onClick={() => ui.commands.reloadFile()}>Reload file</button>
        <button type="button" id="save-ours" hidden={!n?.saveOurs} onClick={() => ui.commands.saveOurs()}>Save ours</button>
      </div>
    </div>
    <div id="file-connection">
      <span id="file-status" role="status" data-state={f?.status ?? 'local'} data-connected={String(f?.connected || false)} aria-label={f?.description ?? 'Local session, saved in this browser'}><span className="file-icon" aria-hidden="true"><Icon name={f?.icon ?? 'web_asset'} /></span><span className="file-name">{f?.name ?? 'Local session'}</span><span className="file-detail">{f?.label}</span></span>
      <button type="button" id="reconnect-file" hidden={!f?.needsPermission} onClick={() => ui.commands.reconnectFile()}>Reconnect</button>
      <button type="button" id="work-locally" hidden={!f?.needsPermission} onClick={() => ui.commands.workLocally()}>Work locally</button>
    </div>
  </div>

  </>;
}
