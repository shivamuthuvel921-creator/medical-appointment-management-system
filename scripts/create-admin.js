import readline from 'node:readline';
import bcrypt from 'bcrypt';
import { createUser, getUserByEmail, setUserRole, closeDb } from '../database.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  console.log('── MedCare admin bootstrap ──');

  const email = (await ask('Admin email: ')).trim().toLowerCase();
  if (!email.includes('@')) {
    console.error('Invalid email');
    process.exit(1);
  }

  const existing = getUserByEmail(email);
  if (existing) {
    const confirm = (await ask(`User ${email} exists with role '${existing.role}'. Promote to admin? [y/N] `)).trim().toLowerCase();
    if (confirm !== 'y') {
      console.log('Aborted');
      closeDb();
      process.exit(0);
    }
    setUserRole(existing.id, 'admin');
    console.log(`Promoted ${email} to admin.`);
    closeDb();
    process.exit(0);
  }

  const name = (await ask('Full name: ')).trim();
  const phone = (await ask('Phone: ')).trim();
  const password = await ask('Password (min 8 chars): ');

  if (!name || !phone) {
    console.error('Name and phone are required');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({
    id: crypto.randomUUID(),
    name,
    email,
    phone,
    passwordHash,
    role: 'admin',
  });

  console.log(`Admin created: ${user.email}`);
  closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
