import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations-mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "mysql://root:Ayush@localhost:3306/cdms",
  },
});
