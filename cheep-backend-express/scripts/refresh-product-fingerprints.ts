import { prisma } from '../src/utils/prisma.client.js';
import { productMatcher } from '../src/api/products/product-matcher.service.js';

async function main() {
    console.log('🔄 Regenerating product fingerprints (muadil_grup_id)...');

    const result = await productMatcher.generateFingerprintsForAll();

    console.log(`✅ Fingerprints refreshed for ${result.processed} products.`);
}

main()
    .catch((error) => {
        console.error('❌ Fingerprint refresh failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

