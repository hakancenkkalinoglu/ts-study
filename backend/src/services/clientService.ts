import db from '../database/db.js';
import type { CreateClientInput, UpdateClientInput } from '../models/Client.js';
import type { CreateNoteInput, Note } from '../models/Note.js';
import type { Appointment, CreateAppointmentInput } from '../models/Appointment.js';
import * as bcrypt from 'bcrypt';

export const hashPassword = async (password: string) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  };



export const findClientByEmail = async (email: string) => {
    const getClientWithEmail = db.prepare(`SELECT id FROM clients WHERE email = ?`);
    const existingClient = getClientWithEmail.get(email);

    if (existingClient) {
        return existingClient;
    }
}
export const findClientById = async (id: string) => {
    const getClientWithId = db.prepare(`SELECT id FROM clients WHERE id = ?`);
    const existingClient = getClientWithId.get(id);
    
    if (existingClient) {
        return existingClient;
    }
}

export const createClient = async (client: CreateClientInput) => {
    const insertUser = db.prepare(`
      INSERT INTO clients (email, name, birthDate, password, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    let hashedPassword: string | null = null;
    if (client.password) {
      hashedPassword = await hashPassword(client.password);
    }
  
    const result = insertUser.run(
      client.email,
      client.name ?? null,
      client.birthDate ?? null,
      hashedPassword
    );
  
    console.log('Inserted client Id', result.lastInsertRowid);
  
    return result.lastInsertRowid;
  };

export const updateClient = async (id: string, data: UpdateClientInput) => {
  const existing = await findClientById(id);
  if (!existing) {
    return 0;
  }

  let hashedPassword: string | undefined;
  if (data.password) {
    hashedPassword = await hashPassword(data.password);
  }

  const stmt = db.prepare(`
    UPDATE clients
    SET
      email = COALESCE(?, email),
      name = COALESCE(?, name),
      birthDate = COALESCE(?, birthDate),
      password = COALESCE(?, password),
      updatedAt = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(
    data.email ?? null,
    data.name ?? null,
    data.birthDate ?? null,
    hashedPassword ?? null,
    id
  );

  return result.changes;
};

export const deleteClientById = async (id: string) => {
  const client = await findClientById(id);
  if (!client) {
    return 0;
  }

  const stmt = db.prepare(`DELETE FROM clients WHERE id = ?`);
  const result = stmt.run(id);

  console.log('deleted rows:', result.changes);
  return result.changes;
};

export const getAllClients = (search?: string) => {
  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`;
    const stmt = db.prepare(`
      SELECT * FROM clients
      WHERE name LIKE ? OR email LIKE ?
      ORDER BY name ASC
    `);
    return stmt.all(searchPattern, searchPattern);
  }
  const stmt = db.prepare(`SELECT * FROM clients ORDER BY name ASC`);
  return stmt.all();
}

export const createAppointment = (input: CreateAppointmentInput) => {
  const stmt = db.prepare(`
    INSERT INTO appointments (clientId, appointmentDate, title, createdAt, updatedAt)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `);
  const result = stmt.run(input.clientId, input.appointmentDate, input.title ?? null);
  return result.lastInsertRowid as number;
};

export const getAppointmentsByClientId = (clientId: number): Appointment[] => {
  const stmt = db.prepare(`
    SELECT * FROM appointments WHERE clientId = ? ORDER BY appointmentDate DESC
  `);
  return stmt.all(clientId) as Appointment[];
};

export type AppointmentWithClient = Appointment & { clientName: string | null };

export const getAllAppointments = (): AppointmentWithClient[] => {
  const stmt = db.prepare(`
    SELECT a.*, c.name as clientName
    FROM appointments a
    LEFT JOIN clients c ON a.clientId = c.id
    ORDER BY a.appointmentDate ASC
  `);
  return stmt.all() as AppointmentWithClient[];
};

export const createNote = (note: CreateNoteInput) => {
  const stmt = db.prepare(`
    INSERT INTO client_notes (clientId, appointmentId, title, content, noteDate, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const result = stmt.run(
    note.clientId,
    note.appointmentId ?? null,
    note.title ?? null,
    note.content,
    note.noteDate
  );

  return result.lastInsertRowid;
};

export const getNotesByClientId = (clientId: number): Note[] => {
  const stmt = db.prepare(`SELECT * FROM client_notes WHERE clientId = ? ORDER BY noteDate DESC, createdAt DESC`);
  const rows = stmt.all(clientId) as Note[];
  return rows;
};

export const getNotesByAppointmentId = (appointmentId: number): Note[] => {
  const stmt = db.prepare(`
    SELECT * FROM client_notes WHERE appointmentId = ? ORDER BY noteDate DESC, createdAt DESC
  `);
  return stmt.all(appointmentId) as Note[];
};
