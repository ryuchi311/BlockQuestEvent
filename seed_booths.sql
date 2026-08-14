-- ==============================================================================
-- BLOCKQUEST FIESTA PH: BOOTH / VENDOR ACCOUNTS SEED SCRIPT
-- ==============================================================================
-- Run this in your Supabase Project -> SQL Editor to create dedicated booth
-- login accounts with pre-hashed passwords using Node.js scryptSync (16-byte salt, 64-byte key).
--
-- After running, booth staff can log in with their assigned email & password.
-- ==============================================================================

-- 1. Ensure admin_users table exists
CREATE TABLE IF NOT EXISTS public.admin_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'booth_staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert or update dedicated booth staff accounts
INSERT INTO public.admin_users (email, password_hash, full_name, role)
VALUES
  -- Booth 1: Polygon Guild (Password: polygon2026)
  ('booth.polygon@blockquest.ph', '91c7b76f8b8a3ff4138dea95b16f5311:e12ee5e70607191ea4029c86e7d42c426495652238dc339ff9399468ea38638c683a12172a4813262e19303fc99974b64a695e959625a56a8adccf17ea984711', 'Polygon Guild Booth', 'booth_staff'),

  -- Booth 2: Solana Superteam (Password: solana2026)
  ('booth.solana@blockquest.ph', 'd94c4ea91bbbdb0e5843579711117c07:b1fbaa543486e96a77991a5be9393cce24e7967b2716d1c7a33f8a1104c1f637c052b09329ab8d8347131ed963332659f4a1247264f29e5e40aecdf4cea4cf4d', 'Solana Superteam PH', 'booth_staff'),

  -- Booth 3: Binance Academy (Password: binance2026)
  ('booth.binance@blockquest.ph', '707cc0040ead4ab9ed9c333dda4113d9:51b2087a1f120dd7f9ea7b7053c155ced383ded5adb433a9b84eff6fbbc6606a900235d71b0b9135f54a4a6a79693e9673e898096c3378dd87273e00c2959fce', 'Binance Academy Booth', 'booth_staff'),

  -- Booth 4: Base Ecosystem (Password: base2026)
  ('booth.base@blockquest.ph', 'fa9a7f7af3d7184a14d31a1980bd191d:6fafdf08fe999fa251b0c4406df76c1ad200db0e7174075fec24ef90219bac2943730e75502e85060295be36e150e187dac4fdcc83bdfa0e2416bc9111189223', 'Base Ecosystem Hub', 'booth_staff'),

  -- Booth 5: Trezor / Ledger Hardware (Password: trezor2026)
  ('booth.trezor@blockquest.ph', '143aa591cec07bd153a04e94e2755af4:08cd1c07ca709eb117ead736348f22ffd578e91e81aad638627eec71a950b25e12a34b4045f414f580223f00c99a772f2c7b165876f1feecafd38ababc299fac', 'Trezor & Ledger Hardware', 'booth_staff'),

  -- Booth 6: Web3 Gaming Arena (Password: gaming2026)
  ('booth.gaming@blockquest.ph', '75861ef9ec27537704410861bd0b1ea2:6414468039d66749f630546cae5a74906ec34829d4a5ccec99e7b1e54ee04d76777e08851b278b27f31568207cc6ddc905794d2ca73cb4eae450efce8893e0ca', 'Web3 Gaming Arena', 'booth_staff'),

  -- Booth 7: BRGY Tamago Lounge (Password: tamago2026)
  ('booth.tamago@blockquest.ph', 'ac6fb0c0091b1351f955fbde5a3e6d89:c5b66d40fedac6a2ffb8520da387b53f87e5b08bec2152574727efa5dac2ff9da790e407cea421b25f9640e553a8ae5a3300fdbfbd4e29b9c7bbbf07ea7a453e', 'BRGY Tamago Lounge', 'booth_staff')
ON CONFLICT (email) DO UPDATE 
SET 
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- Grant permissions so the backend service_role key can read/write
GRANT ALL ON TABLE public.admin_users TO postgres, service_role;
