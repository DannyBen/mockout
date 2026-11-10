import { Canvas } from './Canvas.jsx';
import { Toolbar } from './Toolbar.jsx';
import { Help } from './Help.jsx';
import { Dialogs } from './Dialogs.jsx';
import { Inspector } from './Inspector.jsx';
import { Status } from './Status.jsx';

export function App({ ui }) {
  return <>
    <Canvas />
    <Toolbar ui={ui} />
    <Help ui={ui} />
    <Dialogs ui={ui} />
    <Inspector ui={ui} />
    <Status ui={ui} />
  </>;
}
