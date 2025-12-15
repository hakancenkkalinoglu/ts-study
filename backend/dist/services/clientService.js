import db from '../database/db.js';
import * as bcrypt from 'bcrypt';
export const hashPassword = async (password) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
};
export const findClientByEmail = async (email) => {
    const getClientWithEmail = db.prepare(`SELECT id FROM clients WHERE email = ?`);
    const existingClient = getClientWithEmail.get(email);
    if (existingClient) {
        return existingClient;
    }
};
export const findClientById = async (id) => {
    const getClientWithId = db.prepare(`SELECT id FROM clients WHERE id = ?`);
    const existingClient = getClientWithId.get(id);
    if (existingClient) {
        return existingClient;
    }
};
export const createClient = async (client) => {
    const insertUser = db.prepare(`
      INSERT INTO clients (email, name, birthDate, password, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    const hashedPassword = await hashPassword(client.password);
    const result = insertUser.run(client.email, client.name ?? null, client.birthDate ?? null, hashedPassword);
    console.log('Inserted client Id', result.lastInsertRowid);
    return result.lastInsertRowid;
};
export const deleteClientById = async (id) => {
    const client = await findClientById(id);
    if (!client) {
        return 0;
    }
    const stmt = db.prepare(`DELETE FROM clients WHERE id = ?`);
    const result = stmt.run(id);
    console.log('deleted rows:', result.changes);
    return result.changes;
};
export const getAllClients = () => {
    const stmt = db.prepare(`SELECT * FROM clients`);
    const clients = stmt.all();
    return clients;
};
// ---- User notes ----
export const createNote = (note) => {
    const stmt = db.prepare(`
    INSERT INTO client_notes (clientId, title, content, noteDate, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
    const result = stmt.run(note.clientId, note.title ?? null, note.content, note.noteDate);
    return result.lastInsertRowid;
};
export const getNotesByClientId = (clientId) => {
    const stmt = db.prepare(`SELECT * FROM client_notes WHERE clientId = ? ORDER BY noteDate DESC, createdAt DESC`);
    const rows = stmt.all(clientId);
    return rows;
};
//# sourceMappingURL=clientService.js.map