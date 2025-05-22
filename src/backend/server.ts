import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import verificationRoutes from './routes/verification.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/verify', verificationRoutes);

if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../dist');
  app.use(express.static(frontendPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

async function startServer() {
  try {
    const availablePort = await findAvailablePort(Number(PORT));

    app.listen(availablePort, () => {
      console.log(`Server is running on port ${availablePort}`);
      if (availablePort !== Number(PORT)) {
        console.log(`Note: Default port ${PORT} was already in use`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

startServer();
