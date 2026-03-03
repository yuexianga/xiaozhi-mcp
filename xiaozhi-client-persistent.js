#!/usr/bin/env node
/**
 * 小欧 - 小智 AI MCP 客户端 (长连接模式)
 * 支持心跳保活、上下文记忆、准实时对话
 * 全中文工具名和参数
 */

require('dotenv').config();
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const XIAOZHI_MCP_URL = process.env.XIAOZHI_MCP_URL;

if (!XIAOZHI_MCP_URL) {
  console.error('❌ 错误：请设置 XIAOZHI_MCP_URL 环境变量');
  console.error('   复制 .env.example 为 .env 并填入你的 token');
  process.exit(1);
}

// 数据目录 - 位于xiaozhi-mcp文件夹内（绝对路径）
const DATA_DIR = '/root/.openclaw/workspace/xiaozhi-mcp/data';
const CONFIG = {
  heartbeatInterval: 30000,
  reconnectDelay: 5000,
  maxReconnectAttempts: 10,
  contextTTL: 3600000, // 1小时
};

const state = {
  ws: null,
  connected: false,
  reconnectAttempts: 0,
  messageId: 1000,
  lastActivity: Date.now(),
  context: [],
};

// 确保数据目录存在
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('无法创建数据目录:', err.message);
  }
}

// ==================== 工具定义 ====================
const TOOLS = [
  {
    name: '小欧_读取文件',
    description: '读取文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        路径: { type: 'string', description: '文件路径' },
        行数限制: { type: 'number', description: '最大读取行数' }
      },
      required: ['路径']
    }
  },
  {
    name: '小欧_列出文件',
    description: '列出目录中的文件',
    inputSchema: {
      type: 'object',
      properties: {
        路径: { type: 'string', description: '目录路径' },
        显示隐藏文件: { type: 'boolean', description: '是否显示隐藏文件' }
      }
    }
  },
  {
    name: '小欧_发送电报',
    description: '发送消息到 Telegram',
    inputSchema: {
      type: 'object',
      properties: {
        消息: { type: 'string', description: '要发送的消息内容' },
        目标: { type: 'string', description: '目标用户或群组' }
      },
      required: ['消息']
    }
  },
  {
    name: '小欧_发送邮件',
    description: '发送邮件（需要配置 SMTP）',
    inputSchema: {
      type: 'object',
      properties: {
        收件人: { type: 'string', description: '收件人邮箱地址' },
        主题: { type: 'string', description: '邮件主题' },
        正文: { type: 'string', description: '邮件正文内容' },
        格式: { type: 'boolean', description: '是否使用 HTML 格式' }
      },
      required: ['收件人', '主题', '正文']
    }
  },
  {
    name: '小欧_系统信息',
    description: '获取系统信息（CPU、内存、磁盘使用情况）',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: '小欧_网络搜索',
    description: '搜索网络信息',
    inputSchema: {
      type: 'object',
      properties: {
        关键词: { type: 'string', description: '搜索关键词' },
        数量: { type: 'number', description: '结果数量' }
      },
      required: ['关键词']
    }
  },
  {
    name: '小欧_网页截图',
    description: '截取网页截图',
    inputSchema: {
      type: 'object',
      properties: {
        网址: { type: 'string', description: '网页 URL' },
        完整页面: { type: 'boolean', description: '是否截取完整页面' }
      },
      required: ['网址']
    }
  },
  {
    name: '小欧_状态',
    description: '查看 Git 仓库状态',
    inputSchema: {
      type: 'object',
      properties: {
        路径: { type: 'string', description: 'Git 仓库路径' }
      }
    }
  },
  {
    name: '小欧_执行命令',
    description: '在服务器上执行 Shell 命令',
    inputSchema: {
      type: 'object',
      properties: {
        命令: { type: 'string', description: '要执行的命令' }
      },
      required: ['命令']
    }
  },
  {
    name: '小欧_重启OpenClaw',
    description: '重启 OpenClaw 服务',
    inputSchema: {
      type: 'object',
      properties: {
        确认: { type: 'boolean', description: '确认重启（需要为true）' }
      },
      required: ['确认']
    }
  },
  {
    name: '小欧_切换模型',
    description: '切换 OpenClaw 使用的 AI 模型',
    inputSchema: {
      type: 'object',
      properties: {
        模型: { type: 'string', description: '模型名称（如 qwen, coder 等）' }
      },
      required: ['模型']
    }
  },
  {
    name: '小欧_检查版本',
    description: '检查 OpenClaw 版本',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: '小欧_更新OpenClaw',
    description: '更新 OpenClaw 到最新版本',
    inputSchema: {
      type: 'object',
      properties: {
        确认: { type: 'boolean', description: '确认更新（需要为true）' }
      },
      required: ['确认']
    }
  },
  {
    name: '小欧_保存笔记',
    description: '保存笔记到记忆',
    inputSchema: {
      type: 'object',
      properties: {
        内容: { type: 'string', description: '笔记内容' },
        标签: { type: 'string', description: '标签（可选）' }
      },
      required: ['内容']
    }
  },
  {
    name: '小欧_添加日程',
    description: '添加日历事件',
    inputSchema: {
      type: 'object',
      properties: {
        标题: { type: 'string', description: '事件标题' },
        开始时间: { type: 'string', description: '开始时间（ISO 8601 格式）' },
        结束时间: { type: 'string', description: '结束时间（可选）' },
        描述: { type: 'string', description: '事件描述（可选）' },
        地点: { type: 'string', description: '地点（可选）' }
      },
      required: ['标题', '开始时间']
    }
  },
  {
    name: '小欧_查看日程',
    description: '查看日历事件',
    inputSchema: {
      type: 'object',
      properties: {
        时间段: { type: 'string', description: '时间段：今天、明天、本周', enum: ['today', 'tomorrow', 'week'] }
      }
    }
  },
  {
    name: '小欧_记账',
    description: '记录一笔消费/支出',
    inputSchema: {
      type: 'object',
      properties: {
        金额: { type: 'number', description: '金额（元）' },
        分类: { type: 'string', description: '分类：餐饮、交通、购物、娱乐、生活、其他' },
        项目: { type: 'string', description: '消费项目/商品名称' },
        备注: { type: 'string', description: '备注（可选）' }
      },
      required: ['金额', '分类', '项目']
    }
  },
  {
    name: '小欧_消费报告',
    description: '查看消费统计报告',
    inputSchema: {
      type: 'object',
      properties: {
        时间范围: { type: 'string', description: '时间范围：今天、本周、本月', enum: ['today', 'week', 'month'] }
      }
    }
  }
];

