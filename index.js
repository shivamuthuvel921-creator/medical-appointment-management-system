import app from './app.js';
import { closeDb } from './database.js';
import { startReminderService, stopReminderService } from './services/reminders.js';
import { config } from './config.js';

const server = app.listen(config.port, () => {
  console.log(`Medication scheduler running at http://localhost:${config.port}`);
});

startReminderService();

function shutdown() {
  stopReminderService();
  closeDb();
  server.close(() => process.exit());
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
