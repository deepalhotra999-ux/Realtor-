import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connect, DATABASE_URL } from "./_db";

async function main() {
  const { db, close } = connect();
  console.log(`Migrating ${DATABASE_URL.replace(/:\/\/[^@]+@/, "://***@")} …`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