// ==================== 日志输出 ====================
function log(level, ...args) {
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  const prefix = `[${timestamp}] [${level}]`;
  console.log(prefix, ...args);
}

// ==================== 上下文管理 ====================
function addToContext(role, content) {
  state.context.push({ role, content, timestamp: Date.now() });

  const now = Date.now();
  state.context = state.context.filter(item => now - item.timestamp < CONFIG.contextTTL);

  if (state.context.length > 20) {
    state.context = state.context.slice(-20);
  }
}

function getContextSummary() {
  if (state.context.length === 0) return '暂无对话记录';

  return state.context.map((item, i) => {
    const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const role = item.role === 'user' ? '你' : '小欧';
    return `${time} ${role}: ${item.content.substring(0, 50)}${item.content.length > 50 ? '...' : ''}`;
  }).join('\n');
}

// ==================== WebSocket 连接管理 ====================
function connect() {
  log('INFO', '🔌 正在连接小智 AI MCP 服务器...');

  state.ws = new WebSocket(XIAOZHI_MCP_URL, {
    handshakeTimeout: 10000,
    keepAlive: true
  });

  state.ws.on('open', onOpen);
  state.ws.on('message', onMessage);
  state.ws.on('error', onError);
  state.ws.on('close', onClose);
}

function onOpen() {
  log('SUCCESS', '✅ 已连接到小智 MCP 服务器（长连接模式）');
  log('INFO', `📦 ${TOOLS.length} 个工具已注册`);
  log('INFO', '💓 心跳间隔: 30 秒');
  log('INFO', `💾 数据目录: ${DATA_DIR}`);
  state.connected = true;
  state.reconnectAttempts = 0;
  state.lastActivity = Date.now();
  startHeartbeat();
}

