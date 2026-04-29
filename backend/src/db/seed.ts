import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './client';
import { users } from './schema';

async function seed() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  await db.insert(users).values({
    name:         'Admin',
    email:        'admin@example.com',
    passwordHash,
    role:         'admin',
    createdAt:    Math.floor(Date.now() / 1000),
  });

  console.log('Admin user created: admin@example.com / admin123');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
