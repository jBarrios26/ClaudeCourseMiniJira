import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./client";
import { users, projects, tickets } from "./schema";

async function seed() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await db.insert(users).values({
    name: "Admin",
    email: "admin@example.com",
    passwordHash,
    role: "admin",
    createdAt: Math.floor(Date.now() / 1000),
  });

  console.log("Admin user created: admin@example.com / admin123");

  const ts = Math.floor(Date.now() / 1000);
  const [defaultProject] = await db
    .insert(projects)
    .values({
      name: "Default",
      description: "Default project for existing tickets",
      createdAt: ts,
      updatedAt: ts,
    })
    .returning({ id: projects.id });

  await db.update(tickets).set({ projectId: defaultProject.id });

  console.log(
    `Default project created (id: ${defaultProject.id}) and all tickets assigned to it`,
  );
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
