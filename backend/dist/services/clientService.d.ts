import type { CreateClientInput, UpdateClientInput } from '../models/Client.js';
import type { CreateNoteInput, Note } from '../models/Note.js';
import type { Appointment, CreateAppointmentInput } from '../models/Appointment.js';
export declare const hashPassword: (password: string) => Promise<string>;
export declare const findClientByEmail: (email: string) => Promise<{} | undefined>;
export declare const findClientById: (id: string) => Promise<{} | undefined>;
export declare const createClient: (client: CreateClientInput) => Promise<number | bigint>;
export declare const updateClient: (id: string, data: UpdateClientInput) => Promise<number>;
export declare const deleteClientById: (id: string) => Promise<number>;
export declare const getAllClients: (search?: string) => unknown[];
export declare const createAppointment: (input: CreateAppointmentInput) => number;
export declare const getAppointmentsByClientId: (clientId: number) => Appointment[];
export type AppointmentWithClient = Appointment & {
    clientName: string | null;
};
export declare const getAllAppointments: () => AppointmentWithClient[];
export declare const createNote: (note: CreateNoteInput) => number | bigint;
export declare const getNotesByClientId: (clientId: number) => Note[];
export declare const getNotesByAppointmentId: (appointmentId: number) => Note[];
//# sourceMappingURL=clientService.d.ts.map