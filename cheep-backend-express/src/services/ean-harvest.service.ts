/**
 * EAN harvest — borrow real barcodes from EAN-bearing chains onto no-EAN chains.
 *
 * PROBLEM: Some Poland chains (Auchan store 41, Biedronka store 44) carry NO
 * EAN, so they can never cross-store-match. But Carrefour (40) and Żabka (47),
 * sourced from Wolt, carry real EANs. When a no-EAN product is UNAMBIGUOUSLY the
 * same item as an EAN-bearing one (same brand + same normalized name + EXACT same
 * size), we borrow that EAN so the no-EAN chain joins the comparable set.
 *
 * ZERO-ERROR MANDATE: a WRONG barcode causes a wrong cross-store merge — the
 * worst possible failure. When in ANY doubt, assign NOTHING. Guards:
 *   - brand must be PRESENT and (fold-normalized) EQUAL on both sides;
 *   - size (extractGramaj) must be PRESENT and EXACTLY equal — 500g never borrows
 *     a 700g EAN (size is baked into the fingerprint AND checked explicitly);
 *   - the no-EAN name must have >= 2 meaningful tokens (skip generic 1-word names);
 *   - if 2+ DIFFERENT EANs map to the same key → the key is AMBIGUOUS → assign
 *     nothing for it, ever;
 *   - STRICT mode (this is what runs UNSUPERVISED, nightly, with no human audit):
 *     the (brand+fingerprint+gramaj) key alone is NOT enough. A 2026-07 manual
 *     run of 1,279 assignments had 8 audited-wrong merges, and every one of them
 *     shared brand+fingerprint+gramaj with its wrong match (promo packs with
 *     extra grams baked into the printed weight, flour "typ" variants, bag pack
 *     counts, baby-food age ranges, "2w1" vs "3w1" variant markers, catering vs
 *     retail multi-packs). generateProductFingerprint STRIPS all digits before
 *     hashing, so none of those numeric differences show up in the fingerprint.
 *     strictNameMatch() below is the additional guard: it keeps digits/variant
 *     markers INTACT as tokens and requires the two names' significant-token
 *     SETS to be exactly equal (order-independent, but nothing may differ).
 *
 * This mirrors the OFF bulk enricher (Cheep-Scraper/countries/_common/off_bulk.py)
 * but the EAN source is OUR OWN catalog, which has far better PL coverage than OFF.
 * It reuses the SAME normalization the matcher uses (generateProductFingerprint /
 * baseNormalize / cleanProductText / extractGramaj) so a harvested EAN reconciles
 * exactly the way an ingest-time EAN match would.
 *
 * Assigning an EAN that already exists on another product IS the merge signal:
 * because @@unique([country_id, ean_barcode]) allows only one product per EAN per
 * country, the borrowed EAN's owner already exists, so every assignment is a
 * MERGE. We keep the product with more store_prices as the merge target, move the
 * other's prices onto it (productMatcher.mergeProducts), then ensure the survivor
 * carries the EAN.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { prisma } from '../utils/prisma.client.js';
import {
    productMatcher,
    generateProductFingerprint,
    baseNormalize,
    cleanProductText,
} from '../api/products/product-matcher.service.js';
import { extractGramaj } from './brand-independent-pricing.js';

export interface HarvestProduct {
    id: number;
    name: string;
    brand: string | null;
    ean_barcode: string | null;
    store_prices: { store_id: number }[];
}

export interface ProductKey {
    key: string;
    foldBrand: string;
    gramaj: string;
    fingerprint: string;
}

export interface EanIndex {
    /** key -> the single EAN it unambiguously maps to */
    eanByKey: Map<string, string>;
    /** keys that 2+ DIFFERENT EANs map to — never assign for these */
    ambiguous: Set<string>;
    stats: { sources: number; uniqueKeys: number; ambiguousKeys: number };
}

export interface Assignment {
    product: HarvestProduct;
    ean: string;
    key: string;
}

