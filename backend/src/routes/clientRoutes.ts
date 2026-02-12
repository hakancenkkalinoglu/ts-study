import express from 'express';
import {
  createClientHandler,
  getClientsHandler,
  deleteClientHandler,
  updateClientHandler,
  createNoteHandler,
  getClientNotesHandler,
  createAppointmentHandler,
  getAppointmentsHandler,
  getAppointmentNotesHandler,
  getAllAppointmentsHandler,
  getAppointmentByIdHandler,
  updateAppointmentHandler,
  deleteAppointmentHandler,
  createMeetHandler,
} from '../controllers/clientController.js';

const router = express.Router();

// Clients
router.get('/clients', getClientsHandler);
router.post('/clients', createClientHandler);
router.put('/clients/:id', updateClientHandler);
router.delete('/clients/:id', deleteClientHandler);

// Notes for a client (all notes)
router.get('/clients/:clientId/notes', getClientNotesHandler);
router.post('/clients/:clientId/notes', (req, res, next) => {
  req.body.clientId = Number(req.params.clientId);
  return createNoteHandler(req, res);
});

// All appointments (for calendar)
router.get('/appointments', getAllAppointmentsHandler);
// Single appointment (for opening update modal after create)
router.get('/appointments/:id', getAppointmentByIdHandler);
// Google Meet: create calendar event with Meet for an appointment
router.post('/appointments/:appointmentId/create-meet', createMeetHandler);

// Appointments for a client
router.get('/clients/:clientId/appointments', getAppointmentsHandler);
router.post('/clients/:clientId/appointments', createAppointmentHandler);
router.put('/clients/:clientId/appointments/:appointmentId', updateAppointmentHandler);
router.delete('/clients/:clientId/appointments/:appointmentId', deleteAppointmentHandler);

// Notes for an appointment
router.get('/clients/:clientId/appointments/:appointmentId/notes', getAppointmentNotesHandler);
router.post('/clients/:clientId/appointments/:appointmentId/notes', (req, res, next) => {
  req.body.clientId = Number(req.params.clientId);
  req.body.appointmentId = Number(req.params.appointmentId);
  return createNoteHandler(req, res);
});

export default router;


