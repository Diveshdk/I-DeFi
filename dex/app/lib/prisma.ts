import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

// Use SQLite for launchpad; ignore Postgres URL so app works without a running DB.
const dbUrl = process.env.DATABASE_URL?.startsWith("file:")
  ? process.env.DATABASE_URL
  : "file:./prisma/dev.db";
const dbPath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;
const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

const adapter = new PrismaBetterSqlite3({ url: absolutePath });
const prisma = new PrismaClient({ adapter });

export default prisma;
