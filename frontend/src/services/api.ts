import axios from 'axios';
import type { Client, CreateClientInput, Note, CreateNoteInput, Appointment, CreateAppointmentInput, UpdateAppointmentInput, AppointmentWithClient } from '../types';

// Relative URL: Vite proxy forwards /api to backend (localhost:3000)
const API_BASE_URL = '/api';
const TOKEN_KEY = 'leylilog_token';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setStoredToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearStoredToken = (): void => localStorage.removeItem(TOKEN_KEY);

export const login = async (
  username: string,
  password: string
): Promise<{ token: string; username: string }> => {
  const response = await api.post<{ token: string; username: string }>('/auth/login', {
    username,
    password,
  });
  return response.data;
};

// Client endpoints
export const getClients = async (search?: string): Promise<Client[]> => {
  const params = search?.trim() ? { search: search.trim() } : {};
  const response = await api.get<Client[]>('/clients', { params });
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

// Appointment endpoints
export const getAppointments = async (clientId: number): Promise<Appointment[]> => {
  const response = await api.get<Appointment[]>(`/clients/${clientId}/appointments`);
  return response.data;
};

export const createAppointment = async (
  data: CreateAppointmentInput
): Promise<{ id: number; googleMeetLink?: string | null; googleHtmlLink?: string | null }> => {
  const response = await api.post<{
    id: number;
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

export const getAllAppointments = async (): Promise<AppointmentWithClient[]> => {
  const response = await api.get<AppointmentWithClient[]>('/appointments');
  return response.data;
};

export const getAppointmentById = async (id: number): Promise<AppointmentWithClient> => {
  const response = await api.get<AppointmentWithClient>(`/appointments/${id}`);
  return response.data;
};

// Google Calendar / Meet
export const getGoogleAuthUrl = (): string => {
  return `${API_BASE_URL}/auth/google`;
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
