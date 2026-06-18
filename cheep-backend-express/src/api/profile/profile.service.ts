import { prisma } from '../../utils/prisma.client.js';

export interface ProfileInput {
    household_size?: string;
    diet?: string;
    avoid?: string[];
    allergies?: string[];
    weekly_budget?: number;
    onboarding_done?: boolean;
}

export const getProfile = async (userId: number) => {
    return prisma.userProfile.findUnique({ where: { user_id: userId } });
};

export const upsertProfile = async (userId: number, data: ProfileInput) => {
    return prisma.userProfile.upsert({
        where: { user_id: userId },
        create: { user_id: userId, ...data },
        update: { ...data },
    });
};
