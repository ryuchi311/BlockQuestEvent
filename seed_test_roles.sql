-- ==============================================================================
-- BLOCKQUEST FIESTA PH: COMPLETE RBAC TEST ACCOUNTS SEED SCRIPT
-- ==============================================================================
-- Run this in your Supabase SQL Editor to seed dummy accounts for all roles.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.admin_users (email, password_hash, full_name, role)
VALUES
  ('superadmin@blockquest.ph', '9588f1e301d3a3bdb2d77842529725c7:5cbdd834a9b8a0bb62ebbef5ebd07e8620cf765ba3557ec53189c40c6b29add810cb2185d7daa250c06fd7900405cbb036e59f1403aed4db7af33658daeb8dd7', 'Super Administrator', 'superadmin'), -- Password: superadmin2026
  ('manager@blockquest.ph', 'bd0e70c1f2f36c5414a5d7ba9e2c9e23:09fa13dfb328f7a718fd81e13767838a85368788c2baf356a9c296c193582e04cc1f90add5b5c9425de23d0a3f042c5c375fa17f01a0baf0f599975df58eb701', 'Operations Manager', 'admin'), -- Password: manager2026
  ('gate@blockquest.ph', 'd88b46fe07f5c818754368b1efadeb3c:8c751ffb2fffd643e16cc8fc4fd9ed9665520c76d33c41c727a5c466097e129a8967a23e59e8005641c7a051e949253a532a5756746e830a7aa2d3330181b586', 'Gate Staff Lead', 'manage_attendees'), -- Password: gate2026
  ('verifier@blockquest.ph', '69555ff532caf1eaaa64b7d6b62886c6:0a4e18f26154640d78a9f306ae0c5825be9cd3b8c684f51f2df593d2c7bd2215d8c70b9a94d628d2fb900ec783922acd26649b90d0e3a1116be6e5fe0fe28183', 'Quest Verifier Lead', 'verifier'), -- Password: verifier2026
  ('viewer@blockquest.ph', '6af1bd0e718da8ccd58db4cb8f1bef5b:3ea4133d52f847cd915e639a4757fc1679cb5f8d97a8db05f18d7579523394e3378c6cdfcd30053ae15b7aa1bcab003cdb95d8a9c902787857616be2e43f8774', 'Sponsor Observer', 'viewer'), -- Password: viewer2026
  ('booth.polygon@blockquest.ph', 'c27d35b9cfaa802e83cfcbd4133a5410:54dec89ae1435e35404fe9520b1751194c6b279f2be25ee2c159af5b4a15fb4f5c70e06e94bdc1a2dc39b3cb0b6e0dfaa5173c526979e0fb17ee0b05e1d88f75', 'Polygon Guild Booth', 'booth_staff'), -- Password: polygon2026
  ('booth.solana@blockquest.ph', '912d494502374c305628feb7b241268f:b3d67c71efe9f5b4a23eb42da412e9988245f0ff8fb53cc7ca2f740dfbf90db2d087d9d7d1aa7987466a73a44ab0c70682c315cbb316a6bdaebd95df9fd6caa8', 'Solana Superteam PH', 'booth_staff'), -- Password: solana2026
  ('booth.binance@blockquest.ph', 'a6c1ef463b2664de9897633f6d64bb3e:ec93cc78796085eaeaf216b9b019e2e485bcdfd15ef4170e1446ed270ec4dfd5fd7dc8ccd91f261152c3dc4c0a3a1410c00bf25b6f44fbe59366a24884ece561', 'Binance Academy Booth', 'booth_staff') -- Password: binance2026
ON CONFLICT (email) DO UPDATE 
SET 
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

GRANT ALL ON TABLE public.admin_users TO postgres, service_role;
