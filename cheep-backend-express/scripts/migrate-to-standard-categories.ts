/**
 * STANDARD CATEGORIES MIGRATION SCRIPT
 * 
 * Bu script mevcut tüm kategorileri standart kategori yapısına dönüştürür:
 * 1. Tüm standart kategorileri veritabanına ekler
 * 2. Mevcut ürünleri doğru standart kategorilere taşır
 * 3. Standart olmayan kategorileri temizler
 * 
 * Kullanım:
 *   tsx scripts/migrate-to-standard-categories.ts
 */

import { prisma } from '../src/utils/prisma.client.js';
import {
    STANDARD_CATEGORIES,
    findStandardCategoryByName,
    findStandardCategoryBySlug,
} from '../src/config/standard-categories.js';
import { categoryMatcher } from '../src/api/categories/category-matcher.service.js';

interface MigrationStats {
    standardCategoriesCreated: number;
    productsMoved: number;
    categoriesMerged: number;
    categoriesDeleted: number;
    errors: string[];
}

async function migrateToStandardCategories() {
    console.log('🚀 Standart kategori migrasyonu başlıyor...\n');

    const stats: MigrationStats = {
        standardCategoriesCreated: 0,
        productsMoved: 0,
        categoriesMerged: 0,
        categoriesDeleted: 0,
        errors: [],
    };

    try {
        // 1. TÜM STANDART KATEGORİLERİ OLUŞTUR
        console.log('📋 Adım 1: Standart kategorileri oluşturuluyor...');
        const categoryIdMap = new Map<string, number>(); // slug -> id mapping

        // Önce ana kategorileri oluştur
        for (const standardCategory of STANDARD_CATEGORIES) {
            try {
                let parentCategory = await prisma.category.findFirst({
                    where: {
                        OR: [
                            { slug: standardCategory.slug },
                            {
                                name: {
                                    equals: standardCategory.name,
                                    mode: 'insensitive',
                                },
                            },
                        ],
                        parent_id: null,
                    },
                });

                if (!parentCategory) {
                    parentCategory = await prisma.category.create({
                        data: {
                            name: standardCategory.name,
                            slug: standardCategory.slug,
                            parent_id: null,
                            display_order: standardCategory.displayOrder,
                            icon_url: standardCategory.icon || null,
                        },
                    });
                    stats.standardCategoriesCreated++;
                    console.log(`   ✅ Ana kategori oluşturuldu: "${standardCategory.name}"`);
                } else {
                    // Mevcut kategoriyi güncelle
                    await prisma.category.update({
                        where: { id: parentCategory.id },
                        data: {
                            name: standardCategory.name,
                            slug: standardCategory.slug,
                            display_order: standardCategory.displayOrder,
                            icon_url: standardCategory.icon || null,
                        },
                    });
                    console.log(`   🔄 Ana kategori güncellendi: "${standardCategory.name}"`);
                }

                categoryIdMap.set(standardCategory.slug, parentCategory.id);

                // Alt kategorileri oluştur
                for (const subcategory of standardCategory.subcategories) {
                    try {
                        let subCategory = await prisma.category.findFirst({
                            where: {
                                OR: [
                                    { slug: subcategory.slug },
                                    {
                                        name: {
                                            equals: subcategory.name,
                                            mode: 'insensitive',
                                        },
                                    },
                                ],
                                parent_id: parentCategory.id,
                            },
                        });

                        if (!subCategory) {
                            subCategory = await prisma.category.create({
                                data: {
                                    name: subcategory.name,
                                    slug: subcategory.slug,
                                    parent_id: parentCategory.id,
                                    display_order: subcategory.displayOrder,
                                },
                            });
                            stats.standardCategoriesCreated++;
                            console.log(`      ✅ Alt kategori oluşturuldu: "${subcategory.name}"`);
                        } else {
                            // Mevcut alt kategoriyi güncelle
                            await prisma.category.update({
                                where: { id: subCategory.id },
                                data: {
                                    name: subcategory.name,
                                    slug: subcategory.slug,
                                    display_order: subcategory.displayOrder,
                                },
                            });
                            console.log(`      🔄 Alt kategori güncellendi: "${subcategory.name}"`);
                        }

                        categoryIdMap.set(subcategory.slug, subCategory.id);
                    } catch (error: any) {
                        const errorMsg = `Alt kategori hatası "${subcategory.name}": ${error.message}`;
                        console.error(`   ❌ ${errorMsg}`);
                        stats.errors.push(errorMsg);
                    }
                }
            } catch (error: any) {
                const errorMsg = `Ana kategori hatası "${standardCategory.name}": ${error.message}`;
                console.error(`   ❌ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }

        console.log(`\n✅ ${stats.standardCategoriesCreated} standart kategori oluşturuldu.\n`);

        // 2. MEVCUT ÜRÜNLERİ STANDART KATEGORİLERE TAŞI
        console.log('📦 Adım 2: Ürünler standart kategorilere taşınıyor...');

        const allProducts = await prisma.product.findMany({
            include: {
                category: true,
            },
        });

        for (const product of allProducts) {
            if (!product.category) {
                continue; // Kategorisi yoksa atla
            }

            const currentCategoryName = product.category.name;
            const standardCategory = findStandardCategoryByName(currentCategoryName);

            if (!standardCategory) {
                // Standart kategoride yoksa, fuzzy matching dene
                try {
                    const matchedId = await categoryMatcher.findOrCreateCategory(currentCategoryName);
                    if (matchedId && matchedId !== product.category_id) {
                        await prisma.product.update({
                            where: { id: product.id },
                            data: { category_id: matchedId },
                        });
                        stats.productsMoved++;
                        if (stats.productsMoved % 50 === 0) {
                            console.log(`   📦 ${stats.productsMoved} ürün taşındı...`);
                        }
                    }
                } catch (error: any) {
                    // Hata durumunda en yakın kategoriyi bul
                    const bestMatch = await findBestStandardCategoryForMerge(currentCategoryName);
                    if (bestMatch && bestMatch !== product.category_id) {
                        await prisma.product.update({
                            where: { id: product.id },
                            data: { category_id: bestMatch },
                        });
                        stats.productsMoved++;
                    } else {
                        const errorMsg = `Ürün taşıma hatası (ID: ${product.id}, Kategori: "${currentCategoryName}"): ${error.message}`;
                        stats.errors.push(errorMsg);
                    }
                }
            } else {
                // Standart kategoride varsa direkt taşı
                let targetId: number | undefined;
                
                // Alt kategori mi, ana kategori mi kontrol et
                if ('subcategories' in standardCategory) {
                    // Ana kategori - slug ile direkt bul
                    targetId = categoryIdMap.get(standardCategory.slug);
                } else {
                    // Alt kategori - slug ile bul
                    targetId = categoryIdMap.get((standardCategory as any).slug);
                }

                if (targetId && targetId !== product.category_id) {
                    await prisma.product.update({
                        where: { id: product.id },
                        data: { category_id: targetId },
                    });
                    stats.productsMoved++;
                    if (stats.productsMoved % 50 === 0) {
                        console.log(`   📦 ${stats.productsMoved} ürün taşındı...`);
                    }
                }
            }
        }

        console.log(`\n✅ ${stats.productsMoved} ürün taşındı.\n`);

        // 3. STANDART OLMAYAN KATEGORİLERİ TEMİZLE
        console.log('🧹 Adım 3: Standart olmayan kategoriler temizleniyor...');

        const allCategories = await prisma.category.findMany({
            include: {
                products: true,
                children: true,
            },
        });

        const standardSlugs = new Set<string>();
        for (const cat of STANDARD_CATEGORIES) {
            standardSlugs.add(cat.slug);
            for (const sub of cat.subcategories) {
                standardSlugs.add(sub.slug);
            }
        }

        for (const category of allCategories) {
            if (standardSlugs.has(category.slug)) {
                continue; // Standart kategori, atla
            }

            // Standart olmayan kategori
            if (category.children.length > 0) {
                // Alt kategorileri varsa, önce onları temizle
                for (const child of category.children) {
                    if (child.products.length > 0) {
                        // Ürünleri birleştirilecek kategoriye taşı
                        const bestMatch = await findBestStandardCategoryForMerge(child.name);
                        if (bestMatch) {
                            await prisma.product.updateMany({
                                where: { category_id: child.id },
                                data: { category_id: bestMatch },
                            });
                            stats.productsMoved += child.products.length;
                        }
                    }
                    await prisma.category.delete({ where: { id: child.id } });
                    stats.categoriesDeleted++;
                }
            }

            if (category.products.length > 0) {
                // Ürünleri birleştirilecek kategoriye taşı
                const bestMatch = await findBestStandardCategoryForMerge(category.name);
                if (bestMatch) {
                    await prisma.product.updateMany({
                        where: { category_id: category.id },
                        data: { category_id: bestMatch },
                    });
                    stats.productsMoved += category.products.length;
                }
            }

            await prisma.category.delete({ where: { id: category.id } });
            stats.categoriesDeleted++;
            console.log(`   🗑️  Silindi: "${category.name}" (${category.products.length} ürün taşındı)`);
        }

        console.log(`\n✅ ${stats.categoriesDeleted} standart olmayan kategori silindi.\n`);

        // 4. ÖZET
        console.log('🎉 Migrasyon tamamlandı!\n');
        console.log('📊 İstatistikler:');
        console.log(`   - ${stats.standardCategoriesCreated} standart kategori oluşturuldu`);
        console.log(`   - ${stats.productsMoved} ürün taşındı`);
        console.log(`   - ${stats.categoriesDeleted} kategori silindi`);
        if (stats.errors.length > 0) {
            console.log(`   - ${stats.errors.length} hata oluştu:`);
            stats.errors.forEach(error => console.log(`     ❌ ${error}`));
        }
    } catch (error) {
        console.error('❌ Migrasyon hatası:', error);
        throw error;
    }
}

/**
 * Bir kategori adı için en uygun standart kategori ID'sini bulur
 */
async function findBestStandardCategoryForMerge(categoryName: string): Promise<number | null> {
    try {
        const matchedId = await categoryMatcher.findOrCreateCategory(categoryName);
        return matchedId;
    } catch {
        // Eşleşme bulunamazsa, genel bir kategoriye at (örn: Temel Gıda)
        const generalCategory = await prisma.category.findFirst({
            where: {
                slug: 'temel-gida',
                parent_id: null,
            },
        });
        return generalCategory?.id || null;
    }
}

// Script'i çalıştır
migrateToStandardCategories()
    .catch((error) => {
        console.error('❌ Script hatası:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

