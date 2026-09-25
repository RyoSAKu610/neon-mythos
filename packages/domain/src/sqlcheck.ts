import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { newDb } from "pg-mem";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = [
  "supabase/migrations/001_economy_core.sql",
  "supabase/migrations/002_mission_compat.sql",
  // 003 needs auth schema + authenticated role: stub them first.
  "supabase/migrations/003_rls.sql",
  "supabase/migrations/004_hardening.sql",
];

const db = newDb();
db.public.none(`create schema if not exists auth;`);
db.public.none(`create table if not exists auth.users (id uuid primary key);`);
db.public.none(`do $$ begin create role authenticated; exception when duplicate_object then null; end $$;`);

let ok = 0;
for (const f of files) {
  const sql = readFileSync(join(root, f), "utf8");
  try {
    db.public.none(sql);
    console.log(`APPLIED ${f}`);
    ok++;
  } catch (e) {
    console.error(`FAILED ${f}:`, (e as Error).message.split("\n").slice(0, 6).join("\n"));
    process.exitCode = 1;
  }
}

// Idempotency: re-apply 002 tail inserts + 004 (on conflict paths).
try {
  db.public.none(readFileSync(join(root, files[1]), "utf8"));
  db.public.none(readFileSync(join(root, files[3]), "utf8"));
  console.log("RE-APPLY idempotent OK");
} catch (e) {
  console.error("RE-APPLY FAILED:", (e as Error).message.split("\n").slice(0, 6).join("\n"));
  process.exitCode = 1;
}

// Spot checks.
try {
  const worlds = db.public.many(`select id from worlds order by 1`);
  console.log("worlds:", JSON.stringify(worlds));
  const caps = db.public.many(`select id from capabilities order by 1`);
  console.log("capabilities:", caps.length);
  // Constraint checks: bad mission status must fail.
  try {
    db.public.none(`insert into missions(title, question, status) values ('t','q','bogus')`);
    console.error("CHECK FAILED: bogus mission status accepted");
    process.exitCode = 1;
  } catch {
    console.log("CHECK mission status enforced OK");
  }
  try {
    db.public.none(`insert into ledger_entries(world_id, from_principal_id, to_principal_id, amount_credits) values ('production','00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000', 10)`);
    console.error("CHECK FAILED: self-transfer accepted");
    process.exitCode = 1;
  } catch {
    console.log("CHECK ledger self-transfer rejected OK");
  }
} catch (e) {
  console.error("SPOT CHECK FAILED:", (e as Error).message);
  process.exitCode = 1;
}
console.log(`migrations applied: ${ok}/${files.length}`);
