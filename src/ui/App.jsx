import { Canvas } from './Canvas.jsx';
import { Toolbar } from './Toolbar.jsx';
import { Help } from './Help.jsx';
import { Dialogs } from './Dialogs.jsx';
import { Inspector } from './Inspector.jsx';
import { Status } from './Status.jsx';

export function App({ ui }) {
  return <>
    <Canvas />
    <Toolbar />
    <p id="placement-hint" role="status" hidden>Move copy · Click or Enter to place · Esc to cancel</p>
    <Help />
    <Dialogs />
    <Inspector ui={ui} />
    <Status />
  </>;
}
