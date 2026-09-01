import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'testpsikolog-secret-change-in-production';
function isPublicPath(req) {
    const p = req.path;
    if (req.method === 'POST' && (p === '/auth/login' || p === '/auth/login/'))
        return true;
    if (p === '/auth/google' || p === '/auth/google/callback' || p === '/auth/google/status')
        return true;
    return false;
}
export function authMiddleware(req, res, next) {
    if (isPublicPath(req)) {
        next();
        return;
    }
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        res.status(401).json({ message: 'Giriş yapmanız gerekiyor.' });
        return;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ message: 'Geçersiz veya süresi dolmuş oturum.' });
    }
}
//# sourceMappingURL=authMiddleware.js.map