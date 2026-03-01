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
    }
}