function onMessage(data) {
  try {
    const msg = JSON.parse(data.toString());
    state.lastActivity = Date.now();

    if (msg.method) {
      handleRequest(msg);
    }
  } catch (err) {
    log('ERROR', '解析失败:', err.message);
  }
}

function onError(err) {
  log('ERROR', 'WebSocket 错误:', err.message);
}

function onClose(code, reason) {
  log('WARN', `连接关闭 (code: ${code}, reason: ${reason || ''})`);
  state.connected = false;
  stopHeartbeat();

  if (state.reconnectAttempts < CONFIG.maxReconnectAttempts) {
    state.reconnectAttempts++;
    log('INFO', `🔄 ${CONFIG.reconnectDelay/1000}秒后尝试第 ${state.reconnectAttempts} 次重连...`);
    setTimeout(connect, CONFIG.reconnectDelay);
  } else {
    log('ERROR', '❌ 达到最大重连次数，请检查网络或重启服务');
  }
}

let heartbeatTimer = null;
function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (state.connected && state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ jsonrpc: '2.0', id: ++state.messageId, method: 'ping' }));
    }
  }, CONFIG.heartbeatInterval);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ==================== MCP 请求处理 ====================
async function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      state.ws.send(JSON.stringify({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: '小欧-mcp-server-persistent', version: '2.0.0' }
        }
      }));
      break;

    case 'tools/list':
      state.ws.send(JSON.stringify({ jsonrpc: '2.0', id, result: { tools: TOOLS } }));
      break;

    case 'tools/call':
      log('CALL', `🛠️ 调用: ${params?.name}`);
      const result = await handleToolCall(params);
      state.ws.send(JSON.stringify({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: result }] }
      }));
      break;

    case 'ping':
      log('DEBUG', '💓 收到心跳');
      state.ws.send(JSON.stringify({ jsonrpc: '2.0', id, result: {} }));
      break;

    default:
      log('WARN', `未知方法: ${method}`);
  }
}

// ==================== 工具执行 ====================
async function handleToolCall(params) {
  const { name, arguments: args } = params || {};

  try {
    switch (name) {
      case '小欧_读取文件':
        return await readFile(args?.路径, args?.行数限制);

      case '小欧_列出文件':
        return await listFiles(args?.路径 || __dirname, args?.显示隐藏文件);

      case '小欧_发送电报':
        return await sendTelegramMessage(args?.消息, args?.目标);

      case '小欧_发送邮件':
        return await sendEmail(args?.收件人, args?.主题, args?.正文, args?.格式);

      case '小欧_系统信息':
        return await getSystemInfo();

      case '小欧_网络搜索':
        return `🔍 [小欧] 搜索 "${args?.关键词}" 已准备就绪\n\n⚠️ 需要配置 Brave API Key 才能执行搜索`;

      case '小欧_网页截图':
        return `📸 [小欧] 准备截取网页: ${args?.网址}\n\n⚠️ 请在 OpenClaw 界面执行截图操作`;

      case '小欧_状态':
        return await getGitStatus(args?.路径);

      case '小欧_执行命令':
        return await executeShellCommand(args?.命令);

      case '小欧_重启OpenClaw':
        return await restartOpenClaw(args?.确认);

      case '小欧_切换模型':
        return await switchOpenClawModel(args?.模型);

      case '小欧_检查版本':
        return await checkOpenClawVersion();

      case '小欧_更新OpenClaw':
        return await updateOpenClaw(args?.确认);

      case '小欧_保存笔记':
        return await saveNote(args?.内容, args?.标签);

      case '小欧_添加日程':
        return await addCalendarEvent(args?.标题, args?.开始时间, args?.结束时间, args?.描述, args?.地点);

      case '小欧_查看日程':
        return await listCalendarEvents(args?.时间段 || 'today');

      case '小欧_记账':
        return await addExpense(args?.金额, args?.分类, args?.项目, args?.备注);

      case '小欧_消费报告':
        return await getExpenseReport(args?.时间范围 || 'today');

      default:
        return `❌ 未知工具: ${name}`;
    }
  } catch (err) {
    return `❌ 执行错误: ${err.message}`;
  }
}

