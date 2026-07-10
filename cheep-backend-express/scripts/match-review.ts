// Kullanım: npx tsx scripts/match-review.ts list PL
//          npx tsx scripts/match-review.ts approve 12
//          npx tsx scripts/match-review.ts reject 12
import { prisma } from '../src/utils/prisma.client.js';
import { listPendingProposals, approveProposal, rejectProposal } from '../src/services/match-review.service.js';

const [cmd, arg] = process.argv.slice(2);

async function main() {
    if (cmd === 'list') {
        const rows = await listPendingProposals(arg || 'PL');
        for (const r of rows) {
            const [a, b] = await Promise.all([
                prisma.product.findUnique({ where: { id: r.product_id }, include: { store_prices: true } }),
                prisma.product.findUnique({ where: { id: r.candidate_product_id }, include: { store_prices: true } }),
            ]);
            console.log(`#${r.id}  sim=${r.similarity.toFixed(3)}  [${r.evidence}]`);
            console.log(`   YENİ  ${a?.id}: ${a?.name} | ${a?.brand ?? '-'} | mağaza: ${a?.store_prices.map(s => s.store_id).join(',')}`);
            console.log(`   ADAY  ${b?.id}: ${b?.name} | ${b?.brand ?? '-'} | mağaza: ${b?.store_prices.map(s => s.store_id).join(',')}`);
        }
        console.log(`\nToplam bekleyen: ${rows.length}`);
    } else if (cmd === 'approve') {
        await approveProposal(Number(arg));
        console.log(`Teklif ${arg} onaylandı ve birleştirildi.`);
    } else if (cmd === 'reject') {
        await rejectProposal(Number(arg));
        console.log(`Teklif ${arg} reddedildi.`);
    } else {
        console.log('Kullanım: match-review.ts list <CC> | approve <id> | reject <id>');
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
