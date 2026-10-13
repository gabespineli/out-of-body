import { spawnSync } from "node:child_process";
import path from "node:path";
const docker = (...args) => spawnSync("docker", args, { encoding: "utf8" });
if (docker("info", "--format", "{{.ServerVersion}}").status !== 0) throw new Error("Open Docker Desktop and wait until its engine is running, then retry.");
if (docker("network", "inspect", "oob-local-network").status !== 0) {
  const created = docker("network", "create", "--driver", "bridge", "--opt", "com.docker.network.bridge.host_binding_ipv4=127.0.0.1", "oob-local-network");
  if (created.status !== 0) throw new Error("The dedicated local Docker network could not be created.");
}
const result = spawnSync(process.execPath, [path.resolve("node_modules/supabase/dist/supabase.js"), "start", "--network-id", "oob-local-network",
  "-x", "imgproxy,logflare,vector,realtime,mailpit,edge-runtime,supavisor"], { stdio: "inherit" });
process.exit(result.status ?? 1);
