import { prisma } from '../../utils/prisma.client.js';
import { Prisma } from '@prisma/client';

interface GetAllProductsParams {
    category_id?: number;
    brand?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

export const getAllProducts = async (params: GetAllProductsParams) => {
    const { category_id, brand, search, limit = 50, offset = 0 } = params;

    const where: Prisma.ProductWhereInput = {};

    if (category_id) {
        // 🔥 Parent kategorinin alt kategorilerini de dahil et
        const category = await prisma.category.findUnique({
            where: { id: category_id },
            include: {
                children: {
                    select: { id: true },
                },
            },
        });

        if (category) {
            // Eğer parent kategoriyse (alt kategorileri varsa), onları da dahil et
            if (category.children && category.children.length > 0) {
                const categoryIds = [category.id, ...category.children.map(c => c.id)];
                where.category_id = { in: categoryIds };
            } else {
                // Alt kategoriyse, sadece kendi ID'sini kullan
                where.category_id = category_id;
            }
        } else {
            // Kategori bulunamadıysa, yine de filtrele (hata verme)
            where.category_id = category_id;
        }
    }

    if (brand) {
        where.brand = {
            contains: brand,
            mode: 'insensitive',
        };
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { brand: { contains: search, mode: 'insensitive' } },
            { ean_barcode: { contains: search } },
        ];
    }

    // 🔥 DATABASE SEVİYESİNDE SIRALAMA: Market sayısına göre (çoktan aza)
    // Raw SQL ile store_prices count'una göre sıralama
    
    // WHERE clause builder
    let whereClause = Prisma.sql`WHERE 1=1`;
    
    if (where.category_id) {
        if (typeof where.category_id === 'object' && 'in' in where.category_id) {
            // Array olarak gelen category_id'ler (parent + children)
            whereClause = Prisma.sql`${whereClause} AND p.category_id IN (${Prisma.join(where.category_id.in)})`;
        } else {
            // Tekil category_id
            whereClause = Prisma.sql`${whereClause} AND p.category_id = ${where.category_id}`;
        }
    }
    
    if (where.brand?.contains) {
        whereClause = Prisma.sql`${whereClause} AND p.brand ILIKE ${'%' + where.brand.contains + '%'}`;
    }
    
    if (where.OR) {
        const searchName = where.OR[0]?.name?.contains || '';
        const searchBrand = where.OR[1]?.brand?.contains || '';
        const searchBarcode = where.OR[2]?.ean_barcode?.contains || '';
        whereClause = Prisma.sql`${whereClause} AND (
            p.name ILIKE ${'%' + searchName + '%'} OR
            p.brand ILIKE ${'%' + searchBrand + '%'} OR
            p.ean_barcode LIKE ${'%' + searchBarcode + '%'}
        )`;
    }
    
    const products = await prisma.$queryRaw<any[]>`
        SELECT 
            p.*,
            COUNT(sp.id) as store_count,
            MIN(sp.price::numeric) as min_price
        FROM "products" p
        LEFT JOIN "store_prices" sp ON p.id = sp.product_id
        ${whereClause}
        GROUP BY p.id
        ORDER BY 
            store_count DESC,  -- Önce market sayısına göre (çoktan aza)
            min_price ASC,     -- Sonra en ucuz fiyata göre (azdan çoka)
            p.created_at DESC  -- Son olarak yeni ürünler
        LIMIT ${limit}
        OFFSET ${offset}
    `;

    const total = await prisma.product.count({ where });

    // Eğer ürün yoksa boş array döndür
    if (products.length === 0) {
        return {
            products: [],
            pagination: {
                total,
                limit,
                offset,
                hasMore: false,
            },
        };
    }

    // İlişkili verileri (category, store_prices) ayrı sorgularla al
    // BigInt'ten Number'a dönüştür
    const productIds = products.map(p => Number(p.id));
    
    const productsWithRelations = await prisma.product.findMany({
        where: { id: { in: productIds } },
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
    });

    // Raw SQL sonuçlarının sırasını koru
    const orderedProducts = productIds.map(id => 
        productsWithRelations.find(p => p.id === id)
    ).filter(Boolean) as any[];

