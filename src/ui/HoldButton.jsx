import { useEffect, useRef, useState } from 'react';

export function HoldButton({ ui, className = '', children, ...props }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef(null);
  const cancel = () => { clearTimeout(timer.current); timer.current = null; setHolding(false); };
  const start = () => {
    if (timer.current || props.disabled) return;
    setHolding(true);
    timer.current = setTimeout(() => { cancel(); ui.commands.resetEverything(); }, 1200);
  };
  useEffect(() => {
    window.addEventListener('pointerup', cancel);
    return () => { window.removeEventListener('pointerup', cancel); clearTimeout(timer.current); };
  }, []);
  const key = (event, action) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); action();
  };
  return <button type="button" {...props} className={`${className} hold-action${holding ? ' holding' : ''}`}
    onPointerDown={event => { if (event.button === 0) start(); }} onPointerLeave={cancel} onPointerCancel={cancel}
    onKeyDown={event => key(event, start)} onKeyUp={event => key(event, cancel)} onBlur={cancel} onClick={event => event.preventDefault()}>{children}</button>;
}
