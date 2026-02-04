import type { Request, Response } from 'express';
import {
  createClient,
  deleteClientById,
  getAllClients,
  updateClient,
  createNote,
  getNotesByClientId,
  getNotesByAppointmentId,
  createAppointment,
  getAppointmentsByClientId,
  getAllAppointments,
  updateAppointment,
  deleteAppointmentById,
} from '../services/clientService.js';
import type { CreateClientInput, UpdateClientInput } from '../models/Client.js';
import type { CreateNoteInput } from '../models/Note.js';
import type { CreateAppointmentInput, UpdateAppointmentInput } from '../models/Appointment.js';

export const createClientHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateClientInput;
    const id = await createClient(body);
    res.status(201).json({ id });
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getClientsHandler = (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const clients = getAllClients(search);
    res.json(clients);
  } catch (err) {
    console.error('Error getting clients:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteClientHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Client id is required' });
    }
    const deleted = await deleteClientById(id);
    if (deleted === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json({ deleted });
  } catch (err) {
    console.error('Error deleting client:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateClientHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Client id is required' });
    }

    const body = req.body as UpdateClientInput;
    const updated = await updateClient(id, body);

    if (updated === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({ updated });
  } catch (err) {
    console.error('Error updating client:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createNoteHandler = (req: Request, res: Response) => {
  try {
    const body = req.body as CreateNoteInput;
    const id = createNote(body);
    res.status(201).json({ id });
  } catch (err) {
    console.error('Error creating note:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getClientNotesHandler = (req: Request, res: Response) => {
  try {
    const clientId = Number(req.params.clientId);
    const notes = getNotesByClientId(clientId);
    res.json(notes);
  } catch (err) {
    console.error('Error getting notes:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createAppointmentHandler = (req: Request, res: Response) => {
  try {
    const clientId = Number(req.params.clientId);
    const body = req.body as Omit<CreateAppointmentInput, 'clientId'>;
    const id = createAppointment({ ...body, clientId } as CreateAppointmentInput);
    res.status(201).json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message.includes('zaten bir randevu mevcut')) {
      return res.status(409).json({ message });
    }
    console.error('Error creating appointment:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAppointmentsHandler = (req: Request, res: Response) => {
  try {
    const clientId = Number(req.params.clientId);
    const appointments = getAppointmentsByClientId(clientId);
    res.json(appointments);
  } catch (err) {
    console.error('Error getting appointments:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAppointmentNotesHandler = (req: Request, res: Response) => {
  try {
    const appointmentId = Number(req.params.appointmentId);
    const notes = getNotesByAppointmentId(appointmentId);
    res.json(notes);
  } catch (err) {
    console.error('Error getting appointment notes:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllAppointmentsHandler = (_req: Request, res: Response) => {
  try {
    const appointments = getAllAppointments();
    res.json(appointments);
  } catch (err) {
    console.error('Error getting all appointments:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateAppointmentHandler = (req: Request, res: Response) => {
  try {
    const clientId = Number(req.params.clientId);
    const appointmentId = Number(req.params.appointmentId);
    const body = req.body as UpdateAppointmentInput;
    const updated = updateAppointment(appointmentId, clientId, body);
    if (updated === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    res.json({ updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message.includes('zaten bir randevu mevcut')) {
      return res.status(409).json({ message });
    }
    console.error('Error updating appointment:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteAppointmentHandler = (req: Request, res: Response) => {
  try {
    const clientId = Number(req.params.clientId);
    const appointmentId = Number(req.params.appointmentId);
    const deleted = deleteAppointmentById(appointmentId, clientId);
    if (deleted === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    res.json({ deleted });
  } catch (err) {
    console.error('Error deleting appointment:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


