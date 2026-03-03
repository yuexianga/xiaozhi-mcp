#!/usr/bin/env node
/**
 * OpenClaw - 小智 AI WebSocket 桥接服务器
 * 让小智硬件可以通过 WebSocket 与 OpenClaw 对话
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.XIAOZHI_PORT || 18790;

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    name: 'OpenClaw XiaoZhi Bridge',
    status: 'running',
    endpoints: {
      websocket: `ws://localhost:${PORT}/xiaozhi`
    }
  }));
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server, path: '/xiaozhi' });

console.log(`🦞 OpenClaw - 小智 AI 桥接服务器启动中...`);
console.log(`📡 WebSocket 端点: ws://localhost:${PORT}/xiaozhi`);

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🔗 小智设备已连接: ${clientIp}`);

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'welcome',
    message: '你好！我是 OpenClaw，已经准备好和你对话了。',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('📥 收到消息:', msg);

      // 处理不同类型的消息
      switch (msg.type) {
        case 'chat':
          // 文本对话
          const response = await handleChat(msg.content);
          ws.send(JSON.stringify({
            type: 'chat_response',
            content: response,
            timestamp: new Date().toISOString()
          }));
          break;

        case 'command':
          // 执行命令
          const result = await handleCommand(msg.command, msg.args);
          ws.send(JSON.stringify({
            type: 'command_result',
            result: result,
            timestamp: new Date().toISOString()
          }));
          break;

        case 'voice':
          // 语音输入（转文本后处理）
          ws.send(JSON.stringify({
            type: 'voice_response',
            text: `收到语音: "${msg.text}"`,
            action: 'processing',
            timestamp: new Date().toISOString()
          }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `未知消息类型: ${msg.type}`,
            timestamp: new Date().toISOString()
          }));
      }
    } catch (err) {
      console.error('❌ 处理消息错误:', err);
      ws.send(JSON.stringify({
        type: 'error',
        message: err.message,
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    console.log(`👋 小智设备断开连接: ${clientIp}`);
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket 错误:', err);
  });
});

// 处理对话
async function handleChat(content) {
  // 这里可以调用 OpenClaw 的 Agent 来处理对话
  return `OpenClaw 收到: "${content}"\n\n我可以帮你：\n- 执行系统命令\n- 读取文件\n- 搜索网络\n- 发送消息\n\n请告诉我你需要什么帮助！`;
}

// 处理命令
async function handleCommand(command, args) {
  const commands = {
    'status': () => 'OpenClaw 运行正常',
    'memory': () => '记忆功能已就绪',
    'tools': () => '可用工具: execute_command, read_file, web_search, send_message',
    'help': () => '使用说明: 发送 {type: "chat", content: "你的问题"} 开始对话',
  };

  if (commands[command]) {
    return commands[command](args);
  }
  return `未知命令: ${command}。可用命令: status, memory, tools, help`;
}

server.listen(PORT, () => {
  console.log(`✅ 服务器已启动，监听端口 ${PORT}`);
  console.log(`📝 API 文档:`);
  console.log(`   - 连接: ws://localhost:${PORT}/xiaozhi`);
  console.log(`   - 对话: {type: "chat", content: "你好"}`);
  console.log(`   - 命令: {type: "command", command: "status"}`);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...');
  wss.close();
  server.close();
  process.exit(0);
});
