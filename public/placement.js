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

  moveDelta(first, origin, pointer, nudge, zoom, grid) {
    return {
      x: this.snap(first.x + (pointer ? (pointer.x - origin.x) / zoom : 0) + nudge.x, grid) - first.x,
      y: this.snap(first.y + (pointer ? (pointer.y - origin.y) / zoom : 0) + nudge.y, grid) - first.y,
    };
  },
};

if (typeof module !== 'undefined') module.exports = MockoutPlacement;
