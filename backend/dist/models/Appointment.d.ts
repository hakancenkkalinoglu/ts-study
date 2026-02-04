export type Appointment = {
    id: number;
    clientId: number;
    appointmentDate: string;
    appointmentTime: string | null;
    title: string | null;
    isPaid: number;
    createdAt: string;
    updatedAt: string;
};
export type CreateAppointmentInput = {
    clientId: number;
    appointmentDate: string;
    appointmentTime?: string;
    title?: string;
    isPaid?: boolean;
};
export type UpdateAppointmentInput = {
    appointmentDate?: string;
    appointmentTime?: string;
    title?: string;
    isPaid?: boolean;
};
//# sourceMappingURL=Appointment.d.ts.map