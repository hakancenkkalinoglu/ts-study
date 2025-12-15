import express from 'express';
import clientRoutes from './routes/clientRoutes.js';
const app = express();
const PORT = 3000;
app.use(express.json());
app.use('/api', clientRoutes);
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map