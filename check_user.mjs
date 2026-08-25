import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
let url = "";
let key = "";
env.split('\n').forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) url = line.split("=").slice(1).join("=").trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) key = line.split("=").slice(1).join("=").trim();
});

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("email", "ryuchicago@gmail.com")
    .maybeSingle();
    
  console.log("User Data:", data);
  console.log("Error:", error);
  
  if (data) {
    const { data: comp } = await supabase
      .from("quest_completions")
      .select("*")
      .eq("registration_id", data.id);
    console.log("Completions:", comp);
  }
}

run();
