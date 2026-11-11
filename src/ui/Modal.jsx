import { useLayoutEffect, useRef } from 'react';
import { navigateDialog } from './keyboard.js';

export function Modal({ ui, name, open, busy, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} {...props} onKeyDown={navigateDialog} onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => ui.commands.dialogClosed(name)} />;
}
