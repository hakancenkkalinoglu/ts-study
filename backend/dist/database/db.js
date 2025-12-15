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
    // Create client_notes table
    db.exec(`
    CREATE TABLE IF NOT EXISTS client_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      noteDate TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
    )
  `);
}
// Initialize the database
initializeDatabase();
export default db;
//# sourceMappingURL=db.js.map