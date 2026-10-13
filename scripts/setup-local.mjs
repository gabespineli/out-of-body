import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import path from "node:path";
const cli = path.resolve("node_modules/supabase/dist/supabase.js");
const status = spawnSync(process.execPath, [cli, "status", "--output", "json"], { encoding: "utf8" });
if (status.status !== 0) throw new Error("Start the dedicated local Supabase instance first: npm run backend:start");
let info;
try { info = JSON.parse(status.stdout); } catch { throw new Error("Local Supabase status could not be read."); }
let existing = {};
try { existing = parseEnv(await readFile(".env.local", "utf8")); } catch {}
if (existing.SUPABASE_URL && existing.SUPABASE_URL !== info.API_URL) throw new Error("Existing .env.local points elsewhere. Use a separate local environment; it was not overwritten.");
const key = () => randomBytes(32).toString("hex");
const settings = { SUPABASE_URL: info.API_URL, SUPABASE_SECRET_KEY: info.SECRET_KEY || info.SERVICE_ROLE_KEY,
  OOB_INSTALLATION_KEY: existing.OOB_INSTALLATION_KEY || key(), OOB_CLEANUP_SECRET: existing.OOB_CLEANUP_SECRET || key(),
  OOB_LOCAL_ANON_KEY: info.PUBLISHABLE_KEY || info.ANON_KEY };
if (!settings.SUPABASE_URL || !settings.SUPABASE_SECRET_KEY) throw new Error("Local Supabase credentials are incomplete.");
if (settings.SUPABASE_URL !== "http://127.0.0.1:55321") throw new Error("This helper only configures the dedicated Out of Body local backend.");
const port = process.env.OOB_LOCAL_APP_PORT || "3000";
if (!/^\d{4,5}$/.test(port) || +port > 65535) throw new Error("The local app port is invalid.");
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const vault = (name, value) => `do $$ declare existing_id uuid; begin
  select id into existing_id from vault.decrypted_secrets where name = ${quote(name)} limit 1;
  if existing_id is null then perform vault.create_secret(${quote(value)}, ${quote(name)});
  else perform vault.update_secret(existing_id, ${quote(value)}); end if; end $$;`;
const cron = await readFile("supabase/setup-cleanup.sql", "utf8");
const sql = vault("oob_cleanup_url", `http://host.docker.internal:${port}/api/participant/cleanup`)
  + vault("oob_cleanup_secret", settings.OOB_CLEANUP_SECRET) + cron;
const scheduled = spawnSync("docker", ["exec", "-i", "supabase_db_out-of-body-participant-mvp", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
if (scheduled.status !== 0) throw new Error("Local automatic cleanup could not be configured. Check the dedicated database's Vault/pg_cron support.");
await writeFile(".env.local", Object.entries(settings).map(([name, value]) => `${name}=${value}`).join("\n") + "\n");
console.log(`Configured .env.local and minute-by-minute temporary-file cleanup for the local app on port ${port}. Keys were not printed. Restart Next.js after environment changes.`);
