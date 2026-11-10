import MockoutColors from '../core/colors.js';

export function renderColorBlock(element, { color = null, label, selected = false, mixed = false, action = null }) {
    element.classList.add('color-block');
    element.classList.toggle('transparent', !color && !mixed);
    element.classList.toggle('mixed', mixed);
    element.style.setProperty('--block-color', color || 'var(--ui-surface)');
    const style = getComputedStyle(element);
    const backgrounds = color ? [color] : [style.getPropertyValue(mixed ? '--ui-mixed' : '--ui-checker').trim(),
      style.getPropertyValue('--ui-surface').trim()];
    element.style.setProperty('--block-text', MockoutColors.contrastingText(...backgrounds));
    const name = document.createElement('span');
    name.className = 'color-block-label';
    name.textContent = label;
    const mark = document.createElement('span');
    mark.className = 'color-block-mark';
    mark.setAttribute('aria-hidden', 'true');
    if (action) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('icon');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `assets/material-symbols/sprite.svg#${action}`);
      svg.append(use); mark.append(svg);
    } else mark.textContent = selected ? '✓' : '';
    element.replaceChildren(name, mark);
}
