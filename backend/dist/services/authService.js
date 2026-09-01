import db from '../database/db.js';
import * as bcrypt from 'bcrypt';
const DEFAULT_USERNAME = 'testpsikolog';
const DEFAULT_PASSWORD = 'test1234';
export function findUserByUsername(username) {
    const row = db.prepare('SELECT * FROM app_users WHERE username = ?').get(username);
    return row ?? null;
}
export async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}
/** İlk kurulumda varsayılan kullanıcıyı oluşturur (yoksa). */
export async function seedDefaultUser() {
    const existing = db.prepare('SELECT id FROM app_users WHERE username = ?').get(DEFAULT_USERNAME);
    if (existing)
        return;
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    db.prepare('INSERT INTO app_users (username, passwordHash) VALUES (?, ?)').run(DEFAULT_USERNAME, passwordHash);
    console.log('Varsayılan giriş kullanıcısı oluşturuldu:', DEFAULT_USERNAME);
}
//# sourceMappingURL=authService.js.map