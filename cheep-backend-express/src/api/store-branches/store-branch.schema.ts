import Joi from "joi";

// Tek şube (scraper'ın devlet depo verisinden çıkardığı). external_ref benzersiz
// anahtardır (ör. 'mf:bim-Q061'); upsert bununla yapılır. lat/lon zorunlu — konumsuz
// şube mesafe için işe yaramaz.
export const upsertStoreBranchSchema = Joi.object({
    store_id: Joi.number().integer().required(),
    external_ref: Joi.string().max(200).required(),
    name: Joi.string().min(1).max(300).required(),
    lat: Joi.number().min(-90).max(90).required(),
    lon: Joi.number().min(-180).max(180).required(),
    city: Joi.string().max(120).optional().allow(null, '').empty(''),
    // Varsayilan 'marketfiyati' IDI: kaynak belirtmeyen her sube, verisi oradan
    // gelmese bile Market Fiyati'ndan gelmis gibi etiketleniyordu — artik o
    // kaynakla baglantimiz yok (bkz. docs/VERI-IZINLERI.md), yani bu YANLIS bir
    // kayitti. Tek canli ice aktarici (osm_branches.py) zaten 'osm' gonderiyor.
    source: Joi.string().max(40).default('unknown'),
});

export const bulkUpsertStoreBranchesSchema = Joi.object({
    branches: Joi.array()
        .items(upsertStoreBranchSchema)
        .min(1)
        .max(2000)
        .required(),
});
