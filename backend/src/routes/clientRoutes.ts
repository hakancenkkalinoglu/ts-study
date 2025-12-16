import express from 'express';
import {
  createClientHandler,
  getClientsHandler,
  deleteClientHandler,
  updateClientHandler,
  createNoteHandler,
  getClientNotesHandler,
} from '../controllers/clientController.js';

const router = express.Router();

// Clients
router.get('/clients', getClientsHandler);
router.post('/clients', createClientHandler);
router.put('/clients/:id', updateClientHandler);
router.delete('/clients/:id', deleteClientHandler);

// Notes for a client
router.get('/clients/:clientId/notes', getClientNotesHandler);
router.post('/clients/:clientId/notes', (req, res, next) => {
  // ensure clientId from params is on body for CreateNoteInput
  req.body.clientId = Number(req.params.clientId);
  return createNoteHandler(req, res);
});

export default router;


