import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import scanHandler from './api/scan.js';
import consultHandler from './api/consult.js';
import healthHandler from './api/health.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Support base64 image uploads up to 20MB
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Delegate API routes to shared Vercel-compatible Serverless handlers in /api/*
app.all('/api/scan', (req: Request, res: Response) => scanHandler(req, res));
app.all('/api/scan-receipt', (req: Request, res: Response) => scanHandler(req, res));
app.all('/api/consult', (req: Request, res: Response) => consultHandler(req, res));
app.all('/api/health', (req: Request, res: Response) => healthHandler(req, res));

// Setup Vite Dev Middleware or Static Serving
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Uangku] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Uangku] Server startup failed:', err);
  process.exit(1);
});
