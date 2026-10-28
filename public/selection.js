const MinimockSelection = {
  selectOnly(current, id) {
    const isolatedCopyIds = current.isolatedCopyIds;
    return {
      ...current,
      selectedId: id,
      selectedIds: id === null ? new Set() : new Set([id]),
      isolatedCopyIds: isolatedCopyIds && (isolatedCopyIds.size !== 1 || !isolatedCopyIds.has(id))
        ? null : isolatedCopyIds,
    };
  },

  inspectedBox(boxes, selection) {
    if (!selection.inspectorOpen || selection.inspectorKind !== 'box' || selection.selectedIds.size !== 1) return null;
    return boxes.find(box => box.id === selection.selectedId) ?? null;
  },

  inspectorPosition(boxRect, panel, viewport) {
    let left = boxRect.right + 12;
    if (left + panel.width > viewport.width - 12) left = boxRect.left - panel.width - 12;
    return {
      left: Math.max(12, Math.min(left, viewport.width - panel.width - 12)),
      top: Math.max(12, Math.min(boxRect.top, viewport.height - panel.height - 12)),
    };
  },

  containsBox(outer, inner) {
    return outer.id !== inner.id && outer.x <= inner.x && outer.y <= inner.y
      && outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h
      && (outer.x < inner.x || outer.y < inner.y
        || outer.x + outer.w > inner.x + inner.w || outer.y + outer.h > inner.y + inner.h);
  },

  nearestContainer(boxes, inner) {
    let nearest = null;
    for (const box of boxes) {
      if (this.containsBox(box, inner) && (!nearest || box.w * box.h < nearest.w * nearest.h)) nearest = box;
    }
    return nearest;
  },
};

if (typeof module !== 'undefined') module.exports = MinimockSelection;
