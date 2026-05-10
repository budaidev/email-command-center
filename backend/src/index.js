// Load environment variables FIRST before anything else
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import accountsRouter from './routes/accounts.js';
import emailsRouter from './routes/emails.js';
import syncRouter from './routes/sync.js';
import summariesRouter from './routes/summaries.js';
import tagsRouter from './routes/tags.js';
import categoriesRouter from './routes/categories.js';
import dailyDigestsRouter from './routes/daily-digests.js';
import calendarEventsRouter from './routes/calendar-events.js';
import categoryActionsRouter from './routes/category-actions.js';
import tasksRouter from './routes/tasks.js';
import triageRouter from './routes/triage.js';
import pipelineRouter from './routes/pipeline.js';
import { syncAll, startAllIdleWatchers, stopAllIdleWatchers } from './services/sync.js';
import { generateYesterdayDigest } from './services/daily-digest.js';
import { syncAllCalendars } from './services/caldav.js';

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use('/api/accounts', accountsRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/summaries', summariesRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/daily-digests', dailyDigestsRouter);
app.use('/api/calendar-events', calendarEventsRouter);
app.use('/api/category-actions', categoryActionsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/triage', triageRouter);
app.use('/api/pipeline', pipelineRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const server = app.listen(port, async () => {
  console.log(`Email Command Center API running on port ${port}`);
  console.log('[Startup] Running initial sync...');
  await syncAll().catch(console.error);
  // Sync calendars alongside email
  syncAllCalendars().catch(console.error);
  // Start IDLE watchers after initial sync so last_uid is up to date
  startAllIdleWatchers();
  // Fallback cron every 5 min in case IDLE misses anything
  cron.schedule('*/5 * * * *', () => {
    console.log('[Cron] Running fallback sync...');
    syncAll().catch(console.error);
    syncAllCalendars().catch(console.error);
  });
  // Daily digest cron at 2:00 AM
  cron.schedule('0 2 * * *', () => {
    console.log('[Cron] Generating yesterday\'s daily digest...');
    generateYesterdayDigest().catch(console.error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  stopAllIdleWatchers();
  server.close();
});
process.on('SIGINT', () => {
  stopAllIdleWatchers();
  server.close();
  process.exit(0);
});
