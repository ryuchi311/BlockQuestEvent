-- BlockQuest Fiesta PH registration schema
-- Passwords should be stored as hashes from the backend, never as plain text.

CREATE TABLE IF NOT EXISTS public.registrations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  organization TEXT,
  password_hash TEXT NOT NULL,
  agreed_to_terms BOOLEAN NOT NULL DEFAULT FALSE,
  agreed_to_data_gathering BOOLEAN NOT NULL DEFAULT FALSE,
  agreed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticket_code TEXT UNIQUE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  pincode TEXT
);

CREATE INDEX IF NOT EXISTS registrations_created_at_idx
  ON public.registrations (created_at DESC);

-- Trigger function to automatically generate random unique ticket_code (e.g. BQF-X79K2M) before insert
CREATE OR REPLACE FUNCTION set_ticket_code()
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT;
  i INTEGER;
  done BOOLEAN := false;
BEGIN
  WHILE NOT done LOOP
    result := 'BQF-';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Ensure the ticket code is unique
    IF NOT EXISTS (SELECT 1 FROM public.registrations WHERE ticket_code = result) THEN
      done := true;
    END IF;
  END LOOP;
  
  NEW.ticket_code := result;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_set_ticket_code
BEFORE INSERT ON public.registrations
FOR EACH ROW
EXECUTE FUNCTION set_ticket_code();

-- Fiesta Event Quests table
CREATE TABLE IF NOT EXISTS public.fiesta_event_quests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  xp INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'Soon',
  category TEXT NOT NULL DEFAULT 'onboarding',
  action_label TEXT,
  action_url TEXT,
  requires_proof BOOLEAN NOT NULL DEFAULT FALSE,
  is_quiz BOOLEAN NOT NULL DEFAULT FALSE,
  quiz_answer TEXT,
  quiz_options JSONB,
  correct_option_index INTEGER,
  passcode TEXT,
  expires_at TIMESTAMPTZ,
  depends_on_quest_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 99,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration statements for newly added quest attributes
ALTER TABLE public.fiesta_event_quests ADD COLUMN IF NOT EXISTS quiz_options JSONB;
ALTER TABLE public.fiesta_event_quests ADD COLUMN IF NOT EXISTS correct_option_index INTEGER;
ALTER TABLE public.fiesta_event_quests ADD COLUMN IF NOT EXISTS passcode TEXT;
ALTER TABLE public.fiesta_event_quests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.fiesta_event_quests ADD COLUMN IF NOT EXISTS depends_on_quest_id TEXT;
ALTER TABLE public.fiesta_event_quests ADD COLUMN IF NOT EXISTS requires_message BOOLEAN DEFAULT FALSE;

-- Quest Verifications table for user proof submissions & admin review
CREATE TABLE IF NOT EXISTS public.quest_verifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quest_id TEXT NOT NULL,
  quest_title TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  ticket_code TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  proof_url TEXT NOT NULL,
  proof_hash TEXT,
  user_message TEXT,
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin Users table for RBAC dashboard access
CREATE TABLE IF NOT EXISTS public.admin_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer', -- 'superadmin', 'admin', 'verifier', 'manage_attendees', 'viewer'
  requires_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grant privileges so the service_role key can read/insert/update tables
GRANT ALL ON TABLE public.admin_users TO postgres, service_role;
GRANT ALL ON TABLE public.quest_verifications TO postgres, service_role, anon, authenticated;

-- Optional migration statement if table was created in an earlier version:
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional migration statement if table was created in an earlier version:
ALTER TABLE public.quest_verifications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.quest_verifications ADD COLUMN IF NOT EXISTS user_message TEXT;
ALTER TABLE public.quest_verifications ADD COLUMN IF NOT EXISTS proof_hash TEXT;


-- Quest Completions table to track claimed XP
CREATE TABLE IF NOT EXISTS public.quest_completions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quest_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(quest_id, user_email)
);

GRANT ALL ON TABLE public.quest_completions TO postgres, service_role, anon, authenticated;

-- Social Missions table for Registration form
CREATE TABLE IF NOT EXISTS public.social_missions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  button_text TEXT NOT NULL,
  button_color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON TABLE public.social_missions TO postgres, service_role, anon, authenticated;

-- Quest Message Notes table for attendee Messagebox submissions & admin review
CREATE TABLE IF NOT EXISTS public.quest_message_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quest_id TEXT NOT NULL,
  quest_title TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  ticket_code TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  user_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON TABLE public.quest_message_notes TO postgres, service_role, anon, authenticated;

