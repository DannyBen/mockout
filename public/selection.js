const MockoutSelection = {
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
    if (!selection.inspectorOpen || selection.inspectorKind !== 'box' || !selection.selectedIds.has(selection.selectedId)) return null;
    return boxes.find(box => box.id === selection.selectedId) ?? null;
  },

  commonValue(boxes, getValue) {
    if (!boxes.length) return undefined;
    const first = getValue(boxes[0]);
    return boxes.every(box => getValue(box) === first) ? first : undefined;
  },

  applyProperty(boxes, selectedIds, key, value) {
    for (const box of boxes) if (selectedIds.has(box.id)) box[key] = value;
  },

  inspectorPosition(boxRect) {
    return { left: boxRect.right + 5, top: boxRect.top };
  },

  inspectorPan(rect, viewport, margin = 12) {
    const axis = (start, end, size, available) => size > available - margin * 2
      ? margin - start
      : start < margin ? margin - start : end > available - margin ? available - margin - end : 0;
    return {
      x: axis(rect.left, rect.right, rect.width, viewport.width),
      y: axis(rect.top, rect.bottom, rect.height, viewport.height),
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

if (typeof module !== 'undefined') module.exports = MockoutSelection;
