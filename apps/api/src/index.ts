import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { config } from './config.js';
import { setupGoogleAuth } from './auth/google.js';
import { authRouter } from './routes/auth.js';
import { bottlesRouter } from './routes/bottles.js';
import { analysisRouter } from './routes/analysis.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { historyRouter } from './routes/history.js';
import { importsRouter } from './routes/imports.js';
import { agentRouter } from './routes/agent.js'; // Cellar Agent (localhost only)
import { eventsRouter } from './routes/events.js'; // Wine World Moments

const app = express();

// Setup Google OAuth
setupGoogleAuth();

// Middleware
// Allow requests from production and local dev
const allowedOrigins = [
  'http://localhost:5173',  // Local dev
  'http://localhost:5174',  // Alternative local port
  'https://wine-cellar-brain.vercel.app', // Production
];

// Add WEB_URL from environment if set
if (config.webUrl && config.webUrl.trim()) {
  allowedOrigins.push(config.webUrl.trim());
}

console.log('[CORS] Allowed origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin) {
        console.log('[CORS] Allowing request with no origin');
        return callback(null, true);
      }
      
      // Allow if origin is in the whitelist
      if (allowedOrigins.includes(origin)) {
        console.log('[CORS] Allowing origin:', origin);
        callback(null, true);
      } else {
        console.warn('[CORS] BLOCKED origin:', origin);
        console.warn('[CORS] Allowed origins are:', allowedOrigins);
        callback(null, false); // Don't throw error, just reject
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/bottles', bottlesRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/history', historyRouter);
app.use('/api/imports', importsRouter);
app.use('/api/agent', agentRouter); // Cellar Agent (localhost only)
app.use('/api/events', eventsRouter); // Wine World Moments

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.port, () => {
  console.log(`🍷 Wine Cellar Brain API running on http://localhost:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`OpenAI enabled: ${config.openaiApiKey ? 'Yes' : 'No (using fallback heuristics)'}`);
});

