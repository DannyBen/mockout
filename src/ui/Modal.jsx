import { useLayoutEffect, useRef } from 'react';

export function Modal({ ui, name, open, busy, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  function keyDown(event) {
    const dialog = ref.current;
    const direction = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (direction && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const options = [...dialog.querySelectorAll('button:not(.icon-button):not(:disabled)')].filter(button => button.getClientRects().length);
      const index = options.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      options[(index + direction + options.length) % options.length].focus();
    } else if (event.key === 'Tab') {
      const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  return <dialog ref={ref} {...props} onKeyDown={keyDown} onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => ui.commands.dialogClosed(name)} />;
}
