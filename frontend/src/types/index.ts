export type Client = {
  id: number;
  email: string;
  name: string | null;
  birthDate: string | null;
  agreedFee: number | null;
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

export type Appointment = {
  id: number;
  clientId: number;
  appointmentDate: string;
  appointmentTime: string | null;
  title: string | null;
  isPaid: number;
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
