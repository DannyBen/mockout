import Colors from '../core/colors.js';
import Project from '../core/project.js';

// Palette drafts stay outside the project until Save. Preview never records
// history or writes storage; the editor's onSave records one undo operation.
export function createPaletteEditor(ui, { state, color, theme, onPreview, onLayout, onSelect, onPick, onSave, onDelete }) {
  const palettes = () => state().palettes ?? [];
  const get = id => palettes().find(palette => palette.id === id);
  let paletteId = null, selectedId = null, sourceId = null, draft = null, side = 'light';
  let error = '', hexDirty = false, hexEditing = false, hexText = '', hexError = '';
  const recipe = () => Colors.paletteRecipe(draft, side);
  const find = selector => document.querySelector(`#box-color-picker ${selector}`);
  const increment = axis => axis === 'c' ? .001 : .1;
  const rounded = (value, axis) => Number((Math.round(value / increment(axis)) * increment(axis)).toFixed(3));
  const stepPosition = (value, [min, max]) => {
    const extent = value < 0 ? -min : max;
    return extent > 0 ? Math.max(-1, Math.min(1, value / extent)) : 0;
  };
  const stepValue = (position, [min, max], axis) => rounded(position * (position < 0 ? -min : max), axis);

  function entries() {
    if (draft) return Array.from({ length: draft.count }, (_, index) => ({
      id: index, color: Colors.toHex(Colors.paletteValue(recipe(), index)), name: `${draft.name || 'Palette'} ${index + 1}`,
    }));
    const palette = get(paletteId);
    const items = palette ? palette.colors.map(id => state().swatches.find(item => item.id === id)) : [];
    return items.map(item => ({ ...item, color: color(item.id) }));
  }

  function render() {
    const palette = get(paletteId);
    const current = draft ? recipe() : null;
    ui.update({ palette: {
      api, paletteId, selectedId, draft: draft && structuredClone(draft), side, error, hexError,
      hex: hexDirty || hexEditing ? hexText : current ? Colors.toHex(current.base).toUpperCase() : '',
      label: draft?.name || (draft ? 'New palette' : palette?.name || 'No palettes'),
      palettes: palettes(), entries: entries(), canEdit: Boolean(palette), counts: [3, 6, 9],
      unassigned: Colors.isUnassigned(state(), sourceId) ? { id: sourceId, color: color(sourceId) } : null,
      recipe: current && structuredClone(current),
    } });
  }

  function focus() {
    (selectedId === null ? find('[data-transparent]')
      : find('[data-unassigned][aria-pressed="true"]') || find('[data-palette-colors] [aria-selected="true"]') || find('[data-palette-colors] button') || find('[data-palette-name]'))?.focus();
  }
  function refreshSelection() {
    if (selectedId != null && (!state().swatches.some(color => color.id === selectedId)
      || (selectedId !== sourceId && Colors.isUnassigned(state(), selectedId)))) selectedId = sourceId;
    onSelect(selectedId);
  }
  function begin(edit) {
    const palette = get(paletteId);
    if (edit && !palette) return;
    const selected = state().swatches.find(item => item.id === selectedId);
    const base = palette?.base ?? Colors.fromHex(selected ? Colors.hexFor(state().swatches, selected.id, palettes()) : '#4393e1');
    draft = edit ? structuredClone(palette) : {
      name: 'Palette', count: palette?.count ?? 6, base: { ...base },
      step: palette ? { ...palette.step } : { l: base.l >= 50 ? -8 : 8, c: 0, h: 0 }, dark: { mode: 'inverse' },
    };
    side = draft.dark?.mode === 'custom' ? theme() : 'light';
    hexDirty = false; hexEditing = false; hexError = ''; error = '';
    onLayout();
    find('[data-palette-title]').focus(); find('[data-palette-title]').select();
  }
  function cancel() {
    const editing = Boolean(draft.id);
    draft = null; hexDirty = false; hexEditing = false; hexError = ''; error = '';
    onLayout();
    find(editing ? '[data-edit-palette]' : '[data-palette-name]').focus();
  }
  function applyHex(report = false) {
    if (!hexDirty) return true;
    const value = hexText.trim().replace(/^#/, '');
    if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) {
      hexError = 'Enter three or six hex digits, with or without #.';
      render();
      if (report) find('[data-palette-hex]').reportValidity();
      return false;
    }
    const expanded = value.length === 3 ? [...value].map(digit => digit + digit).join('') : value;
    Object.assign(recipe().base, Colors.fromHex('#' + expanded));
    hexDirty = false; hexError = ''; error = ''; onPreview();
    return true;
  }
  function save() {
    if (!applyHex(true)) return;
    const invalid = [...find('[data-palette-editor]').querySelectorAll('input[type="number"]')]
      .find(input => input.value === '' || !input.validity.valid);
    if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
    if (!draft.name.trim()) { error = 'Enter a palette name.'; render(); find('[data-palette-title]').focus(); return; }
    try { paletteId = onSave(draft); }
    catch (issue) { error = issue.message; render(); return; }
    draft = null; error = ''; refreshSelection(); onLayout(); focus();
  }
  function remove() {
    if (draft || !get(paletteId)) return;
    try { onDelete(paletteId); }
    catch (issue) { error = issue.message; render(); return; }
    paletteId = palettes()[0]?.id ?? null; error = ''; refreshSelection(); onLayout(); focus();
  }

  const api = {
    render, focus, begin, cancel, save, remove,
    open(id) {
      selectedId = sourceId = id; draft = null; error = '';
      paletteId = palettes().find(palette => palette.colors.includes(id))?.id ?? get(paletteId)?.id ?? palettes()[0]?.id ?? null;
      render();
    },
    preview(id, activeTheme) {
      const index = draft?.id && get(draft.id)?.colors.indexOf(id);
      if (!Number.isInteger(index) || index < 0 || index >= draft.count) return null;
      const hex = Colors.toHex(Colors.paletteValue(draft, index, activeTheme));
      return draft.dark ? hex : Project.resolveColor(hex, state().swatches.find(item => item.id === id)?.dark, activeTheme);
    },
    select(id) { if (draft || id === selectedId) return; selectedId = id; onSelect(id); },
    pick(id) { if (id === selectedId) onPick(id); else api.select(id); },
    accept: onPick,
    choose(id) { paletteId = id || null; onLayout(); },
    rename(name) { draft.name = name; error = ''; render(); },
    setCount(count) { draft.count = count; error = ''; onLayout(); },
    setHex(text) { hexEditing = true; hexDirty = true; hexText = text; applyHex(); },
    acceptHex() { hexEditing = false; if (draft && applyHex()) render(); },
    setMode(mode) {
      if (!applyHex(true)) return;
      const previous = Colors.paletteRecipe(draft, 'dark');
      draft.dark ??= {};
      if (mode === 'custom' && !draft.dark.base) Object.assign(draft.dark, { base: { ...previous.base }, step: { ...previous.step } });
      draft.dark.mode = mode; side = mode === 'custom' ? 'dark' : 'light'; onPreview();
    },
    setSide(value) { if (applyHex(true)) { side = value; onPreview(); } },
    copy() {
      if (draft?.dark?.mode !== 'custom' || !applyHex(true)) return;
      const source = Colors.paletteRecipe(draft, side === 'dark' ? 'light' : 'dark');
      Object.assign(recipe().base, source.base); Object.assign(recipe().step, source.step); error = ''; onPreview();
    },
    setChannel(axis, group, value) { recipe()[group][axis] = value; error = ''; onPreview(); },
    stepPosition, stepValue, increment, rounded,
    escape(event) {
      if (event.key === 'Escape' && draft) {
        event.preventDefault(); event.stopPropagation();
        // Native window keyboard handling also listens for Escape.
        event.nativeEvent.stopImmediatePropagation();
        cancel();
      }
    },
  };
  return api;
}
