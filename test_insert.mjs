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
    .from("quest_completions")
    .insert({
      quest_id: "test",
      registration_id: 1,
      // user_email: "test@example.com", // omitting this to see if it succeeds
      xp_awarded: 10
    })
    .select();
    
  console.log("Error:", error);
  console.log("Data:", data);
}

run();
