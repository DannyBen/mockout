import { useLayoutEffect, useRef } from 'react';
import Colors from '../core/colors.js';
import { Icon } from './Icon.jsx';

export function ColorBlock({ as: Tag = 'button', color, label, selected = false, mixed = false, action, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const backgrounds = color ? [color] : [style.getPropertyValue(mixed ? '--ui-mixed' : '--ui-checker').trim(), style.getPropertyValue('--ui-surface').trim()];
    ref.current.style.setProperty('--block-text', Colors.contrastingText(...backgrounds));
  });
  return <Tag ref={ref} {...(Tag === 'button' ? { type: 'button' } : {})} {...props}
    className={`color-block ${!color && !mixed ? 'transparent' : ''} ${mixed ? 'mixed' : ''} ${props.className || ''}`} data-mixed={mixed || undefined}
    style={{ ...props.style, '--block-color': color || 'var(--ui-surface)' }}>
    <span className="color-block-label">{label}</span>
    <span className="color-block-mark" aria-hidden="true">{action ? <Icon name={action} /> : selected ? '✓' : ''}</span>
  </Tag>;
}
