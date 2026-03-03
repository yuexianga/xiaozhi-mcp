#!/usr/bin/env node
/**
 * 小欧 - 小智 AI MCP 客户端 (stdio模式，供mcporter调用)
 * 优化版：日志级别控制、更好的错误处理、参数验证
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ==================== 配置 ====================
const CONFIG = {
  logLevel: process.env.XIAOZHI_LOG_LEVEL || 'error', // silent, error, warn, info, debug
  maxFileSize: 100 * 1024, // 100KB
  commandTimeout: 30000,
  readFileLimit: 1000
};

// ==================== 工具定义 ====================
const TOOLS = [
  {
    name: 'xiaozhi_读取文件',
    description: '读取文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径', minLength: 1 },
        limit: { type: 'number', description: '最大读取行数', minimum: 1, maximum: 10000 }
      },
      required: ['path']
    }
  },
  {
    name: 'xiaozhi_列出文件',
    description: '列出目录中的文件',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径' },
        showHidden: { type: 'boolean', description: '是否显示隐藏文件' }
      }
    }
  },
  {
    name: 'xiaozhi_发送电报',
    description: '发送消息到 Telegram',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '要发送的消息内容', minLength: 1 },
        target: { type: 'string', description: '目标用户或群组' }
      },
      required: ['message']
    }
  },
  {
    name: 'xiaozhi_系统信息',
    description: '获取系统信息（CPU、内存、磁盘使用情况）',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'xiaozhi_执行命令',
    description: '在服务器上执行 Shell 命令',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令', minLength: 1 }
      },
      required: ['command']
    }
  },
  {
    name: 'xiaozhi_检查服务',
    description: '检查服务运行状态',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ==================== 日志系统 ====================
const LOG_LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const currentLogLevel = LOG_LEVELS[CONFIG.logLevel] || LOG_LEVELS.error;

function log(level, ...args) {
  if (LOG_LEVELS[level] <= currentLogLevel) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    process.stderr.write(`${prefix} ${args.join(' ')}\n`);
  }
}

// ==================== 参数验证 ====================
function validateParams(name, params) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) return { valid: false, error: `未知工具: ${name}` };

  const schema = tool.inputSchema;
  if (!schema) return { valid: true };

  const args = params || {};

  // 检查必填参数
  if (schema.required) {
    for (const required of schema.required) {
      if (!args[required]) {
        return { valid: false, error: `缺少必填参数: ${required}` };
      }
    }
  }

  // 检查属性
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const value = args[key];
      if (value === undefined) continue;

      // 类型检查
      if (propSchema.type === 'string' && typeof value !== 'string') {
        return { valid: false, error: `参数 ${key} 必须是字符串` };
      }
      if (propSchema.type === 'number' && typeof value !== 'number') {
        return { valid: false, error: `参数 ${key} 必须是数字` };
      }
      if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
        return { valid: false, error: `参数 ${key} 必须是布尔值` };
      }

      // 字符串长度检查
      if (propSchema.type === 'string') {
        if (propSchema.minLength && value.length < propSchema.minLength) {
          return { valid: false, error: `参数 ${key} 长度不能少于 ${propSchema.minLength}` };
        }
      }

      // 数字范围检查
      if (propSchema.type === 'number') {
        if (propSchema.minimum !== undefined && value < propSchema.minimum) {
          return { valid: false, error: `参数 ${key} 不能小于 ${propSchema.minimum}` };
        }
        if (propSchema.maximum !== undefined && value > propSchema.maximum) {
          return { valid: false, error: `参数 ${key} 不能大于 ${propSchema.maximum}` };
        }
      }
    }
  }

  return { valid: true };
}

// ==================== Stdio Protocol ====================
function sendStdio(msg) {
  const json = JSON.stringify(msg);
  const content = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
  process.stdout.write(content);
}

let buffer = Buffer.alloc(0);
let messageCount = 0;

process.stdin.on('data', (chunk) => {
  log('debug', `Received ${chunk.length} bytes`);
  buffer = Buffer.concat([buffer, chunk]);

  while (true) {
    const headerMatch = buffer.toString('utf8').match(/Content-Length: (\d+)\r\n\r\n/);
    if (!headerMatch) {
      break;
    }

    const contentLength = parseInt(headerMatch[1], 10);
    const headerEnd = headerMatch.index + headerMatch[0].length;

    if (buffer.length < headerEnd + contentLength) {
      log('debug', `Waiting for more data: have ${buffer.length}, need ${headerEnd + contentLength}`);
      break;
    }

    const jsonStr = buffer.slice(headerEnd, headerEnd + contentLength).toString('utf8');
    buffer = buffer.slice(headerEnd + contentLength);

    try {
      const msg = JSON.parse(jsonStr);
      messageCount++;
      handleStdioRequest(msg);
    } catch (e) {
      log('error', `Parse error: ${e.message}`);
    }
  }
});

async function handleStdioRequest(msg) {
  const { id, method, params } = msg;

  log('info', `[${messageCount}] ${method}`);

  switch (method) {
    case 'initialize':
      sendStdio({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'xiaozhi-mcp-server', version: '2.0.0' }
        }
      });
      break;

    case 'notifications/initialized':
      log('info', 'Client initialized');
      break;

    case 'tools/list':
      sendStdio({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      break;

    case 'tools/call':
      try {
        const validation = validateParams(params?.name, params?.arguments);
        if (!validation.valid) {
          sendStdio({
            jsonrpc: '2.0', id,
            error: { code: -32602, message: validation.error }
          });
          return;
        }

        const result = await handleToolCall(params);
        sendStdio({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: result }] }
        });
      } catch (err) {
        log('error', `Tool error: ${err.message}`);
        sendStdio({
          jsonrpc: '2.0', id,
          error: { code: -32603, message: err.message }
        });
      }
      break;

    case 'ping':
      sendStdio({ jsonrpc: '2.0', id, result: {} });
      break;

    default:
      log('warn', `Unknown method: ${method}`);
      sendStdio({
        jsonrpc: '2.0', id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
  }
}

// ==================== Tool Implementation ====================
async function handleToolCall(params) {
  const { name, arguments: args } = params || {};
  log('info', `Calling: ${name}`);

  try {
    switch (name) {
      case 'xiaozhi_读取文件':
        return await readFile(args?.path, args?.limit);

      case 'xiaozhi_列出文件':
        return await listFiles(args?.path || '/root/.openclaw/workspace', args?.showHidden);

      case 'xiaozhi_发送电报':
        return await sendTelegramMessage(args?.message, args?.target);

      case 'xiaozhi_系统信息':
        return await getSystemInfo();

      case 'xiaozhi_执行命令':
        return await executeShellCommand(args?.command);

      case 'xiaozhi_检查服务':
        return await checkServices();

      default:
        return `❌ 未知工具: ${name}`;
    }
  } catch (err) {
    log('error', `Execution error: ${err.message}`);
    throw err;
  }
}

async function readFile(filePath, limit) {
  if (!filePath) return '❌ 请提供文件路径';

  const resolvedPath = path.resolve(filePath);
  const maxLines = Math.min(limit || CONFIG.readFileLimit, 10000);

  try {
    const stats = await fs.stat(resolvedPath);
    if (stats.size > CONFIG.maxFileSize) {
      return `❌ 文件过大 (${Math.round(stats.size / 1024)}KB)，请提供更具体的路径`;
    }

    const content = await fs.readFile(resolvedPath, 'utf8');
    const lines = content.split('\n');
    const truncated = lines.slice(0, maxLines).join('\n');
    const suffix = lines.length > maxLines ? `\n\n... (还有 ${lines.length - maxLines} 行)` : '';

    return `📄 [文件: ${filePath}]\n大小: ${Math.round(stats.size / 1024)}KB\n行数: ${lines.length}\n\`\`\`\n${truncated}${suffix}\n\`\`\``;
  } catch (err) {
    return `❌ 读取失败: ${err.message}`;
  }
}

async function listFiles(dirPath, showHidden) {
  const targetPath = dirPath || '/root/.openclaw/workspace';

  try {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const files = entries
      .filter(e => showHidden || !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map(e => {
        const prefix = e.isDirectory() ? '📁' : '📄';
        const suffix = e.isDirectory() ? '/' : '';
        return `${prefix} ${e.name}${suffix}`;
      })
      .slice(0, 50);

    const totalCount = entries.length;
    const hiddenCount = entries.filter(e => e.name.startsWith('.')).length;
    const dirCount = entries.filter(e => e.isDirectory()).length;

    let result = `📂 [目录: ${dirPath}]\n`;
    result += `统计: ${totalCount} 项 (文件夹: ${dirCount}, 隐藏: ${hiddenCount})\n\n`;
    result += files.join('\n');
    if (totalCount > 50) {
      result += `\n... (还有 ${totalCount - 50} 项)`;
    }

    return result;
  } catch (err) {
    return `❌ 列出失败: ${err.message}`;
  }
}

async function sendTelegramMessage(message, target) {
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

    const { stdout } = await execPromise(
      `curl -s -X POST "${url}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`,
      { timeout: 10000 }
    );
    const response = JSON.parse(stdout);

    if (response.ok) {
      return `✅ [Telegram消息已发送]\n消息: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"\n目标: ${CHAT_ID}`;
    } else {
      return `❌ 发送失败: ${response.description}`;
    }
  } catch (err) {
    return `❌ 发送失败: ${err.message}`;
  }
}

async function getSystemInfo() {
  try {
    const [uptime, memory, disk, load] = await Promise.all([
      execPromise('uptime -p 2>/dev/null || uptime'),
      execPromise('free -h 2>/dev/null | head -2 || echo "Memory info unavailable"'),
      execPromise('df -h / 2>/dev/null | tail -1 || echo "Disk info unavailable"'),
      execPromise('cat /proc/loadavg 2>/dev/null | cut -d" " -f1-3 || echo ""')
    ]);

    return `💻 [系统信息]\n\n⏱️ 运行时间: ${uptime.stdout.trim()}\n\n🧠 内存:\n${memory.stdout.trim()}\n\n💾 磁盘:\n${disk.stdout.trim()}\n\n⚡ 负载: ${load.stdout.trim()}`;
  } catch (err) {
    return `⚠️ 部分系统信息无法获取: ${err.message}`;
  }
}

async function executeShellCommand(command) {
  if (!command) return '❌ 请提供要执行的命令';

  // 安全检查
  const dangerousPatterns = ['rm -rf /', 'mkfs', 'dd if=/dev/zero', ':(){ :|:& };:'];
  for (const pattern of dangerousPatterns) {
    if (command.includes(pattern)) {
      return `❌ 危险命令，已阻止执行: ${command}`;
    }
  }

  try {
    const { stdout, stderr } = await execPromise(command, {
      timeout: CONFIG.commandTimeout,
      maxBuffer: 1024 * 1024
    });
    const result = stdout || '';
    const errors = stderr || '';

    return `💻 [执行命令: ${command}]\n\n${result}${errors ? '\n⚠️ 错误输出:\n' + errors : ''}`;
  } catch (err) {
    return `❌ 执行失败: ${err.message}`;
  }
}

async function checkServices() {
  const checks = [
    { name: 'xiaozhi-client', pidFile: '/root/.openclaw/workspace/xiaozhi-mcp/xiaozhi.pid' },
    { name: 'xiaozhi-bridge', pidFile: '/root/.openclaw/workspace/xiaozhi-mcp/bridge.pid' }
  ];

  const results = [];
  for (const check of checks) {
    try {
      const pid = await fs.readFile(check.pidFile, 'utf8');
      process.kill(parseInt(pid.trim()), 0);
      results.push(`✅ ${check.name}: 运行中 (PID: ${pid.trim()})`);
    } catch (err) {
      results.push(`❌ ${check.name}: 未运行`);
    }
  }

  return `🔍 [服务状态]\n${results.join('\n')}\n\n总消息数: ${messageCount}`;
}

process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down...');
  process.exit(0);
});

// 启动日志
log('info', `🚀 xiaozhi-mcp-stdio v2.0.0 started (log level: ${CONFIG.logLevel})`);