export type Appointment = {
    id: number;
    clientId: number;
    appointmentDate: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
};
export type CreateAppointmentInput = {
    clientId: number;
    appointmentDate: string;
    title?: string;
};
//# sourceMappingURL=Appointment.d.ts.map