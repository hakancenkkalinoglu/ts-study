export type Client = {
    id: number;
    email: string;
    name: string | null;
    birthDate: string | null;
    agreedFee: number | null;
    password?: string;
    createdAt: string;
    updatedAt: string;
};
export type CreateClientInput = {
    email: string;
    name?: string;
    birthDate?: string;
    agreedFee?: number;
    password?: string;
};
export type UpdateClientInput = {
    email?: string;
    name?: string;
    birthDate?: string;
    agreedFee?: number;
    password?: string;
};
export type ClientResponse = Omit<Client, 'password'>;
//# sourceMappingURL=Client.d.ts.map