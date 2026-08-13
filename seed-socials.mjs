import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Service Role Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Seeding social missions...");
  const missions = [
    { platform: "facebook", title: "Facebook Page", description: "Follow BRGY Tamago", url: "https://www.facebook.com/BRGYTamago", button_text: "Follow FB →", button_color: "#1877f2", sort_order: 1 },
    { platform: "telegram", title: "Telegram Channel", description: "Follow BlockQuest", url: "https://t.me/block_quest", button_text: "Join TG →", button_color: "#24A1DE", sort_order: 2 },
    { platform: "telegram", title: "Telegram Group", description: "Join BlockQuest Group", url: "https://t.me/+YG918_es6Es0Mjc1", button_text: "Join TG →", button_color: "#24A1DE", sort_order: 3 },
    { platform: "twitter", title: "X (Twitter)", description: "Follow @BRGYTamago", url: "https://x.com/BRGYTamago", button_text: "Follow X →", button_color: "#000000", sort_order: 4 },
  ];

  for (const m of missions) {
    const { error } = await supabase.from("social_missions").insert(m);
    if (error) {
      console.error(`Error inserting ${m.title}:`, error);
    } else {
      console.log(`Inserted ${m.title}`);
    }
  }
  console.log("Done seeding.");
}

seed();
