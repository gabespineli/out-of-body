import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("out");
const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".wasm": "application/wasm", ".task": "application/octet-stream", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
http.createServer((request, response) => {
  let relative;
  try { relative = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname).replace(/^\/+/, ""); }
  catch { response.writeHead(400); response.end(); return; }
  let filename = path.resolve(root, relative || "index.html");
  if (!filename.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, "index.html");
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) { response.writeHead(404); response.end("Not found"); return; }
  response.writeHead(200, { "Content-Type": types[path.extname(filename)] ?? "application/octet-stream", "Permissions-Policy": "camera=(self), microphone=()", "X-Content-Type-Options": "nosniff" });
  if (request.method === "HEAD") response.end(); else fs.createReadStream(filename).pipe(response);
}).listen(3201, "127.0.0.1", () => console.log("Local: http://127.0.0.1:3201/"));
