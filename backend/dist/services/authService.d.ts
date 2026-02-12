export type AppUser = {
    id: number;
    username: string;
    passwordHash: string;
    createdAt: string;
};
export declare function findUserByUsername(username: string): AppUser | null;
export declare function verifyPassword(plain: string, hash: string): Promise<boolean>;
/** İlk kurulumda varsayılan kullanıcıyı oluşturur (yoksa). */
export declare function seedDefaultUser(): Promise<void>;
//# sourceMappingURL=authService.d.ts.map