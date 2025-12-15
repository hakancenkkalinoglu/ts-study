import type { CreateClientInput } from '../models/Client.js';
import type { CreateNoteInput, Note } from '../models/Note.js';
export declare const hashPassword: (password: string) => Promise<string>;
export declare const findClientByEmail: (email: string) => Promise<{} | undefined>;
export declare const findClientById: (id: string) => Promise<{} | undefined>;
export declare const createClient: (client: CreateClientInput) => Promise<number | bigint>;
export declare const deleteClientById: (id: string) => Promise<number>;
export declare const getAllClients: () => unknown[];
export declare const createNote: (note: CreateNoteInput) => number | bigint;
export declare const getNotesByClientId: (clientId: number) => Note[];
//# sourceMappingURL=clientService.d.ts.map