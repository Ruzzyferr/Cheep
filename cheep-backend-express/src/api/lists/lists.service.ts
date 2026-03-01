import { prisma } from '../../utils/prisma.client.js';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// LIST CRUD OPERATIONS
// ============================================

/**
 * Kullanıcının tüm listelerini getir (status filter ile)
 */
export const getUserLists = async (userId: number, status?: string) => {
    const where: any = { user_id: userId };
    
    // Status filter (active, completed, ya da hepsi)
    if (status && status !== 'all') {
        where.status = status;
    }
    
    const lists = await prisma.list.findMany({
        where,
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
        orderBy: {
            updated_at: 'desc',
        },
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
                    ? Math.min(...a.product.store_prices.map(sp => parseFloat(sp.price)))
                    : Infinity;
                const bMinPrice = b.product?.store_prices && b.product.store_prices.length > 0
                    ? Math.min(...b.product.store_prices.map(sp => parseFloat(sp.price)))
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
        throw new Error('Liste bulunamadı veya erişim yetkiniz yok');
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
                ? Math.min(...a.product.store_prices.map(sp => parseFloat(sp.price)))
                : Infinity;
            const bMinPrice = b.product?.store_prices && b.product.store_prices.length > 0
                ? Math.min(...b.product.store_prices.map(sp => parseFloat(sp.price)))
                : Infinity;
            
            return aMinPrice - bMinPrice;
        });
    }

    return list;
};

/**
 * Yeni liste oluştur
 */
export const createList = async (
    userId: number,
    data: {
        name: string;
        is_template?: boolean;
        budget?: number | string;
    }
) => {
    // 🔥 KURAL: Aynı anda sadece 1 aktif liste olabilir
    // Eğer yeni liste aktif olacaksa (is_template=false), mevcut aktif listeleri completed yap
    if (!data.is_template) {
        await prisma.list.updateMany({
            where: {
                user_id: userId,
                status: 'active',
            },
            data: {
                status: 'completed',
                completed_at: new Date(),
            },
        });
    }

    return await prisma.list.create({
        data: {
            user_id: userId,
            name: data.name,
            is_template: data.is_template || false,
            budget: data.budget ? new Decimal(data.budget) : null,
            status: 'active', // Yeni liste her zaman active olarak oluşturulur
        },
        include: {
            list_items: true,
        },
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
        throw new Error('Liste bulunamadı veya erişim yetkiniz yok');
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
        throw new Error('Liste bulunamadı veya erişim yetkiniz yok');
    }

    await prisma.list.delete({
        where: { id: listId },
    });

    return { success: true, message: 'Liste silindi' };
};

/**
 * Şablon listeleri getir (public olabilir)
 */
export const getTemplates = async () => {
    return await prisma.list.findMany({
        where: { is_template: true },
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
    });
};

/**
 * Şablondan liste oluştur
 */
export const createFromTemplate = async (
    userId: number,
    templateId: number,
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
        throw new Error('Şablon bulunamadı');
    }

    // Yeni liste oluştur
    const newList = await prisma.list.create({
        data: {
            user_id: userId,
            name: listName || `${template.name} (Kopya)`,
            budget: template.budget,
            is_template: false,
            status: 'active',
        },
    });

    // Şablon ürünlerini kopyala
    if (template.list_items.length > 0) {
        await prisma.listItem.createMany({
            data: template.list_items.map(item => ({
                list_id: newList.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit: item.unit,
            })),
        });
    }

    // Tüm ilişkilerle birlikte getir
    return await prisma.list.findUnique({
        where: { id: newList.id },
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
        throw new Error('Geçmiş liste bulunamadı veya erişim yetkiniz yok');
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
        throw new Error('Hedef liste bulunamadı veya aktif değil');
    }

    // Ürünleri mevcut listeye ekle (duplicate kontrolü ile)
    let addedCount = 0;
    let skippedCount = 0;

    for (const item of completedList.list_items) {
        const exists = await prisma.listItem.findUnique({
            where: {
                list_id_product_id: {
                    list_id: targetListId,
                    product_id: item.product_id,
                },
            },
        });

        if (!exists) {
            await prisma.listItem.create({
                data: {
                    list_id: targetListId,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit: item.unit,
                },
            });
            addedCount++;
        } else {
            skippedCount++;
        }
    }

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
        throw new Error('Geçmiş liste bulunamadı veya erişim yetkiniz yok');
    }

    // ESKİ AKTİF LİSTEYİ SİL (eğer belirtildiyse)
    if (oldActiveListId) {
        await prisma.list.delete({
            where: {
                id: oldActiveListId,
                user_id: userId, // Güvenlik kontrolü
            },
        });
    }

    // Yeni liste oluştur
    const newList = await prisma.list.create({
        data: {
            user_id: userId,
            name: completedList.name,
            budget: completedList.budget,
            is_template: false,
            status: 'active',
        },
    });

    // Ürünleri kopyala
    if (completedList.list_items.length > 0) {
        await prisma.listItem.createMany({
            data: completedList.list_items.map(item => ({
                list_id: newList.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit: item.unit,
            })),
        });
    }

    // Tüm ilişkilerle birlikte getir
    return await prisma.list.findUnique({
        where: { id: newList.id },
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
        throw new Error('Liste bulunamadı veya erişim yetkiniz yok');
    }

    // Ürün var mı kontrol et
    const product = await prisma.product.findUnique({
        where: { id: data.product_id },
    });

    if (!product) {
        throw new Error('Ürün bulunamadı');
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
        throw new Error('Ürün bulunamadı veya erişim yetkiniz yok');
    }

    return await prisma.listItem.update({
        where: { id: itemId },
        data: {
            quantity: data.quantity,
            unit: data.unit,
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
        throw new Error('Ürün bulunamadı veya erişim yetkiniz yok');
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
        throw new Error('Liste bulunamadı veya erişim yetkiniz yok');
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
        throw new Error('Liste bulunamadı veya erişim yetkiniz yok');
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