// ==================== 工具函数 ====================
async function readFile(filePath, limit = 100) {
  try {
    if (!filePath) return '❌ 请提供文件路径';
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    const lines = content.split('\n');
    const truncated = lines.slice(0, limit).join('\n');
    const suffix = lines.length > limit ? `\n\n... (还有 ${lines.length - limit} 行)` : '';
    return `📄 [文件: ${filePath}]\n\`\`\`\n${truncated}${suffix}\n\`\`\``;
  } catch (err) {
    return `❌ 读取失败: ${err.message}`;
  }
}

async function listFiles(dirPath, showHidden = false) {
  try {
    const targetPath = dirPath || __dirname;
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const files = entries
      .filter(e => showHidden || !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}${e.isDirectory() ? '/' : ''}`)
      .slice(0, 30);
    return `📂 [目录: ${dirPath || '当前目录'}]\n${files.join('\n')}${entries.length > 30 ? '\n... (还有 ' + (entries.length - 30) + ' 项)' : ''}`;
  } catch (err) {
    return `❌ 列出失败: ${err.message}`;
  }
}

async function sendTelegramMessage(message, target = null) {
  if (!message) return '❌ 请提供消息内容';

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8066651062:AAFlM9hHtXCf-iOu3tjgRVXvkqm5PFeEakU';
  const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '7597776041';
  const CHAT_ID = target || DEFAULT_CHAT_ID;

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    };

    const { stdout } = await execPromise(`curl -s -X POST "${url}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`);
    const response = JSON.parse(stdout);

    if (response.ok) {
      return `✅ [Telegram消息已发送]\n消息: "${message}"\n目标: ${CHAT_ID}`;
    } else {
      return `❌ 发送失败: ${response.description}`;
    }
  } catch (err) {
    return `❌ 发送失败: ${err.message}`;
  }
}

async function sendEmail(to, subject, body, isHtml = false) {
  if (!to || !subject || !body) return '❌ 请提供收件人、主题和正文';

  const emailData = { to, subject, body, isHtml, timestamp: new Date().toISOString(), status: 'pending' };

  try {
    const emailPath = path.join(DATA_DIR, 'pending-emails.json');
    let emails = [];
    try {
      const existing = await fs.readFile(emailPath, 'utf8');
      emails = JSON.parse(existing);
    } catch (e) {}
    emails.push(emailData);
    await fs.writeFile(emailPath, JSON.stringify(emails, null, 2), 'utf8');

    return `📧 [邮件已保存]\n收件人: ${to}\n主题: ${subject}\n\n⚠️ 已加入发送队列，请在 OpenClaw 界面确认发送`;
  } catch (err) {
    return `❌ 保存邮件失败: ${err.message}`;
  }
}

async function getSystemInfo() {
  try {
    const { stdout: uptime } = await execPromise('uptime -p 2>/dev/null || uptime');
    const { stdout: memory } = await execPromise('free -h 2>/dev/null | head -2 || echo "Memory info unavailable"');
    const { stdout: disk } = await execPromise('df -h / 2>/dev/null | tail -1 || echo "Disk info unavailable"');
    return `💻 [系统信息]\n⏱️ 运行时间: ${uptime.trim()}\n\n🧠 内存:\n${memory}\n\n💾 磁盘:\n${disk}`;
  } catch (err) {
    return `⚠️ 部分系统信息无法获取: ${err.message}`;
  }
}

async function getGitStatus(repoPath) {
  try {
    const cwd = repoPath || '/root/.openclaw/workspace';
    const { stdout } = await execPromise('git status --short --branch 2>&1', { cwd });
    return `🌿 [Git 状态: ${cwd}]\n${stdout || '工作区干净，无未提交更改'}`;
  } catch (err) {
    return `❌ Git 检查失败: ${err.message}`;
  }
}

