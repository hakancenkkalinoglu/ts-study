import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const dbPath = path.join(__dirname, '../../data/database.sqlite');

// Create database connection
const db: DatabaseType = new Database(dbPath);

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
  let tableInfo = db.prepare("PRAGMA table_info(client_notes)").all() as { name: string }[];
  let hasFilePath = tableInfo.some((col) => col.name === 'filePath');
  if (!hasFilePath) {
    db.exec(`ALTER TABLE client_notes ADD COLUMN filePath TEXT`);
  }

  // Migration: Add appointmentId column to existing client_notes table if it doesn't exist
  tableInfo = db.prepare("PRAGMA table_info(client_notes)").all() as { name: string }[];
  const hasAppointmentId = tableInfo.some((col) => col.name === 'appointmentId');
  if (!hasAppointmentId) {
    db.exec(`ALTER TABLE client_notes ADD COLUMN appointmentId INTEGER`);
  }

}

// Initialize the database
initializeDatabase();

export default db;
