import { prisma } from '../../utils/prisma.client.js';
import { Decimal } from '@prisma/client/runtime/library';
import { notFound } from '../../utils/app-error.js';

// ============================================
// LIST CRUD OPERATIONS
// ============================================

/**
 * Kullanıcının tüm listelerini getir (aktif önce, sonra updated_at desc).
 * ÜLKEYE göre süzülür: bir liste yalnızca oluşturulduğu ülkedeyken görünür.
 */
export const getUserLists = async (userId: number, countryId: number) => {
    const lists = await prisma.list.findMany({
        where: { user_id: userId, country_id: countryId },
        include: {
            list_items: {
                include: {
                    product: {
                        include: {
                            category: true,
                            store_prices: {
                                include: {
                                    store: true,
                                },
                                orderBy: {
                                    price: 'asc',
                                },
                            },
                        },
                    },
                },
            },
        },
        // status: 'active' < 'inactive' alfabetik → 'active' önce gelir
        orderBy: [{ status: 'asc' }, { updated_at: 'desc' }],
    });

    // 🔥 SIRA: Her listenin elemanlarını market sayısına göre sırala
    lists.forEach(list => {
        if (list.list_items && list.list_items.length > 0) {
            list.list_items = list.list_items.sort((a, b) => {
                const aStoreCount = a.product?.store_prices?.length || 0;
                const bStoreCount = b.product?.store_prices?.length || 0;
                
                // Önce market sayısına göre (çoktan aza)
                if (bStoreCount !== aStoreCount) {
                    return bStoreCount - aStoreCount;
                }
                
                // Market sayısı aynıysa, en ucuz fiyata göre (azdan çoka)
                const aMinPrice = a.product?.store_prices && a.product.store_prices.length > 0
                    ? Math.min(...a.product.store_prices.map(sp => Number(sp.price)))
                    : Infinity;
                const bMinPrice = b.product?.store_prices && b.product.store_prices.length > 0
                    ? Math.min(...b.product.store_prices.map(sp => Number(sp.price)))
                    : Infinity;
                
                return aMinPrice - bMinPrice;
            });
        }
    });

    return lists;
};

/**
 * Liste detayını getir (sadece sahibi erişebilir)
 */