async function executeShellCommand(command) {
  if (!command) return '❌ 请提供要执行的命令';
  try {
    const { stdout, stderr } = await execPromise(command, { timeout: 30000 });
    const result = stdout || '';
    const errors = stderr || '';
    return `💻 [执行命令: ${command}]\n${result}${errors ? '\n⚠️ 错误输出:\n' + errors : ''}`;
  } catch (err) {
    return `❌ 执行失败: ${err.message}`;
  }
}

async function restartOpenClaw(confirm) {
  if (!confirm) return '❌ 需要确认参数为 true 才能重启';
  try {
    const { stdout } = await execPromise('openclaw gateway restart 2>&1', { timeout: 15000 });
    return `🔄 [OpenClaw 重启]\n${stdout}\n\n✅ 重启命令已执行`;
  } catch (err) {
    return `❌ 重启失败: ${err.message}`;
  }
}

async function switchOpenClawModel(model) {
  if (!model) return '❌ 请指定模型名称';
  try {
    const { stdout } = await execPromise(`openclaw config set agents.defaults.model.primary "${model}" 2>&1`);
    return `🔧 [模型切换]\n已切换到: ${model}\n\n${stdout}\n\n⚠️ 重启服务后生效`;
  } catch (err) {
    return `❌ 切换失败: ${err.message}`;
  }
}

async function checkOpenClawVersion() {
  try {
    const { stdout } = await execPromise('openclaw --version 2>&1');
    const version = stdout.trim();
    return `📦 [OpenClaw 版本]\n当前版本: ${version}\n\n检查更新: openclaw update --dry-run`;
  } catch (err) {
    return `❌ 检查失败: ${err.message}`;
  }
}

async function updateOpenClaw(confirm) {
  if (!confirm) return '❌ 需要确认参数为 true 才能更新';
  try {
    const { stdout } = await execPromise('npm install -g openclaw@latest 2>&1', { timeout: 60000 });
    return `🆙 [OpenClaw 更新]\n${stdout}\n\n✅ 更新完成，建议重启服务`;
  } catch (err) {
    return `❌ 更新失败: ${err.message}`;
  }
}

async function saveNote(content, tag = '') {
  try {
    const notePath = path.join(DATA_DIR, 'xiaozhi-notes.md');
    const timestamp = new Date().toISOString();
    const entry = `\n## ${timestamp}${tag ? ` [${tag}]` : ''}\n${content}\n`;
    await fs.appendFile(notePath, entry, 'utf8');
    return `📝 [笔记已保存]\n标签: ${tag || '无'}\n内容预览: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`;
  } catch (err) {
    return `❌ 保存失败: ${err.message}`;
  }
}

