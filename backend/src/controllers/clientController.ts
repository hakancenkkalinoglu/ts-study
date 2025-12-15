import type { Request, Response } from 'express';
import {
  createClient,
  deleteClientById,
  getAllClients,
  createNote,
  getNotesByClientId,
} from '../services/clientService.js';
import type { CreateClientInput } from '../models/Client.js';
import type { CreateNoteInput } from '../models/Note.js';

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

export const getClientsHandler = (_req: Request, res: Response) => {
  try {
    const clients = getAllClients();
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


