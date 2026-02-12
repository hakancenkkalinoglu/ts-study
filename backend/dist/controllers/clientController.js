import { createClient, deleteClientById, getAllClients, updateClient, createNote, getNotesByClientId, getNotesByAppointmentId, createAppointment, getAppointmentsByClientId, getAllAppointments, getAppointmentByIdWithClient, updateAppointment, deleteAppointmentById, updateAppointmentGoogleFields, } from '../services/clientService.js';
import { createCalendarEventWithMeet, updateCalendarEvent, deleteCalendarEvent, isConnected, } from '../services/googleCalendarService.js';
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
export const getClientsHandler = (req, res) => {
    try {
        const search = req.query.search;
        const clients = getAllClients(search);
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
export const createAppointmentHandler = async (req, res) => {
    try {
        const clientId = Number(req.params.clientId);
        const body = req.body;
        const id = createAppointment({ ...body, clientId });
        let googleMeetLink = null;
        let googleHtmlLink = null;
        if (isConnected()) {
            try {
                const appointment = getAppointmentByIdWithClient(id);
                if (appointment) {
                    const result = await createCalendarEventWithMeet(appointment, 60);
                    updateAppointmentGoogleFields(id, {
                        googleEventId: result.eventId,
                        googleMeetLink: result.meetLink,
                        googleHtmlLink: result.htmlLink,
                    });
                    googleMeetLink = result.meetLink;
                    googleHtmlLink = result.htmlLink;
                }
            }
            catch (googleErr) {
                console.error('Google Calendar event create failed:', googleErr);
            }
        }
        res.status(201).json({ id, googleMeetLink, googleHtmlLink });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        if (message.includes('zaten bir randevu mevcut')) {
            return res.status(409).json({ message });
        }
        console.error('Error creating appointment:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const getAppointmentsHandler = (req, res) => {
    try {
        const clientId = Number(req.params.clientId);
        const appointments = getAppointmentsByClientId(clientId);
        res.json(appointments);
    }
    catch (err) {
        console.error('Error getting appointments:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const getAppointmentNotesHandler = (req, res) => {
    try {
        const appointmentId = Number(req.params.appointmentId);
        const notes = getNotesByAppointmentId(appointmentId);
        res.json(notes);
    }
    catch (err) {
        console.error('Error getting appointment notes:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const getAllAppointmentsHandler = (_req, res) => {
    try {
        const appointments = getAllAppointments();
        res.json(appointments);
    }
    catch (err) {
        console.error('Error getting all appointments:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const getAppointmentByIdHandler = (req, res) => {
    try {
        const id = Number(req.params.id);
        const appointment = getAppointmentByIdWithClient(id);
        if (!appointment) {
            return res.status(404).json({ message: 'Randevu bulunamadı.' });
        }
        res.json(appointment);
    }
    catch (err) {
        console.error('Error getting appointment:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const updateAppointmentHandler = async (req, res) => {
    try {
        const clientId = Number(req.params.clientId);
        const appointmentId = Number(req.params.appointmentId);
        const body = req.body;
        const updated = updateAppointment(appointmentId, clientId, body);
        if (updated === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }
        const appointment = getAppointmentByIdWithClient(appointmentId);
        if (appointment?.googleEventId && (body.appointmentDate != null || body.appointmentTime != null || body.title != null)) {
            try {
                await updateCalendarEvent(appointment.googleEventId, appointment, 60);
            }
            catch (googleErr) {
                console.error('Google Calendar event update failed:', googleErr);
            }
        }
        res.json({ updated });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        if (message.includes('zaten bir randevu mevcut')) {
            return res.status(409).json({ message });
        }
        console.error('Error updating appointment:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const deleteAppointmentHandler = async (req, res) => {
    try {
        const clientId = Number(req.params.clientId);
        const appointmentId = Number(req.params.appointmentId);
        const appointment = getAppointmentByIdWithClient(appointmentId);
        if (appointment?.googleEventId) {
            try {
                await deleteCalendarEvent(appointment.googleEventId);
            }
            catch (googleErr) {
                console.error('Google Calendar event delete failed:', googleErr);
            }
        }
        const deleted = deleteAppointmentById(appointmentId, clientId);
        if (deleted === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }
        res.json({ deleted });
    }
    catch (err) {
        console.error('Error deleting appointment:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const createMeetHandler = async (req, res) => {
    try {
        const appointmentId = Number(req.params.appointmentId);
        const appointment = getAppointmentByIdWithClient(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: 'Randevu bulunamadı.' });
        }
        const durationMinutes = typeof req.body?.durationMinutes === 'number' ? req.body.durationMinutes : 60;
        const result = await createCalendarEventWithMeet(appointment, durationMinutes);
        updateAppointmentGoogleFields(appointmentId, {
            googleEventId: result.eventId,
            googleMeetLink: result.meetLink,
            googleHtmlLink: result.htmlLink,
        });
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        if (message.includes('bağlı değil')) {
            return res.status(401).json({ message });
        }
        console.error('Error creating Meet:', err);
        res.status(500).json({ message: message });
    }
};
//# sourceMappingURL=clientController.js.map