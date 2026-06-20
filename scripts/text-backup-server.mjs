import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";

const port = Number(process.env.PORT || 8787);
const backupDir = path.resolve("backups", "text");

const safeName = (value) => String(value || "user").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);

const readBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

const send = (response, status, data) => {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(data));
};

const sendText = (response, status, text, contentType = "text/plain; charset=utf-8") => {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
    "Content-Type": contentType
  });
  response.end(text);
};

const archivePath = (name) => {
  const base = path.basename(String(name || ""));
  if (!base || base !== name || !base.endsWith(".json")) {
    throw new Error("Invalid archive name");
  }
  return path.join(backupDir, base);
};

const loadArchive = async (name) => JSON.parse(await readFile(archivePath(name), "utf8"));

const listArchives = async () => {
  await mkdir(backupDir, { recursive: true });
  const files = (await readdir(backupDir)).filter((name) => name.endsWith(".json")).sort().reverse();
  const summaries = [];
  for (const file of files) {
    try {
      const archive = await loadArchive(file);
      const info = await stat(archivePath(file));
      summaries.push({
        file,
        owner: archive.owner,
        exportedAt: archive.exportedAt,
        characters: archive.characters?.length || 0,
        conversations: archive.conversations?.length || 0,
        messages: archive.messages?.length || 0,
        bytes: info.size,
        api: {
          json: `/archives/${encodeURIComponent(file)}`,
          transcript: `/archives/${encodeURIComponent(file)}/transcript`
        }
      });
    } catch {
      summaries.push({ file, error: "Unable to read archive" });
    }
  }
  return summaries;
};

const transcriptFromArchive = (archive) => {
  const characters = new Map((archive.characters || []).map((item) => [item.id, item]));
  const conversations = new Map((archive.conversations || []).map((item) => [item.id, item]));
  const groups = new Map();
  for (const message of archive.messages || []) {
    const list = groups.get(message.conversationId) || [];
    list.push(message);
    groups.set(message.conversationId, list);
  }

  const lines = [
    `Owner: ${archive.owner?.displayName || archive.owner?.id || "unknown"}`,
    `ExportedAt: ${archive.exportedAt || ""}`,
    `Messages: ${(archive.messages || []).length}`,
    ""
  ];

  for (const [conversationId, messages] of groups.entries()) {
    const conversation = conversations.get(conversationId);
    const character = conversation ? characters.get(conversation.characterId) : undefined;
    lines.push(`## ${conversation?.title || conversationId}`);
    if (character) lines.push(`AI: ${character.remarkName || character.displayName} / ${character.roleType || ""}`);
    for (const message of messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
      const speaker =
        message.senderType === "user"
          ? archive.owner?.displayName || "用户"
          : characters.get(message.senderCharacterId)?.remarkName || "AI";
      lines.push(`[${message.createdAt}] ${speaker}: ${message.content}`);
    }
    lines.push("");
  }
  return lines.join("\n");
};

const viewerHtml = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>微聊文字档案</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;margin:0;background:#f4f5f2;color:#111}
header{padding:16px 18px;background:#ededed;border-bottom:1px solid #ddd;font-weight:700}
main{display:grid;grid-template-columns:320px 1fr;min-height:calc(100vh - 54px)}
aside{border-right:1px solid #ddd;background:#fff;overflow:auto}
button{display:block;width:100%;padding:12px 14px;border:0;border-bottom:1px solid #eee;background:#fff;text-align:left;cursor:pointer}
button:hover{background:#f5f7f4}
pre{white-space:pre-wrap;margin:0;padding:18px;line-height:1.55}
.meta{font-size:12px;color:#777;margin-top:4px}
@media(max-width:720px){main{grid-template-columns:1fr}aside{max-height:38vh;border-right:0;border-bottom:1px solid #ddd}}
</style>
<header>微聊文字档案</header>
<main><aside id="list"></aside><pre id="content">加载中...</pre></main>
<script>
async function loadList(){
  const list=await fetch('/archives').then(r=>r.json());
  const box=document.getElementById('list');
  box.innerHTML='';
  if(!list.archives.length){document.getElementById('content').textContent='还没有档案。手机发送后会出现在这里。';return;}
  for(const item of list.archives){
    const btn=document.createElement('button');
    btn.innerHTML='<b>'+(item.owner?.displayName||item.file)+'</b><div class="meta">'+item.exportedAt+' · '+item.messages+' 条</div>';
    btn.onclick=async()=>{document.getElementById('content').textContent=await fetch(item.api.transcript).then(r=>r.text())};
    box.appendChild(btn);
  }
  box.firstChild.click();
}
loadList().catch(err=>document.getElementById('content').textContent=String(err));
</script>`;

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "OPTIONS") {
    send(response, 204, {});
    return;
  }

  if (request.method === "GET") {
    if (url.pathname === "/" || url.pathname === "/status") {
      send(response, 200, {
        ok: true,
        endpoint: "/upload",
        backupDir,
        api: {
          list: "/archives",
          viewer: "/viewer"
        }
      });
      return;
    }
    if (url.pathname === "/viewer") {
      sendText(response, 200, viewerHtml, "text/html; charset=utf-8");
      return;
    }
    if (url.pathname === "/archives") {
      send(response, 200, { ok: true, archives: await listArchives() });
      return;
    }
    const archiveMatch = url.pathname.match(/^\/archives\/([^/]+)(?:\/(transcript))?$/);
    if (archiveMatch) {
      const file = decodeURIComponent(archiveMatch[1]);
      const archive = await loadArchive(file);
      if (archiveMatch[2] === "transcript") {
        sendText(response, 200, transcriptFromArchive(archive));
      } else {
        send(response, 200, archive);
      }
      return;
    }
    send(response, 404, { ok: false, error: "Not found" });
    return;
  }

  if (request.method !== "POST" || request.url !== "/upload") {
    send(response, 404, { ok: false, error: "Use POST /upload" });
    return;
  }

  try {
    const body = await readBody(request);
    const archive = JSON.parse(body);
    if (archive.archiveVersion !== 1 || !Array.isArray(archive.messages)) {
      send(response, 400, { ok: false, error: "Invalid text archive" });
      return;
    }

    await mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const owner = safeName(archive.owner?.displayName || archive.owner?.id);
    const filePath = path.join(backupDir, `${owner}-${stamp}.json`);
    await writeFile(filePath, JSON.stringify(archive, null, 2), "utf8");
    send(response, 200, { ok: true, path: filePath, messages: archive.messages.length });
  } catch (error) {
    send(response, 500, { ok: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const item of entries || []) {
      if (item.family === "IPv4" && !item.internal) {
        addresses.push(`http://${item.address}:${port}`);
      }
    }
  }
  console.log(`Text backup server is running.`);
  console.log(`Backup folder: ${backupDir}`);
  console.log(`Use one of these upload endpoints on your phone:`);
  for (const address of addresses) console.log(`  ${address}/upload`);
  console.log(`Open viewer in your browser:`);
  for (const address of addresses) console.log(`  ${address}/viewer`);
});