    return {
        products: orderedProducts,
        pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
        },
    };
};

export const getProductById = async (id: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
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
    });

    if (!product) {
        throw new Error('Ürün bulunamadı');
    }

    return product;
};

export const getProductByBarcode = async (barcode: string) => {
    const product = await prisma.product.findUnique({
        where: { ean_barcode: barcode },
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
    });

    if (!product) {
        throw new Error('Ürün bulunamadı');
    }

    return product;
};

export const createProduct = async (data: {
    name: string;
    brand?: string;
    ean_barcode?: string;
    image_url?: string;
    category_id?: number;
    muadil_grup_id?: string;
}) => {
    // Barkod varsa, aynı barkodlu ürün kontrolü
    if (data.ean_barcode) {
        const existing = await prisma.product.findUnique({
            where: { ean_barcode: data.ean_barcode },
        });

        if (existing) {
            throw new Error('Bu barkoda sahip ürün zaten mevcut');
        }
    }

    return await prisma.product.create({
        data,
        include: {
            category: true,
        },
    });
};

export const upsertProduct = async (data: {
    name: string;
    brand?: string;
    ean_barcode?: string;
    image_url?: string;
    category_id?: number;
    muadil_grup_id?: string;
}) => {
    // Eğer barkod varsa, ona göre upsert yap
    if (data.ean_barcode) {
        return await prisma.product.upsert({
            where: { ean_barcode: data.ean_barcode },
            update: {
                name: data.name,
                brand: data.brand,
                image_url: data.image_url,
                category_id: data.category_id,
                muadil_grup_id: data.muadil_grup_id,
            },
            create: data,
            include: {
                category: true,
            },
        });
    }

    // Barkod yoksa direkt oluştur
    return await prisma.product.create({
        data,
        include: {
            category: true,
        },
    });
};

export const updateProduct = async (
    id: number,
    data: {
        name?: string;
        brand?: string;
        barcode?: string;
        image_url?: string;
        category_id?: number;
        muadil_grup_id?: string;
    }
) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
        throw new Error('Ürün bulunamadı');
    }

    return await prisma.product.update({
        where: { id },
        data,
        include: {
            category: true,
        },
    });
};

export const deleteProduct = async (id: number) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
        throw new Error('Ürün bulunamadı');
    }

    await prisma.product.delete({ where: { id } });
};

export const getProductPrices = async (id: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            store_prices: {
                include: {
                    store: true,
                },
                orderBy: {
                    price: 'asc',
                },
            },
        },
    });

    if (!product) {
        throw new Error('Ürün bulunamadı');
    }

    return product.store_prices;
};

export const compareProductPrices = async (id: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            store_prices: {
                include: {
                    store: true,
                },
                orderBy: {
                    price: 'asc',
                },
            },
        },
    });

    if (!product) {
        throw new Error('Ürün bulunamadı');
    }

    if (product.store_prices.length === 0) {
        return {
            product: {
                id: product.id,
                name: product.name,
                brand: product.brand,
            },
            prices: [],
            cheapest: null,
            mostExpensive: null,
            averagePrice: null,
            priceDifference: null,
        };
    }

    const prices = product.store_prices.map((sp) => ({
        store: sp.store,
        price: Number(sp.price),
        unit: sp.unit,
        last_updated_at: sp.last_updated_at,
    }));

    const cheapest = prices[0];
    const mostExpensive = prices[prices.length - 1];
    const averagePrice =
        prices.reduce((sum: any, p: { price: any; }) => sum + p.price, 0) / prices.length;
    const priceDifference = mostExpensive.price - cheapest.price;
    const savingsPercentage =
        ((priceDifference / mostExpensive.price) * 100).toFixed(2);

    return {
        product: {
            id: product.id,
            name: product.name,
            brand: product.brand,
            image_url: product.image_url,
        },
        prices,
        cheapest,
        mostExpensive,
        averagePrice: Number(averagePrice.toFixed(2)),
        priceDifference: Number(priceDifference.toFixed(2)),
        savingsPercentage: `${savingsPercentage}%`,
    };
};

