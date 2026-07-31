import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import apiRouter from './api/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import morgan from "morgan";
import logger from "./utils/logger.js";
import { config } from './config/index.js';
import { prisma } from './utils/prisma.client.js';
import { applyTrustProxy } from './config/trust-proxy.js';
import { jsonBodyParser } from './middleware/body-parser.middleware.js';

// dotenv config'i './config' içinde bir kez yapılır; burada tekrar etmeye gerek yok.

const app: Application = express();
const PORT = config.port;

// Caddy'nin arkasındayız. Bu ayar olmadan req.ip herkes için Caddy'nin Docker
// IP'si olur ve tüm rate limit'ler kullanıcı başına değil GLOBAL çalışır.
// Ayrıntı: src/config/trust-proxy.ts
applyTrustProxy(app);

const stream: morgan.StreamOptions = {
    write: (message) => logger.http(message.trim()),
};
app.use(morgan('dev', { stream }));

// Güvenlik header'ları (HSTS, X-Frame-Options, X-Content-Type-Options, vb.)
// Swagger UI'ın çalışabilmesi için CSP'yi yalnızca production'da uygula.
app.use(
    helmet({
        contentSecurityPolicy: config.isProduction ? undefined : false,
        crossOriginEmbedderPolicy: false,
    })
);

// Middleware
// CORS: ALLOWED_ORIGINS tanımlıysa allowlist uygula, değilse (dev) origin'i yansıt.
app.use(cors({
    origin: config.allowedOrigins.length ? config.allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
// Gövde boyutu: varsayılan dar, yalnızca toplu ingest uçları geniş.
// Ayrıntı ve gerekçe: src/middleware/body-parser.middleware.ts
app.use(jsonBodyParser());
app.use(express.urlencoded({ limit: '100kb', extended: true }));

// Input sanitization (tüm route'lar için)
import { sanitizeInput } from './middleware/sanitize.middleware.js';
app.use(sanitizeInput);

// Rate limiting (tüm ortamlarda aktif; dev için limit yüksek tutulur)
import { generalLimiter } from './middleware/rate-limit.middleware.js';
app.use('/api/', generalLimiter);
logger.info('✅ Rate limiting enabled');

// Swagger Yapılandırması
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Cheep API',
            version: '1.0.0',
            description: `
# Cheep - Akıllı Alışveriş Asistanı API

Market fiyatlarını karşılaştırma ve akıllı alışveriş listesi oluşturma platformu.

## Özellikler
- 🏪 Market ve ürün yönetimi
- 💰 Fiyat karşılaştırma
- 📋 Alışveriş listesi oluşturma
- 👤 Kullanıcı yönetimi
- 🔍 Ürün arama ve filtreleme

## Authentication
Bazı endpoint'ler JWT token gerektirir. Token'ı \`Authorization: Bearer <token>\` header'ında gönderin.
            `.trim(),
            contact: {
                name: 'Cheep Team',
                email: 'support@cheep.com',
            },
            license: {
                name: 'MIT',
            },
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Development server',
            },
        ],
        // ++ YENİ EKLENEN BÖLÜM BAŞLANGICI ++
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter JWT token',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
        // ++ YENİ EKLENEN BÖLÜM SONU ++
        tags: [
            {
                name: 'Auth',
                description: 'Kullanıcı kimlik doğrulama işlemleri',
            },
            {
                name: 'Users',
                description: 'Kullanıcı profil yönetimi',
            },
            {
                name: 'Lists',
                description: 'Alışveriş listesi yönetimi',
            },
            {
                name: 'Products',
                description: 'Ürün yönetimi ve fiyat karşılaştırma',
            },
            {
                name: 'Stores',
                description: 'Market yönetimi',
            },
            {
                name: 'StorePrices',
                description: 'Market fiyat yönetimi',
            },
            {
                name: 'Categories',
                description: 'Kategori yönetimi',
            },
            {
                name: 'Feedback',
                description: 'Fiyat geri bildirimi ve doğruluk istatistikleri',
            },
        ],
    },
    apis: ['./src/api/**/*.routes.ts', './dist/api/**/*.routes.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI Options
const swaggerUiOptions = {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Cheep API Docs',
};

// Swagger YALNIZCA production dışında. Canlıda açık bırakmak tüm API yüzeyini
// (uçlar, parametreler, şemalar) herkese haritalıyordu — saldırgana hazır bir
// keşif aracı. Dokümana ihtiyaç olursa `npm run dev` ile yerelde açılır.
if (!config.isProduction) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    logger.info('📚 Swagger /api-docs açık (production dışı)');
}

// Ana Rotalar — her API isteğinde ülke çözümlenir (x-country header veya default)
import { resolveCountry } from './middleware/country.middleware.js';
app.use('/api/v1', resolveCountry, apiRouter);

// Ana sayfa
app.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'Cheep API is running! 🚀',
        version: '1.0.0',
        documentation: `http://localhost:${PORT}/api-docs`,
        endpoints: {
            auth: '/api/v1/auth',
            users: '/api/v1/users',
            lists: '/api/v1/lists',
            products: '/api/v1/products',
            stores: '/api/v1/stores',
            storePrices: '/api/v1/store-prices',
            categories: '/api/v1/categories',
            feedback: '/api/v1/feedback',
        },
    });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

// 404 Handler
app.use(notFoundHandler);

// Error Handler (en sonda olmalı)
app.use(errorHandler);

const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║           🛒 CHEEP API SERVER 🛒             ║
║                                               ║
║   Server running on port ${PORT}                ║
║                                               ║
║   📚 API Docs: http://localhost:${PORT}/api-docs   ║
║   🏥 Health:   http://localhost:${PORT}/health     ║
║                                               ║
╚═══════════════════════════════════════════════╝
    `);
});

// --- Graceful shutdown ---
const shutdown = (signal: string) => {
    logger.info(`${signal} alındı. Sunucu kapatılıyor...`);
    server.close(async () => {
        try {
            await prisma.$disconnect();
            logger.info('Prisma bağlantısı kapatıldı. Çıkılıyor.');
            process.exit(0);
        } catch (err) {
            logger.error('Kapatma sırasında hata:', err);
            process.exit(1);
        }
    });
    // Zorla kapanma güvenliği (10s)
    setTimeout(() => {
        logger.error('Zamanında kapatılamadı, zorla çıkılıyor.');
        process.exit(1);
    }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    // Yakalanmamış istisnada process tutarsız durumda olabilir → logla ve çık.
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});