# 小智 MCP 服务器 v2.0

小智 AI MCP（Model Context Protocol）服务器的完整实现，支持三种运行模式。

[![版本](https://img.shields.io/badge/版本-v2.0.0-brightgreen.svg)](CHANGELOG.md)

## 📁 文件说明

| 文件 | 模式 | 用途 | 协议 |
|------|------|------|------|
| `xiaozhi-bridge-server.js` | 独立服务器 | 让小智硬件设备连接到 OpenClaw | WebSocket (ws://) |
| `xiaozhi-client-persistent.js` | 长连接客户端 | OpenClaw 作为 MCP 客户端连接小智服务器 | WebSocket (wss://) |
| `xiaozhi-mcp-stdio.js` | stdio 客户端 | 供 mcporter/MCP SDK 调用 | MCP stdio |

---

## 🚀 快速开始

### 1. 配置 Token

创建 `.env` 文件：

```bash
XIAOZHI_MCP_URL="wss://api.xiaozhi.me/mcp/?token=你的token"
```

### 2. 运行方式选择

#### 方式 A：启动独立服务器（让小智设备连接）

```bash
node xiaozhi-bridge-server.js
```

访问：`http://localhost:18790/xiaozhi`

#### 方式 B：启动长连接客户端（作为 MCP 服务器）

```bash
XIAOZHI_MCP_URL="wss://api.xiaozhi.me/mcp/?token=xxx" \
node xiaozhi-client-persistent.js
```

#### 方式 C：使用 mcporter（推荐）

```bash
# 配置 mcporter.json
mcporter config add xiaozhi \
  --command node \
  --args "./xiaozhi-mcp/xiaozhi-mcp-stdio.js" \
  --env "XIAOZHI_MCP_URL=wss://api.xiaozhi.me/mcp/?token=xxx"

# 列出工具
mcporter list xiaozhi

# 调用工具
mcporter call xiaozhi.xiaozhi_读取文件 path=/tmp/test.txt
mcporter call xiaozhi.xiaozhi_系统信息
```

---

## 🛠️ 可用工具

### 基础工具 (所有版本)

| 工具名 | 说明 | 参数 |
|--------|------|------|
| `xiaozhi_读取文件` | 读取文件内容 | `path` (路径), `limit` (最大行数) |
| `xiaozhi_列出文件` | 列出目录文件 | `path` (路径), `showHidden` (显示隐藏) |
| `xiaozhi_系统信息` | 获取系统信息 | 无 |
| `xiaozhi_执行命令` | 执行 Shell 命令 | `command` (命令) |
| `xiaozhi_发送电报` | 发送 Telegram 消息 | `message` (内容), `target` (目标) |
| `xiaozhi_检查服务` | 检查服务运行状态 | 无 |

### 长连接版本独有工具 (共18个)

- `小欧_发送邮件` - 发送邮件（需配置 SMTP）
- `小欧_网络搜索` - 网络搜索（需配置 API）
- `小欧_网页截图` - 截取网页
- `小欧_保存笔记` - 保存笔记到记忆
- `小欧_添加日程` - 添加日历事件
- `小欧_查看日程` - 查看日程
- `小欧_记账` - 记录消费
- `小欧_消费报告` - 消费统计
- `小欧_重启OpenClaw` - 重启 OpenClaw
- `小欧_切换模型` - 切换 AI 模型
- `小欧_检查版本` - 检查版本
- `小欧_更新OpenClaw` - 更新 OpenClaw

---

## 🔧 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `XIAOZHI_MCP_URL` | 小智 MCP WebSocket URL | 无 |
| `XIAOZHI_PORT` | 桥接服务器端口 | 18790 |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | 见脚本内 |
| `TELEGRAM_CHAT_ID` | 默认聊天 ID | 见脚本内 |

---

## 📊 运行模式对比

| 模式 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| 桥接服务器 | 拥有小智硬件设备 | 可接受设备连接，简单易用 | 功能有限 |
| 长连接客户端 | 需要完整工具集 | 功能最全，支持所有高级工具 | 需保持连接 |
| stdio 客户端 | 通过 mcporter 调用 | 标准化协议，易于集成 | 工具较少 |

---

## 📝 管理命令

```bash
# 查看运行状态
ps aux | grep xiaozhi | grep -v grep

# 启动长连接客户端（后台）
nohup node xiaozhi-client-persistent.js > xiaozhi.log 2>&1 &

# 查看日志
tail -f xiaozhi.log

# 停止服务
pkill -f xiaozhi-client-persistent
```

---

## 🔍 故障排查

### 连接失败

检查 token 是否有效：
```bash
curl -s "https://api.xiaozhi.me/mcp/?token=你的token"
```

### mcporter 超时

stdio 客户端目前与 mcporter 存在兼容性问题，建议：
1. 使用长连接版本（`xiaozhi-client-persistent.js`）
2. 或直接调用 WebSocket API

### 工具执行失败

检查权限：
```bash
# 确保有文件读写权限
ls -la /root/.openclaw/workspace

# 确保有执行命令权限
whoami
```

---

## 📚 API 示例

### 直接调用 stdio 版本

```bash
# 初始化 + 列出工具
INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}'
LIST='{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

(
  printf "Content-Length: ${#INIT}\r\n\r\n$INIT"
  printf "Content-Length: ${#LIST}\r\n\r\n$LIST"
) | node xiaozhi-mcp-stdio.js
```

### 调用工具

```bash
TOOL_CALL='{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"xiaozhi_系统信息"}}'

printf "Content-Length: ${#TOOL_CALL}\r\n\r\n$TOOL_CALL" | node xiaozhi-mcp-stdio.js
```

---

## 📄 许可证

MIT

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**最后更新**: 2026-03-03