/** A real, borrowable barcode: present and NOT an 'mf-' synthetic fingerprint. */
export function realEan(p: { ean_barcode?: string | null }): string | null {
    const e = (p.ean_barcode ?? '').trim();
    if (!e) return null;
    if (e.toLowerCase().startsWith('mf-')) return null;
    return e;
}

/**
 * Match key = generateProductFingerprint (the SAME signal the matcher merges on):
 * sorted meaningful name-token set + EXACT size (@gramaj) + fat-%. Returns null
 * (→ never matched) unless the size is present and the name has >= 2 meaningful
 * tokens. With `requireBrand`, the brand COLUMN must be present too.
 *
 * Why the key is NOT a separate brand||fingerprint tuple: the fingerprint already
 * embeds brand tokens — from the brand column when present, else from the NAME.
 * Wolt-sourced EAN-bearing products (Carrefour/Żabka) leave the brand column NULL
 * and carry the brand IN the name ("Piątnica Jogurt naturalny 330 g"), whereas the
 * no-EAN chains (Auchan/Biedronka) populate the brand column. Because a borrower's
 * fingerprint ALWAYS contains its brand token (its column is required and gets
 * prepended into the name before normalization), only a source whose NAME contains
 * that SAME brand token can produce an equal fingerprint. So "same brand" is
 * enforced structurally by exact fingerprint equality — never borrowing across
 * brands — while still unlocking the ~10k EAN sources whose brand lives in the name.
 */
export function computeKey(
    p: { name: string; brand?: string | null },
    opts: { requireBrand?: boolean } = {},
): ProductKey | null {
    const brand = (p.brand ?? '').trim();
    const foldBrand = brand ? baseNormalize(brand) : '';
    if (opts.requireBrand && !foldBrand) return null; // borrower MUST carry a brand

    const gramaj = extractGramaj(p.name);
    if (!gramaj) return null; // size MUST be present & parseable

    // Meaningful name tokens (brand NOT prepended) — reuse the matcher's cleaner.
    const nameTokens = cleanProductText(p.name).split(' ').filter(Boolean);
    if (nameTokens.length < 2) return null; // too short / generic

    const fingerprint = generateProductFingerprint({ name: p.name, brand: brand || undefined });
    if (!fingerprint) return null;

    return { key: fingerprint, foldBrand, gramaj, fingerprint };
}

/**
 * Build the (brand,name,size) -> EAN index over EAN-bearing products. A key that
 * 2+ DIFFERENT real EANs map to is flagged AMBIGUOUS and never yields an EAN.
 */
export function buildEanIndex(products: HarvestProduct[]): EanIndex {
    const eansByKey = new Map<string, Set<string>>();
    let sources = 0;
    for (const p of products) {
        const ean = realEan(p);
        if (!ean) continue;
        const k = computeKey(p);
        if (!k) continue;
        sources++;
        let set = eansByKey.get(k.key);
        if (!set) {
            set = new Set();
            eansByKey.set(k.key, set);
        }
        set.add(ean);
    }

    const eanByKey = new Map<string, string>();
    const ambiguous = new Set<string>();
    for (const [key, eans] of eansByKey) {
        if (eans.size === 1) eanByKey.set(key, eans.values().next().value as string);
        else ambiguous.add(key); // 2+ distinct EANs on one key → zero-error skip
    }

    return {
        eanByKey,
        ambiguous,
        stats: { sources, uniqueKeys: eanByKey.size, ambiguousKeys: ambiguous.size },
    };
}

/**
 * For each NO-EAN product, resolve its key against the index. Exactly-one
 * unambiguous EAN → assignment. Ambiguous key → counted skip, no assignment.
 */
export function planAssignments(
    noEanProducts: HarvestProduct[],
    index: EanIndex,
): { assignments: Assignment[]; ambiguousSkips: number; candidates: number } {
    const assignments: Assignment[] = [];
    let ambiguousSkips = 0;
    let candidates = 0;

    for (const p of noEanProducts) {
        if (realEan(p)) continue; // only no-EAN products borrow
        // Borrower side: brand column REQUIRED (its brand token anchors the match).
        const k = computeKey(p, { requireBrand: true });
        if (!k) continue; // failed a guard — skip silently
        candidates++;
        if (index.ambiguous.has(k.key)) {
            ambiguousSkips++;
            continue;
        }
        const ean = index.eanByKey.get(k.key);
        if (!ean) continue; // miss
        assignments.push({ product: p, ean, key: k.key });
    }

    return { assignments, ambiguousSkips, candidates };
}

