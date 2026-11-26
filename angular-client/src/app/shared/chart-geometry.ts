/**
 * Pure functions that turn prices into SVG coordinates. No framework code here, which keeps them
 * trivial to unit-test (the React client has an identical copy).
 */

export interface ChartPoint {
  t: number; // epoch millis
  price: number;
}

export interface ChartGeometry {
  line: string;
  area: string;
  yTicks: { y: number; value: number }[];
  xTicks: { x: number; label: string }[];
  last: { x: number; y: number; value: number } | null;
  min: number;
  max: number;
}

export function sparklinePoints(values: readonly number[], width = 100, height = 28): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(' ');
}

export function chartGeometry(
  points: readonly ChartPoint[],
  width: number,
  height: number,
  pad = { top: 12, right: 64, bottom: 24, left: 8 },
): ChartGeometry {
  const empty: ChartGeometry = { line: '', area: '', yTicks: [], xTicks: [], last: null, min: 0, max: 0 };
  if (points.length < 2) return empty;

  const prices = points.map((p) => p.price);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  const margin = (max - min) * 0.1 || max * 0.001 || 1;
  min -= margin;
  max += margin;

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (t: number) => pad.left + ((t - t0) / (t1 - t0 || 1)) * innerW;
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min)) * innerH;

  const coords = points.map((p) => `${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`);
  const line = 'M' + coords.join(' L');
  const area = `${line} L${x(t1).toFixed(1)},${pad.top + innerH} L${x(t0).toFixed(1)},${pad.top + innerH} Z`;

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = min + ((max - min) * i) / 4;
    return { y: y(value), value };
  });
  const xTicks = Array.from({ length: 4 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / 3;
    return { x: x(t), label: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
  });
  const lastPoint = points[points.length - 1];
  return { line, area, yTicks, xTicks, last: { x: x(lastPoint.t), y: y(lastPoint.price), value: lastPoint.price }, min, max };
}
