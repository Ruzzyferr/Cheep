// Express Request tipini genişlet
declare namespace Express {
    export interface Request {
        user?: {
            id: number;
            email: string;
            name: string;
            created_at: Date;
            updated_at: Date;
        };
        country?: {
            id: number;
            code: string;
            currency: string;
        };
        /**
         * İstemcinin arayüz dili. `resolveRequestLang` doldurur ve her zaman
         * desteklenen bir dile çözülür. Ülkeden BAĞIMSIZ: Türkiye'de yaşayıp
         * uygulamayı İngilizce kullanan biri TR kataloğunu İngilizce kategori
         * adlarıyla görür.
         */
        lang?: 'tr' | 'en' | 'de' | 'pl' | 'sv' | 'hr' | 'hu' | 'ro';
    }
}

