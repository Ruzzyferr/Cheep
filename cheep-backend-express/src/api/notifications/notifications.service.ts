import { prisma } from '../../utils/prisma.client.js';

const LIST_SELECT = {
    id: true,
    old_price: true,
    new_price: true,
    drop_pct: true,
    read_at: true,
    created_at: true,
    product: { select: { id: true, name: true, brand: true, image_url: true } },
    store: { select: { id: true, name: true, logo_url: true } },
    country: { select: { code: true, currency: true } },
} as const;

/** Kullanıcının bildirimleri, yeniden eskiye. */
export const listNotifications = async (userId: number, limit = 30, offset = 0) => {
    const [items, total] = await Promise.all([
        prisma.priceDrop.findMany({
            where: { user_id: userId },
            select: LIST_SELECT,
            orderBy: { created_at: 'desc' },
            take: limit,
            skip: offset,
        }),
        prisma.priceDrop.count({ where: { user_id: userId } }),
    ]);
    return { items, total, hasMore: offset + items.length < total };
};

/** Zil ikonundaki rozet için. */
export const unreadCount = (userId: number) =>
    prisma.priceDrop.count({ where: { user_id: userId, read_at: null } });

/** Tek bildirimi okundu işaretler. Başkasının bildirimini işaretleyemez. */
export const markRead = async (userId: number, id: number): Promise<boolean> => {
    const r = await prisma.priceDrop.updateMany({
        where: { id, user_id: userId, read_at: null },
        data: { read_at: new Date() },
    });
    return r.count > 0;
};

export const markAllRead = async (userId: number): Promise<number> => {
    const r = await prisma.priceDrop.updateMany({
        where: { user_id: userId, read_at: null },
        data: { read_at: new Date() },
    });
    return r.count;
};
