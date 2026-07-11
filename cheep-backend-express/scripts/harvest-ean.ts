/**
 * EAN harvest CLI — thin wrapper around src/services/ean-harvest.service.ts.
 *
 * All index-build / plan / apply / strict-guard logic lives in the service so
 * it can also be called from the unsupervised nightly endpoint
 * (POST /api/v1/store-prices/harvest-ean). This script only parses argv,
 * prints a human-readable report, and (in non-strict legacy mode) supports
 * --exclude-file for manual-audit overrides.
 *
 * DRY-RUN by default. Pass --apply to write. Usage:
 *   npx tsx scripts/harvest-ean.ts                    # dry-run, legacy (non-strict)
 *   npx tsx scripts/harvest-ean.ts --strict --apply    # strict unsupervised mode
 *   npx tsx scripts/harvest-ean.ts --country=PL --apply --exclude-file audited-wrong.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prisma } from '../src/utils/prisma.client.js';
import {
    realEan,
    computeKey,
    buildEanIndex,
    planAssignments,
    filterExcluded,
    loadExclusion,
    applyAssignments,
    strictNameMatch,
    harvestEan,
    type HarvestProduct,
    type ProductKey,
    type EanIndex,
    type Assignment,
    type Exclusion,
    type ApplyStats,
} from '../src/services/ean-harvest.service.js';

// Re-exported so existing tests/tools that import from the script keep working.
export {
    realEan,
    computeKey,
    buildEanIndex,
    planAssignments,
    filterExcluded,
    loadExclusion,
    applyAssignments,
    strictNameMatch,
    harvestEan,
};
export type { HarvestProduct, ProductKey, EanIndex, Assignment, Exclusion, ApplyStats };

// Store labels for the PL pilot (for reporting attribution only).
const STORE_LABELS: Record<number, string> = { 40: 'Carrefour', 41: 'Auchan', 44: 'Biedronka', 47: 'Żabka' };

async function main() {
    const argv = process.argv.slice(2);
    const apply = argv.includes('--apply');
    const strict = argv.includes('--strict');
    const countryArg = argv.find((a) => a.startsWith('--country='));
    const countryCode = (countryArg ? countryArg.split('=')[1] : 'PL').toUpperCase();
    const dryRun = !apply;

    // --exclude-file <path>  OR  --exclude-file=<path>: audited-wrong assignments
    // to skip (by borrowed EAN or by no-EAN product id). Skipped = no assignment,
    // no merge, logged as EXCLUDED. Strict mode does NOT require this file.
    const exclIdx = argv.indexOf('--exclude-file');
    const exclEq = argv.find((a) => a.startsWith('--exclude-file='));
    const excludePath = exclEq
        ? exclEq.split('=').slice(1).join('=')
        : exclIdx >= 0
          ? argv[exclIdx + 1]
          : undefined;
    const exclusion: Exclusion = excludePath
        ? loadExclusion(excludePath)
        : { eans: new Set(), productIds: new Set() };
    if (excludePath) {
        console.log(
            `Exclusion file: ${excludePath}  (eans=${exclusion.eans.size}, product_ids=${exclusion.productIds.size})`,
        );
    }

    const country = await prisma.country.findUnique({ where: { code: countryCode } });
    if (!country) throw new Error(`Unknown country code: ${countryCode}`);

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const auditDir = resolve(__dirname, '../.harvest-logs');
    mkdirSync(auditDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const auditLog = resolve(
        auditDir,
        `harvest-ean-${countryCode}-${strict ? 'strict' : 'legacy'}-${dryRun ? 'dryrun' : 'apply'}-${stamp}.log`,
    );
    writeFileSync(auditLog, `# EAN harvest ${dryRun ? 'DRY-RUN' : 'APPLY'} ${strict ? 'STRICT' : 'LEGACY'} ${countryCode} ${stamp}\n`);

    console.log(`\n=== EAN harvest — ${countryCode} (${dryRun ? 'DRY-RUN' : 'APPLY'}, ${strict ? 'STRICT' : 'LEGACY'}) ===`);
    console.log('Loading products (preview pass, for the report below)…');

    // A separate reporting pass (fine-grained functions) so we can print the
    // rich sample/store breakdown a human wants when running this by hand.
    // The actual write path always goes through harvestEan() (single source
    // of truth for the strict guard + apply/merge logic).
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
    console.log(`  total=${all.length}  ean-bearing=${withEan.length}  no-ean=${noEan.length}`);

    const index = buildEanIndex(withEan);
    console.log(
        `Index: sources=${index.stats.sources}  uniqueKeys=${index.stats.uniqueKeys}  ambiguousKeys=${index.stats.ambiguousKeys}`,
    );

    const planned = planAssignments(noEan, index);
    const { ambiguousSkips, candidates } = planned;

    const ownerByEan = new Map<string, HarvestProduct>();
    for (const p of withEan) {
        const e = realEan(p)!;
        if (!ownerByEan.has(e)) ownerByEan.set(e, p);
    }

    let previewAssignments = planned.assignments;
    let rejectedByStrictPreview = 0;
    if (strict) {
        previewAssignments = previewAssignments.filter((a) => {
            const owner = ownerByEan.get(a.ean);
            const ok = strictNameMatch(a.product.name, owner?.name ?? '', a.product.brand ?? undefined);
            if (!ok) rejectedByStrictPreview++;
            return ok;
        });
    }

    const { kept: previewKept, excluded } = filterExcluded(previewAssignments, exclusion);

    const wouldMerge = previewKept.filter((a) => {
        const owner = ownerByEan.get(a.ean);
        return owner && owner.id !== a.product.id;
    }).length;

    // Store attribution of the no-EAN products that would get an EAN.
    const byStore = new Map<number, number>();
    for (const a of previewKept) {
        const seen = new Set<number>();
        for (const sp of a.product.store_prices ?? []) {
            if (seen.has(sp.store_id)) continue;
            seen.add(sp.store_id);
            byStore.set(sp.store_id, (byStore.get(sp.store_id) ?? 0) + 1);
        }
    }

    console.log('\n--- PLAN ---');
    console.log(`candidates (no-EAN with a well-formed key): ${candidates}`);
    console.log(`ambiguous skips:                            ${ambiguousSkips}`);
    if (strict) console.log(`rejected by strict name guard:              ${rejectedByStrictPreview}`);
    console.log(`unambiguous assignments (after guard/excl):  ${previewKept.length}`);
    console.log(`excluded (audited-wrong):                   ${excluded.length}`);
    console.log(`would-be merges:                            ${wouldMerge}`);
    console.log('assignments by store:');
    for (const [sid, n] of [...byStore.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${STORE_LABELS[sid] ?? `store ${sid}`} (${sid}): ${n}`);
    }

    console.log('\n--- 25 SAMPLE ASSIGNMENTS (no-EAN name → borrowed-from name → EAN) ---');
    for (const a of previewKept.slice(0, 25)) {
        const owner = ownerByEan.get(a.ean);
        console.log(`  "${a.product.name}"  →  "${owner?.name ?? '?'}"  →  ${a.ean}`);
    }

    // Single source of truth for the actual write path.
    const stats = await harvestEan(countryCode, { apply, strict, exclusion, auditLog });

    console.log('\n--- RESULT ---');
    if (dryRun) {
        console.log('DRY-RUN — nothing written. Re-run with --apply to execute.');
        console.log(
            `would-assign=${stats.assigned}  would-merge=${stats.merged}  ambiguous=${stats.ambiguous}  rejectedByStrict=${stats.rejectedByStrict}`,
        );
    } else {
        console.log(
            `assigned=${stats.assigned}  merged=${stats.merged}  ambiguous=${stats.ambiguous}  rejectedByStrict=${stats.rejectedByStrict}`,
        );
    }
    console.log(`Audit log: ${auditLog}`);
}

// Only run the CLI when executed directly (not when imported by tests).
const isDirectRun =
    typeof process.argv[1] === 'string' &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
    main()
        .catch((err) => {
            console.error('❌ EAN harvest failed:', err);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
