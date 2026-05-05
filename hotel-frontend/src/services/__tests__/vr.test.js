import { getVrEntry, VR_DEFAULT_FALLBACK } from '../vr';

describe('getVrEntry', () => {
  it('returns default entry when no room provided', () => {
    const entry = getVrEntry(null);
    expect(entry).toBeDefined();
    expect(entry.id).toBe('default');
  });

  it('matches keywords in room data', () => {
    const entry = getVrEntry({ name: '尊享海景大床房', type: '豪华套房' });
    expect(entry.id).toBe('ocean-suite');
    expect(entry.fallbackSrc).toBe(VR_DEFAULT_FALLBACK);
  });
});
