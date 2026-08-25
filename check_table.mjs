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
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quest_completions';
    `);
    console.log("Columns:", res.rows.map(r => r.column_name));
    
    // Reload schema just in case
    await client.query(`NOTIFY pgrst, 'reload schema'`);
    console.log("Schema cache reloaded!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

run();
