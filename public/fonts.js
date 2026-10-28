const MinimockFonts = (() => {
  const symbolFamilies = ['Material Symbols Outlined', 'Material Symbols Rounded', 'Material Symbols Sharp'];
  const classicIconFamilies = ['Material Icons', 'Material Icons Two Tone'];
  const materialFamilies = [...symbolFamilies, ...classicIconFamilies];
  const familyOf = box => box.fontFamily ?? '';
  const sizeOf = box => box.fontSize ?? 13;
  const weightOf = box => box.fontWeight ?? 400;
  const styleOf = box => box.fontStyle ?? 'normal';
  const isMaterial = family => materialFamilies.includes(family);
  const isSymbol = family => symbolFamilies.includes(family);
  const isClassicIcon = family => classicIconFamilies.includes(family);
  const categoryOf = family => !family ? '' : isMaterial(family) ? 'material' : 'google';
  const validFamily = family => typeof family === 'string' && family.length <= 80
    && family.trim() === family && !/[:;"\\\x00-\x1f\x7f]/.test(family);

  function stylesheet(family, weight = 400, style = 'normal') {
    const params = new URLSearchParams();
    const axes = style === 'italic' ? `:ital,wght@1,${weight}`
      : weight !== 400 ? `:wght@${weight}` : '';
    params.set('family', family + axes);
    params.set('display', isMaterial(family) ? 'block' : 'swap');
    return `https://fonts.googleapis.com/css2?${params}`;
  }

  function stylesheets(boxes) {
    const urls = new Set();
    for (const box of boxes) {
      const family = familyOf(box);
      if (!family || !validFamily(family)) continue;
      urls.add(stylesheet(family));
      const weight = isSymbol(family) ? Math.min(weightOf(box), 700) : weightOf(box);
      const style = isMaterial(family) ? 'normal' : styleOf(box);
      if (!isClassicIcon(family) && (weight !== 400 || style === 'italic')) {
        urls.add(stylesheet(family, weight, style));
      }
    }
    return [...urls];
  }

  return { materialFamilies, familyOf, sizeOf, weightOf, styleOf,
    isMaterial, isSymbol, isClassicIcon, categoryOf, validFamily, stylesheets };
})();

if (typeof module !== 'undefined') module.exports = MinimockFonts;
