#!/bin/bash
# 小智 MCP 测试脚本
# 用于快速测试 stdio 接口功能

XIAOZHI_DIR="/root/.openclaw/workspace/xiaozhi-mcp"
STDIO_SCRIPT="$XIAOZHI_DIR/xiaozhi-mcp-stdio.js"

# 加载环境变量
if [ -f "$XIAOZHI_DIR/.env" ]; then
  export $(grep -v '^#' "$XIAOZHI_DIR/.env" | xargs)
fi

echo "🧪 小智 MCP stdio 接口测试"
echo "================================"
echo ""

# 测试 1: 初始化
echo "📌 测试 1: 初始化请求"
INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-script"}}}'
echo "发送: $INIT"
echo ""
echo "响应:"
printf "Content-Length: ${#INIT}\r\n\r\n$INIT" | node "$STDIO_SCRIPT" 2>&1 | head -5 | grep -v DEBUG
echo ""

sleep 1

# 测试 2: 列出工具
echo "📌 测试 2: 列出所有工具"
LIST='{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
echo "发送: $LIST"
echo ""
echo "响应:"
printf "Content-Length: ${#LIST}\r\n\r\n$LIST" | node "$STDIO_SCRIPT" 2>&1 | head -10 | grep -v DEBUG
echo ""

sleep 1

# 测试 3: 调用工具 - 系统信息
echo "📌 测试 3: 调用工具 - 系统信息"
SYSINFO='{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"xiaozhi_系统信息","arguments":{}}}'
echo "发送: 系统信息查询"
echo ""
echo "响应:"
printf "Content-Length: ${#SYSINFO}\r\n\r\n$SYSINFO" | node "$STDIO_SCRIPT" 2>&1 | head -15 | grep -v DEBUG
echo ""

sleep 1

# 测试 4: 调用工具 - 读取文件
echo "📌 测试 4: 调用工具 - 读取文件"
READFILE='{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"xiaozhi_读取文件","arguments":{"path":"/root/.openclaw/workspace/xiaozhi-mcp/README.md","limit":5}}}'
echo "发送: 读取 README.md 前 5 行"
echo ""
echo "响应:"
printf "Content-Length: ${#READFILE}\r\n\r\n$READFILE" | node "$STDIO_SCRIPT" 2>&1 | head -20 | grep -v DEBUG
echo ""

sleep 1

# 测试 5: Ping
echo "📌 测试 5: Ping 请求"
PING='{"jsonrpc":"2.0","id":5,"method":"ping"}'
echo "发送: $PING"
echo ""
echo "响应:"
printf "Content-Length: ${#PING}\r\n\r\n$PING" | node "$STDIO_SCRIPT" 2>&1 | head -5 | grep -v DEBUG
echo ""

echo "================================"
echo "✅ 所有测试完成！"