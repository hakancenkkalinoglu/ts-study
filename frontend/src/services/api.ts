import axios from 'axios';
import type {
  Client,
  CreateClientInput,
  Note,
  CreateNoteInput,
  Appointment,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AppointmentWithClient,
  BlockedSlot,
  Clinic,
  ClinicRoom,
  UpdateNoteInput,
  Profile,
  SessionPackage,
  InventorySummary,
  InventoryDetail,
  InventoryResult,
} from '../types';

// Relative URL: Vite proxy forwards /api to backend (localhost:3000)
const API_BASE_URL = '/api';
const TOKEN_KEY = 'testpsikolog_token';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isPublicAuthUrl = (url?: string) => {
  const path = String(url || '');
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/register') ||
    path.includes('/auth/forgot-password') ||
    path.includes('/auth/reset-password') ||
    path.includes('/auth/google/login') ||
    path.includes('/auth/google/exchange')
  );
};

api.interceptors.request.use((config) => {
  if (isPublicAuthUrl(config.url)) {
    delete config.headers.Authorization;
    return config;
  }
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = String(err.config?.url || '');
      if (!isPublicAuthUrl(url)) {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.setItem('session_expired', '1');
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setStoredToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearStoredToken = (): void => localStorage.removeItem(TOKEN_KEY);

export const login = async (
  email: string,
  password: string
): Promise<{ token: string; username: string; email?: string }> => {
  const response = await api.post<{ token: string; username: string; email?: string }>('/auth/login', {
    email,
    password,
  });
  return response.data;
};

export const register = async (
  email: string,
  password: string,
  displayName?: string
): Promise<{ token: string; username: string; email?: string }> => {
  const response = await api.post<{ token: string; username: string; email?: string }>('/auth/register', {
    email,
    password,
    displayName,
  });
  return response.data;
};

export const getProfile = async (): Promise<Profile> => {
  const response = await api.get<Profile>('/auth/me');
  return response.data;
};

export const updateProfile = async (data: {
  displayName?: string;
  email?: string;
  reminderHours?: number;
}): Promise<Profile> => {
  const response = await api.put<Profile>('/auth/me', data);
  return response.data;
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const response = await api.put<{ token: string }>('/auth/password', { currentPassword, newPassword });
  setStoredToken(response.data.token);
};

export const forgotPassword = async (email: string): Promise<string> => {
  const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
  return response.data.message;
};

export const resetPassword = async (email: string, code: string, newPassword: string): Promise<string> => {
  const response = await api.post<{ message: string }>('/auth/reset-password', { email, code, newPassword });
  return response.data.message;
};

export const disconnectGoogle = async (): Promise<void> => {
  await api.delete('/auth/google');
};

export const exportAccount = async (): Promise<Record<string, unknown>> => {
  const response = await api.get<Record<string, unknown>>('/auth/export');
  return response.data;
};

export const deleteAccount = async (): Promise<void> => {
  await api.delete('/auth/me');
};

export const getUpcomingAppointments = async (hours?: number): Promise<AppointmentWithClient[]> => {
  const params = hours ? { hours } : {};
  const response = await api.get<AppointmentWithClient[]>('/appointments/upcoming', { params });
  return response.data;
};

let googleExchangeInFlight: {
  code: string;
  promise: Promise<{ token: string; username: string; email?: string }>;
} | null = null;

export const exchangeGoogleAuth = async (
  code: string
): Promise<{ token: string; username: string; email?: string }> => {
  if (googleExchangeInFlight && googleExchangeInFlight.code === code) {
    return googleExchangeInFlight.promise;
  }
  const promise = api
    .post<{ token: string; username: string; email?: string }>('/auth/google/exchange', { code })
    .then((response) => response.data);
  googleExchangeInFlight = { code, promise };
  try {
    return await promise;
  } catch (error) {
    googleExchangeInFlight = null;
    throw error;
  }
};

// Client endpoints
export const getClients = async (search?: string): Promise<Client[]> => {
  const params = search?.trim() ? { search: search.trim() } : {};
  const response = await api.get<Client[]>('/clients', { params });
  return response.data;
};

export const getClient = async (id: number): Promise<Client> => {
  const response = await api.get<Client>(`/clients/${id}`);
  return response.data;
};

export const createClient = async (data: CreateClientInput): Promise<{ id: number }> => {
  const response = await api.post<{ id: number }>('/clients', data);
  return response.data;
};

export const updateClient = async (id: number, data: Partial<CreateClientInput>): Promise<{ updated: number }> => {
  const response = await api.put<{ updated: number }>(`/clients/${id}`, data);
  return response.data;
};

export const deleteClient = async (id: number): Promise<{ deleted: number }> => {
  const response = await api.delete<{ deleted: number }>(`/clients/${id}`);
  return response.data;
};

// Note endpoints
export const getClientNotes = async (clientId: number): Promise<Note[]> => {
  const response = await api.get<Note[]>(`/clients/${clientId}/notes`);
  return response.data;
};

export const createNote = async (data: CreateNoteInput): Promise<{ id: number }> => {
  const response = await api.post<{ id: number }>(`/clients/${data.clientId}/notes`, data);
  return response.data;
};

export const createAppointmentNote = async (
  clientId: number,
  appointmentId: number,
  data: Omit<CreateNoteInput, 'clientId' | 'appointmentId'>
): Promise<{ id: number }> => {
  const response = await api.post<{ id: number }>(
    `/clients/${clientId}/appointments/${appointmentId}/notes`,
    data
  );
  return response.data;
};

export const updateNote = async (
  clientId: number,
  noteId: number,
  data: UpdateNoteInput
): Promise<{ updated: number }> => {
  const response = await api.put<{ updated: number }>(`/clients/${clientId}/notes/${noteId}`, data);
  return response.data;
};

export const deleteNote = async (clientId: number, noteId: number): Promise<{ deleted: number }> => {
  const response = await api.delete<{ deleted: number }>(`/clients/${clientId}/notes/${noteId}`);
  return response.data;
};

// Appointment endpoints
export const getAppointments = async (clientId: number): Promise<Appointment[]> => {
  const response = await api.get<Appointment[]>(`/clients/${clientId}/appointments`);
  return response.data;
};

export const createAppointment = async (
  data: CreateAppointmentInput
): Promise<{
  id: number;
  createdCount?: number;
  googleMeetLink?: string | null;
  googleHtmlLink?: string | null;
}> => {
  const response = await api.post<{
    id: number;
    createdCount?: number;
    googleMeetLink?: string | null;
    googleHtmlLink?: string | null;
  }>(`/clients/${data.clientId}/appointments`, data);
  return response.data;
};

export const updateAppointment = async (
  clientId: number,
  appointmentId: number,
  data: UpdateAppointmentInput
): Promise<{ updated: number }> => {
  const response = await api.put<{ updated: number }>(
    `/clients/${clientId}/appointments/${appointmentId}`,
    data
  );
  return response.data;
};

export const deleteAppointment = async (
  clientId: number,
  appointmentId: number
): Promise<{ deleted: number }> => {
  const response = await api.delete<{ deleted: number }>(
    `/clients/${clientId}/appointments/${appointmentId}`
  );
  return response.data;
};

export const getAppointmentNotes = async (
  clientId: number,
  appointmentId: number
): Promise<Note[]> => {
  const response = await api.get<Note[]>(
    `/clients/${clientId}/appointments/${appointmentId}/notes`
  );
  return response.data;
};

export const getAllAppointments = async (scope?: 'mine' | 'clinic'): Promise<AppointmentWithClient[]> => {
  const params = scope ? { scope } : {};
  const response = await api.get<AppointmentWithClient[]>('/appointments', { params });
  return response.data;
};

export const getBlockedSlots = async (from: string, to: string): Promise<BlockedSlot[]> => {
  const response = await api.get<BlockedSlot[]>('/me/blocked-slots', { params: { from, to } });
  return response.data;
};

export const createBlockedSlot = async (data: {
  slotDate: string;
  startTime: string;
  endTime: string;
  title?: string;
}): Promise<BlockedSlot> => {
  const response = await api.post<BlockedSlot>('/me/blocked-slots', data);
  return response.data;
};

export const deleteBlockedSlot = async (id: number): Promise<void> => {
  await api.delete(`/me/blocked-slots/${id}`);
};

export const getMyClinic = async (): Promise<Clinic | null> => {
  const response = await api.get<{ clinic: Clinic | null }>('/clinic');
  return response.data.clinic;
};

export const createClinic = async (name: string): Promise<Clinic> => {
  const response = await api.post<Clinic>('/clinic', { name });
  return response.data;
};

export const joinClinic = async (inviteCode: string): Promise<Clinic> => {
  const response = await api.post<Clinic>('/clinic/join', { inviteCode });
  return response.data;
};

export const leaveClinic = async (): Promise<void> => {
  await api.post('/clinic/leave');
};

export const deleteClinic = async (): Promise<void> => {
  await api.delete('/clinic');
};

export const getClinicRooms = async (): Promise<ClinicRoom[]> => {
  const response = await api.get<ClinicRoom[]>('/clinic/rooms');
  return response.data;
};

export const createClinicRoom = async (name: string, color?: string): Promise<ClinicRoom> => {
  const response = await api.post<ClinicRoom>('/clinic/rooms', { name, color });
  return response.data;
};

export const updateClinicRoom = async (
  roomId: number,
  data: { name?: string; color?: string }
): Promise<ClinicRoom> => {
  const response = await api.put<ClinicRoom>(`/clinic/rooms/${roomId}`, data);
  return response.data;
};

export const deleteClinicRoom = async (roomId: number): Promise<void> => {
  await api.delete(`/clinic/rooms/${roomId}`);
};

export const renameClinic = async (name: string): Promise<Clinic> => {
  const response = await api.put<Clinic>('/clinic', { name });
  return response.data;
};

export const rotateClinicInvite = async (): Promise<Clinic> => {
  const response = await api.post<Clinic>('/clinic/invite/rotate');
  return response.data;
};

export const kickClinicMember = async (memberUserId: number): Promise<Clinic> => {
  const response = await api.delete<Clinic>(`/clinic/members/${memberUserId}`);
  return response.data;
};

export const transferClinicOwnership = async (userId: number): Promise<Clinic> => {
  const response = await api.post<Clinic>('/clinic/transfer', { userId });
  return response.data;
};

export const getClientPackages = async (clientId: number): Promise<SessionPackage[]> => {
  const response = await api.get<SessionPackage[]>(`/clients/${clientId}/packages`);
  return response.data;
};

export const createClientPackage = async (
  clientId: number,
  data: { title: string; totalSessions: number; prepaidAmount?: number }
): Promise<SessionPackage> => {
  const response = await api.post<SessionPackage>(`/clients/${clientId}/packages`, data);
  return response.data;
};

export const consumeClientPackage = async (clientId: number, packageId: number): Promise<SessionPackage> => {
  const response = await api.post<SessionPackage>(`/clients/${clientId}/packages/${packageId}/consume`);
  return response.data;
};

export const deleteClientPackage = async (clientId: number, packageId: number): Promise<void> => {
  await api.delete(`/clients/${clientId}/packages/${packageId}`);
};

export const listInventories = async (): Promise<InventorySummary[]> => {
  const response = await api.get<InventorySummary[]>('/inventories');
  return response.data;
};

export const getInventory = async (inventoryId: number): Promise<InventoryDetail> => {
  const response = await api.get<InventoryDetail>(`/inventories/${inventoryId}`);
  return response.data;
};

export const getClientInventoryResults = async (clientId: number): Promise<InventoryResult[]> => {
  const response = await api.get<InventoryResult[]>(`/clients/${clientId}/inventories`);
  return response.data;
};

export const submitClientInventory = async (
  clientId: number,
  inventoryId: number,
  answers: number[]
): Promise<InventoryResult> => {
  const response = await api.post<InventoryResult>(`/clients/${clientId}/inventories/${inventoryId}`, { answers });
  return response.data;
};

export const attachNoteFile = async (clientId: number, noteId: number, file: File): Promise<Note> => {
  const body = new FormData();
  body.append('file', file);
  const response = await api.post<Note>(`/clients/${clientId}/notes/${noteId}/file`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const downloadNoteFile = async (clientId: number, noteId: number, fileName?: string | null): Promise<void> => {
  const response = await api.get(`/clients/${clientId}/notes/${noteId}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'ek';
  link.click();
  URL.revokeObjectURL(url);
};

export const deleteNoteFile = async (clientId: number, noteId: number): Promise<void> => {
  await api.delete(`/clients/${clientId}/notes/${noteId}/file`);
};

export const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (message) return message;
  }
  return fallback;
};

export const getAppointmentById = async (id: number): Promise<AppointmentWithClient> => {
  const response = await api.get<AppointmentWithClient>(`/appointments/${id}`);
  return response.data;
};

// Google Calendar / Meet
export const getGoogleLoginUrl = async (): Promise<string> => {
  const response = await api.get<{ url: string }>('/auth/google/login');
  return response.data.url;
};

export const getGoogleAuthUrl = async (): Promise<string> => {
  const response = await api.get<{ url: string }>('/auth/google');
  return response.data.url;
};

export const getGoogleAuthStatus = async (): Promise<{ connected: boolean }> => {
  const response = await api.get<{ connected: boolean }>('/auth/google/status');
  return response.data;
};

export const createMeetForAppointment = async (
  appointmentId: number,
  durationMinutes?: number
): Promise<{ meetLink: string; eventId: string; htmlLink: string }> => {
  const response = await api.post<{ meetLink: string; eventId: string; htmlLink: string }>(
    `/appointments/${appointmentId}/create-meet`,
    durationMinutes != null ? { durationMinutes } : undefined
  );
  return response.data;
};
