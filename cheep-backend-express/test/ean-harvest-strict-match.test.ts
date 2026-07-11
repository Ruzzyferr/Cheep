import { describe, it, expect } from 'vitest';
import { strictNameMatch } from '../src/services/ean-harvest.service.js';

// ZERO-ERROR MANDATE regression cases. These 8 pairs were manually-audited
// WRONG assignments from the 2026-07 harvest run: all 8 shared the same
// (brand + fingerprint + gramaj) key under the old matcher, so the old key
// alone could not tell them apart. strictNameMatch MUST reject every one of
// them by requiring the significant-token SETS to be exactly equal.
describe('strictNameMatch: 8 audited-wrong regression cases (must ALL reject)', () => {
  it('1. Zott smietana 330g vs 330g+30g promo pack (360g total)', () => {
    expect(
      strictNameMatch('Śmietana 12% Zott 330 g', 'Śmietana 12% 330g + 30g Zott 360 g', 'Zott'),
    ).toBe(false);
  });

  it('2. flour type 480 vs type 00', () => {
    expect(
      strictNameMatch(
        'Mąka Szymanowska pszenna typ 480 Polskie Młyny 1 kg',
        'Mąka Szymanowska pszenna typ 00 Polskie Młyny 1 kg',
        'Polskie Młyny',
      ),
    ).toBe(false);
  });

  it('3. garbage bags 60L 10 sztuk vs 12 sztuk', () => {
    expect(
      strictNameMatch(
        'Worki na śmieci 60L Jan Niezbędny 10 sztuk',
        'Worki na śmieci 60L Jan Niezbędny 12 sztuk',
        'Jan Niezbędny',
      ),
    ).toBe(false);
  });

  it('4. garbage bags 35L 15 sztuk vs 18 sztuk', () => {
    expect(
      strictNameMatch(
        'Worki na śmieci 35L Jan Niezbędny 15 sztuk',
        'Worki na śmieci 35L Jan Niezbędny 18 sztuk',
        'Jan Niezbędny',
      ),
    ).toBe(false);
  });

  it('5. HiPP baby food: age "po 11 miesiącu" vs "po 9. miesiącu"', () => {
    expect(
      strictNameMatch(
        'HiPP BIO Jarzynki z kurczakiem ... po 11 miesiącu 190 g',
        '...po 9. miesiącu 190 g',
        'HiPP',
      ),
    ).toBe(false);
  });

  it('6. HiPP musli: age "od 12. miesiąca" vs "od 10. miesiąca"', () => {
    expect(
      strictNameMatch('HiPP BIO Musli ... od 12. miesiąca', '...od 10. miesiąca', 'HiPP'),
    ).toBe(false);
  });

  it('7. Axe shower gel 2w1 vs 3w1', () => {
    expect(
      strictNameMatch(
        'Axe Anti Hangover żel pod prysznic 2w1',
        'Axe Anti Hangover żel pod prysznic 3w1',
        'Axe',
      ),
    ).toBe(false);
  });

  it('8. Czaniecki pasta: 2500g catering pack vs 500g', () => {
    expect(
      strictNameMatch(
        'Czaniecki Makaron 5 jajeczny gniazdko 2 500 g',
        'Czaniecki Makaron 5 jajeczny gniazdko 500 g',
        'Czaniecki',
      ),
    ).toBe(false);
  });
});

// KNOWN-GOOD pairs: word-order / brand-position differences only, same
// significant tokens. Must still be ACCEPTED — the guard must not become so
// aggressive that it rejects legitimate matches.
describe('strictNameMatch: known-good word-order pairs (must ALL accept)', () => {
  it('Cheetos: brand-first vs brand-last', () => {
    expect(
      strictNameMatch(
        'Cheetos Chrupki kukurydziane cebulki 130 g',
        'Chrupki kukurydziane cebulki Cheetos 130 g',
        'Cheetos',
      ),
    ).toBe(true);
  });

  it('Prymat: brand-first vs brand-last', () => {
    expect(
      strictNameMatch(
        'Prymat Przyprawa grill klasyczny 80 g',
        'Przyprawa Grill klasyczny Prymat 80 g',
        'Prymat',
      ),
    ).toBe(true);
  });

  it('Monini: brand-first vs brand-last', () => {
    expect(
      strictNameMatch(
        'Monini Sos Pesto z bazylią 190 g',
        'Sos Pesto z bazylią Monini 190 g',
        'Monini',
      ),
    ).toBe(true);
  });
});

describe('strictNameMatch: multiset (count-aware) token equality', () => {
  it('rejects a duplicated token that a set-based comparison would let slip through', () => {
    // Reviewer-found false accept: as SETS, {produkt,100,g} == {produkt,100,g},
    // but nameA repeats "100 g" — the token COUNTS differ (100:x2,g:x2 vs
    // 100:x1,g:x1) so this MUST be rejected under multiset equality.
    expect(strictNameMatch('Produkt 100 g 100 g', 'Produkt 100 g')).toBe(false);
  });

  it('rejects differing token composition even with overlapping token sets', () => {
    expect(strictNameMatch('X 2 x 100 g', 'X 100 g 100 g')).toBe(false);
  });
});

describe('strictNameMatch: additional guards', () => {
  it('rejects when brand is omitted and brand tokens differ significant sets', () => {
    // Without a brand hint, the brand token itself becomes a significant
    // token; if only one side carries it, sets differ → reject. Safe
    // under-merge is acceptable.
    expect(
      strictNameMatch(
        'Cheetos Chrupki kukurydziane cebulki 130 g',
        'Chrupki kukurydziane cebulki 130 g',
      ),
    ).toBe(false);
  });

  it('is symmetric', () => {
    const a = 'Prymat Przyprawa grill klasyczny 80 g';
    const b = 'Przyprawa Grill klasyczny Prymat 80 g';
    expect(strictNameMatch(a, b, 'Prymat')).toBe(strictNameMatch(b, a, 'Prymat'));
  });

  it('rejects two completely unrelated names', () => {
    expect(strictNameMatch('Mleko UHT 3,2% 1L', 'Chleb żytni 500 g')).toBe(false);
  });
});
