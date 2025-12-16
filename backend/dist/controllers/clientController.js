import { createClient, deleteClientById, getAllClients, updateClient, createNote, getNotesByClientId, } from '../services/clientService.js';
export const createClientHandler = async (req, res) => {
    try {
        const body = req.body;
        const id = await createClient(body);
        res.status(201).json({ id });
    }
    catch (err) {
        console.error('Error creating client:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const getClientsHandler = (_req, res) => {
    try {
        const clients = getAllClients();
        res.json(clients);
    }
    catch (err) {
        console.error('Error getting clients:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const deleteClientHandler = async (req, res) => {
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
    }
    catch (err) {
        console.error('Error deleting client:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const updateClientHandler = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'Client id is required' });
        }
        const body = req.body;
        const updated = await updateClient(id, body);
        if (updated === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }
        res.json({ updated });
    }
    catch (err) {
        console.error('Error updating client:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const createNoteHandler = (req, res) => {
    try {
        const body = req.body;
        const id = createNote(body);
        res.status(201).json({ id });
    }
    catch (err) {
        console.error('Error creating note:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const getClientNotesHandler = (req, res) => {
    try {
        const clientId = Number(req.params.clientId);
        const notes = getNotesByClientId(clientId);
        res.json(notes);
    }
    catch (err) {
        console.error('Error getting notes:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
//# sourceMappingURL=clientController.js.map