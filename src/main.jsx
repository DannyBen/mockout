import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { App } from './ui/App.jsx';
import { createUIStore } from './ui/store.js';
import { startEditor } from './editor/runtime.js';
import './style.css';

const ui = createUIStore();
const root = createRoot(document.querySelector('#root'));
flushSync(() => root.render(<App ui={ui} />));
const editor = startEditor(ui);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    editor.destroy();
    root.unmount();
  });
}
