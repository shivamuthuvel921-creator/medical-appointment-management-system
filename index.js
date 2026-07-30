import app from './app.js';
import { closeDb } from './database.js';

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Medication scheduler running at http://localhost:${port}`);
});

process.on('SIGINT', () => { closeDb(); server.close(() => process.exit()); });
process.on('SIGTERM', () => { closeDb(); server.close(() => process.exit()); });
