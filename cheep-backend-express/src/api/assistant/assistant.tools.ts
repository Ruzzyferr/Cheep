import * as Lists from '../lists/lists.service.js';
import * as Products from '../products/products.service.js';
import { compareShoppingList } from '../../services/compare-engine.service.js';

// ============================================
// GEMINI FUNCTION DECLARATIONS
// ============================================

export const toolDeclarations: any[] = [
  {
    name: 'search_products',
    description: 'Katalogda ürün arar. Ürün adı, marka veya anahtar kelimeye göre arama yapar.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Arama terimi (ürün adı, marka, vb.)' },
        limit: { type: 'number', description: 'Döndürülecek maksimum ürün sayısı (varsayılan: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_user_lists',
    description: "Kullanıcının tüm alışveriş listelerini döndürür.",
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_list_items',
    description: 'Belirli bir listenin içindeki ürünleri ve detaylarını döndürür.',
    parameters: {
      type: 'object',
      properties: {
        listId: { type: 'number', description: 'Liste ID' },
      },
      required: ['listId'],
    },
  },
  {
    name: 'create_list',
    description: "Kullanıcı için yeni bir alışveriş listesi oluşturur.",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Liste adı' },
        budget: { type: 'number', description: 'Opsiyonel bütçe limiti (TL)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_items_to_list',
    description: 'Listeye bir veya birden fazla ürün ekler. Her ürün için katalogda arama yapılır.',
    parameters: {
      type: 'object',
      properties: {
        listId: { type: 'number', description: 'Ürün eklenecek liste ID' },
        items: {
          type: 'array',
          description: 'Eklenecek ürünler',
          items: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Ürün arama terimi' },
              quantity: { type: 'number', description: 'Miktar (varsayılan: 1)' },
              unit: { type: 'string', description: 'Birim (varsayılan: adet)' },
              brandIndependent: { type: 'boolean', description: 'Marka bağımsız mı? (muadil ürün kabulü)' },
            },
            required: ['query'],
          },
        },
      },
      required: ['listId', 'items'],
    },
  },
  {
    name: 'remove_list_item',
    description: 'Listeden belirli bir ürünü çıkarır.',
    parameters: {
      type: 'object',
      properties: {
        listId: { type: 'number', description: 'Liste ID' },
        itemId: { type: 'number', description: 'Kaldırılacak liste öğesi ID' },
      },
      required: ['listId', 'itemId'],
    },
  },
  {
    name: 'get_product_prices',
    description: 'Belirli bir ürünün tüm marketlerdeki güncel fiyatlarını döndürür.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'number', description: 'Ürün ID' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'get_cheapest_route',
    description: 'Verilen alışveriş listesi için en ucuz alışveriş rotasını ve market kombinasyonlarını hesaplar.',
    parameters: {
      type: 'object',
      properties: {
        listId: { type: 'number', description: 'Liste ID' },
      },
      required: ['listId'],
    },
  },
];

// ============================================
// TOOL EXECUTOR (user-scoped)
// ============================================

/**
 * Builds a tool executor function scoped to a specific user.
 * Returns (name, args) => Promise<any>; never throws — errors are returned as { error }.
 *
 * Shape notes:
 * - getAllProducts returns { products: Product[], pagination: {...} } — we extract .products
 * - removeItemFromList signature: (listId, itemId, userId) — 3 args
 * - get_product_prices uses Products.getProductPrices (not store-prices service)
 */
export function buildToolExecutor(userId: number) {
  return async (name: string, args: any): Promise<any> => {
    try {
      switch (name) {
        case 'search_products': {
          // getAllProducts returns { products: [...], pagination: {...} }
          const result = await Products.getAllProducts({ search: args.query, limit: args.limit ?? 10 });
          return result.products ?? result;
        }

        case 'get_user_lists': {
          return await Lists.getUserLists(userId);
        }

        case 'get_list_items': {
          return await Lists.getListById(args.listId, userId);
        }

        case 'create_list': {
          return await Lists.createList(userId, { name: args.name, budget: args.budget });
        }

        case 'add_items_to_list': {
          const results: any[] = [];
          const items = (args.items ?? []).slice(0, 50);
          for (const item of items as any[]) {
            // getAllProducts returns { products: [...], pagination: {...} }
            const searchResult = await Products.getAllProducts({ search: item.query, limit: 1 });
            const products: any[] = searchResult.products ?? (searchResult as any);
            if (!products || products.length === 0) {
              results.push({ query: item.query, matched: false });
              continue;
            }
            const prod = products[0];
            const added = await Lists.addItemToList(args.listId, userId, {
              product_id: prod.id,
              quantity: item.quantity ?? 1,
              unit: item.unit ?? 'adet',
              brand_independent: item.brandIndependent ?? false,
            });
            results.push({ query: item.query, matched: true, product: prod.name, itemId: (added as any).id });
          }
          return { added: results };
        }

        case 'remove_list_item': {
          // Real signature: removeItemFromList(listId, itemId, userId)
          return await Lists.removeItemFromList(args.listId, args.itemId, userId);
        }

        case 'get_product_prices': {
          // getProductPrices is on products.service, returns store_prices array
          return await Products.getProductPrices(args.productId);
        }

        case 'get_cheapest_route': {
          return await compareShoppingList(args.listId, userId, {});
        }

        default:
          return { error: `Bilinmeyen araç: ${name}` };
      }
    } catch (e: any) {
      return { error: e?.message ?? 'Araç çalıştırılamadı' };
    }
  };
}
