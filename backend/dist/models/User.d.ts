export type User = {
    id: number;
    email: string;
    name: string | null;
    password: string;
    createdAt: string;
    updatedAt: string;
};
export type CreateUserInput = {
    email: string;
    name?: string;
    password: string;
};
export type UpdateUserInput = {
    email?: string;
    name?: string;
    password?: string;
};
export type UserResponse = Omit<User, 'password'>;
//# sourceMappingURL=User.d.ts.map