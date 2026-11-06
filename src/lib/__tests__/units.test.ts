import { displayWeight, toKg } from '../units';

describe('units', () => {
  it('keeps kg values and rounds to 0.5', () => {
    expect(displayWeight(82.3, 'kg')).toBe(82.5);
  });

  it('converts kg to lb for display', () => {
    expect(displayWeight(100, 'lb')).toBe(220.5);
  });

  it('round-trips lb input to kg', () => {
    expect(toKg(220.462, 'lb')).toBeCloseTo(100, 2);
  });
});
