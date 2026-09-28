interface Span {
  start: number;
  end: number;
}

/**
 * Paints spans onto a strip where each device pixel takes the color of the span covering most of its bytes.
 * Blending sub-pixel spans instead would turn wide files into uniform gray.
 */
export function paintDominant<T extends Span>(
  ctx: OffscreenCanvasRenderingContext2D,
  spans: T[],
  from: number,
  to: number,
  width: number,
  height: number,
  colorOf: (span: T) => string,
): void {
  const bytesPerPx = (to - from) / width;
  let first = 0;
  let runStart = 0;
  let runColor: string | null = null;
  const flush = (end: number) => {
    if (!runColor) return;
    ctx.fillStyle = runColor;
    ctx.fillRect(runStart, 0, end - runStart, height);
  };
  for (let px = 0; px < width; px++) {
    const b0 = from + px * bytesPerPx;
    const b1 = b0 + bytesPerPx;
    while (first < spans.length && (spans[first] as T).end <= b0) first++;
    let best: T | null = null;
    let bestBytes = 0;
    for (let i = first; i < spans.length && (spans[i] as T).start < b1; i++) {
      const span = spans[i] as T;
      const bytes = Math.min(b1, span.end) - Math.max(b0, span.start);
      if (bytes > bestBytes) {
        bestBytes = bytes;
        best = span;
      }
    }
    const color = best ? colorOf(best) : null;
    if (color !== runColor) {
      flush(px);
      runStart = px;
      runColor = color;
    }
  }
  flush(width);
}

/** The span at `offset` in a list sorted by start, allowing `slack` bytes so hairline spans stay hoverable. */
export function spanAt<T extends Span>(spans: T[], offset: number, slack: number): T | null {
  let lo = 0;
  let hi = spans.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((spans[mid] as T).start <= offset) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const hit = spans[best];
  if (hit && offset <= hit.end + slack) return hit;
  const next = spans[best + 1];
  return next && next.start - offset < slack ? next : null;
}
