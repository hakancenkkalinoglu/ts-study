import db from '../database/db.js';
import * as bcrypt from 'bcrypt';

const DEFAULT_USERNAME = 'psgleylidereli';
const DEFAULT_PASSWORD = 'leyli1123';

export type AppUser = {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: string;
};

export function findUserByUsername(username: string): AppUser | null {
  const row = db.prepare('SELECT * FROM app_users WHERE username = ?').get(username);
  return (row as AppUser) ?? null;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** İlk kurulumda varsayılan kullanıcıyı oluşturur (yoksa). */
export async function seedDefaultUser(): Promise<void> {
  const existing = db.prepare('SELECT id FROM app_users WHERE username = ?').get(DEFAULT_USERNAME);
  if (existing) return;

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  db.prepare('INSERT INTO app_users (username, passwordHash) VALUES (?, ?)').run(DEFAULT_USERNAME, passwordHash);
  console.log('Varsayılan giriş kullanıcısı oluşturuldu:', DEFAULT_USERNAME);
}
