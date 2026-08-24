import { Client } from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
let connectionString = "";
env.split('\n').forEach(line => {
  if (line.startsWith("Supabase_Direct=")) connectionString = line.split("=").slice(1).join("=").trim();
});

const regex = /(postgresql:\/\/[^:]+:)([^@]+)(@.+)/;
const match = connectionString.match(regex);
if (match) {
  const pwd = match[2];
  connectionString = match[1] + encodeURIComponent(pwd) + match[3];
}

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to DB, running migration...");
    
    await client.query(`ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS promo_code TEXT;`);
    
    console.log("Migration successful.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

run();
