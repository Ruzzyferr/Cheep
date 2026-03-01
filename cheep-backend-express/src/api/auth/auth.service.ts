import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma.client.js';
import { config } from '../../config/index.js';

// Kullanıcı kayıt servisi
export const registerUser = async (email: string, pass: string, name: string) => {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('Bu email adresi zaten kullanılıyor.');
    }

    const password_hash = await bcrypt.hash(pass, 10);

    const user = await prisma.user.create({
        data: {
            email,
            password_hash,
            name,
        },
    });

    const { password_hash: _, ...userWithoutPassword } = user;
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });

    return { user: userWithoutPassword, token };
};

// Kullanıcı giriş servisi
export const loginUser = async (email: string, pass: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new Error('Geçersiz email veya şifre.');
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password_hash);
    if (!isPasswordValid) {
        throw new Error('Geçersiz email veya şifre.');
    }

    const { password_hash: _, ...userWithoutPassword } = user;
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });

    return { user: userWithoutPassword, token };
};