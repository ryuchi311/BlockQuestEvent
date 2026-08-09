import { randomBytes, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const env = fs.readFileSync(".env.local", "utf8");
let supabaseUrl = "";
let supabaseKey = "";
env.split('\n').forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) supabaseUrl = line.split("=")[1].trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) supabaseKey = line.split("=")[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

async function run() {
  const email = "admin@blockquest.com";
  const password = "blockquest2026";
  const hashed = hashPassword(password);
  
  console.log("Seeding superadmin: " + email);

  const { data, error } = await supabase.from("admin_users").insert({
    email,
    password_hash: hashed,
    full_name: "Super Admin",
    role: "superadmin"
  });
  
  if (error) {
    if (error.code === '23505') {
       console.log("Admin already exists!");
    } else {
       console.error("Error inserting:", error);
    }
  } else {
    console.log("Admin seeded successfully! You can now log in with the new credentials.");
  }
}

run();