export interface Exclusion {
    /** borrowed EANs to never assign */
    eans: Set<string>;
    /** no-EAN product ids to never touch */
    productIds: Set<number>;
}

/** Load an exclusion file: JSON { eans: string[], product_ids: number[] }. */
export function loadExclusion(path: string): Exclusion {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as {
        eans?: unknown[];
        product_ids?: unknown[];
    };
    return {
        eans: new Set((raw.eans ?? []).map((e) => String(e).trim())),
        productIds: new Set((raw.product_ids ?? []).map((id) => Number(id))),
    };
}

/**
 * Drop any assignment whose borrowed EAN is in `eans` OR whose no-EAN product id
 * is in `product_ids`. An excluded assignment yields NO write and NO merge — it is
 * simply removed from the plan (and logged as EXCLUDED by the caller).
 */
export function filterExcluded(
    assignments: Assignment[],
    exclusion: Exclusion,
): { kept: Assignment[]; excluded: Assignment[] } {
    const kept: Assignment[] = [];
    const excluded: Assignment[] = [];
    for (const a of assignments) {
        if (exclusion.eans.has(a.ean) || exclusion.productIds.has(a.product.id)) {
            excluded.push(a);
        } else {
            kept.push(a);
        }
    }
    return { kept, excluded };
}

function priceCount(p: HarvestProduct): number {
    return p.store_prices?.length ?? 0;
}

export interface ApplyStats {
    assigned: number; // plain assigns (no existing owner — defensive, rare)
    merged: number; // assignments resolved via a merge
    skipped: number; // constraint violation / error — logged & skipped
}

/**
 * Execute assignments. Because @@unique([country_id, ean_barcode]) permits only
 * one product per EAN, the borrowed EAN's owner already exists → the assignment
 * is a MERGE: keep the product with more store_prices as target, move the other's
 * prices onto it, then make sure the survivor carries the EAN. ownerByEan is
 * mutated so several no-EAN products borrowing the SAME EAN fold into one survivor.
 * In dryRun mode NOTHING is written.
 */
export async function applyAssignments(
    assignments: Assignment[],
    ownerByEan: Map<string, HarvestProduct>,
    opts: { dryRun: boolean; auditLog?: string },
): Promise<ApplyStats> {
    const stats: ApplyStats = { assigned: 0, merged: 0, skipped: 0 };

    for (const a of assignments) {
        const p = a.product;
        const owner = ownerByEan.get(a.ean);

        try {
            if (!owner || owner.id === p.id) {
                // No existing owner (defensive; should not happen since the EAN
                // came from an owned product) → plain assign.
                if (!opts.dryRun) {
                    await prisma.product.update({
                        where: { id: p.id },
                        data: { ean_barcode: a.ean },
                    });
                }
                ownerByEan.set(a.ean, { ...p, ean_barcode: a.ean });
                stats.assigned++;
                audit(opts, 'ASSIGN', a, p, owner);
                continue;
            }

            // Merge: the product with MORE store_prices survives as target.
            const target = priceCount(owner) >= priceCount(p) ? owner : p;
            const source = target === owner ? p : owner;

            if (!opts.dryRun) {
                await productMatcher.mergeProducts(source.id, target.id);
                // If the survivor is the (formerly) no-EAN product, the owner that
                // held the EAN was just deleted → the EAN is free → set it now.
                if (target.id !== owner.id) {
                    await prisma.product.update({
                        where: { id: target.id },
                        data: { ean_barcode: a.ean },
                    });
                }
            }

            // Survivor becomes the new owner, carrying both sides' prices.
            const survivor: HarvestProduct = {
                ...target,
                ean_barcode: a.ean,
                store_prices: [...(owner.store_prices ?? []), ...(p.store_prices ?? [])],
            };
            ownerByEan.set(a.ean, survivor);
            stats.merged++;
            audit(opts, 'MERGE', a, p, owner);
        } catch (err) {
            // A constraint violation or any error → skip & log, never abort the run.
            stats.skipped++;
            const msg = err instanceof Error ? err.message : String(err);
            audit(opts, 'SKIP', a, p, owner, msg);
        }
    }

    return stats;
}

