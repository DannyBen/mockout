import { useLayoutEffect, useRef } from 'react';

// Native change commits on blur/Enter, rather than on every keystroke. React
// owns the field, while the focused input owns unfinished and invalid text.
export function Input({ as: Tag = 'input', value, onCommit, onBlur, ...props }) {
  const ref = useRef(null);
  const latest = useRef(null);
  latest.current = { value, onCommit, onBlur };
  useLayoutEffect(() => {
    const input = ref.current;
    const change = event => {
      if (latest.current.onCommit?.(input.value, input) === false) { event.preventDefault(); return; }
      input.value = latest.current.value ?? '';
    };
    input.addEventListener('change', change);
    return () => input.removeEventListener('change', change);
  }, []);
  useLayoutEffect(() => {
    if (document.activeElement !== ref.current) ref.current.value = value ?? '';
  });
  return <Tag ref={ref} defaultValue={value ?? ''} required={Tag === 'input' && props.type === 'number'} {...props} onBlur={event => {
    latest.current.onBlur?.(event);
    ref.current.value = latest.current.value ?? '';
  }} />;
}
