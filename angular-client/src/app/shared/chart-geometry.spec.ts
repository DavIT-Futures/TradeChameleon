import { chartGeometry, sparklinePoints } from './chart-geometry';

describe('sparklinePoints', () => {
  it('maps min to the bottom and max to the top', () => {
    expect(sparklinePoints([1, 2, 3], 100, 10)).toBe('0.0,10.0 50.0,5.0 100.0,0.0');
  });

  it('needs at least two values', () => {
    expect(sparklinePoints([1])).toBe('');
  });
});

describe('chartGeometry', () => {
  const points = [
    { t: 0, price: 100 },
    { t: 1000, price: 110 },
    { t: 2000, price: 105 },
  ];

  it('builds a line path, an area and ticks', () => {
    const g = chartGeometry(points, 400, 200);
    expect(g.line.startsWith('M')).toBe(true);
    expect(g.area.endsWith('Z')).toBe(true);
    expect(g.yTicks).toHaveLength(5);
    expect(g.xTicks).toHaveLength(4);
    expect(g.last?.value).toBe(105);
  });

  it('pads the price range so the line never touches the edges', () => {
    const g = chartGeometry(points, 400, 200);
    expect(g.min).toBeLessThan(100);
    expect(g.max).toBeGreaterThan(110);
  });
});
