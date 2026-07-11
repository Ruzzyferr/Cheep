export interface ChainAlias { store_id: number; chain: string; aliases: string[]; }

export const BRAND_ALIASES: Record<string, ChainAlias[]> = {
  TR: [
    { store_id: 1, chain: 'Migros', aliases: ['migros', 'migros jet', 'migros m', 'mmm migros'] },
    { store_id: 2, chain: 'CarrefourSA', aliases: ['carrefour', 'carrefoursa', 'carrefour sa', 'carrefour express'] },
    { store_id: 3, chain: 'A101', aliases: ['a101', 'a 101'] },
    { store_id: 4, chain: 'ŞOK', aliases: ['sok', 'sok market', 'şok', 'şok market'] },
  ],
  CH: [
    { store_id: 10, chain: 'Migros', aliases: ['migros'] },
    { store_id: 11, chain: 'Coop', aliases: ['coop', 'coop pronto'] },
  ],
  SE: [
    { store_id: 20, chain: 'ICA', aliases: ['ica', 'ica maxi', 'ica kvantum', 'ica nara', 'ica supermarket'] },
    { store_id: 21, chain: 'Willys', aliases: ['willys'] },
  ],
  DE: [
    { store_id: 30, chain: 'REWE', aliases: ['rewe', 'rewe city', 'rewe center'] },
    { store_id: 31, chain: 'Kaufland', aliases: ['kaufland'] },
  ],
  PL: [
    { store_id: 40, chain: 'Carrefour', aliases: ['carrefour', 'carrefour express', 'carrefour market'] },
    { store_id: 41, chain: 'Auchan', aliases: ['auchan', 'auchan supermarket', 'auchan hipermarket'] },
    { store_id: 44, chain: 'Biedronka', aliases: ['biedronka'] },
    { store_id: 45, chain: 'Lidl', aliases: ['lidl'] },
    { store_id: 47, chain: 'Żabka', aliases: ['zabka', 'żabka', 'zabka nano', 'żabka nano'] },
  ],
};
