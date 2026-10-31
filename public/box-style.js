const MockoutBoxStyle = (() => {
  const overrides = { borderWidth: 'borderWidths', borderColor: 'borderColors', radius: 'cornerRadii' };
  const targets = [
    { id: 'tl', name: 'Top left', corner: true, index: 0, x: 0, y: 0 },
    { id: 'top', name: 'Top', index: 0, x: .5, y: 0 },
    { id: 'tr', name: 'Top right', corner: true, index: 1, x: 1, y: 0 },
    { id: 'right', name: 'Right', index: 1, x: 1, y: .5 },
    { id: 'br', name: 'Bottom right', corner: true, index: 2, x: 1, y: 1 },
    { id: 'bottom', name: 'Bottom', index: 2, x: .5, y: 1 },
    { id: 'bl', name: 'Bottom left', corner: true, index: 3, x: 0, y: 1 },
    { id: 'left', name: 'Left', index: 3, x: 0, y: .5 },
  ];
  const values = (box, property) => box[overrides[property]] ?? Array(4).fill(box[property]);
  const numeric = value => Number.isFinite(value) && value >= 0;
  const color = (value, swatches) => value === null || swatches.some(item => item.id === value);
  return {
    targets,
    values,
    value(box, property, index) {
      const items = values(box, property);
      return index === undefined ? items.every(item => item === items[0]) ? items[0] : undefined : items[index];
    },
    set(box, property, value, index) {
      if (index === undefined) {
        box[property] = value;
        delete box[overrides[property]];
      } else {
        const items = [...values(box, property)];
        items[index] = value;
        box[overrides[property]] = items;
      }
    },
    copy(box) {
      return Object.fromEntries(Object.values(overrides).filter(key => box[key] !== undefined)
        .map(key => [key, [...box[key]]]));
    },
    valid(box, swatches) {
      return Object.entries(overrides).every(([property, key]) => box[key] === undefined
        || (Array.isArray(box[key]) && box[key].length === 4
          && box[key].every(value => property === 'borderColor' ? color(value, swatches) : numeric(value))));
    },
    usesColor(box, id) {
      return ['fill', 'textColor', 'borderColor'].some(key => box[key] === id)
        || (box.borderColors?.includes(id) ?? false);
    },
    replaceColor(box, id, replacement) {
      for (const key of ['fill', 'textColor', 'borderColor']) if (box[key] === id) box[key] = replacement;
      if (box.borderColors) box.borderColors = box.borderColors.map(value => value === id ? replacement : value);
    },
    widths(box) {
      if (!box.borderWidths) {
        const width = Math.max(0, box.w === 1 || box.h === 1 ? box.borderWidth : Math.min(box.borderWidth, box.w / 2, box.h / 2));
        return box.h === 1 ? [width, 0, 0, 0] : box.w === 1 ? [0, 0, 0, width] : Array(4).fill(width);
      }
      const result = [...box.borderWidths];
      for (const [first, second, size] of [[0, 2, box.h], [1, 3, box.w]]) {
        const total = result[first] + result[second];
        if (total > size) { result[first] *= size / total; result[second] *= size / total; }
      }
      return result;
    },
    markerFrame(rect) {
      const width = Math.max(80, rect.width + 28);
      const height = Math.max(64, rect.height + 28);
      const left = rect.left - (width - rect.width) / 2;
      const top = rect.top - (height - rect.height) / 2;
      return { left, top, right: left + width, width, height };
    },
  };
})();
if (typeof module !== 'undefined') module.exports = MockoutBoxStyle;
