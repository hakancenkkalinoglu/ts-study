import axios from 'axios';
import type { Client, CreateClientInput, Note, CreateNoteInput, Appointment, CreateAppointmentInput, UpdateAppointmentInput, AppointmentWithClient } from '../types';

// Relative URL: Vite proxy forwards /api to backend (localhost:3000)
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export const createAppointment = async (data: CreateAppointmentInput): Promise<{ id: number }> => {
  const response = await api.post<{ id: number }>(`/clients/${data.clientId}/appointments`, data);
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
