import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const migrationsDir = join(import.meta.dirname, "..", "migrations");

  // Only run Neon migrations (001_neon_schema.sql)
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && f.includes("neon"))
    .sort();

  if (files.length === 0) {
    console.log("No Neon migration files found");
    return;
  }

  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const sqlContent = readFileSync(join(migrationsDir, file), "utf-8");
    await sql(sqlContent);
    console.log(`Completed: ${file}`);
  }

  console.log("All migrations complete");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
