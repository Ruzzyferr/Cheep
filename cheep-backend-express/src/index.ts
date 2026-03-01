import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import apiRouter from './api/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import morgan from "morgan";
import logger from "./utils/logger.js";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

const stream: morgan.StreamOptions = {
    write: (message) => logger.http(message.trim()),
};
app.use(morgan('dev', { stream }));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Input sanitization (tüm route'lar için)
import { sanitizeInput } from './middleware/sanitize.middleware.js';
app.use(sanitizeInput);

// Rate limiting (sadece production'da)
import { generalLimiter } from './middleware/rate-limit.middleware.js';
if (process.env.NODE_ENV === 'production') {
    app.use('/api/', generalLimiter);
    console.log('✅ Rate limiting enabled (Production mode)');
} else {
    console.log('⚠️  Rate limiting disabled (Development mode)');
}

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

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Ana Rotalar
app.use('/api/v1', apiRouter);

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

app.listen(PORT, () => {
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