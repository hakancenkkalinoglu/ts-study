import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import clientRoutes from './routes/clientRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import { seedDefaultUser } from './services/authService.js';
import path from 'path';
import { fileURLToPath } from 'url';
const app = express();
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.use('/api', authMiddleware);
app.use('/api', clientRoutes);
app.use('/api', authRoutes);
app.use(express.static(path.join(__dirname, '../public')));
seedDefaultUser()
    .then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map