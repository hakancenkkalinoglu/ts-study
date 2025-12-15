import type { CreateUserInput } from '../models/User.js';
export declare const hashPassword: (password: string) => Promise<string>;
export declare const createUser: (user: CreateUserInput) => Promise<number | bigint>;
export declare const findUserByEmail: (email: string) => Promise<{} | undefined>;
export declare const findUserById: (id: string) => Promise<{} | undefined>;
export declare const deleteUserById: (id: string) => Promise<import("better-sqlite3").RunResult | "User not found">;
//# sourceMappingURL=userService.d.ts.map