import dotenv from 'dotenv';
dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET ortam değişkeni production için zorunludur (min 32 karakter)');
    }
}

export const config = {
    jwtSecret: jwtSecret || 'dev-only-not-for-production-32chars',
};