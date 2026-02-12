import db from '../database/db.js';
import type { CreateClientInput, UpdateClientInput } from '../models/Client.js';
import type { CreateNoteInput, Note } from '../models/Note.js';
import type { Appointment, CreateAppointmentInput, UpdateAppointmentInput } from '../models/Appointment.js';
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
      INSERT INTO clients (email, name, birthDate, agreedFee, password, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    let hashedPassword: string | null = null;
    if (client.password) {
      hashedPassword = await hashPassword(client.password);
    }
  
    const result = insertUser.run(
      client.email,
      client.name ?? null,
      client.birthDate ?? null,
      client.agreedFee ?? 2000,
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
      agreedFee = CASE WHEN ? IS NOT NULL THEN ? ELSE agreedFee END,
      password = COALESCE(?, password),
      updatedAt = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(
    data.email ?? null,
    data.name ?? null,
    data.birthDate ?? null,
    data.agreedFee ?? null,
    data.agreedFee ?? null,
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

const normalizeDate = (d: string) => (d.includes('T') ? (d.split('T')[0] ?? d) : d).slice(0, 10);
const normalizeTime = (t: string) => (t || '09:00').slice(0, 5);

export const hasAppointmentAtDateTime = (appointmentDate: string, appointmentTime: string, excludeId?: number): boolean => {
  const dateStr = normalizeDate(appointmentDate);
  const timeStr = normalizeTime(appointmentTime);
  const datePattern = dateStr + '%';
  const timePattern = timeStr + '%';
  let existing;
  if (excludeId != null) {
    existing = db.prepare(`
      SELECT id FROM appointments
      WHERE appointmentDate LIKE ? AND appointmentTime LIKE ? AND id != ?
    `).get(datePattern, timePattern, excludeId);
  } else {
    existing = db.prepare(`
      SELECT id FROM appointments
      WHERE appointmentDate LIKE ? AND appointmentTime LIKE ?
    `).get(datePattern, timePattern);
  }
  return !!existing;
};

export const createAppointment = (input: CreateAppointmentInput) => {
  const dateStr = normalizeDate(input.appointmentDate);
  const timeStr = normalizeTime(input.appointmentTime ?? '09:00');

  if (hasAppointmentAtDateTime(dateStr, timeStr)) {
    throw new Error('Bu tarih ve saatte zaten bir randevu mevcut.');
  }

  const stmt = db.prepare(`
    INSERT INTO appointments (clientId, appointmentDate, appointmentTime, title, isPaid, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  const result = stmt.run(
    input.clientId,
    dateStr,
    timeStr,
    input.title ?? null,
    input.isPaid ? 1 : 0
  );
  return result.lastInsertRowid as number;
};

export const getAppointmentsByClientId = (clientId: number): Appointment[] => {
  const stmt = db.prepare(`
    SELECT * FROM appointments WHERE clientId = ? ORDER BY appointmentDate DESC, appointmentTime ASC
  `);
  return stmt.all(clientId) as Appointment[];
};

export const updateAppointment = (appointmentId: number, clientId: number, data: UpdateAppointmentInput) => {
  const current = db.prepare(`SELECT appointmentDate, appointmentTime FROM appointments WHERE id = ? AND clientId = ?`).get(appointmentId, clientId) as { appointmentDate: string; appointmentTime: string } | undefined;
  if (!current) return 0;

  const newDate = data.appointmentDate != null ? normalizeDate(data.appointmentDate) : normalizeDate(current.appointmentDate);
  const newTime = data.appointmentTime != null ? normalizeTime(data.appointmentTime) : normalizeTime(current.appointmentTime);

  if (hasAppointmentAtDateTime(newDate, newTime, appointmentId)) {
    throw new Error('Bu tarih ve saatte zaten bir randevu mevcut.');
  }

  const stmt = db.prepare(`
    UPDATE appointments
    SET
      appointmentDate = COALESCE(?, appointmentDate),
      appointmentTime = COALESCE(?, appointmentTime),
      title = COALESCE(?, title),
      isPaid = CASE WHEN ? IS NOT NULL THEN ? ELSE isPaid END,
      updatedAt = datetime('now')
    WHERE id = ? AND clientId = ?
  `);
  const isPaidVal = data.isPaid != null ? (data.isPaid ? 1 : 0) : null;
  const result = stmt.run(
    data.appointmentDate ?? null,
    data.appointmentTime ?? null,
    data.title ?? null,
    isPaidVal,
    isPaidVal,
    appointmentId,
    clientId
  );
  return result.changes;
};

export const deleteAppointmentById = (appointmentId: number, clientId: number) => {
  const stmt = db.prepare(`DELETE FROM appointments WHERE id = ? AND clientId = ?`);
  const result = stmt.run(appointmentId, clientId);
  return result.changes;
};

export const updateAppointmentGoogleFields = (
  appointmentId: number,
  data: { googleEventId: string; googleMeetLink: string; googleHtmlLink: string }
) => {
  const stmt = db.prepare(`
    UPDATE appointments
    SET googleEventId = ?, googleMeetLink = ?, googleHtmlLink = ?, updatedAt = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(data.googleEventId, data.googleMeetLink, data.googleHtmlLink, appointmentId);
  return result.changes;
};

export type AppointmentWithClient = Appointment & {
  clientName: string | null;
  agreedFee: number | null;
};
export const getAllAppointments = (): AppointmentWithClient[] => {
  const stmt = db.prepare(`
    SELECT a.*, c.name as clientName, c.agreedFee as agreedFee
    FROM appointments a
    LEFT JOIN clients c ON a.clientId = c.id
    ORDER BY a.appointmentDate ASC, a.appointmentTime ASC
  `);
  return stmt.all() as AppointmentWithClient[];
};

export const getAppointmentByIdWithClient = (appointmentId: number): AppointmentWithClient | null => {
  const stmt = db.prepare(`
    SELECT a.*, c.name as clientName, c.agreedFee as agreedFee
    FROM appointments a
    LEFT JOIN clients c ON a.clientId = c.id
    WHERE a.id = ?
  `);
  const row = stmt.get(appointmentId);
  return (row as AppointmentWithClient) ?? null;
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
