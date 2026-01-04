import axios from 'axios';
import type { Client, CreateClientInput, Note, CreateNoteInput } from '../types';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Client endpoints
export const getClients = async (): Promise<Client[]> => {
  const response = await api.get<Client[]>('/clients');
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
