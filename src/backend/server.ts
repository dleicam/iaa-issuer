import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import verificationRoutes from './routes/verification.routes';
import loginRoutes from './routes/login.routes';
import vcRoutes from './routes/vc.routes';
import { vcService } from './utils/vc-service';

// Session store to keep track of valid session tokens
export const sessions = new Map<string, { 
  userId: string, 
  expires: number,
  vp?: any 
}>();

// Session expiration time (24 hours)
export const SESSION_EXPIRATION = 24 * 60 * 60 * 1000;

// Clean up expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expires < now) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/verify', verificationRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/vc', vcRoutes);

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
    // Initialize the VC service
    try {
      await vcService.initialize();
      console.log('VC service initialized successfully');
    } catch (vcError) {
      console.error('Failed to initialize VC service:', vcError);
    }

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
