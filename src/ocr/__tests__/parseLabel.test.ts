import { parseLabel } from '../parseLabel';

describe('parseLabel', () => {
  it('reads a combination medication and its strength', () => {
    const result = parseLabel(['SAMPLE PHARMACY', 'CARBIDOPA/LEVODOPA 25/100 MG TAB', 'TAKE 1 TABLET BY MOUTH 3 TIMES DAILY', 'QTY: 90']);
    expect(result.name).toBe('Carbidopa/Levodopa');
    expect(result.strength).toBe('25/100 mg');
    expect(result.directions).toBe('TAKE 1 TABLET BY MOUTH 3 TIMES DAILY');
  });

  it('allows small OCR mistakes', () => {
    expect(parseLabel(['Pramipexo1e 0.25mg']).name).toBe('Pramipexole');
    expect(parseLabel(['ROPINIROLF HCL 1 MG']).name).toBe('Ropinirole');
  });

  it('reads brand names', () => {
    const result = parseLabel(['Sinemet', '10/100 mg tablets']);
    expect(result.name).toBe('Sinemet');
    expect(result.strength).toBe('10/100 mg');
  });

  it('returns no name when the label has none it knows', () => {
    expect(parseLabel(['Fresh Market', 'Total 12.99']).name).toBeUndefined();
  });
});

describe('parseLabel directions', () => {
  it('prefers the "take" line over the strength line', () => {
    expect(parseLabel(['CARBIDOPA/LEVODOPA', '25/100 MG TABLET', 'TAKE 1 TABLET BY MOUTH']).directions).toBe('TAKE 1 TABLET BY MOUTH');
  });
});
