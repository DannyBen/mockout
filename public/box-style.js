const MockoutBoxStyle = (() => {
  const overrides = { borderWidth: 'borderWidths', borderColor: 'borderColors', radius: 'cornerRadii', padding: 'paddingSides' };
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
  const values = (box, property) => {
    if (property === 'paddingX' || property === 'paddingY') {
      const items = values(box, 'padding');
      return (property === 'paddingX' ? [1, 3] : [0, 2]).map(index => items[index]);
    }
    return box[overrides[property]] ?? (property === 'padding'
      ? [box.paddingY ?? 3, box.paddingX ?? 3, box.paddingY ?? 3, box.paddingX ?? 3] : Array(4).fill(box[property]));
  };
  const fitSides = (items, width, height) => {
    const result = [...items];
    for (const [first, second, size] of [[0, 2, height], [1, 3, width]]) {
      const total = result[first] + result[second];
      if (total > size) { result[first] *= size / total; result[second] *= size / total; }
    }
    return result;
  };
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
      if (property === 'paddingX' || property === 'paddingY') {
        box[property] = value;
        if (box.paddingSides) {
          const items = [...box.paddingSides];
          for (const side of property === 'paddingX' ? [1, 3] : [0, 2]) items[side] = value;
          if (items[0] === items[2] && items[1] === items[3]) {
            box.paddingX = items[1]; box.paddingY = items[0];
            delete box.paddingSides;
          } else box.paddingSides = items;
        }
        return;
      }
      if (index === undefined) {
        if (property === 'padding') box.paddingX = box.paddingY = value;
        else box[property] = value;
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
      return fitSides(box.borderWidths, box.w, box.h);
    },
    paddings(box, widths = this.widths(box)) {
      return fitSides(values(box, 'padding'), Math.max(0, box.w - widths[1] - widths[3]),
        Math.max(0, box.h - widths[0] - widths[2]));
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
