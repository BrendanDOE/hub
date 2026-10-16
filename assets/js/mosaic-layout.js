// Gap-free rectangular mosaics. Each cut partitions a rectangle completely;
// tile aspect ratios remain fixed, while nearby dates may trade positions.
const MAX_WINDOW = 6;

function join(a, b, axis, gap) {
  if (axis === 'vertical') return {a: a.a + b.a, b: a.b + b.b + gap, first: a, second: b, axis};
  const inverse = 1 / a.a + 1 / b.a;
  return {a: 1 / inverse, b: (a.b / a.a + b.b / b.a - gap) / inverse, first: a, second: b, axis};
}

function rectangles(tree, width, x = 0, y = 0, out = [], gap = 13) {
  const height = tree.a * width + tree.b;
  if (tree.item) out.push({item: tree.item, x, y, width, height});
  else if (tree.axis === 'horizontal') {
    const firstWidth = (height - tree.first.b) / tree.first.a;
    rectangles(tree.first, firstWidth, x, y, out, gap);
    rectangles(tree.second, width - firstWidth - gap, x + firstWidth + gap, y, out, gap);
  } else {
    const firstHeight = tree.first.a * width + tree.first.b;
    rectangles(tree.first, width, x, y, out, gap);
    rectangles(tree.second, width, x, y + firstHeight + gap, out, gap);
  }
  return out;
}

function trees(items, gap) {
  const cache = new Map();
  const build = (start, end) => {
    const key = `${start}:${end}`;
    if (cache.has(key)) return cache.get(key);
    if (end - start === 1) return [{item: items[start], a: 1 / items[start].aspect, b: 0}];
    const out = [];
    for (let mid = start + 1; mid < end; mid++)
      for (const a of build(start, mid)) for (const b of build(mid, end)) {
        out.push(join(a, b, 'horizontal', gap), join(a, b, 'vertical', gap));
      }
    cache.set(key, out);
    return out;
  };
  return build(0, items.length);
}

export function layoutMosaic(items, width, rowLimit = 3, gap = 13) {
  if (!items.length || width <= 0) return {tiles: [], height: 0};
  const columns = Math.min(Math.max(1, rowLimit), Math.max(1, Math.floor((width + gap) / 233)));
  const unit = (width - gap * (columns - 1)) / columns;
  const baseHeight = Math.max(160, Math.min(260, unit * .9));
  const prepared = items.map((item, index) => {
    const level = {small: 1, medium: 2, large: 3}[item.size] || 2;
    const portrait = item.orientation === 'portrait';
    const spaces = level === 1 ? 1 : level === 2 ? Math.max(1, columns / 2) : Math.min(columns, 6);
    const idealHeight = portrait ? baseHeight * level : baseHeight;
    const idealWidth = portrait ? Math.min(unit, idealHeight * .72) : Math.max(baseHeight * 1.35, unit * spaces + gap * (spaces - 1));
    // Phones keep tall tiles readable without magnifying a desktop 3-row
    // portrait to several screen heights.
    const aspect = columns === 1 && portrait ? [0, .8, .65, .5][level] : idealWidth / idealHeight;
    return {...item, index, aspect, idealWidth, idealHeight};
  });
  const best = Array(items.length + 1);
  best[items.length] = {cost: 0};
  for (let start = items.length - 1; start >= 0; start--) {
    let choice = null;
    const max = columns === 1 ? 1 : Math.min(MAX_WINDOW, items.length - start);
    for (let n = 1; n <= max; n++) {
      const sequence = prepared.slice(start, start + n);
      // A bounded adjacent swap gives awkward shapes a fitting neighbor;
      // no tile can move beyond its six-item chronological window.
      const orders = [sequence];
      for (let i = 0; i < n - 1; i++) {
        const swapped = sequence.slice();
        [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
        orders.push(swapped);
      }
      for (const order of orders) for (const tree of trees(order, gap)) {
        const height = tree.a * width + tree.b;
        if (height <= 0) continue;
        const tiles = rectangles(tree, width, 0, 0, [], gap);
        // The configured row limit remains a maximum, including tall tiles
        // already spanning through a row of shorter neighbors.
        if (tiles.some(a => tiles.filter(b => b.y <= a.y + 1e-6 && b.y + b.height > a.y + 1e-6).length > columns)) continue;
        let cost = .08 + best[start + n].cost;
        for (const tile of tiles) {
          if (tile.width < 1 || tile.height < 1) { cost = Infinity; break; }
          cost += Math.log(tile.width / tile.item.idealWidth) ** 2 + Math.log(tile.height / tile.item.idealHeight) ** 2;
          const minimum = Math.min(120, width);
          if (tile.width < minimum) cost += 20 * ((minimum - tile.width) / minimum) ** 2;
          if (tile.height < 100) cost += 20 * ((100 - tile.height) / 100) ** 2;
        }
        const readingOrder = tiles.slice().sort((a, b) => Math.round(a.y - b.y) || a.x - b.x);
        cost += readingOrder.reduce((sum, tile, i) => sum + .045 * Math.abs(tile.item.index - start - i), 0);
        if (!choice || cost < choice.cost - 1e-9) choice = {cost, tiles, height, next: start + n};
      }
    }
    best[start] = choice;
  }
  const result = []; let y = 0;
  for (let start = 0; start < items.length;) {
    const group = best[start];
    for (const tile of group.tiles) result.push({...tile, y: tile.y + y});
    y += group.height + gap;
    start = group.next;
  }
  return {tiles: result, height: y - gap};
}