export function audit(
    opts: { dryRun: boolean; auditLog?: string },
    kind: 'ASSIGN' | 'MERGE' | 'SKIP' | 'EXCLUDED' | 'REJECT_STRICT',
    a: Assignment,
    noEan: HarvestProduct,
    owner: HarvestProduct | undefined,
    extra?: string,
): void {
    if (!opts.auditLog) return;
    const line =
        [
            new Date().toISOString(),
            opts.dryRun ? 'DRY' : 'APPLY',
            kind,
            `ean=${a.ean}`,
            `noEan#${noEan.id}="${noEan.name}"`,
            `borrowFrom#${owner?.id ?? '-'}="${owner?.name ?? '-'}"`,
            extra ? `err=${extra}` : '',
        ]
            .filter(Boolean)
            .join('\t') + '\n';
    appendFileSync(opts.auditLog, line);
}

// ---------------------------------------------------------------------------
// strictNameMatch — the UNSUPERVISED guard
// ---------------------------------------------------------------------------

/**
 * Pure connectives only — NOT a general stop-word list. Removing anything more
 * aggressive (like product-matcher's EXTRA_NOISE_WORDS) risks stripping a token
 * that is the ONLY thing distinguishing two different products. Numbers and
 * variant markers ("2w1", "480", "10") are NEVER removed by design.
 */
const CONNECTIVE_WORDS = new Set<string>([
    // Polish
    'z', 'ze', 'w', 'we', 'i', 'a', 'o', 'u', 'do', 'od', 'po', 'na', 'dla', 'oraz', 'lub', 'the',
    // generic/English fallbacks (harmless no-ops for PL names, useful if this
    // guard is ever reused for another country's connectives)
    'and', 'or', 'of', 'for',
]);

/**
 * Tokenize a name into its significant tokens: fold diacritics + lowercase
 * (baseNormalize), split on non-alphanumeric — crucially KEEPING digits inside
 * tokens intact (unlike generateProductFingerprint, which strips all digits
 * before hashing) — then drop brand tokens and pure connectives.
 */
function significantTokens(name: string, brandTokens: ReadonlySet<string>): Set<string> {
    const folded = baseNormalize(name); // lowercase, diacritics folded, punctuation -> space
    const tokens = folded.split(' ').filter(Boolean);
    const out = new Set<string>();
    for (const t of tokens) {
        if (brandTokens.has(t)) continue;
        if (CONNECTIVE_WORDS.has(t)) continue;
        out.add(t);
    }
    return out;
}

/**
 * STRICT unsupervised guard: true only if nameA and nameB reduce to EXACTLY the
 * same set of significant tokens (order-independent — so brand-first vs
 * brand-last word-order variants still match) once brand words and pure
 * connectives are removed. ANY extra or differing token (a promo-pack gram
 * suffix, a different flour "typ", a different pack count, a different age
 * range, "2w1" vs "3w1", a leftover "2" from "2 500 g") makes the sets unequal
 * and the match is REJECTED. This is a precision-over-recall guard: it may
 * reject legitimate spelling variants/typos (e.g. "Kechup" vs "Ketchup") — that
 * is an ACCEPTABLE safe under-merge, never an over-merge.
 */
