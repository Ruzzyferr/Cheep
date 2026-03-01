// ============================================
// src/api/categories/categories.service.ts
// HİYERARŞİK KATEGORİ SERVİSİ
// ============================================
import { prisma } from '../../utils/prisma.client.js';
import slugifyModule from 'slugify';

const slugify =
    (slugifyModule as unknown as typeof import('slugify')['default']) ??
    ((slugifyModule as unknown) as typeof import('slugify')['default']);

/**
 * Tüm kategorileri getir (düz liste)
 */
export const getAllCategories = async () => {
    return await prisma.category.findMany({
        orderBy: [
            { parent_id: 'asc' }, // Önce parent'lar
            { display_order: 'asc' },
        ],
        include: {
            parent: true, // Parent bilgisini de getir
            _count: {
                select: {
                    products: true, // Kaç ürün var?
                    children: true, // Kaç alt kategori var?
                },
            },
        },
    });
};

/**
 * Sadece ana kategorileri getir (parent_id = null)
 */
export const getParentCategories = async () => {
    const categories = await prisma.category.findMany({
        where: { parent_id: null },
        orderBy: { display_order: 'asc' },
        include: {
            _count: {
                select: {
                    products: true,
                    children: true,
                },
            },
        },
    });
    
    // Debug log
    console.log(`📊 Parent categories found: ${categories.length}`);
    categories.forEach(cat => console.log(`  - ${cat.name} (ID: ${cat.id}, parent_id: ${cat.parent_id})`));
    
    return categories;
};

/**
 * Hiyerarşik tree yapısı (parent-child ilişkisi ile)
 */
export const getCategoryTree = async () => {
    // 1. Tüm kategorileri getir
    const allCategories = await prisma.category.findMany({
        orderBy: [
            { parent_id: 'asc' },
            { display_order: 'asc' },
        ],
        include: {
            _count: {
                select: {
                    products: true,
                },
            },
        },
    });

    // 2. Tree yapısı oluştur
    const categoryMap = new Map();
    const tree: any[] = [];

    // Önce tüm kategorileri map'e ekle
    allCategories.forEach(category => {
        categoryMap.set(category.id, {
            ...category,
            children: [],
        });
    });

    // Sonra child'ları parent'lara ekle
    allCategories.forEach(category => {
        const node = categoryMap.get(category.id);
        if (category.parent_id === null) {
            // Ana kategori
            tree.push(node);
        } else {
            // Alt kategori
            const parent = categoryMap.get(category.parent_id);
            if (parent) {
                parent.children.push(node);
            }
        }
    });

    return tree;
};

/**
 * Bir kategorinin alt kategorilerini getir
 */
export const getSubcategories = async (parentId: number) => {
    return await prisma.category.findMany({
        where: { parent_id: parentId },
        orderBy: { display_order: 'asc' },
        include: {
            _count: {
                select: {
                    products: true,
                },
            },
        },
    });
};

/**
 * ID'ye göre kategori getir (children ile birlikte)
 */
export const getCategoryById = async (id: number) => {
    return await prisma.category.findUnique({
        where: { id },
        include: {
            parent: true,
            children: {
                orderBy: { display_order: 'asc' },
            },
            _count: {
                select: {
                    products: true,
                    children: true,
                },
            },
        },
    });
};

/**
 * Slug'a göre kategori getir
 */
export const getCategoryBySlug = async (slug: string) => {
    return await prisma.category.findUnique({
        where: { slug },
        include: {
            parent: true,
            children: {
                orderBy: { display_order: 'asc' },
            },
            _count: {
                select: {
                    products: true,
                    children: true,
                },
            },
        },
    });
};

/**
 * İsme göre kategori bul
 */
export const getCategoryByName = async (name: string) => {
    return await prisma.category.findFirst({
        where: { name },
    });
};

/**
 * Kategori oluştur
 * 🔥 Slug artık opsiyonel! Verilmezse otomatik oluşturulur
 */
