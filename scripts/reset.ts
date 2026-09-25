import { connect } from "./_db";

/** Drops every application table (keeps PostGIS). Development only. */
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset in production");
  const { sql, close } = connect();
  await sql.unsafe(
    `DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;`,
  );
  console.log("Database reset.");
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
