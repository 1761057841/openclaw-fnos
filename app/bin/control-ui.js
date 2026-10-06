const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const managementPrefix = process.env.OPENCLAW_MANAGEMENT_PREFIX || '';
const socketPath = process.env.OPENCLAW_MANAGEMENT_SOCKET || '';
const appData = process.env.OPENCLAW_APP_DATA || '/vol1/@apphome/openclaw/data';
const prefix = process.env.OPENCLAW_PREFIX || path.join(appData, 'openclaw');
const logFile = process.env.OPENCLAW_LOG_FILE || path.join(process.env.TRIM_PKGVAR || appData, 'openclaw.log');
const runtimeDir = path.join(appData, 'runtime');
const tokenFile = path.join(runtimeDir, 'gateway.token');
const gatewayPidFile = process.env.OPENCLAW_GATEWAY_PID_FILE || path.join(runtimeDir, 'gateway.pid');
const appBin = process.env.OPENCLAW_APP_BIN || __dirname;
const configPath = process.env.OPENCLAW_CONFIG_PATH || path.join(appData, 'openclaw', '.openclaw', 'openclaw.json');
const backupDir = path.join(runtimeDir, 'config-backups');
const clientScriptPath = path.join(__dirname, 'control-ui-client.js');
let actionBusy = false;

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenClaw 管理</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#19232d;background:#eef2f5;--line:#d9e0e6;--muted:#697682;--blue:#1769aa;--green:#138a5b;--red:#c43d3d}
*{box-sizing:border-box}body{margin:0}.top{height:64px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 24px;gap:14px}.mark{width:34px;height:34px;border-radius:8px;background:#1769aa;color:#fff;display:grid;place-items:center;font-weight:800}.brand{font-weight:700;font-size:18px}.sub{color:var(--muted);font-size:13px}.layout{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 64px)}aside{background:#f8fafb;border-right:1px solid var(--line);padding:18px 12px}button,.nav{font:inherit}.nav{display:block;width:100%;border:0;background:transparent;text-align:left;padding:11px 12px;border-radius:6px;color:#42515c;cursor:pointer;margin-bottom:4px}.nav.active,.nav:hover{background:#e5eff7;color:#115d95;font-weight:600}.content{padding:24px;max-width:1180px;width:100%}.view{display:none}.view.active{display:block}h1{font-size:24px;margin:0 0 5px}h2{font-size:16px;margin:0 0 14px}.desc{color:var(--muted);margin:0 0 22px;font-size:14px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}.card{background:#fff;border:1px solid var(--line);border-radius:7px;padding:16px;min-height:100px}.label{font-size:12px;color:var(--muted);margin-bottom:10px}.value{font-size:20px;font-weight:700;overflow-wrap:anywhere}.ok{color:var(--green)}.bad{color:var(--red)}.section{background:#fff;border:1px solid var(--line);border-radius:7px;padding:18px;margin-bottom:16px}.rows{display:grid;grid-template-columns:180px 1fr;gap:10px;font-size:14px}.rows div:nth-child(odd){color:var(--muted)}.toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px}button.action{border:1px solid #b9c8d3;background:#fff;border-radius:5px;padding:8px 12px;cursor:pointer;color:#234}.action.primary{background:#1769aa;border-color:#1769aa;color:#fff}.action:disabled{cursor:not-allowed;opacity:.55;filter:grayscale(1)}.log{height:430px;overflow:auto;background:#111a21;color:#c8d5dc;border-radius:5px;padding:14px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}.terminal-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:5px}.terminal-heading h1{margin:0}.terminal-heading-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}.terminal{background:#111a21;border-radius:6px;padding:14px}.terminal-output{height:370px;overflow:auto;color:#d5e1e6;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}.prompt{display:flex;gap:8px;margin-top:12px}.prompt span{color:#76c7a0;padding:10px 0;font-family:monospace}.prompt input{flex:1;background:#1c2932;border:1px solid #40515d;color:#fff;border-radius:4px;padding:10px;font:13px monospace}.hint{color:#9aabb5;font-size:12px;margin-top:10px}.pill{display:inline-block;border-radius:99px;padding:4px 8px;font-size:12px;background:#e8f5ee;color:var(--green)}@media(max-width:800px){.layout{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line);display:flex;gap:6px;padding:8px}.nav{margin:0}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.content{padding:16px}.rows{grid-template-columns:120px 1fr}}
</style></head>
<body><header class="top"><div class="mark">OC</div><div><div class="brand">OpenClaw</div><div class="sub">fnOS 管理中心</div></div></header>
<div class="layout"><aside><button class="nav active" data-view="overview">概览</button><button class="nav" data-view="status">状态</button><button class="nav" data-view="tools">工具</button><button class="nav" data-view="diagnostics">诊断</button><button class="nav" data-view="config">配置</button><button class="nav" data-view="logs">运行日志</button><button class="nav" data-view="terminal">OpenClaw 终端</button></aside>
<main class="content"><section id="overview" class="view active"><h1>概览</h1><p class="desc">查看 OpenClaw Gateway 和应用运行时状态。</p><div class="actions"><button class="action primary" data-action="start">启动 Gateway</button><button class="action" data-action="restart">重启 Gateway</button><button class="action" data-action="stop">停止 Gateway</button><button class="action" data-action="update-node">检查并更新 Node</button><button class="action" data-action="install-gh">安装 GitHub CLI</button><span id="actionStatus" class="sub" role="status" aria-live="polite"></span></div><div class="grid"><div class="card"><div class="label">Gateway</div><div id="gateway" class="value">检查中</div></div><div class="card"><div class="label">OpenClaw 版本</div><div id="ocver" class="value">-</div></div><div class="card"><div class="label">Node 版本</div><div id="nodever" class="value">-</div></div><div class="card"><div class="label">监听端口</div><div id="port" class="value">-</div></div></div><div class="section"><h2>运行信息</h2><div class="rows"><div>应用数据</div><div id="data">-</div><div>运行用户</div><div id="user">-</div><div>最后检查</div><div id="checked">-</div></div></div></section>
<section id="status" class="view"><h1>运行状态</h1><p class="desc">查看 Gateway、GitHub CLI、渠道和模型 Provider 的可用状态。</p><div class="section"><div id="statusRows" class="rows">加载中...</div></div><div class="section"><h2>资源使用</h2><div id="resourceRows" class="rows">加载中...</div></div></section>
<section id="tools" class="view"><h1>第三方工具</h1><p class="desc">查看应用私有目录中已安装的第三方工具。OpenClaw CLI、Node.js 和运行时不在此列表中。</p><div class="section"><div id="toolRows" class="rows">加载中...</div></div></section>
<section id="diagnostics" class="view"><h1>诊断中心</h1><p class="desc">检查运行环境、配置、权限、Socket 和 Gateway。</p><div class="toolbar"><button class="action primary" id="runDiagnostics">运行诊断</button><button class="action" id="copyDiagnostics">复制报告</button></div><div class="section"><div id="diagnosticRows" class="rows">尚未运行诊断。</div></div></section>
<section id="config" class="view"><h1>配置与备份</h1><p class="desc">修改受支持的基础配置，保存前会自动备份。</p><div class="section"><div class="rows"><div>Gateway 端口</div><div><input id="cfgPort" type="number" min="1" max="65535"><button class="action primary" id="saveConfig">保存配置</button></div><div>配置文件</div><div id="cfgPath">-</div><div>最近备份</div><div><select id="backupSelect"><option value="">暂无备份</option></select> <button class="action" id="restoreConfig">恢复选中备份</button></div></div></div><div class="section"><h2>当前配置（敏感字段已隐藏）</h2><pre class="log" id="rawConfig">加载中...</pre></div></section>
<section id="logs" class="view"><h1>运行日志</h1><p class="desc">显示应用托管的 Gateway 输出日志。</p><div class="toolbar"><button class="action primary" id="refreshLog">刷新日志</button><input id="logQuery" placeholder="搜索日志"><label><input type="checkbox" id="autoLog" checked> 自动刷新</label></div><pre class="log" id="log">加载中...</pre></section>
<section id="terminal" class="view"><div class="terminal-heading"><h1>OpenClaw 终端</h1><div class="terminal-heading-actions"><button class="action" id="copyGatewayToken">复制 Gateway Token</button><span id="tokenStatus" class="hint" role="status" aria-live="polite"></span></div></div><p class="desc">只执行 OpenClaw 管理命令，命令在应用用户权限下运行。</p><div class="terminal"><div class="terminal-output" id="termOut">OpenClaw 管理终端\n输入 openclaw help 查看可用命令。\n</div><div class="prompt"><span>$</span><input id="cmd" autocomplete="off" spellcheck="false" placeholder="openclaw gateway status --deep"><button class="action primary" id="run">执行</button></div><div class="hint">允许：status、gateway、doctor、update、channels、skills、models、devices、config，以及受限的 gh auth/repo/issue/pr/run/api。禁止系统 Shell、sudo、管道和重定向；GitHub 仓库只能写入应用 workspace。</div></div></section></main></div>
<script src="${managementPrefix}/client.js"></script></body></html>`;

function json(res, code, data) { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); }
function isAdmin(req) {
  if (String(req.headers['x-trim-isadmin'] || '').toLowerCase() === 'true') return true;
  // The fnOS unified gateway authenticates the iframe before proxying it to
  // the application Unix socket. Node does not expose a remoteAddress for
  // Unix-domain requests, so do not require a private HTTP header that the
  // gateway is not required to inject. TCP access still requires the header.
  return Boolean(socketPath && req.socket && !req.socket.remoteAddress);
}
function readTail(file, bytes = 120000, query = '') {
  try {
    const b = fs.readFileSync(file);
    let text = b.subarray(Math.max(0, b.length - bytes)).toString('utf8');
    if (query) {
      const needle = query.toLowerCase();
      text = text.split('\n').filter(line => line.toLowerCase().includes(needle)).join('\n');
    }
    return text || '没有匹配的日志。';
  } catch { return '暂无日志。'; }
}
function resourceInfo() {
  let disk = {};
  try {
    const s = fs.statfsSync(appData);
    const total = Number(s.blocks) * Number(s.bsize);
    const free = Number(s.bavail) * Number(s.bsize);
    disk = { total, free, used: Math.max(0, total - free) };
  } catch {}
  let gatewayMemory = null;
  try {
    const pid = Number(fs.readFileSync(gatewayPidFile, 'utf8'));
    const stat = fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/^VmRSS:\s+(\d+)\s+kB$/m);
    if (stat) gatewayMemory = Number(stat[1]) * 1024;
  } catch {}
  return { load: os.loadavg(), memory: { total: os.totalmem(), free: os.freemem(), used: os.totalmem() - os.freemem() }, gatewayMemory, disk, process: process.resourceUsage() };
}
function nodeBinary() { const fixed = path.join(prefix, 'tools', 'node', 'bin', 'node'); if (fs.existsSync(fixed)) return fixed; try { return fs.readdirSync(path.join(prefix, 'tools')).filter(x => /^node-v/.test(x)).sort().pop() ? path.join(prefix, 'tools', fs.readdirSync(path.join(prefix, 'tools')).filter(x => /^node-v/.test(x)).sort().pop(), 'bin', 'node') : process.execPath; } catch { return process.execPath; } }
function nodeVersion() { return process.version; }
function openclawVersion() {
  try {
    const packagePath = path.join(prefix, 'tools', 'node', 'lib', 'node_modules', 'openclaw', 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageData.version ? `v${packageData.version}` : '未安装';
  } catch {}
  try {
    const toolsDir = path.join(prefix, 'tools');
    const nodeDir = fs.readdirSync(toolsDir).filter(name => /^node-v/.test(name)).sort().pop();
    if (nodeDir) {
      const packagePath = path.join(toolsDir, nodeDir, 'lib', 'node_modules', 'openclaw', 'package.json');
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageData.version ? `v${packageData.version}` : '未安装';
    }
  } catch {}
  return '运行时损坏';
}
function openclawVersionDetailed() {
  try {
    const r = spawnSync(path.join(prefix, 'bin', 'openclaw'), ['--version'], { env: process.env, encoding: 'utf8', timeout: 10000 });
    if (r.error || r.status !== 0) return '运行时损坏';
    const line = (r.stdout || '').trim().split('\\n')[0];
    return line || '未安装';
  } catch {
    return '运行时损坏';
  }
}
function gatewayRunning() {
  try {
    const pid = Number(fs.readFileSync(gatewayPidFile, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('invalid pid');
    process.kill(pid, 0);
    try {
      const command = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
      if (!/gateway[\\s_-]+run/.test(command) && !/openclaw/.test(command)) throw new Error('not OpenClaw');
    } catch (error) {
      if (error.code === 'ENOENT') throw error;
    }
    return true;
  } catch {
    try { fs.unlinkSync(gatewayPidFile); } catch {}
    return false;
  }
}
function gatewayEnv() { return { ...process.env }; }
function configuredGatewayPort() {
  try {
    const text = fs.readFileSync(configPath, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/[^\r\n]*/g, '$1');
    const match = text.match(/["']?gateway["']?\s*:\s*\{([\s\S]*?)\}/m);
    const portMatch = match && match[1].match(/["']?port["']?\s*:\s*(\d+)/m);
    const value = Number(portMatch && portMatch[1]);
    if (Number.isInteger(value) && value >= 1 && value <= 65535) return value;
  } catch {}
  return 18790;
}
function cli(args, timeout = 15000) {
  try {
    const r = spawnSync(path.join(prefix, 'bin', 'openclaw'), args, { env: process.env, cwd: process.env.OPENCLAW_WORKSPACE_DIR || appData, encoding: 'utf8', timeout });
    return { ok: r.status === 0, output: `${r.stdout || ''}${r.stderr || ''}`.trim() };
  } catch (error) { return { ok: false, output: error.message }; }
}
function safeConfigText() {
  try {
    // This intentionally works on JSON5/text too. Redact the complete value
    // after credential-like keys, including quoted strings and arrays, rather
    // than attempting to parse a format OpenClaw accepts beyond JSON.
    return fs.readFileSync(configPath, 'utf8')
      .replace(/((?:^|[,\n\r])\s*["']?(?:token|api[_-]?key|secret|password|authorization|cookie|access[_-]?token|refresh[_-]?token|webhook)["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[[^\]]*\]|\{[^}]*\}|[^,\n\r}]+)/gim, '$1[REDACTED]');
  } catch { return ''; }
}
function configBackups() {
  try { return fs.readdirSync(backupDir).filter(name => /^openclaw\.json\./.test(name)).sort().reverse().slice(0, 10); } catch { return []; }
}
function githubCliStatus(includeAuth = true) {
  const gh = path.join(prefix, 'tools', 'gh', 'bin', 'gh');
  if (!fs.existsSync(gh)) return { name: 'GitHub CLI', value: '未安装', ok: false };
  let version = '';
  try {
    const versionResult = spawnSync(gh, ['--version'], { env: process.env, cwd: process.env.OPENCLAW_WORKSPACE_DIR || appData, encoding: 'utf8', timeout: 8000 });
    if (versionResult.status !== 0) return { name: 'GitHub CLI', value: '运行失败', ok: false };
    version = String(versionResult.stdout || '').trim().split('\\n')[0].replace(/^gh version\\s+/i, '');
  } catch { return { name: 'GitHub CLI', value: '运行失败', ok: false }; }
  if (!includeAuth) return { name: 'GitHub CLI', value: `${version}，已安装`, ok: true };
  try {
    const authResult = spawnSync(gh, ['auth', 'status'], { env: process.env, cwd: process.env.OPENCLAW_WORKSPACE_DIR || appData, encoding: 'utf8', timeout: 10000 });
    if (authResult.status === 0) return { name: 'GitHub CLI', value: `${version}，已认证`, ok: true };
    return { name: 'GitHub CLI', value: `${version}，未认证`, ok: false };
  } catch { return { name: 'GitHub CLI', value: `${version}，认证状态未知`, ok: false }; }
}
function thirdPartyTools() {
  const toolsDir = path.join(prefix, 'tools');
  const excluded = /^(node|node-v|npm|openclaw)(?:$|[-.])/i;
  const items = [];
  let names = [];
  try { names = fs.readdirSync(toolsDir).sort(); } catch { return items; }
  for (const name of names) {
    if (excluded.test(name) || name.startsWith('.')) continue;
    const root = path.join(toolsDir, name);
    let stat;
    try { stat = fs.statSync(root); } catch { continue; }
    if (!stat.isDirectory()) continue;
    let executable = path.join(root, 'bin', name);
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(root, 'tool.json'), 'utf8'));
      if (typeof metadata.executable === 'string' && /^[A-Za-z0-9._+/-]+$/.test(metadata.executable)) {
        const candidate = path.resolve(root, metadata.executable);
        if (candidate === root || candidate.startsWith(root + path.sep)) executable = candidate;
      }
    } catch {}
    if (!fs.existsSync(executable)) continue;
    let version = '已安装';
    try {
      const result = spawnSync(executable, ['--version'], { env: process.env, cwd: process.env.OPENCLAW_WORKSPACE_DIR || appData, encoding: 'utf8', timeout: 8000 });
      const firstLine = String(result.stdout || result.stderr || '').trim().split('\\n')[0];
      if (firstLine) version = firstLine.slice(0, 160);
    } catch { version = '已安装，版本未知'; }
    items.push({ name, version, status: '已安装', ok: true, path: root });
  }
  return items;
}
function statusItems() {
  const gateway = gatewayRunning();
  const channels = cli(['channels', 'status', '--json']);
  const models = cli(['models', 'status', '--json']);
  const openclaw = openclawVersion();
  return [
    { name: 'Gateway', value: gateway ? '运行中' : '已停止', ok: gateway },
    { name: 'Gateway 认证', value: fs.existsSync(tokenFile) ? '已配置' : '缺失', ok: fs.existsSync(tokenFile) },
    { name: 'OpenClaw', value: openclaw, ok: openclaw !== '运行时损坏' },
    { name: 'Node.js', value: nodeVersion(), ok: true },
    githubCliStatus(),
    { name: '渠道', value: channels.ok ? '配置可读取' : '读取失败', ok: channels.ok },
    { name: '模型 Provider', value: models.ok ? '配置可读取' : '读取失败', ok: models.ok },
    { name: '监听端口', value: String(configuredGatewayPort()), ok: true }
  ];
}
function diagnosticItems() {
  const checks = [];
  const add = (name, ok, value) => checks.push({ name, ok, value: value || (ok ? '通过' : '失败') });
  add('Node.js 可执行', fs.existsSync(nodeBinary()), nodeVersion());
  const oc = cli(['--version']); add('OpenClaw CLI 可执行', oc.ok, oc.ok ? oc.output.split('\n')[0] : oc.output);
  let configOk = false; try { configOk = fs.statSync(configPath).isFile() && fs.statSync(configPath).size > 0; } catch {}
  add('配置文件存在', configOk, configOk ? '通过' : '缺失');
  let tokenOk = false; try { const s = fs.statSync(tokenFile); tokenOk = s.isFile() && (s.mode & 0o077) === 0; } catch {}
  add('Gateway token 权限', tokenOk, tokenOk ? '0600' : '缺失或权限过宽');
  let socketOk = false; try { socketOk = fs.statSync(socketPath).isSocket(); } catch {}
  add('fnOS 管理 Socket', socketOk, socketOk ? '存在' : '不存在');
  add('Gateway 进程', gatewayRunning(), gatewayRunning() ? '运行中' : '未运行');
  try { const d = fs.statSync(appData); add('数据目录可访问', true, `${Math.round(d.size / 1024)} KB`); } catch { add('数据目录可访问', false, '无法访问'); }
  return checks;
}
function configResponse() {
  return { path: configPath, port: configuredGatewayPort(), raw: safeConfigText(), backups: configBackups() };
}
function writeConfigText(text) {
  const temporary = `${configPath}.tmp.${process.pid}`;
  fs.writeFileSync(temporary, text, { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, configPath);
}
function updateConfigPort(text, port) {
  const gateway = text.match(/(["']?gateway["']?\s*:\s*\{)([\s\S]*?)(\})/m);
  if (!gateway) return null;
  const body = gateway[2];
  const portPattern = /(["']?port["']?\s*:\s*)\d+/m;
  const updatedBody = portPattern.test(body)
    ? body.replace(portPattern, `$1${port}`)
    : `\n    port: ${port},${body}`;
  return text.replace(gateway[0], `${gateway[1]}${updatedBody}${gateway[3]}`);
}
function restoreConfig(name) {
  if (typeof name !== 'string' || !/^openclaw\.json\.[0-9TZ-]+\.bak$/.test(name)) return { ok: false, error: '无效的备份文件。' };
  const source = path.join(backupDir, name);
  try {
    if (path.dirname(source) !== backupDir || !fs.statSync(source).isFile()) return { ok: false, error: '备份文件不存在。' };
    const rollback = `${configPath}.restore-backup.${process.pid}`;
    if (fs.existsSync(configPath)) fs.copyFileSync(configPath, rollback);
    fs.copyFileSync(source, configPath);
    if (!fs.statSync(configPath).isFile() || fs.statSync(configPath).size === 0) throw new Error('恢复后的配置文件为空。');
    try { fs.unlinkSync(rollback); } catch {}
    return { ok: true };
  } catch (error) {
    try { if (fs.existsSync(`${configPath}.restore-backup.${process.pid}`)) fs.renameSync(`${configPath}.restore-backup.${process.pid}`, configPath); } catch {}
    return { ok: false, error: `恢复失败：${error.message}` };
  }
}
function saveConfigPort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: '端口必须是 1 到 65535 的整数。' };
  let original;
  try {
    original = fs.readFileSync(configPath, 'utf8');
    const updated = updateConfigPort(original, port);
    if (!updated) return { ok: false, error: '配置中未找到 gateway 配置段，未写入。' };
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backup = path.join(backupDir, `openclaw.json.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`);
    fs.copyFileSync(configPath, backup, fs.constants.COPYFILE_EXCL);
    writeConfigText(updated);
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
}
function startGateway() {
  if (gatewayRunning()) return 'Gateway 已在运行。';
  const launcher = path.join(appBin, 'openclaw');
  if (!fs.existsSync(launcher)) return 'Gateway 启动失败：OpenClaw 启动入口不存在。';
  const log = fs.openSync(logFile, 'a');
  const child = spawn(launcher, ['gateway', 'run', '--bind', 'lan', '--allow-unconfigured'], { env: gatewayEnv(), cwd: process.env.OPENCLAW_WORKSPACE_DIR || appData, detached: false, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  const clearPid = () => { try { if (fs.readFileSync(gatewayPidFile, 'utf8').trim() === String(child.pid)) fs.unlinkSync(gatewayPidFile); } catch {} };
  child.once('error', error => { clearPid(); try { fs.appendFileSync(logFile, `\\n[gateway] start error: ${error.message}\\n`); } catch {} });
  child.once('exit', () => { clearPid(); });
  fs.writeFileSync(gatewayPidFile, String(child.pid), { mode: 0o600 });
  if (child.pid) return `Gateway 启动中，PID ${child.pid}`;
  clearPid();
  return 'Gateway 启动失败。';
}
function stopGateway() {
  if (!gatewayRunning()) return 'Gateway 当前未运行。';
  try {
    const pid = Number(fs.readFileSync(gatewayPidFile, 'utf8'));
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(gatewayPidFile);
    return `Gateway 已停止，PID ${pid}`;
  } catch { return 'Gateway 停止失败。'; }
}
function tokenize(line) { const m = line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []; return m.map(x => x.length > 1 && ((x[0] === '"' && x.at(-1) === '"') || (x[0] === "'" && x.at(-1) === "'")) ? x.slice(1, -1) : x); }
function allowed(args) {
  if (!args.length || args[0] !== 'openclaw') return false;
  if (args.some(x => /[|;&<>`$]/.test(x))) return false;
  const rest = args.slice(1); const root = rest[0];
  if (!root || !['help','status','doctor','gateway','update','channels','skills','models','devices','config','gh'].includes(root)) return false;
  if (root === 'update') return rest.length <= 2 && (!rest[1] || rest[1] === '--yes');
  if (root === 'config') return rest.length <= 3 && ['get','set','unset','list'].includes(rest[1]);
  if (root === 'gh') {
    const ghRoot = rest[1];
    if (!ghRoot || !['auth','repo','issue','pr','run','api','version','help'].includes(ghRoot)) return false;
    if (ghRoot === 'auth') return rest.length <= 4 && ['status','login','logout','setup-git'].includes(rest[2]);
    if (ghRoot === 'repo') return rest.length <= 5 && ['clone','view','list','create','fork','sync'].includes(rest[2]);
    if (ghRoot === 'issue') return rest.length <= 6 && ['list','view','create','close','reopen','comment'].includes(rest[2]);
    if (ghRoot === 'pr') return rest.length <= 6 && ['list','view','checks','create','close','merge','diff','checkout'].includes(rest[2]);
    if (ghRoot === 'run') return rest.length <= 6 && ['list','view','watch','rerun','cancel','download'].includes(rest[2]);
    if (ghRoot === 'api') return rest.length <= 6 && !rest.some(x => ['--input','--hostname','--jq','--include','--verbose'].includes(x));
    return rest.length <= 3;
  }
  return rest.length <= 4;
}
function runCommand(command) {
  return new Promise(resolve => {
    const args = tokenize(command);
    if (!allowed(args)) return resolve({ error: '命令被拒绝：只允许受限的 openclaw 管理命令。' });

    // Handle this exact command without invoking a shell. Keep the complete
    // credential out of terminal output.
    if (args.length === 4 && args[1] === 'gateway' && args[2] === 'auth-token' && args[3] === '--show') {
      try {
        const token = fs.readFileSync(tokenFile, 'utf8').trim();
        const masked = token.length > 8 ? `${token.slice(0, 4)}…${token.slice(-4)}` : '已配置';
        return resolve({ output: `Gateway token：${masked}\n完整 token 不在终端中显示。请使用受信任的原生 Control UI 配置认证。` });
      } catch {
        return resolve({ error: 'Gateway token 尚未生成或无法读取。' });
      }
    }

    const isGh = args[1] === 'gh';
    if (isGh) {
      const ghArgs = args.slice(2);
      const ghGroup = ghArgs[0];
      const ghAction = ghArgs[1];
      if (ghGroup === 'auth' && ghAction === 'login' && ghArgs.includes('--with-token')) return resolve({ error: '不允许通过命令参数传入 GitHub token；请运行 gh auth login 使用交互式认证。' });
      if (ghGroup === 'repo' && ghAction === 'clone') {
        const workspace = path.resolve(process.env.OPENCLAW_WORKSPACE_DIR || path.join(process.env.HOME || appData, '.openclaw', 'workspace'));
        // gh repo clone accepts a repository followed by an optional directory.
        // Validate the second positional argument, not the repository name.
        const positional = ghArgs.slice(2).filter(value => !value.startsWith('-'));
        const destinationArg = positional[1];
        const destination = destinationArg ? path.resolve(workspace, destinationArg) : workspace;
        if (destination !== workspace && !destination.startsWith(workspace + path.sep)) return resolve({ error: '仓库只能克隆到 OpenClaw workspace 内。' });
      }
    }
    const executable = isGh ? path.join(prefix, 'tools', 'gh', 'bin', 'gh') : path.join(prefix, 'bin', 'openclaw');
    const child = spawn(executable, isGh ? args.slice(2) : args.slice(1), { env: process.env, cwd: process.env.OPENCLAW_WORKSPACE_DIR || appData, timeout: 120000 });
    let stdout='', stderr='';
    child.stdout.on('data', b => stdout += b);
    child.stderr.on('data', b => stderr += b);
    child.on('error', e => resolve({ error: e.message }));
    child.on('close', code => resolve({ output: (stdout + stderr).trim() || `(退出码 ${code})` }));
  });
}
const server = http.createServer((req, res) => {
  const requestUrl = req.url || '/';
  let requestPath;
  try { requestPath = new URL(requestUrl, 'http://localhost').pathname; }
  catch { return json(res, 400, { error: '无效请求路径。' }); }
  const url = managementPrefix && (requestPath === managementPrefix || requestPath.startsWith(managementPrefix + '/'))
    ? requestPath.slice(managementPrefix.length) || '/'
    : requestPath;
  if (req.method === 'GET' && url === '/healthz') return json(res, 200, { ok: true });
  if (req.method === 'GET' && url === '/client.js') {
    try {
      const client = fs.readFileSync(clientScriptPath, 'utf8').replaceAll('__MANAGEMENT_PREFIX__', managementPrefix);
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(client);
    } catch (error) { return json(res, 500, { error: `Unable to load management client: ${error.message}` }); }
  }
  if (req.method === 'GET' && (url === '/api/overview' || url === '/api/logs' || url === '/api/status' || url === '/api/tools' || url === '/api/diagnostics' || url === '/api/config')) {
    if (!isAdmin(req)) return json(res, 403, { error: '需要管理员权限。' });
    if (url === '/api/overview') return json(res, 200, { gateway: gatewayRunning(), openclaw: openclawVersion(), node: nodeVersion(), port: configuredGatewayPort(), gh: githubCliStatus(false), data: appData, user: os.userInfo().username });
    if (url === '/api/status') return json(res, 200, { items: statusItems(), resource: resourceInfo() });
    if (url === '/api/tools') return json(res, 200, { items: thirdPartyTools() });
    if (url === '/api/diagnostics') return json(res, 200, { items: diagnosticItems() });
    if (url === '/api/config') return json(res, 200, configResponse());
    const query = new URL(requestUrl, 'http://localhost').searchParams.get('q') || '';
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); return res.end(readTail(logFile, 120000, query.slice(0, 200)));
  }
  if (req.method === 'POST' && (url === '/api/action' || url === '/api/command' || url === '/api/config')) {
    if (!isAdmin(req)) return json(res, 403, { error: '需要管理员权限。' });
    let body=''; let tooLarge=false; req.on('data', b => { body += b; if (body.length > 32768) { tooLarge=true; req.removeAllListeners('data'); req.resume(); } }); req.on('end', async () => {
      if (tooLarge) return json(res, 413, { error: '请求体过大。' });
      if (url === '/api/action' && actionBusy) return json(res, 409, { error: '已有操作正在执行。' });
      if (url === '/api/action') actionBusy=true;
      try {
        const d=JSON.parse(body); let output='';
        if (url === '/api/config') {
          const result = d.restore ? restoreConfig(d.restore) : saveConfigPort(Number(d.port));
          return result.ok ? json(res, 200, configResponse()) : json(res, 400, { error: result.error });
        }
        if (url === '/api/command') return json(res, 200, await runCommand(String(d.command || '')));
        if(d.action==='start') output=startGateway();
        else if(d.action==='stop') output=stopGateway();
        else if(d.action==='restart'){stopGateway(); await new Promise(r=>setTimeout(r,500)); output=startGateway();}
        else if(d.action==='update-node'){const r=spawnSync(path.join(appBin,'update-node'),[],{env:process.env,cwd:appData,encoding:'utf8',timeout:300000}); output=(r.stdout||'')+(r.stderr||''); if(r.error) return json(res,500,{error:'Node 更新失败：'+r.error.message,output}); if(r.status!==0) return json(res,500,{error:'Node 更新失败（退出码 '+r.status+'）',output});}
        else if(d.action==='install-gh'){const r=spawnSync('/bin/sh',[path.join(appBin,'ensure-gh')],{env:process.env,cwd:appData,encoding:'utf8',timeout:300000}); output=(r.stdout||'')+(r.stderr||''); if(r.error) return json(res,500,{error:'GitHub CLI 安装失败：'+r.error.message,output}); if(r.status!==0) return json(res,500,{error:'GitHub CLI 安装失败（退出码 '+r.status+'）',output});}
        else return json(res,400,{error:'不支持的操作。'});
        json(res,200,{output:output.trim()||'操作完成。',node:nodeVersion()});
      } catch(e){json(res,400,{error:'无效请求。'});} finally {if (url === '/api/action') actionBusy=false;}
    }); return;
  }
  if (req.method === 'POST' && url === '/api/token/copy') {
    if (!isAdmin(req)) return json(res, 403, { error: '需要管理员权限。' });
    try {
      const token = fs.readFileSync(tokenFile, 'utf8').trim();
      if (!token) return json(res, 404, { error: 'Gateway token 尚未生成。' });
      return json(res, 200, { token });
    } catch { return json(res, 404, { error: 'Gateway token 尚未生成或无法读取。' }); }
  }
  if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(page); }
  json(res, 404, { error: 'Not found' });
});
server.on('error', error => {
  try { fs.appendFileSync(logFile, `\\n[management] listen error: ${error.message}\\n`); } catch {}
  process.exitCode = 1;
});
if (socketPath) {
  try {
    const existing = fs.lstatSync(socketPath);
    if (!existing.isSocket()) throw new Error(`Refusing to replace non-socket at ${socketPath}`);
    fs.unlinkSync(socketPath);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  server.listen(socketPath, () => {
    fs.chmodSync(socketPath, 0o660);
  });
} else {
  const listenPort = Number(process.env.OPENCLAW_MANAGEMENT_PORT || '18789');
  server.listen(listenPort, '0.0.0.0');
}
