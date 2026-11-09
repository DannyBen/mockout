const MockoutPlacement = {
  snap(value, grid) { return grid ? Math.round(value / grid) * grid : Math.round(value); },

  nudge(value, direction, grid, steps = 1) {
    if (!grid || !direction) return value + direction * steps;
    const cell = direction > 0 ? Math.floor(value / grid) : Math.ceil(value / grid);
    return (cell + direction * steps) * grid;
  },

  worldPoint(pointer, rect, view) {
    return {
      x: (pointer.clientX - rect.left - view.x) / view.zoom,
      y: (pointer.clientY - rect.top - view.y) / view.zoom,
    };
  },

  duplicateOffset(box, cursor, grid) {
    if (!cursor) return { x: grid || 10, y: grid || 10 };
    return {
      x: this.snap(cursor.x - box.w / 2, grid) - box.x,
      y: this.snap(cursor.y - box.h / 2, grid) - box.y,
    };
  },
};

if (typeof module !== 'undefined') module.exports = MockoutPlacement;
