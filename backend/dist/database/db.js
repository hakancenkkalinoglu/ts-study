import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Database file path
const dbPath = path.join(__dirname, '../../data/database.sqlite');
// Create database connection
const db = new Database(dbPath);
// Enable foreign keys
db.pragma('foreign_keys = ON');
// Initialize database tables
function initializeDatabase() {
    // Create clients table
    db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      name TEXT,
      birthDate TEXT,
      password TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
    // Create appointments table
    db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      appointmentDate TEXT NOT NULL,
      title TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
    )
  `);
    // Create client_notes table
    db.exec(`
    CREATE TABLE IF NOT EXISTS client_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      appointmentId INTEGER,
      title TEXT,
      content TEXT NOT NULL,
      filePath TEXT,
      noteDate TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (appointmentId) REFERENCES appointments(id) ON DELETE CASCADE
    )
  `);
    // Migration: Add filePath column to existing client_notes table if it doesn't exist
    let tableInfo = db.prepare("PRAGMA table_info(client_notes)").all();
    let hasFilePath = tableInfo.some((col) => col.name === 'filePath');
    if (!hasFilePath) {
        db.exec(`ALTER TABLE client_notes ADD COLUMN filePath TEXT`);
    }
    // Migration: Add appointmentId column to existing client_notes table if it doesn't exist
    tableInfo = db.prepare("PRAGMA table_info(client_notes)").all();
    const hasAppointmentId = tableInfo.some((col) => col.name === 'appointmentId');
    if (!hasAppointmentId) {
        db.exec(`ALTER TABLE client_notes ADD COLUMN appointmentId INTEGER`);
    }
    // Migration: Add appointmentTime column to appointments table if it doesn't exist
    tableInfo = db.prepare("PRAGMA table_info(appointments)").all();
    const hasAppointmentTime = tableInfo.some((col) => col.name === 'appointmentTime');
    if (!hasAppointmentTime) {
        db.exec(`ALTER TABLE appointments ADD COLUMN appointmentTime TEXT DEFAULT '09:00'`);
    }
    // Migration: Add isPaid column to appointments table if it doesn't exist
    tableInfo = db.prepare("PRAGMA table_info(appointments)").all();
    const hasIsPaid = tableInfo.some((col) => col.name === 'isPaid');
    if (!hasIsPaid) {
        db.exec(`ALTER TABLE appointments ADD COLUMN isPaid INTEGER DEFAULT 0`);
    }
    // Migration: Add agreedFee column to clients table if it doesn't exist
    tableInfo = db.prepare("PRAGMA table_info(clients)").all();
    const hasAgreedFee = tableInfo.some((col) => col.name === 'agreedFee');
    if (!hasAgreedFee) {
        db.exec(`ALTER TABLE clients ADD COLUMN agreedFee INTEGER DEFAULT 2000`);
    }
    // Migration: Google Calendar / Meet link columns on appointments
    tableInfo = db.prepare("PRAGMA table_info(appointments)").all();
    const hasGoogleEventId = tableInfo.some((col) => col.name === 'googleEventId');
    if (!hasGoogleEventId) {
        db.exec(`ALTER TABLE appointments ADD COLUMN googleEventId TEXT`);
    }
    tableInfo = db.prepare("PRAGMA table_info(appointments)").all();
    const hasGoogleMeetLink = tableInfo.some((col) => col.name === 'googleMeetLink');
    if (!hasGoogleMeetLink) {
        db.exec(`ALTER TABLE appointments ADD COLUMN googleMeetLink TEXT`);
    }
    tableInfo = db.prepare("PRAGMA table_info(appointments)").all();
    const hasGoogleHtmlLink = tableInfo.some((col) => col.name === 'googleHtmlLink');
    if (!hasGoogleHtmlLink) {
        db.exec(`ALTER TABLE appointments ADD COLUMN googleHtmlLink TEXT`);
    }
    // App login users table
    db.exec(`
    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
// Initialize the database
initializeDatabase();
export default db;
//# sourceMappingURL=db.js.map