const MockoutColorPicker = {
  create(element, { state, color, theme, onPreview, onLayout, onPick, onSave, onDelete }) {
    const find = selector => element.querySelector(selector);
    const name = find('[data-palette-name]'), choices = find('[data-palette-choices]');
    const strip = find('[data-palette-colors]'), editor = find('[data-palette-editor]');
    const nameInput = find('[data-palette-title]'), error = find('[role="alert"]');
    const hexInput = find('[data-palette-hex]'), darkMode = find('[data-palette-dark]');
    const copyButton = find('[data-copy-palette]');
    const sideButtons = [...element.querySelectorAll('[data-palette-side]')];
    const controls = [...editor.querySelectorAll('.palette-slider')].map(row => ({
      axis: row.dataset.axis, group: row.dataset.group,
      range: row.querySelector('input[type="range"]'), number: row.querySelector('input[type="number"]'),
      track: row.querySelector('.palette-track'), marks: row.querySelector('.palette-marks'),
    }));
    const countButtons = [...editor.querySelectorAll('[data-count]')];
    const axes = ['l', 'c', 'h'];
    const channels = ['Lightness', 'Chroma', 'Hue'];
    const palettes = () => state().palettes ?? [];
    const get = id => palettes().find(palette => palette.id === id);
    const legacyColors = () => {
      const owned = new Set(palettes().flatMap(palette => palette.colors));
      return state().swatches.filter(color => !owned.has(color.id));
    };
    let paletteId = null, selectedId = null, draft = null, choosing = false, gradientKey = '', side = 'light', hexDirty = false, hexColor = '';
    const recipe = () => MockoutColors.paletteRecipe(draft, side);

    const clamp = value => Math.max(0, Math.min(1, value));
    const increment = axis => axis === 'c' ? .001 : .1;
    const rounded = (value, axis) => Number((Math.round(value / increment(axis)) * increment(axis)).toFixed(3));
    function stepPosition(value, [min, max]) {
      const extent = value < 0 ? -min : max;
      return extent > 0 ? Math.max(-1, Math.min(1, value / extent)) : 0;
    }
    const stepValue = (position, [min, max], axis) => rounded(position * (position < 0 ? -min : max), axis);

    function renderMarks(control) {
      const { axis, group, range, marks, limits } = control;
      marks.replaceChildren();
      if (group === 'step') {
        const end = (Number(range.value) + 1) / 2;
        const span = document.createElement('span');
        span.className = 'palette-step-span';
        span.style.setProperty('--start', Math.min(.5, end));
        span.style.setProperty('--end', Math.max(.5, end));
        const zero = document.createElement('span');
        zero.className = 'palette-zero';
        marks.append(span, zero);
      } else {
        for (let index = 0; index < draft.count; index++) {
          let value = MockoutColors.paletteValue(recipe(), index)[axis];
          if (axis === 'h' && (value < 0 || value > 360)) value = ((value % 360) + 360) % 360;
          const position = limits[1] > limits[0] ? clamp((value - limits[0]) / (limits[1] - limits[0])) : .5;
          const tick = document.createElement('span');
          tick.className = 'palette-tick';
          tick.dataset.value = Number(value.toFixed(3));
          tick.style.setProperty('--position', position);
          marks.append(tick);
        }
      }
    }

    function entries() {
      if (draft) return Array.from({ length: draft.count }, (_, index) => ({
        color: MockoutColors.toHex(MockoutColors.paletteValue(recipe(), index)),
        name: `${draft.name || 'Palette'} ${index + 1}`,
      }));
      const palette = get(paletteId);
      const colors = palette ? palette.colors.map(id => state().swatches.find(color => color.id === id)) : legacyColors();
      return colors.map(item => ({ ...item, color: color(item.id) }));
    }

    function renderStrip() {
      const active = strip.contains(document.activeElement) ? document.activeElement.dataset.colorId : null;
      strip.replaceChildren();
      for (const color of entries()) {
        const item = document.createElement(draft ? 'output' : 'button');
        if (!draft) {
          item.type = 'button'; item.dataset.colorId = color.id;
          item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(color.id === selectedId));
        }
        MockoutColorBlock.render(item, { color: color.color, label: color.name, selected: !draft && color.id === selectedId });
        item.setAttribute('aria-label', `${color.name}: ${color.color.toUpperCase()}`);
        strip.append(item);
      }
      if (active) strip.querySelector(`[data-color-id="${CSS.escape(active)}"]`)?.focus();
    }

    function renderChoices() {
      const items = [...(legacyColors().length ? [{ id: '', name: 'Existing colors' }] : []), ...palettes()];
      const newButton = find('[data-new-palette]');
      choices.replaceChildren();
      for (const palette of items) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'dialog-choice'; button.dataset.paletteId = palette.id;
        button.textContent = palette.name; button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(palette.id === (paletteId ?? '')));
        choices.append(button);
      }
      choices.append(newButton);
    }

    function render() {
      const palette = get(paletteId);
      find('[data-palette-label]').textContent = draft?.name || (draft ? 'New palette' : palette?.name || (legacyColors().length ? 'Existing colors' : 'No palettes'));
      name.hidden = Boolean(draft); nameInput.hidden = !draft;
      name.disabled = Boolean(draft);
      name.setAttribute('aria-expanded', String(choosing));
      find('[data-new-palette]').disabled = Boolean(draft);
      find('[data-edit-palette]').disabled = Boolean(draft) || !palette;
      find('[data-edit-palette]').setAttribute('aria-description', palette ? 'Edit this palette' : 'Existing colors have no palette recipe.');
      const canDelete = palette && MockoutColors.canCount(state(), palette, 0);
      find('[data-delete-palette]').disabled = Boolean(draft) || !canDelete;
      find('[data-delete-palette]').setAttribute('aria-description', !palette ? 'Choose a palette to delete.'
        : canDelete ? 'Delete this palette. You can undo this change.' : 'Palette colors are still in use.');
      for (const button of element.querySelectorAll('[data-edit-palette], [data-delete-palette]')) button.hidden = Boolean(draft);
      editor.hidden = !draft;
      find('[data-palette-theme-actions]').hidden = !draft;
      copyButton.hidden = !draft || draft.dark?.mode !== 'custom';
      copyButton.textContent = side === 'dark' ? 'Copy from light' : 'Copy from dark';
      find('[data-save-palette]').hidden = !draft; find('[data-cancel-palette]').hidden = !draft;
      find('[data-transparent]').hidden = Boolean(draft) || choosing;
      find('[data-palette-hint]').hidden = Boolean(draft) || !choosing;
      find('[data-transparent]').setAttribute('aria-pressed', String(selectedId === null));
      MockoutColorBlock.render(find('[data-transparent]'), { label: 'Transparent', selected: selectedId === null });
      choices.hidden = !choosing; strip.hidden = choosing;
      if (choosing) renderChoices(); else renderStrip();
      if (!draft) return;
      const current = recipe();
      darkMode.value = draft.dark?.mode ?? 'same';
      find('[data-palette-sides]').hidden = draft.dark?.mode !== 'custom';
      sideButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.paletteSide === side)));
      const hex = MockoutColors.toHex(current.base).toUpperCase();
      if (!hexDirty && (document.activeElement !== hexInput || hex !== hexColor)) hexInput.value = hex;
      hexColor = hex;
      if (document.activeElement !== nameInput) nameInput.value = draft.name;
      const existing = draft.id && get(draft.id);
      countButtons.forEach(button => {
        const count = Number(button.dataset.count);
        button.disabled = Boolean(existing) && !MockoutColors.canCount(state(), existing, count);
        button.classList.toggle('active', count === draft.count);
        button.setAttribute('aria-pressed', String(count === draft.count));
      });
      for (const control of controls) {
        const { axis, group, range, number } = control;
        const index = axes.indexOf(axis);
        const min = group === 'base' ? 0 : [-100, -.4, -360][index];
        const max = [100, .4, 360][index];
        const limits = group === 'step' ? MockoutColors.stepLimits(current, axis)
          : axis === 'c' ? [0, current.base.l > 0 && current.base.l < 100
            ? Math.floor(MockoutColors.maxChroma(current.base.l, current.base.h) * 1000) / 1000 : 0]
          : [min, max];
        if (group === 'step') { limits[0] = Math.min(0, limits[0]); limits[1] = Math.max(0, limits[1]); }
        control.limits = limits;
        number.min = min; number.max = max; number.step = increment(axis);
        range.min = group === 'step' ? -1 : limits[0];
        range.max = group === 'step' ? 1 : limits[1];
        range.step = group === 'step' ? 'any' : increment(axis);
        range.value = group === 'step' ? stepPosition(current.step[axis], limits) : current.base[axis];
        if (document.activeElement !== number) number.value = Number(current[group][axis].toFixed(axis === 'c' ? 3 : 1));
        range.disabled = limits[0] === limits[1];
        range.setAttribute('aria-label', `${channels[index]} ${group} slider`);
        range.setAttribute('aria-valuetext', String(current[group][axis]));
        renderMarks(control);
      }
      const key = JSON.stringify([current.base, current.step, draft.count]);
      if (key !== gradientKey) {
        gradientKey = key;
        controls.forEach(({ axis, group, range, track, limits }) => {
          const min = Number(range.min), max = Number(range.max);
          const stops = Array.from({ length: 25 }, (_, stop) => {
            const position = min + (max - min) * stop / 24;
            const value = group === 'step' ? stepValue(position, limits, axis) : position;
            const preview = { ...current, [group]: { ...current[group], [axis]: value } };
            const color = MockoutColors.paletteValue(preview, group === 'base' ? 0 : draft.count - 1);
            if (axis !== 'l' && (color.l <= 1 || color.l >= 99)) color.l = 60;
            if (axis === 'h' && color.c < .02) color.c = .12;
            return MockoutColors.toHex(color);
          });
          track.style.setProperty('--channel-gradient', `linear-gradient(to right, ${stops.join(', ')})`);
        });
      }
    }

    function begin(edit) {
      const palette = get(paletteId);
      if (edit && !palette) return;
      const selected = state().swatches.find(color => color.id === selectedId);
      const base = palette?.base ?? MockoutColors.fromHex(selected ? MockoutColors.hexFor(state().swatches, selected.id, palettes()) : '#4393e1');
      draft = edit ? structuredClone(palette) : {
        name: 'Palette', count: palette?.count ?? 6, base: { ...base },
        step: palette ? { ...palette.step } : { l: base.l >= 50 ? -8 : 8, c: 0, h: 0 },
        dark: { mode: 'inverse' },
      };
      side = draft.dark?.mode === 'custom' ? theme() : 'light';
      hexDirty = false; hexInput.setCustomValidity('');
      choosing = false; error.hidden = true; gradientKey = '';
      onLayout(); nameInput.focus(); nameInput.select();
    }

    function cancel() {
      choosing = !draft.id;
      hexDirty = false; hexInput.setCustomValidity('');
      draft = null; error.hidden = true; onLayout();
      (choosing ? find('[data-new-palette]') : find('[data-edit-palette]')).focus();
    }

    function save() {
      if (!applyHex(true)) return;
      const invalid = controls.map(control => control.number).find(input => input.value === '' || !input.validity.valid);
      if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
      if (!draft.name.trim()) { error.textContent = 'Enter a palette name.'; error.hidden = false; nameInput.focus(); return; }
      try { paletteId = onSave(draft); }
      catch (issue) { error.textContent = issue.message; error.hidden = false; return; }
      draft = null; error.hidden = true; onLayout(); focus();
    }

    function applyHex(report = false) {
      if (!hexDirty) return true;
      const value = hexInput.value.trim().replace(/^#/, '');
      if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) {
        hexInput.setCustomValidity('Enter three or six hex digits, with or without #.');
        if (report) hexInput.reportValidity();
        return false;
      }
      const expanded = value.length === 3 ? [...value].map(digit => digit + digit).join('') : value;
      Object.assign(recipe().base, MockoutColors.fromHex('#' + expanded));
      hexColor = '#' + expanded.toUpperCase();
      hexDirty = false; hexInput.setCustomValidity(''); error.hidden = true; onPreview();
      return true;
    }

    function remove() {
      if (draft || !get(paletteId)) return;
      try { onDelete(paletteId); }
      catch (issue) { error.textContent = issue.message; error.hidden = false; return; }
      paletteId = palettes()[0]?.id ?? null; choosing = false; error.hidden = true;
      onLayout(); focus();
    }

    function focus() { (selectedId === null ? find('[data-transparent]')
      : strip.querySelector('[aria-selected="true"]') || strip.querySelector('button') || name).focus(); }
    name.addEventListener('click', () => {
      choosing = !choosing; onLayout();
      if (choosing) (choices.querySelector('[aria-selected="true"]') || choices.querySelector('button'))?.focus();
      else name.focus();
    });
    choices.addEventListener('click', event => {
      const button = event.target.closest('[data-palette-id]');
      if (!button) return;
      paletteId = button.dataset.paletteId || null; choosing = false; onLayout(); focus();
    });
    strip.addEventListener('click', event => {
      const button = event.target.closest('[data-color-id]');
      if (button) onPick(button.dataset.colorId);
    });
    for (const list of [choices, strip]) list.addEventListener('keydown', event => {
      const direction = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' }[event.key];
      if (!direction) return;
      event.preventDefault();
      const buttons = [...list.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
      const next = direction === 'first' ? 0 : direction === 'last' ? buttons.length - 1
        : (index + direction + buttons.length) % buttons.length;
      buttons[next]?.focus(); buttons[next]?.scrollIntoView({ block: 'nearest' });
    });
    find('[data-new-palette]').addEventListener('click', () => begin(false));
    find('[data-edit-palette]').addEventListener('click', () => begin(true));
    find('[data-delete-palette]').addEventListener('click', remove);
    find('[data-cancel-palette]').addEventListener('click', cancel);
    find('[data-save-palette]').addEventListener('click', save);
    find('[data-transparent]').addEventListener('click', () => onPick(null));
    hexInput.addEventListener('input', () => { hexDirty = true; applyHex(); });
    hexInput.addEventListener('change', () => {
      if (draft && applyHex()) hexInput.value = MockoutColors.toHex(recipe().base).toUpperCase();
    });
    darkMode.addEventListener('change', () => {
      const mode = darkMode.value;
      if (!applyHex(true)) { darkMode.value = draft.dark?.mode ?? 'same'; return; }
      const previous = MockoutColors.paletteRecipe(draft, 'dark');
      draft.dark ??= {};
      if (mode === 'custom' && !draft.dark.base) Object.assign(draft.dark, { base: { ...previous.base }, step: { ...previous.step } });
      draft.dark.mode = mode;
      side = mode === 'custom' ? 'dark' : 'light';
      onPreview();
    });
    sideButtons.forEach(button => button.addEventListener('click', () => {
      if (!applyHex(true)) return;
      side = button.dataset.paletteSide; onPreview();
    }));
    copyButton.addEventListener('click', () => {
      if (draft?.dark?.mode !== 'custom') return;
      if (!applyHex(true)) return;
      const source = MockoutColors.paletteRecipe(draft, side === 'dark' ? 'light' : 'dark');
      const target = recipe();
      Object.assign(target.base, source.base); Object.assign(target.step, source.step);
      error.hidden = true; onPreview();
    });
    nameInput.addEventListener('input', () => { draft.name = nameInput.value; error.hidden = true; render(); });
    countButtons.forEach(button => button.addEventListener('click', () => {
      draft.count = Number(button.dataset.count); error.hidden = true; onLayout();
    }));
    controls.forEach(control => {
      const { axis, group, range, number } = control;
      for (const input of [range, number]) input.addEventListener('input', () => {
        if (!input.value || !input.validity.valid) return;
        recipe()[group][axis] = input === range && group === 'step'
          ? stepValue(input.valueAsNumber, control.limits, axis) : input.valueAsNumber;
        error.hidden = true; onPreview();
      });
      if (group !== 'step') return;
      range.setAttribute('aria-description', 'Double-click to reset the step to zero.');
      range.addEventListener('dblclick', () => { recipe().step[axis] = 0; error.hidden = true; onPreview(); });
      range.addEventListener('keydown', event => {
        const direction = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[event.key];
        if (!direction && !['Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const [min, max] = control.limits;
        recipe().step[axis] = event.key === 'Home' ? min : event.key === 'End' ? max
          : Math.max(min, Math.min(max, rounded(recipe().step[axis] + direction * increment(axis), axis)));
        error.hidden = true; onPreview();
      });
    });
    element.addEventListener('keydown', event => {
      if (event.key === 'Escape' && (draft || choosing)) {
        event.preventDefault(); event.stopPropagation();
        if (draft) cancel(); else { choosing = false; onLayout(); name.focus(); }
      } else if (event.key === 'Enter' && draft && event.target === hexInput) {
        event.preventDefault(); applyHex(true);
      } else if (event.key === 'Enter' && draft && event.target.matches('input')) {
        event.preventDefault(); save();
      }
    });

    return { open(id) {
      selectedId = id; draft = null; choosing = false; error.hidden = true;
      paletteId = palettes().find(palette => palette.colors.includes(id))?.id
        ?? get(paletteId)?.id ?? palettes()[0]?.id ?? null;
      render();
    }, render, focus, preview(id, theme) {
      const index = draft?.id && get(draft.id)?.colors.indexOf(id);
      if (!Number.isInteger(index) || index < 0 || index >= draft.count) return null;
      const hex = MockoutColors.toHex(MockoutColors.paletteValue(draft, index, theme));
      return draft.dark ? hex : MockoutProject.resolveColor(hex, state().swatches.find(item => item.id === id)?.dark, theme);
    } };
  },
};
