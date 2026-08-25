import { Client } from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
let connectionString = "";
env.split('\n').forEach(line => {
  if (line.startsWith("Supabase_Direct=")) connectionString = line.split("=").slice(1).join("=").trim();
});

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to DB, running migration...");
    
    // Add user_email column if missing so live production API calls succeed
    await client.query(`ALTER TABLE public.quest_completions ADD COLUMN IF NOT EXISTS user_email TEXT;`);
    
    // Reload PostgREST schema cache
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    
    console.log("Migration successful & schema cache reloaded!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

run();
