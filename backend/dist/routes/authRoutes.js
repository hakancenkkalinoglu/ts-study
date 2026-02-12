import express from 'express';
import jwt from 'jsonwebtoken';
import { getAuthUrl, getTokensFromCode, isConnected } from '../services/googleCalendarService.js';
import { findUserByUsername, verifyPassword } from '../services/authService.js';
const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'leylilog-secret-change-in-production';
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Kullanıcı adı ve şifre gerekli.' });
        }
        const user = findUserByUsername(username.trim());
        if (!user) {
            return res.status(401).json({ message: 'Kullanıcı adı veya şifre hatalı.' });
        }
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ message: 'Kullanıcı adı veya şifre hatalı.' });
        }
        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username: user.username });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Giriş yapılamadı.' });
    }
});
router.get('/auth/google', (_req, res) => {
    try {
        const url = getAuthUrl();
        res.redirect(url);
    }
    catch (err) {
        console.error('Google auth URL error:', err);
        res.redirect(`${FRONTEND_URL}?google=error`);
    }
});
router.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        res.redirect(`${FRONTEND_URL}?google=missing_code`);
        return;
    }
    try {
        await getTokensFromCode(code);
        res.redirect(`${FRONTEND_URL}?google=success`);
    }
    catch (err) {
        console.error('Google token exchange error:', err);
        res.redirect(`${FRONTEND_URL}?google=error`);
    }
});
router.get('/auth/google/status', (_req, res) => {
    res.json({ connected: isConnected() });
});
export default router;
//# sourceMappingURL=authRoutes.js.map