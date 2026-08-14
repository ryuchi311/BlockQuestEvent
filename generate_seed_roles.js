const crypto = require('crypto');

const roles = [
  { role: 'superadmin', name: 'Super Administrator', email: 'superadmin@blockquest.ph', pass: 'superadmin2026' },
  { role: 'admin', name: 'Operations Manager', email: 'manager@blockquest.ph', pass: 'manager2026' },
  { role: 'manage_attendees', name: 'Gate Staff Lead', email: 'gate@blockquest.ph', pass: 'gate2026' },
  { role: 'verifier', name: 'Quest Verifier Lead', email: 'verifier@blockquest.ph', pass: 'verifier2026' },
  { role: 'viewer', name: 'Sponsor Observer', email: 'viewer@blockquest.ph', pass: 'viewer2026' },
  { role: 'booth_staff', name: 'Polygon Guild Booth', email: 'booth.polygon@blockquest.ph', pass: 'polygon2026' },
  { role: 'booth_staff', name: 'Solana Superteam PH', email: 'booth.solana@blockquest.ph', pass: 'solana2026' },
  { role: 'booth_staff', name: 'Binance Academy Booth', email: 'booth.binance@blockquest.ph', pass: 'binance2026' }
];

let sql = `-- ==============================================================================
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
VALUES\n`;

const lines = roles.map((r, i) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(r.pass, salt, 64).toString('hex');
  const isLast = i === roles.length - 1;
  return `  ('${r.email}', '${salt}:${hash}', '${r.name}', '${r.role}')${isLast ? '' : ','} -- Password: ${r.pass}`;
});

sql += lines.join('\n');
sql += `\nON CONFLICT (email) DO UPDATE 
SET 
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

GRANT ALL ON TABLE public.admin_users TO postgres, service_role;
`;

const fs = require('fs');
fs.writeFileSync('seed_test_roles.sql', sql);
console.log('Successfully generated seed_test_roles.sql');
