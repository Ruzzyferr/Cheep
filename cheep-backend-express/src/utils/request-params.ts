/**
 * Rota parametresini string'e daraltır.
 *
 * Express 5.2 ile `req.params` değerlerinin tipi `string | string[]` oldu:
 * wildcard ve tekrarlı segmentler (`/a/*splat`) dizi döndürebiliyor. Bu API'de
 * öyle bir rota yok — tüm parametreler tekil — ama tip artık bunu garanti
 * etmiyor, dolayısıyla `parseInt(req.params.id)` derlenmiyor.
 *
 * Diziyi sessizce yutmak yerine ilk öğeyi alıyoruz: davranış tekil parametrede
 * bugünküyle birebir aynı, beklenmedik bir dizi gelirse de çökmüyor.
 */
export function param(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
}

/** `param()` + tamsayıya çevirme. Geçersizse NaN döner (çağıran doğrular). */
export function intParam(value: string | string[] | undefined): number {
    return parseInt(param(value), 10);
}
