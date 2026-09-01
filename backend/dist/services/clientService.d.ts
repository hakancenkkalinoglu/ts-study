import type { CreateClientInput, UpdateClientInput } from '../models/Client.js';
import type { CreateNoteInput, Note } from '../models/Note.js';
import type { Appointment, CreateAppointmentInput, UpdateAppointmentInput } from '../models/Appointment.js';
export declare const hashPassword: (password: string) => Promise<any>;
export declare const findClientByEmail: (email: string) => Promise<any>;
export declare const findClientById: (id: string) => Promise<any>;
export declare const createClient: (client: CreateClientInput) => Promise<any>;
export declare const updateClient: (id: string, data: UpdateClientInput) => Promise<any>;
export declare const deleteClientById: (id: string) => Promise<any>;
export declare const getAllClients: (search?: string) => any;
export declare const hasAppointmentAtDateTime: (appointmentDate: string, appointmentTime: string, excludeId?: number) => boolean;
export declare const createAppointment: (input: CreateAppointmentInput) => number;
export declare const getAppointmentsByClientId: (clientId: number) => Appointment[];
export declare const updateAppointment: (appointmentId: number, clientId: number, data: UpdateAppointmentInput) => any;
export declare const deleteAppointmentById: (appointmentId: number, clientId: number) => any;
export declare const updateAppointmentGoogleFields: (appointmentId: number, data: {
    googleEventId: string;
    googleMeetLink: string;
    googleHtmlLink: string;
}) => any;
export type AppointmentWithClient = Appointment & {
    clientName: string | null;
    agreedFee: number | null;
};
export declare const getAllAppointments: () => AppointmentWithClient[];
export declare const getAppointmentByIdWithClient: (appointmentId: number) => AppointmentWithClient | null;
export declare const createNote: (note: CreateNoteInput) => any;
export declare const getNotesByClientId: (clientId: number) => Note[];
export declare const getNotesByAppointmentId: (appointmentId: number) => Note[];
//# sourceMappingURL=clientService.d.ts.map