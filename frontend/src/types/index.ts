export type Client = {
  id: number;
  email: string | null;
  name: string | null;
  birthDate: string | null;
  agreedFee: number | null;
  phone?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName?: string | null;
  updatedByName?: string | null;
};

export type CreateClientInput = {
  name: string;
  email?: string;
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

export const appointmentPaid = (value?: number | boolean | null) => value === true || value === 1;

export const appointmentStatusLabel = (value?: string | null): string => {
  const status = appointmentStatus(value);
  return APPOINTMENT_STATUSES.find((item) => item.value === status)?.label ?? 'Planlandı';
};

export const SESSION_DURATIONS: { value: number; label: string }[] = [
  { value: 45, label: '45 dk' },
  { value: 50, label: '50 dk' },
  { value: 60, label: '60 dk' },
  { value: 90, label: '90 dk' },
];

export const sessionDuration = (value?: number | null): number => {
  if (value == null) {
    return 50;
  }
  if (value < 15 || value > 240 || value % 5 !== 0) {
    return 50;
  }
  return value;
};

export const sessionDurationOptions = (current?: number | null): { value: number; label: string }[] => {
  const value = sessionDuration(current);
  if (SESSION_DURATIONS.some((item) => item.value === value)) {
    return SESSION_DURATIONS;
  }
  return [...SESSION_DURATIONS, { value, label: `${value} dk` }].sort((a, b) => a.value - b.value);
};

export const sessionDurationLabel = (value?: number | null): string => `${sessionDuration(value)} dk`;

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
  clinicId?: number | null;
  roomId?: number | null;
  roomName?: string | null;
  roomColor?: string | null;
  therapistUserId?: number | null;
  therapistName?: string | null;
  mine?: boolean;
  durationMinutes?: number | null;
  seriesId?: string | null;
  sessionFee?: number | null;
  createdByName?: string | null;
  updatedByName?: string | null;
};

export type AppointmentWithClient = Appointment & {
  clientName: string | null;
  agreedFee: number | null;
  clientEmail?: string | null;
};

export type BlockedSlot = {
  id: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  title: string | null;
};

export type CreateAppointmentInput = {
  clientId: number;
  appointmentDate: string;
  appointmentTime?: string;
  title?: string;
  isPaid?: boolean;
  roomId?: number;
  durationMinutes?: number;
  sessionFee?: number;
};

export type UpdateAppointmentInput = {
  appointmentDate?: string;
  appointmentTime?: string;
  title?: string;
  isPaid?: boolean;
  status?: AppointmentStatus;
  roomId?: number;
  durationMinutes?: number;
  sessionFee?: number;
  clearSessionFee?: boolean;
};

export type ClinicMember = {
  userId: number;
  name: string;
  role: string;
};

export type ClinicRoom = {
  id: number;
  name: string;
  color: string | null;
};

export type Clinic = {
  id: number;
  name: string;
  inviteCode: string;
  ownerUserId: number;
  role: string;
  members: ClinicMember[];
  rooms: ClinicRoom[];
  permissions: ClinicPermission[];
};

export type ClinicPermission =
  | 'MANAGE_CLINIC'
  | 'MANAGE_ROOMS'
  | 'INVITE_MEMBERS'
  | 'MANAGE_MEMBERS'
  | 'SET_COMMISSION'
  | 'MANAGE_PAYMENTS'
  | 'VIEW_CLINIC_SCHEDULE'
  | 'VIEW_CLINIC_REPORTS';

export const clinicCan = (clinic: Clinic | null | undefined, permission: ClinicPermission): boolean =>
  Boolean(clinic?.permissions?.includes(permission));

export type Invitation = {
  id: number;
  email: string;
  expiresAt: number;
  inviteUrl: string | null;
};

export type InvitationPreview = {
  clinicName: string;
  email: string;
  accountExists: boolean;
};

export type CommissionMember = {
  userId: number;
  name: string;
  percent: number;
  custom: boolean;
};

export type CommissionOverview = {
  defaultPercent: number;
  members: CommissionMember[];
};

export type TherapistReport = {
  userId: number;
  name: string;
  sessions: number;
  paidAmount: number;
  pendingAmount: number;
  clinicShare: number;
  sharePaid: number;
  shareRemaining: number;
  netAmount: number;
  currentPercent: number;
};

export type SharePayment = {
  id: number;
  amount: number;
  paidOn: string;
  note: string | null;
};

export type FeeStatus = 'none' | 'paid' | 'partial' | 'unpaid';

export type TherapistFee = {
  userId: number;
  name: string;
  sessions: number;
  percent: number;
  owed: number;
  paid: number;
  remaining: number;
  cumulativeRemaining: number;
  status: FeeStatus;
  payments: SharePayment[];
};

export type ClinicFeeReport = {
  month: string;
  totalOwed: number;
  totalPaid: number;
  totalRemaining: number;
  totalCumulativeRemaining: number;
  therapists: TherapistFee[];
};

export type ClinicOverview = {
  from: string;
  to: string;
  sessions: number;
  cancelled: number;
  noShow: number;
  therapists: {
    userId: number;
    name: string;
    role: string;
    sessions: number;
    cancelled: number;
    noShow: number;
    rooms: string[];
    /** 1 = Pazartesi ... 7 = Pazar */
    weekdays: number[];
  }[];
  rooms: { roomId: number; name: string; color: string | null; sessions: number; minutes: number }[];
};

export type ClinicReport = {
  from: string;
  to: string;
  sessions: number;
  paidAmount: number;
  pendingAmount: number;
  clinicShare: number;
  sharePaid: number;
  shareRemaining: number;
  therapists: TherapistReport[];
};

export const THERAPIST_COLORS = ['#7a4a2b', '#3f7f6e', '#a86a2f', '#6d5a8c', '#4f6f8f', '#9a4f4f'];

export const therapistColor = (userId?: number | null): string | undefined => {
  if (userId == null) return undefined;
  return THERAPIST_COLORS[Math.abs(userId) % THERAPIST_COLORS.length];
};

export const appointmentAmount = (apt: {
  sessionFee?: number | null;
  agreedFee?: number | null;
}): number => apt.sessionFee ?? apt.agreedFee ?? 0;

export type Note = {
  id: number;
  clientId: number;
  appointmentId: number | null;
  title: string | null;
  content: string;
  fileName?: string | null;
  noteDate: string;
  createdAt: string;
  updatedAt: string;
  createdByName?: string | null;
  updatedByName?: string | null;
};

export type Profile = {
  id: number;
  email: string | null;
  username: string;
  displayName: string;
  googleConnected: boolean;
  reminderHours: number;
};

export type SessionPackage = {
  id: number;
  clientId: number;
  title: string;
  totalSessions: number;
  remainingSessions: number;
  prepaidAmount: number;
  createdAt: string;
};

export type InventorySummary = {
  id: number;
  code: string;
  name: string;
  description: string;
  maxScore: number;
  itemCount: number;
};

export type InventoryItem = {
  id: number;
  sortOrder: number;
  prompt: string;
};

export type InventoryDetail = {
  id: number;
  code: string;
  name: string;
  description: string;
  maxScore: number;
  items: InventoryItem[];
};

export type InventoryResult = {
  id: number;
  inventoryId: number;
  inventoryName: string;
  score: number;
  maxScore: number;
  interpretation: string;
  createdAt: string;
};

export type CreateNoteInput = {
  clientId: number;
  appointmentId?: number | null;
  title?: string;
  content: string;
  noteDate: string;
};

export type UpdateNoteInput = {
  title?: string;
  content?: string;
  noteDate?: string;
};
