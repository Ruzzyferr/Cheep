import { prisma } from '../src/utils/prisma.client.js';
import { categoryMatcher } from '../src/api/categories/category-matcher.service.js';

async function main() {
    console.log('🔧 Fixing category hierarchy...');

    const categories = await prisma.category.findMany({
        orderBy: { id: 'asc' },
    });

    const canonicalMap = new Map<string, number>();
    let updated = 0;
    let merged = 0;

    for (const category of categories) {
        const { canonicalName, parentName } = categoryMatcher.getCanonicalInfo(category.name);
        const slug = categoryMatcher.slugifyName(canonicalName);
        const targetParentId = parentName ? await categoryMatcher.ensureParentCategory(parentName) : null;

        if (canonicalMap.has(canonicalName)) {
            const targetId = canonicalMap.get(canonicalName)!;
            if (targetId === category.id) {
                continue;
            }

            console.log(`   🔁 Merge "${category.name}" (#${category.id}) into "${canonicalName}" (#${targetId})`);

            await prisma.category.updateMany({
                where: { parent_id: category.id },
                data: { parent_id: targetId },
            });

            await prisma.product.updateMany({
                where: { category_id: category.id },
                data: { category_id: targetId },
            });

            await prisma.category.delete({
                where: { id: category.id },
            });

            merged += 1;
            continue;
        }

        const updates: Record<string, any> = {};
        if (category.name !== canonicalName) {
            updates.name = canonicalName;
        }
        if (category.slug !== slug) {
            updates.slug = slug;
        }
        if ((category.parent_id ?? null) !== (targetParentId ?? null)) {
            updates.parent_id = targetParentId ?? null;
        }

        if (Object.keys(updates).length > 0) {
            await prisma.category.update({
                where: { id: category.id },
                data: updates,
            });
            console.log(`   ✅ Updated "${category.name}" (#${category.id}) → "${canonicalName}" (parent: ${parentName ?? 'root'})`);
            updated += 1;
        } else {
            console.log(`   ✔ Already canonical "${category.name}" (#${category.id})`);
        }

        canonicalMap.set(canonicalName, category.id);
    }

    console.log(`\n🎯 Category hierarchy fix completed. Updated: ${updated}, merged duplicates: ${merged}`);
}

main()
    .catch((error) => {
        console.error('❌ Category fix script failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

