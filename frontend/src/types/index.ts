export type Client = {
  id: number;
  email: string;
  name: string | null;
  birthDate: string | null;
  agreedFee: number | null;
  phone?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientInput = {
  email: string;
  name?: string;
  birthDate?: string;
  agreedFee?: number;
  password?: string;
  phone?: string;
  emergencyName?: string;
  emergencyPhone?: string;
};

export type AppointmentStatus = 'scheduled' | 'attended' | 'no_show' | 'cancelled';

export const APPOINTMENT_STATUSES: { value: AppointmentStatus; label: string }[] = [
  { value: 'scheduled', label: 'Planlandı' },
  { value: 'attended', label: 'Geldi' },
  { value: 'no_show', label: 'Gelmedi' },
  { value: 'cancelled', label: 'İptal' },
];

export const appointmentStatus = (value?: string | null): AppointmentStatus => {
  if (value === 'attended' || value === 'no_show' || value === 'cancelled') {
    return value;
  }
  return 'scheduled';
};

export const appointmentStatusLabel = (value?: string | null): string => {
  const status = appointmentStatus(value);
  return APPOINTMENT_STATUSES.find((item) => item.value === status)?.label ?? 'Planlandı';
};

export type Appointment = {
  id: number;
  clientId: number;
  appointmentDate: string;
  appointmentTime: string | null;
  title: string | null;
  isPaid: number;
  status?: string | null;
  googleEventId?: string | null;
  googleMeetLink?: string | null;
  googleHtmlLink?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentWithClient = Appointment & {
  clientName: string | null;
  agreedFee: number | null;
  clientEmail?: string | null;
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
  status?: AppointmentStatus;
};

export type Note = {
  id: number;
  clientId: number;
  appointmentId: number | null;
  title: string | null;
  content: string;
  noteDate: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteInput = {
  clientId: number;
  appointmentId?: number | null;
  title?: string;
  content: string;
  noteDate: string;
};