export function strictNameMatch(nameA: string, nameB: string, brand?: string): boolean {
    const brandTokens = new Set<string>();
    if (brand) {
        for (const t of baseNormalize(brand).split(' ').filter(Boolean)) brandTokens.add(t);
    }

    const setA = significantTokens(nameA, brandTokens);
    const setB = significantTokens(nameB, brandTokens);

    if (setA.size === 0 || setB.size === 0) return false; // defensive: never match on nothing
    if (setA.size !== setB.size) return false;
    for (const t of setA) {
        if (!setB.has(t)) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// harvestEan — the callable service entry point (used by the CLI and by the
// /api/v1/store-prices/harvest-ean endpoint that runs UNSUPERVISED, nightly).
// ---------------------------------------------------------------------------

export interface HarvestEanOptions {
    /** write assignments/merges to the DB; false = dry-run (nothing written) */
    apply: boolean;
    /**
     * require strictNameMatch(noEanName, borrowFromName, borrowerBrand) on top
     * of the (brand+fingerprint+gramaj) key before assigning. This is what
     * makes the harvest safe to run UNSUPERVISED — pass true for any automated
     * / nightly invocation. false is only for the manual CLI (legacy behavior,
     * still followed up by a human audit + --exclude-file).
     */
    strict: boolean;
    /** manual-override exclusion (CLI only; strict mode does not require it) */
    exclusion?: Exclusion;
    /** optional audit log path — every ASSIGN/MERGE/SKIP/REJECT_STRICT is appended */
    auditLog?: string;
}

export interface HarvestEanStats {
    /** no-EAN products with a well-formed borrower key */
    candidates: number;
    /** plain EAN assigns (no existing owner) */
    assigned: number;
    /** assignments resolved via a product merge */
    merged: number;
    /** candidates skipped because their key maps to 2+ different EANs */
    ambiguous: number;
    /** candidates that had a unique key match but failed strictNameMatch */
    rejectedByStrict: number;
}

/**
 * Full harvest run for one country: load products, build the EAN index, plan
 * assignments, apply the strict-mode guard, then execute (or dry-run) the
 * plan. Safe to call unsupervised: STRICT mode structurally cannot merge two
 * products whose names differ by so much as one significant token.
 */
export async function harvestEan(countryCode: string, opts: HarvestEanOptions): Promise<HarvestEanStats> {
    const country = await prisma.country.findUnique({ where: { code: countryCode } });
    if (!country) throw new Error(`Unknown country code: ${countryCode}`);

    const all = (await prisma.product.findMany({
        where: { country_id: country.id },
        select: {
            id: true,
            name: true,
            brand: true,
            ean_barcode: true,
            store_prices: { select: { store_id: true } },
        },
    })) as HarvestProduct[];

    const withEan = all.filter((p) => realEan(p));
    const noEan = all.filter((p) => !realEan(p));

    const index = buildEanIndex(withEan);
    const planned = planAssignments(noEan, index);

    // ownerByEan: the single existing product that currently holds each EAN.
    // Also doubles as the "borrowFrom" name lookup for the strict guard.
    const ownerByEan = new Map<string, HarvestProduct>();
    for (const p of withEan) {
        const e = realEan(p)!;
        if (!ownerByEan.has(e)) ownerByEan.set(e, p);
    }

    let assignments = planned.assignments;
    let rejectedByStrict = 0;

    if (opts.strict) {
        const kept: Assignment[] = [];
        for (const a of assignments) {
            const owner = ownerByEan.get(a.ean);
            const borrowFromName = owner?.name ?? '';
            const borrowerBrand = a.product.brand ?? undefined;
            if (strictNameMatch(a.product.name, borrowFromName, borrowerBrand)) {
                kept.push(a);
            } else {
                rejectedByStrict++;
                audit({ dryRun: !opts.apply, auditLog: opts.auditLog }, 'REJECT_STRICT', a, a.product, owner);
            }
        }
        assignments = kept;
    }

    if (opts.exclusion) {
        const { kept, excluded } = filterExcluded(assignments, opts.exclusion);
        for (const a of excluded) {
            audit({ dryRun: !opts.apply, auditLog: opts.auditLog }, 'EXCLUDED', a, a.product, ownerByEan.get(a.ean));
        }
        assignments = kept;
    }

    const stats = await applyAssignments(assignments, ownerByEan, {
        dryRun: !opts.apply,
        auditLog: opts.auditLog,
    });

    return {
        candidates: planned.candidates,
        assigned: stats.assigned,
        merged: stats.merged,
        ambiguous: planned.ambiguousSkips,
        rejectedByStrict,
    };
}
