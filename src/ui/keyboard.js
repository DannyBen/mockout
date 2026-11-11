const controls = root => [...root.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
  .filter(field => !field.disabled && field.tabIndex >= 0 && field.getClientRects().length);

export function moveInList(event, horizontal = false) {
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  const direction = { ArrowDown: 1, ArrowUp: -1, ...(horizontal ? { ArrowRight: 1, ArrowLeft: -1 } : {}), Home: 'first', End: 'last' }[event.key];
  if (!direction) return;
  const buttons = controls(event.currentTarget).filter(field => field.tagName === 'BUTTON');
  if (!buttons.length) return;
  event.preventDefault();
  const index = buttons.indexOf(document.activeElement);
  const next = direction === 'first' ? 0 : direction === 'last' ? buttons.length - 1 : (index + direction + buttons.length) % buttons.length;
  buttons[next].focus(); buttons[next].scrollIntoView({ block: 'nearest' });
}

export function navigateDialog(event) {
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
  if (!['Tab', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const focus = document.activeElement;
  const fields = controls(event.currentTarget);
  if (event.key !== 'Tab') {
    if (event.shiftKey || focus.isContentEditable || focus.matches('select, textarea, input[type="number"], input[type="range"]')) return;
    const options = fields.filter(field => !field.closest('.dialog-header, .modal-dialog > header'));
    const index = options.indexOf(focus);
    if (index < 0) return;
    event.preventDefault();
    const next = options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length];
    next.focus(); next.scrollIntoView({ block: 'nearest' });
    return;
  }
  const index = fields.indexOf(document.activeElement);
  if (!fields.length || (index >= 0 && (event.shiftKey ? index !== 0 : index !== fields.length - 1))) return;
  event.preventDefault(); fields[event.shiftKey ? fields.length - 1 : 0].focus();
}