export const getListById = async (listId: number, userId: number) => {
    const list = await prisma.list.findFirst({
        where: {
            id: listId,
            user_id: userId, // Güvenlik: Sadece kendi listesi
        },
        include: {
            list_items: {
                include: {
                    product: {
                        include: {
                            category: true,
                            store_prices: {
                                include: {
                                    store: true,
                                },
                                orderBy: {
                                    price: 'asc',
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    created_at: 'asc',
                },
            },
        },
    });

    if (!list) {
        throw notFound('Liste bulunamadı veya erişim yetkiniz yok');
    }

    // 🔥 SIRA: Liste elemanlarını market sayısına göre sırala (3 market → 2 market → 1 market)
    if (list.list_items && list.list_items.length > 0) {
        list.list_items = list.list_items.sort((a, b) => {
            const aStoreCount = a.product?.store_prices?.length || 0;
            const bStoreCount = b.product?.store_prices?.length || 0;
            
            // Önce market sayısına göre (çoktan aza)
            if (bStoreCount !== aStoreCount) {
                return bStoreCount - aStoreCount;
            }
            
            // Market sayısı aynıysa, en ucuz fiyata göre (azdan çoka)
            const aMinPrice = a.product?.store_prices && a.product.store_prices.length > 0
                ? Math.min(...a.product.store_prices.map(sp => Number(sp.price)))
                : Infinity;
            const bMinPrice = b.product?.store_prices && b.product.store_prices.length > 0
                ? Math.min(...b.product.store_prices.map(sp => Number(sp.price)))
                : Infinity;
            
            return aMinPrice - bMinPrice;
        });
    }

    return list;
};

/**
 * Yeni liste oluştur (aktif); kullanıcının AYNI ÜLKEDEKİ diğer listeleri pasife
 * çekilir. Liste oluşturulduğu ülkeye bağlanır.
 */
export const createList = async (
    userId: number,
    countryId: number,
    data: {
        name: string;
        budget?: number | string | null;
    }
) => {
    // 🔥 KURAL: Aynı anda ÜLKE BAŞINA sadece 1 aktif liste olabilir. Deaktivasyon
    // ülkeye göre süzülür — yoksa Polonya'da liste açmak Türkiye'deki aktif listeyi
    // pasife çekerdi. "mevcut aktifleri inactive yap + yeni listeyi oluştur" atomik.
    return await prisma.$transaction(async (tx) => {
        await tx.list.updateMany({
            where: {
                user_id: userId,
                country_id: countryId,
                status: 'active',
            },
            data: {
                status: 'inactive',
            },
        });

        return await tx.list.create({
            data: {
                user_id: userId,
                country_id: countryId,
                name: data.name,
                budget: data.budget != null ? new Decimal(data.budget) : null,
                status: 'active', // Yeni liste her zaman active olarak oluşturulur
            },
            include: {
                list_items: true,
            },
        });
    });
};

/**
 * Listeyi aktif yap; kullanıcının diğer listeleri pasife çekilir.
 * Sahiplik doğrulanır; yoksa null.
 */
export const activateList = async (listId: number, userId: number) => {
    const owned = await prisma.list.findFirst({ where: { id: listId, user_id: userId } });
    if (!owned) return null;
    return await prisma.$transaction(async (tx) => {
        // Deaktivasyon listenin KENDİ ülkesiyle sınırlı — aktif liste ülke başına
        // tektir; başka ülkedeki aktif listeye dokunma.
        await tx.list.updateMany({
            where: {
                user_id: userId,
                country_id: owned.country_id,
                status: 'active',
            },
            data: {
                status: 'inactive',
            },
        });
        return await tx.list.update({ where: { id: listId }, data: { status: 'active' } });
    });
};

/**
 * Listeyi klonla: kalemleri (brand_independent dahil) kopyalayan yeni PASİF liste.
 * Ad "{name} (Kopya)". Sahiplik yoksa null.
 */
export const cloneList = async (listId: number, userId: number) => {
    const src = await prisma.list.findFirst({
        where: { id: listId, user_id: userId },
        include: { list_items: true },
    });
    if (!src) return null;
    return await prisma.$transaction(async (tx) => {
        const clone = await tx.list.create({
            // Klon, kaynağın ülkesinde kalır (pasif oluşturulur; aktif listeyi ezmez).
            data: { user_id: userId, country_id: src.country_id, name: `${src.name} (Kopya)`, budget: src.budget, status: 'inactive' },
        });
        if (src.list_items.length > 0) {
            await tx.listItem.createMany({
                data: src.list_items.map((it) => ({
                    list_id: clone.id, product_id: it.product_id,
                    quantity: it.quantity, unit: it.unit, brand_independent: it.brand_independent,
                })),
            });
        }
        return clone;
    });
};

/**
 * Başka listeden aktar (merge/replace). brand_independent korunur.
 * Guard: sourceId !== targetId, ikisi de kullanıcıya ait; değilse null.
 */
export const importFromList = async (
    targetId: number, sourceId: number, mode: 'merge' | 'replace', userId: number,
) => {
    if (targetId === sourceId) return null;
    const target = await prisma.list.findFirst({ where: { id: targetId, user_id: userId } });
    if (!target) return null;
    const source = await prisma.list.findFirst({
        where: { id: sourceId, user_id: userId }, include: { list_items: true },
    });
    if (!source) return null;
    return await prisma.$transaction(async (tx) => {
        if (mode === 'replace') {
            await tx.listItem.deleteMany({ where: { list_id: targetId } });
        }
        if (source.list_items.length > 0) {
            await tx.listItem.createMany({
                data: source.list_items.map((it) => ({
                    list_id: targetId, product_id: it.product_id,
                    quantity: it.quantity, unit: it.unit, brand_independent: it.brand_independent,
                })),
                skipDuplicates: mode === 'merge',
            });
        }
        return await tx.list.findFirst({ where: { id: targetId }, include: { list_items: true } });
    });
};

/**
 * Liste güncelle
 */
export const updateList = async (
    listId: number,
    userId: number,
    data: {
        name?: string;
        is_template?: boolean;
        budget?: number | string | null;
    }
) => {
    // Önce liste sahibi mi kontrol et
    const list = await prisma.list.findFirst({
        where: {
            id: listId,
            user_id: userId,
        },
    });

    if (!list) {
        throw notFound('Liste bulunamadı veya erişim yetkiniz yok');
    }

    return await prisma.list.update({
        where: { id: listId },
        data: {
            name: data.name,
            is_template: data.is_template,
            budget: data.budget !== undefined 
                ? (data.budget ? new Decimal(data.budget) : null)
                : undefined,
        },
        include: {
            list_items: {
                include: {
                    product: true,
                },
            },
        },
    });
};

/**
 * Liste sil
 */
export const deleteList = async (listId: number, userId: number) => {
    // Önce liste sahibi mi kontrol et
    const list = await prisma.list.findFirst({
        where: {
            id: listId,
            user_id: userId,
        },
    });

    if (!list) {
        throw notFound('Liste bulunamadı veya erişim yetkiniz yok');
    }

    await prisma.list.delete({
        where: { id: listId },
    });

    return { success: true, message: 'Liste silindi' };
};

/**
 * Şablon listeleri getir (public olabilir)
 */
export const getTemplates = async (countryId?: number) => {
    const templates = await prisma.list.findMany({
        where: {
            is_template: true,
            // ÜLKEYE GÖRE SÜZ: şablonun ürünleri o ülkenin kataloğundan
            // geliyor. Bir TR şablonunu PL kullanıcısına vermek, sonra
            // `createFromTemplate` product_id'leri olduğu gibi kopyaladığı
            // için, karşılaştırmada HER kalemi "eksik" çıkan bir liste üretir.
            ...(countryId ? { country_id: countryId } : {}),
        },
        include: {
            list_items: {
                include: {
                    product: {
                        include: {
                            category: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            created_at: 'desc',
        },
        // Bu uç KİMLİK DOĞRULAMASIZ. Sınırsız bırakmak, her şablonu tüm
        // kalemleri ve ürünleriyle döndüren açık bir uç demek.
        take: 50,
    });

    // `user_id` DIŞARI VERİLMEZ. Şablon galerisi herkese açık; kimin
    // oluşturduğu bilgisi ne gerekli ne de paylaşılabilir.
    return templates.map(({ user_id: _user_id, ...rest }) => rest);
};

/**
 * Şablondan liste oluştur
 */
export const createFromTemplate = async (
    userId: number,
    templateId: number,
    countryId: number,
    listName?: string
) => {
    // Şablonu bul
    const template = await prisma.list.findUnique({
        where: { id: templateId },
        include: {
            list_items: true,
        },
    });

    if (!template || !template.is_template) {
        throw notFound('Şablon bulunamadı');
    }

    // Yeni liste oluştur + şablon ürünlerini kopyala — atomik olmalı. Yeni liste
    // isteğin ülkesine bağlanır; aynı ülkedeki aktif liste pasife çekilir.
    const newListId = await prisma.$transaction(async (tx) => {
        await tx.list.updateMany({
            where: { user_id: userId, country_id: countryId, status: 'active' },
            data: { status: 'inactive' },
        });
        const newList = await tx.list.create({
            data: {
                user_id: userId,
                country_id: countryId,
                name: listName || `${template.name} (Kopya)`,
                budget: template.budget,
                is_template: false,
                status: 'active',
            },
        });

        if (template.list_items.length > 0) {
            await tx.listItem.createMany({
                data: template.list_items.map(item => ({
                    list_id: newList.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit: item.unit,
                })),
            });
        }

        return newList.id;
    });

    // Tüm ilişkilerle birlikte getir
    return await prisma.list.findUnique({
        where: { id: newListId },
        include: {
            list_items: {
                include: {
                    product: true,
                },
            },
        },
    });
};

// ============================================
// COMPLETED LIST IMPORT/REUSE
// ============================================

/**
 * Geçmiş listeden MEVCUT LİSTEYE EKLE (Merge)
 */
export const importFromCompletedList = async (
    userId: number,
    completedListId: number,
    targetListId: number
) => {
    // Geçmiş listeyi bul ve doğrula
    const completedList = await prisma.list.findFirst({
        where: {
            id: completedListId,
            user_id: userId,
            status: 'completed',
        },
        include: {
            list_items: true,
        },
    });

    if (!completedList) {
        throw notFound('Geçmiş liste bulunamadı veya erişim yetkiniz yok');
    }

    // Hedef listeyi doğrula
    const targetList = await prisma.list.findFirst({
        where: {
            id: targetListId,
            user_id: userId,
            status: 'active',
        },
    });

    if (!targetList) {
        throw notFound('Hedef liste bulunamadı veya aktif değil');
    }

    // Ürünleri mevcut listeye ekle — tek transaction + createMany(skipDuplicates).
    // (list_id, product_id) unique olduğundan zaten var olanlar atlanır (N+1 yok).
    const total = completedList.list_items.length;
    const added = await prisma.$transaction(async (tx) => {
        if (total === 0) return 0;
        const result = await tx.listItem.createMany({
            data: completedList.list_items.map(item => ({
                list_id: targetListId,
                product_id: item.product_id,
                quantity: item.quantity,
                unit: item.unit,
            })),
            skipDuplicates: true,
        });
        return result.count;
    });

    const addedCount = added;
    const skippedCount = total - added;

    // Güncellenmiş listeyi getir
    const updatedList = await getListById(targetListId, userId);

    return {
        list: updatedList,
        stats: {
            added: addedCount,
            skipped: skippedCount,
            total: completedList.list_items.length,
        },
    };
};

/**
 * Geçmiş listeden YENİ LİSTE OLUŞTUR (Replace - eski liste SİLİNİR!)
 */
export const replaceWithCompletedList = async (
    userId: number,
    completedListId: number,
    oldActiveListId?: number // Silinecek eski liste
) => {
    // Geçmiş listeyi bul
    const completedList = await prisma.list.findFirst({
        where: {
            id: completedListId,
            user_id: userId,
            status: 'completed',
        },
        include: {
            list_items: true,
        },
    });

    if (!completedList) {
        throw notFound('Geçmiş liste bulunamadı veya erişim yetkiniz yok');
    }

    // Eski listeyi sil + yeni listeyi oluştur + ürünleri kopyala — atomik olmalı.
    const newListId = await prisma.$transaction(async (tx) => {
        // ESKİ AKTİF LİSTEYİ SİL (eğer belirtildiyse)
        if (oldActiveListId) {
            // Önce sahiplik doğrula (delete'e non-unique where geçilemez → IDOR riski).
            const owned = await tx.list.findFirst({
                where: { id: oldActiveListId, user_id: userId },
                select: { id: true },
            });
            if (!owned) {
                throw notFound('Silinecek liste bulunamadı veya erişim yetkiniz yok');
            }
            await tx.list.delete({
                where: { id: oldActiveListId },
            });
        }

        // Yeni liste oluştur — tamamlanan listenin ülkesinde kalır (aynı ülke reuse).
        const newList = await tx.list.create({
            data: {
                user_id: userId,
                country_id: completedList.country_id,
                name: completedList.name,
                budget: completedList.budget,
                is_template: false,
                status: 'active',
            },
        });

        // Ürünleri kopyala
        if (completedList.list_items.length > 0) {
            await tx.listItem.createMany({
                data: completedList.list_items.map(item => ({
                    list_id: newList.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit: item.unit,
                })),
            });
        }

        return newList.id;
    });

    // Tüm ilişkilerle birlikte getir
    return await prisma.list.findUnique({
        where: { id: newListId },
        include: {
            list_items: {
                include: {
                    product: true,
                },
            },
        },
    });
};

// ============================================
// LIST ITEMS OPERATIONS
// ============================================

/**
 * Listeye ürün ekle
 */
export const addItemToList = async (
    listId: number,
    userId: number,
    data: {
        product_id: number;
        quantity?: number;
        unit?: string;
        brand_independent?: boolean;
    }
) => {
    // Liste kontrolü
    const list = await prisma.list.findFirst({
        where: {
            id: listId,
            user_id: userId,
        },
    });

    if (!list) {
        throw notFound('Liste bulunamadı veya erişim yetkiniz yok');
    }

    // Ürün var mı kontrol et
    const product = await prisma.product.findUnique({
        where: { id: data.product_id },
    });

    if (!product) {
        throw notFound('Ürün bulunamadı');
    }

    // Zaten var mı kontrol et
    const existingItem = await prisma.listItem.findUnique({
        where: {
            list_id_product_id: {
                list_id: listId,
                product_id: data.product_id,
            },
        },
    });

    if (existingItem) {
        // Varsa miktarı güncelle
        return await prisma.listItem.update({
            where: { id: existingItem.id },
            data: {
                quantity: data.quantity || existingItem.quantity,
                unit: data.unit || existingItem.unit,
                brand_independent: data.brand_independent ?? existingItem.brand_independent,
            },
            include: {
                product: {
                    include: {
                        category: true,
                        store_prices: {
                            include: { store: true },
                            orderBy: { price: 'asc' },
                        },
                    },
                },
            },
        });
    }

    // Yoksa ekle
    return await prisma.listItem.create({
        data: {
            list_id: listId,
            product_id: data.product_id,
            quantity: data.quantity || 1,
            unit: data.unit || 'adet',
            brand_independent: data.brand_independent ?? false,
        },
        include: {
            product: {
                include: {
                    category: true,
                    store_prices: {
                        include: { store: true },
                        orderBy: { price: 'asc' },
                    },
                },
            },
        },
    });
};

/**
 * Liste item'ı güncelle (miktar, birim)
 */
export const updateListItem = async (
    itemId: number,
    userId: number,
    data: {
        quantity?: number;
        unit?: string;
        brand_independent?: boolean;
    }
) => {
    // Item'ın sahibi mi kontrol et
    const item = await prisma.listItem.findUnique({
        where: { id: itemId },
        include: {
            list: true,
        },
    });

    if (!item || item.list.user_id !== userId) {
        throw notFound('Ürün bulunamadı veya erişim yetkiniz yok');
    }

    return await prisma.listItem.update({
        where: { id: itemId },
        data: {
            quantity: data.quantity,
            unit: data.unit,
            brand_independent: data.brand_independent,
        },
        include: {
            product: {
                include: {
                    category: true,
                    store_prices: {
                        include: { store: true },
                        orderBy: { price: 'asc' },
                    },
                },
            },
        },
    });
};

/**
 * Listeden ürün çıkar
 */
export const removeItemFromList = async (
    listId: number,
    itemId: number,
    userId: number
) => {
    // Item'ın sahibi mi kontrol et
    const item = await prisma.listItem.findUnique({
        where: { id: itemId },
        include: {
            list: true,
        },
    });

    if (!item || item.list.user_id !== userId || item.list_id !== listId) {
        throw notFound('Ürün bulunamadı veya erişim yetkiniz yok');
    }

    await prisma.listItem.delete({
        where: { id: itemId },
    });

    return { success: true, message: 'Ürün listeden çıkarıldı' };
};

/**
 * Listedeki tüm ürünleri sil
 */
export const clearList = async (listId: number, userId: number) => {
    // Liste kontrolü
    const list = await prisma.list.findFirst({
        where: {
            id: listId,
            user_id: userId,
        },
    });

    if (!list) {
        throw notFound('Liste bulunamadı veya erişim yetkiniz yok');
    }

    await prisma.listItem.deleteMany({
        where: { list_id: listId },
    });

    return { success: true, message: 'Liste temizlendi' };
};

// ============================================
// LIST STATISTICS
// ============================================

/**
 * Liste istatistikleri
 */
export const getListStatistics = async (listId: number, userId: number) => {
    const list = await prisma.list.findFirst({
        where: {
            id: listId,
            user_id: userId,
        },
        include: {
            list_items: {
                include: {
                    product: {
                        include: {
                            store_prices: true,
                        },
                    },
                },
            },
        },
    });

    if (!list) {
        throw notFound('Liste bulunamadı veya erişim yetkiniz yok');
    }

    const totalItems = list.list_items.length;
    const itemsWithPrices = list.list_items.filter(
        item => item.product.store_prices.length > 0
    ).length;

    // En ucuz toplam fiyat hesapla
    let minTotalPrice = 0;
    let maxTotalPrice = 0;

    list.list_items.forEach(item => {
        const prices = item.product.store_prices.map(sp => Number(sp.price));
        if (prices.length > 0) {
            minTotalPrice += Math.min(...prices) * item.quantity;
            maxTotalPrice += Math.max(...prices) * item.quantity;
        }
    });

    return {
        listId: list.id,
        listName: list.name,
        totalItems,
        itemsWithPrices,
        itemsWithoutPrices: totalItems - itemsWithPrices,
        estimatedMinPrice: minTotalPrice.toFixed(2),
        estimatedMaxPrice: maxTotalPrice.toFixed(2),
        potentialSavings: (maxTotalPrice - minTotalPrice).toFixed(2),
        budget: list.budget ? Number(list.budget) : null,
        budgetRemaining: list.budget 
            ? (Number(list.budget) - minTotalPrice).toFixed(2)
            : null,
    };
};

