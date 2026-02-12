import type { Request, Response, NextFunction } from 'express';
export type JwtPayload = {
    username: string;
};
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=authMiddleware.d.ts.map