import db from '../database/db.js';
import * as bcrypt from 'bcrypt';
export const hashPassword = async (password) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
};
export const createUser = async (user) => {
    const insertUser = db.prepare(`
    INSERT INTO users (email, name, password, createdAt, updatedAt)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `);
    const hashedPassword = await hashPassword(user.password);
    const result = insertUser.run(user.email, user.name ?? null, hashedPassword);
    console.log('Inserted user Id', result.lastInsertRowid);
    return result.lastInsertRowid;
};
export const findUserByEmail = async (email) => {
    const getUserWithEmail = db.prepare(`SELECT id FROM users WHERE email = ?`);
    const existingUser = getUserWithEmail.get(email);
    if (existingUser) {
        return existingUser;
    }
};
export const findUserById = async (id) => {
    const getUserWithId = db.prepare(`SELECT id FROM users WHERE id = ?`);
    const existingUser = getUserWithId.get(id);
    if (existingUser) {
        return existingUser;
    }
};
export const deleteUserById = async (id) => {
    const userId = findUserById(id);
    if (!userId) {
        return 'User not found';
    }
    const deletedUser = db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    console.log('deleteduser: ', deletedUser);
    return deletedUser;
};
//# sourceMappingURL=userService.js.map