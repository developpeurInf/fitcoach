import { equipmentInWord, likeTerm, musclesInQuery, normalize } from '../catalog';

describe('library search', () => {
  it('maps French muscle words, with or without accents and plural', () => {
    expect(musclesInQuery('Pectoraux')).toEqual(['chest']);
    expect(musclesInQuery('épaule haltères')).toEqual(['shoulders']);
    expect(musclesInQuery('fessier')).toEqual(['glutes']);
    expect(musclesInQuery('squat')).toEqual([]);
  });
  it('strips characters that would change a PostgREST filter', () => {
    expect(likeTerm('curl, (biceps)%_*')).toBe('curl biceps');
    expect(likeTerm('  Développé  couché ')).toBe('développé couché');
  });
  it('maps French equipment words', () => {
    expect(equipmentInWord('Haltères')).toEqual(['dumbbell']);
    expect(equipmentInWord('squat')).toEqual([]);
  });
  it('normalizes accents', () => {
    expect(normalize('Épaules')).toBe('epaules');
  });
});