export const createCategory = async (data: {
    name: string;
    slug?: string;  // Opsiyonel!
    parent_id?: number | null;
    display_order?: number;
    icon_url?: string;
}) => {
    // 🔥 Eğer slug yoksa, otomatik oluştur
    const finalSlug = data.slug || slugify(data.name, {
        lower: true,
        locale: 'tr',
        strict: true,
    });

    // Aynı slug varsa hata ver
    const existing = await prisma.category.findUnique({
        where: { slug: finalSlug },
    });

    if (existing) {
        throw new Error('Bu slug zaten kullanılıyor');
    }

    // Parent kontrolü
    if (data.parent_id) {
        const parent = await prisma.category.findUnique({
            where: { id: data.parent_id },
        });
        if (!parent) {
            throw new Error('Parent kategori bulunamadı');
        }
    }

    return await prisma.category.create({
        data: {
            name: data.name,
            slug: finalSlug,
            parent_id: data.parent_id || null,
            display_order: data.display_order || 0,
            icon_url: data.icon_url,
        },
        include: {
            parent: true,
        },
    });
};

/**
 * Kategori güncelle
 */
export const updateCategory = async (
    id: number,
    data: {
        name?: string;
        slug?: string;
        parent_id?: number | null;
        display_order?: number;
        icon_url?: string;
    }
) => {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
        throw new Error('Kategori bulunamadı');
    }

    // Slug değişiyorsa, unique kontrolü
    if (data.slug && data.slug !== category.slug) {
        const existing = await prisma.category.findUnique({
            where: { slug: data.slug },
        });
        if (existing) {
            throw new Error('Bu slug zaten kullanılıyor');
        }
    }

    // Parent kontrolü
    if (data.parent_id !== undefined) {
        if (data.parent_id === id) {
            throw new Error('Kategori kendi parent\'ı olamaz');
        }
        if (data.parent_id !== null) {
            const parent = await prisma.category.findUnique({
                where: { id: data.parent_id },
            });
            if (!parent) {
                throw new Error('Parent kategori bulunamadı');
            }
        }
    }

    return await prisma.category.update({
        where: { id },
        data,
        include: {
            parent: true,
            children: true,
        },
    });
};

/**
 * Kategori sil
 */
export const deleteCategory = async (id: number) => {
    const category = await prisma.category.findUnique({
        where: { id },
        include: {
            children: true,
            _count: {
                select: { products: true },
            },
        },
    });

    if (!category) {
        throw new Error('Kategori bulunamadı');
    }

    // Alt kategorileri varsa silinemez
    if (category.children.length > 0) {
        throw new Error('Alt kategorileri olan kategori silinemez');
    }

    // Ürünleri varsa uyar
    if (category._count.products > 0) {
        throw new Error(`Bu kategoride ${category._count.products} ürün var. Önce ürünleri taşıyın.`);
    }

    await prisma.category.delete({ where: { id } });
};

/**
 * Bir kategorinin tüm parent'larını getir (breadcrumb için)
 */
export const getCategoryBreadcrumb = async (categoryId: number) => {
    const breadcrumb: any[] = [];
    let currentId: number | null = categoryId;

    while (currentId !== null) {
        // @ts-ignore
        const category = await prisma.category.findUnique({
            where: { id: currentId },
            select: {
                id: true,
                name: true,
                slug: true,
                parent_id: true,
            },
        });

        if (!category) break;

        breadcrumb.unshift(category); // Başa ekle
        currentId = category.parent_id;
    }

    return breadcrumb;
};

/**
 * Kategori ve alt kategorilerindeki toplam ürün sayısı
 */
export const getCategoryProductCount = async (categoryId: number, includeChildren: boolean = true) => {
    if (!includeChildren) {
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
            include: {
                _count: {
                    select: { products: true },
                },
            },
        });
        return category?._count.products || 0;
    }

    // Alt kategoriler dahil
    const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: {
            children: {
                include: {
                    _count: {
                        select: { products: true },
                    },
                },
            },
            _count: {
                select: { products: true },
            },
        },
    });

    if (!category) return 0;

    let total = category._count.products;
    category.children.forEach(child => {
        total += child._count.products;
    });

    return total;
};

