export function moveInList(event, horizontal = false) {
  const direction = { ArrowDown: 1, ArrowUp: -1, ...(horizontal ? { ArrowRight: 1, ArrowLeft: -1 } : {}), Home: 'first', End: 'last' }[event.key];
  if (!direction) return;
  const buttons = [...event.currentTarget.querySelectorAll('button')].filter(button => !button.hidden && !button.disabled);
  if (!buttons.length) return;
  event.preventDefault();
  const index = buttons.indexOf(document.activeElement);
  const next = direction === 'first' ? 0 : direction === 'last' ? buttons.length - 1 : (index + direction + buttons.length) % buttons.length;
  buttons[next].focus(); buttons[next].scrollIntoView({ block: 'nearest' });
}

export function trapInspectorFocus(event) {
  if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
  const fields = [...event.currentTarget.querySelectorAll('button, input, select, a[href]')]
    .filter(field => !field.disabled && field.tabIndex >= 0 && field.getClientRects().length);
  const index = fields.indexOf(document.activeElement);
  if (!fields.length || (index >= 0 && (event.shiftKey ? index !== 0 : index !== fields.length - 1))) return;
  event.preventDefault(); fields[event.shiftKey ? fields.length - 1 : 0].focus();
}
