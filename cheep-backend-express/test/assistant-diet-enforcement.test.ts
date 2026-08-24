import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Asistanın ürün seçerken kullanıcının diyetine UYMASINI kilitler.
 *
 * Canlı denemede vejetaryen profilli bir kullanıcının listesine balıklı ürün
 * eklendi: sistem istemi "NEVER violate hard constraints" diyordu ama
 * `add_items_to_list` katalog aramasının ilk sonucunu körlemesine ekliyordu.
 * Kısıt artık modelin insafına bırakılmıyor, sunucuda uygulanıyor.
 */

const getAllProducts = vi.fn();
const addItemToList = vi.fn();

vi.mock('../src/api/products/products.service.js', () => ({
  getAllProducts: (...a: any[]) => getAllProducts(...a),
  getProductPrices: vi.fn(),
}));
vi.mock('../src/api/lists/lists.service.js', () => ({
  addItemToList: (...a: any[]) => addItemToList(...a),
  getUserLists: vi.fn(),
  getListById: vi.fn(),
  createList: vi.fn(),
  removeItemFromList: vi.fn(),
}));
vi.mock('../src/services/compare-engine.service.js', () => ({ compareShoppingList: vi.fn() }));

const { buildToolExecutor } = await import('../src/api/assistant/assistant.tools.js');

const FISH = { id: 1, name: 'Palamut Fileto 400 Gr', category: { name: 'Deniz Ürünleri' } };
const MEAT = { id: 2, name: 'Dana Kıyma 500 Gr', category: { name: 'Kırmızı Et' } };
const LENTIL = { id: 3, name: 'Yeşil Mercimek 1 Kg', category: { name: 'Bakliyat' } };
const MILK = { id: 4, name: 'Sütaş Süt 1 Lt', category: { name: 'Süt' } };

beforeEach(() => {
  getAllProducts.mockReset();
  addItemToList.mockReset();
  addItemToList.mockResolvedValue({ id: 99 });
});

describe('add_items_to_list — diyet kısıtı', () => {
  it('vejetaryen kullanıcıya balık EKLEMEZ, uygun adaya geçer', async () => {
    getAllProducts.mockResolvedValue({ products: [FISH, LENTIL] });
    const exec = buildToolExecutor(1, 1, { diet: 'vegetarian' });

    const res = await exec('add_items_to_list', { listId: 5, items: [{ query: 'protein' }] });

    expect(res.added[0]).toMatchObject({ matched: true, product: 'Yeşil Mercimek 1 Kg' });
    expect(addItemToList).toHaveBeenCalledWith(5, 1, expect.objectContaining({ product_id: LENTIL.id }));
  });

  it('tüm adaylar diyete aykırıysa ekleme YAPMAZ ve modele nedenini söyler', async () => {
    getAllProducts.mockResolvedValue({ products: [FISH, MEAT] });
    const exec = buildToolExecutor(1, 1, { diet: 'vegetarian' });

    const res = await exec('add_items_to_list', { listId: 5, items: [{ query: 'et' }] });

    expect(res.added[0]).toMatchObject({ matched: false, reason: 'diet_conflict' });
    expect(addItemToList).not.toHaveBeenCalled();
  });

  it('vegan kullanıcı için süt ürünü de elenir', async () => {
    getAllProducts.mockResolvedValue({ products: [MILK, LENTIL] });
    const exec = buildToolExecutor(1, 1, { diet: 'vegan' });

    const res = await exec('add_items_to_list', { listId: 5, items: [{ query: 'kahvaltilik' }] });

    expect(res.added[0].product).toBe('Yeşil Mercimek 1 Kg');
  });

  it('profil YOKSA hiçbir şey elenmez — kısıtsız kullanıcı kısıtlanmaz', async () => {
    getAllProducts.mockResolvedValue({ products: [FISH, LENTIL] });
    const exec = buildToolExecutor(1, 1, null);

    const res = await exec('add_items_to_list', { listId: 5, items: [{ query: 'balık' }] });

    expect(res.added[0].product).toBe('Palamut Fileto 400 Gr');
  });

  it('ürün bulunamadığında sebep "not_found" olur (diyetle karıştırılmaz)', async () => {
    getAllProducts.mockResolvedValue({ products: [] });
    const exec = buildToolExecutor(1, 1, { diet: 'vegan' });

    const res = await exec('add_items_to_list', { listId: 5, items: [{ query: 'yok böyle şey' }] });

    expect(res.added[0]).toMatchObject({ matched: false, reason: 'not_found' });
  });

  it('tek aday değil BİRDEN FAZLA aday çekilir — yoksa alternatife geçilemez', async () => {
    getAllProducts.mockResolvedValue({ products: [LENTIL] });
    const exec = buildToolExecutor(1, 1, { diet: 'vegetarian' });

    await exec('add_items_to_list', { listId: 5, items: [{ query: 'mercimek' }] });

    expect(getAllProducts).toHaveBeenCalledWith(expect.objectContaining({ limit: 8 }));
  });
});

describe('search_products — diyet kısıtı', () => {
  it('vejetaryen kullanıcıya arama sonuçlarında et göstermez', async () => {
    getAllProducts.mockResolvedValue({ products: [MEAT, FISH, LENTIL] });
    const exec = buildToolExecutor(1, 1, { diet: 'vegetarian' });

    const res = await exec('search_products', { query: 'yemeklik', limit: 5 });

    expect(res.map((p: any) => p.id)).toEqual([LENTIL.id]);
  });

  it('eleme sonrası istenen sayıda sonuç kalsın diye fazladan çekilir', async () => {
    getAllProducts.mockResolvedValue({ products: [LENTIL] });
    const exec = buildToolExecutor(1, 1, { diet: 'vegan' });

    await exec('search_products', { query: 'x', limit: 10 });

    expect(getAllProducts).toHaveBeenCalledWith(expect.objectContaining({ limit: 30 }));
  });
});
