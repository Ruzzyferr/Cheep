import { prisma } from '../utils/prisma.client.js';
import { productMatcher } from '../api/products/product-matcher.service.js';

export async function listPendingProposals(countryCode: string) {
    const country = await prisma.country.findFirst({ where: { code: countryCode.toUpperCase() } });
    if (!country) throw new Error(`Bilinmeyen ülke: ${countryCode}`);
    return prisma.matchProposal.findMany({
        where: { country_id: country.id, status: 'pending' },
        orderBy: { similarity: 'desc' },
    });
}

export async function approveProposal(id: number) {
    const p = await prisma.matchProposal.findUnique({ where: { id } });
    if (!p || p.status !== 'pending') throw new Error(`Teklif ${id} pending değil`);
    // Yeni ürün (product_id) kanonik adaya (candidate_product_id) katılır.
    await productMatcher.mergeProducts(p.product_id, p.candidate_product_id);
    await prisma.matchProposal.update({ where: { id }, data: { status: 'approved' } });
    // Aynı yeni ürünün diğer bekleyen teklifleri artık geçersiz (ürün silindi).
    await prisma.matchProposal.updateMany({
        where: { product_id: p.product_id, status: 'pending', id: { not: id } },
        data: { status: 'rejected' },
    });
    return p;
}

export async function rejectProposal(id: number) {
    const p = await prisma.matchProposal.findUnique({ where: { id } });
    if (!p || p.status !== 'pending') throw new Error(`Teklif ${id} pending değil`);
    return prisma.matchProposal.update({ where: { id }, data: { status: 'rejected' } });
}
