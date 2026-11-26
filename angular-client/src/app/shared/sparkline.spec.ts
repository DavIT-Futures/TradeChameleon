import { TestBed } from '@angular/core/testing';
import { Sparkline } from './sparkline';

describe('Sparkline', () => {
  it('renders a rising line', async () => {
    const fixture = TestBed.createComponent(Sparkline);
    fixture.componentRef.setInput('values', [1, 2, 3]);
    await fixture.whenStable();
    const svg: SVGElement = fixture.nativeElement.querySelector('svg');
    expect(svg.classList).toContain('up');
    expect(svg.querySelector('polyline')?.getAttribute('points')).toContain('100.0,0.0');
  });

  it('reacts to new input values (signals, zoneless)', async () => {
    const fixture = TestBed.createComponent(Sparkline);
    fixture.componentRef.setInput('values', [3, 2, 1]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('svg').classList).toContain('down');
  });
});