async function addCalendarEvent(title, startTime, endTime, description = '', location = '') {
  if (!title || !startTime) return '❌ 请提供事件标题和开始时间';

  const event = {
    title: title,
    startTime: startTime,
    endTime: endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(),
    description: description,
    location: location,
    createdAt: new Date().toISOString()
  };

  try {
    const calendarPath = path.join(DATA_DIR, 'calendar-events.json');
    let events = [];
    try {
      const existing = await fs.readFile(calendarPath, 'utf8');
      events = JSON.parse(existing);
    } catch (e) {}
    events.push(event);
    await fs.writeFile(calendarPath, JSON.stringify(events, null, 2), 'utf8');

    const time = new Date(startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `📅 [事件已添加]\n📌 ${title}\n🕒 ${time}\n${location ? '📍 ' + location : ''}\n${description ? '📝 ' + description : ''}`;
  } catch (err) {
    return `❌ 添加失败: ${err.message}`;
  }
}

async function listCalendarEvents(timeRange = 'today') {
  try {
    const calendarPath = path.join(DATA_DIR, 'calendar-events.json');
    let events = [];
    try {
      const existing = await fs.readFile(calendarPath, 'utf8');
      events = JSON.parse(existing);
    } catch (e) {
      return `📅 [日历-${timeRange}]\n暂无事件`;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    let filtered = events.filter(e => {
      const eventTime = new Date(e.startTime);
      switch (timeRange) {
        case 'today': return eventTime >= today && eventTime < tomorrow;
        case 'tomorrow': return eventTime >= tomorrow && eventTime < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
        case 'week': return eventTime >= today && eventTime < weekEnd;
        default: return true;
      }
    });

    filtered.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    if (filtered.length === 0) return `📅 [日历-${timeRange}]\n该时间段暂无事件`;

    const periodNames = { today: '今天', tomorrow: '明天', week: '本周' };
    let result = `📅 [${periodNames[timeRange] || timeRange}的日程]\n共 ${filtered.length} 个事件:\n`;
    filtered.forEach((e, i) => {
      const time = new Date(e.startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      result += `\n${i + 1}. ${e.title}\n   🕒 ${time}${e.location ? ' 📍 ' + e.location : ''}`;
    });
    return result;
  } catch (err) {
    return `❌ 读取日历失败: ${err.message}`;
  }
}

async function addExpense(amount, category, item, note = '') {
  if (!amount || !category || !item) return '❌ 请提供金额、分类和消费项目';

  const expense = {
    amount: parseFloat(amount),
    category: category,
    item: item,
    note: note,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('zh-CN')
  };

  try {
    const expensePath = path.join(DATA_DIR, 'expenses.json');
    let expenses = [];
    try {
      const existing = await fs.readFile(expensePath, 'utf8');
      expenses = JSON.parse(existing);
    } catch (e) {}
    expenses.push(expense);
    await fs.writeFile(expensePath, JSON.stringify(expenses, null, 2), 'utf8');
    return `💰 [记账成功]\n📦 ${item}\n💵 ¥${amount.toFixed(2)}\n🏷️ ${category}${note ? '\n📝 ' + note : ''}`;
  } catch (err) {
    return `❌ 记账失败: ${err.message}`;
  }
}

async function getExpenseReport(timeRange = 'today') {
  try {
    const expensePath = path.join(DATA_DIR, 'expenses.json');
    let expenses = [];
    try {
      const existing = await fs.readFile(expensePath, 'utf8');
      expenses = JSON.parse(existing);
    } catch (e) {
      return `💰 [消费报告-${timeRange}]\n暂无记录`;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    let filtered = expenses.filter(e => {
      const expenseDate = new Date(e.timestamp);
      switch (timeRange) {
        case 'today': return expenseDate >= today;
        case 'week': return expenseDate >= weekAgo;
        case 'month': return expenseDate >= monthAgo;
        default: return true;
      }
    });

    if (filtered.length === 0) return `💰 [消费报告-${timeRange}]\n该时间段暂无记录`;

    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = {};
    filtered.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });

    const periodNames = { today: '今天', week: '本周', month: '本月' };
    let result = `💰 [${periodNames[timeRange] || timeRange}消费报告]\n📊 共 ${filtered.length} 笔，总计 ¥${total.toFixed(2)}\n\n📈 分类统计:\n`;
    Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
      result += `  • ${cat}: ¥${amt.toFixed(2)} (${((amt / total) * 100).toFixed(1)}%)\n`;
    });
    result += `\n📝 最近记录:\n`;
    filtered.slice(-5).reverse().forEach((e, i) => {
      result += `  ${i + 1}. ${e.item} ¥${e.amount.toFixed(2)}\n`;
    });
    return result;
  } catch (err) {
    return `❌ 读取账单失败: ${err.message}`;
  }
}

// ==================== 启动 ====================
(async () => {
  await ensureDataDir();
  log('INFO', '🚀 启动小欧 MCP 客户端（长连接模式）');
  log('INFO', `⚙️ 配置: 心跳=${CONFIG.heartbeatInterval/1000}s, 重连延迟=${CONFIG.reconnectDelay/1000}s`);
  connect();
})();

process.on('SIGINT', () => {
  log('INFO', '\n👋 收到退出信号，正在关闭...');
  stopHeartbeat();
  if (state.ws) state.ws.close();
  process.exit(0);
});