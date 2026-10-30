const MockoutPlacement = {
  snap(value, grid) { return grid ? Math.round(value / grid) * grid : Math.round(value); },

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
