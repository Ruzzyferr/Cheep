export interface StoreRef { id: number; name: string; lat: number | null; lon: number | null }
export interface ProductRef { id: number; name: string; brand: string | null; image_url: string | null }
export interface RawStorePrice { store_id: number; price: number; store: StoreRef }
export interface PricedProduct extends ProductRef { store_prices: RawStorePrice[] }
export interface StoreOption { store_id: number; store: StoreRef; price: number; product: ProductRef }

/**
 * Extracts and normalizes the size/gramaj token from a product name.
 *
 * Recognized unit families:
 *   Liquid  : ml, l, lt, cl  → normalized to ml
 *   Weight  : g, gr, kg      → normalized to g
 *   Count   : adet, ad       → normalized to "<N>adet"
 *
 * Decimal separator: both "." and "," are accepted.
 *
 * Multipack notation (e.g. "6 x 1 L"): multiplied and returned in the base unit
 * (e.g. → "6000ml").
 *
 * Returns null when no size token is found or the token is unrecognizable.
 */
export function extractGramaj(name: string): string | null {
  // Normalise decimal comma → dot and lower-case for matching
  const text = name.replace(/,/g, '.').toLowerCase();

  // Pattern: optional multipack prefix "N x " or "Nx"
  // Then: decimal number  +  optional space  +  unit
  const pattern =
    /(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(ml|l\b|lt\b|cl\b|kg\b|gr\b|g\b|adet\b|ad\b)/gi;

  let match: RegExpExecArray | null;
  let best: { qty: number; unit: string } | null = null;

  while ((match = pattern.exec(text)) !== null) {
    const multipack = match[1] ? parseInt(match[1], 10) : 1;
    const qty = parseFloat(match[2]) * multipack;
    const unit = match[3].toLowerCase();
    // Prefer the first sizeable match (skip very small numbers that look like
    // serial codes matched incidentally — anything ≥ 1 is considered valid).
    if (qty >= 1) {
      best = { qty, unit };
      break;
    }
  }

  if (!best) return null;

  const { qty, unit } = best;

  // Liquid family → ml
  if (unit === 'ml') return `${Math.round(qty)}ml`;
  if (unit === 'l' || unit === 'lt') return `${Math.round(qty * 1000)}ml`;
  if (unit === 'cl') return `${Math.round(qty * 10)}ml`;

  // Weight family → g
  if (unit === 'g') return `${Math.round(qty)}g`;
  if (unit === 'gr') return `${Math.round(qty)}g`;
  if (unit === 'kg') return `${Math.round(qty * 1000)}g`;

  // Count family
  if (unit === 'adet' || unit === 'ad') return `${Math.round(qty)}adet`;

  return null;
}

function productRef(p: ProductRef): ProductRef {
  return { id: p.id, name: p.name, brand: p.brand, image_url: p.image_url };
}

function applyProduct(map: Map<number, StoreOption>, p: PricedProduct): void {
  for (const sp of p.store_prices) {
    const existing = map.get(sp.store_id);
    if (!existing || sp.price < existing.price) {
      map.set(sp.store_id, {
        store_id: sp.store_id,
        store: sp.store,
        price: sp.price,
        product: productRef(p),
      });
    }
  }
}

export function resolveItemStoreOptions(
  representative: PricedProduct,
  brandIndependent: boolean,
  siblings: PricedProduct[]
): Map<number, StoreOption> {
  const map = new Map<number, StoreOption>();
  // Representative is always applied regardless of gramaj.
  applyProduct(map, representative);

  if (brandIndependent) {
    const repGramaj = extractGramaj(representative.name);

    for (const sib of siblings) {
      const sibGramaj = extractGramaj(sib.name);
      // Only include sibling when its gramaj matches the representative's.
      // If representative has no parseable gramaj, only accept siblings that
      // also have no parseable gramaj (conservative: avoid unknown-size swaps).
      if (sibGramaj === repGramaj) {
        applyProduct(map, sib);
      }
    }
  }

  return map;
}
