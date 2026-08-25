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
  // Remove invalid promo completion for user 98
  const { data, error } = await supabase
    .from("quest_completions")
    .delete()
    .eq("id", 622);
    
  console.log("Cleanup result:", data, error);
}

run();
