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
  agreed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticket_code TEXT UNIQUE
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
  sort_order INTEGER NOT NULL DEFAULT 99,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

