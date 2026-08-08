import app from './app.js';
import { closeDb } from './database.js';
import { startReminderService, stopReminderService } from './services/reminders.js';
import { startMedicationReminderService, stopMedicationReminderService } from './services/medicationReminders.js';
import { config } from './config.js';

const server = app.listen(config.port, () => {
  console.log(`Medication scheduler running at http://localhost:${config.port}`);
});

startReminderService();
startMedicationReminderService();

function shutdown() {
  stopReminderService();
  stopMedicationReminderService();
  closeDb();
  server.close(() => process.exit());
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
