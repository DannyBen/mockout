export function Status() {
  return <>


  <input id="open-file" type="file" accept=".json,application/json" hidden />
  <div id="file-area">
    <div id="notice" role="alert" hidden>
      <span id="notice-message"></span>
      <div id="recovery-actions" hidden>
        <button type="button" id="download-saved-button">Download saved data</button>
        <button type="button" id="recovery-reset-button" className="hold-action">Hold to reset app</button>
      </div>
      <div id="file-change-actions" hidden>
        <button type="button" id="reload-file" hidden>Reload file</button>
        <button type="button" id="save-ours">Save ours</button>
      </div>
    </div>
    <div id="file-connection">
      <span id="file-status" role="status" data-state="local" data-connected="false" aria-label="Local session, saved in this browser"><span className="file-icon" aria-hidden="true"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#web_asset"></use></svg></span><span className="file-name">Local session</span><span className="file-detail"></span></span>
      <button type="button" id="reconnect-file" hidden>Reconnect</button>
      <button type="button" id="work-locally" hidden>Work locally</button>
    </div>
  </div>

  </>;
}
