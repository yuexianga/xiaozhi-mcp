# 小智 MCP 快速参考

## 📂 目录结构

```
/root/.openclaw/workspace/xiaozhi-mcp/
├── README.md                      # 完整文档
├── QUICKREF.md                    # 本文件 - 快速参考
├── .env                           # 环境配置
├── .env.example                   # 环境配置示例
├── manage.sh                      # 管理脚本 ⭐
├── test.sh                        # 测试脚本
├── xiaozhi-bridge-server.js       # 桥接服务器
├── xiaozhi-client-persistent.js   # 长连接客户端
├── xiaozhi-mcp-stdio.js           # stdio 客户端
├── xiaozhi-mcp-bridge.js          # 桥接代理（已弃用）
├── xiaozhi.log                    # 日志文件
├── xiaozhi.pid                    # 长连接客户端 PID
└── bridge.pid                     # 桥接服务器 PID
```

---

## ⚡ 快速命令

### 启动/停止/状态

```bash
cd /root/.openclaw/workspace/xiaozhi-mcp

# 启动服务
./manage.sh start

# 查看状态
./manage.sh status

# 重启服务
./manage.sh restart

# 停止服务
./manage.sh stop

# 查看日志
./manage.sh logs

# 测试接口
./test.sh
```

### 通过 mcporter 调用

```bash
# 列出所有工具
mcporter list xiaozhi

# 读取文件
mcporter call xiaozhi.xiaozhi_读取文件 path=/tmp/test.txt

# 系统信息
mcporter call xiaozhi.xiaozhi_系统信息

# 执行命令
mcporter call xiaozhi.xiaozhi_执行命令 command="ls -la"

# 发送 Telegram
mcporter call xiaozhi.xiaozhi_发送电报 message="测试消息"
```

---

## 🛠️ 可用工具（快速版）

| 工具名 | 说明 | 示例 |
|--------|------|------|
| `xiaozhi_读取文件` | 读取文件 | `path=/tmp/file.txt` |
| `xiaozhi_列出文件` | 列出目录 | `path=/tmp`, `showHidden=true` |
| `xiaozhi_系统信息` | 系统信息 | - |
| `xiaozhi_执行命令` | 执行命令 | `command="uptime"` |
| `xiaozhi_发送电报` | 发送消息 | `message="hello"`, `target=123` |

### 长连接版本独有工具

- `小欧_发送邮件`, `小欧_网络搜索`, `小欧_网页截图`
- `小欧_保存笔记`, `小欧_添加日程`, `小欧_查看日程`
- `小欧_记账`, `小欧_消费报告`
- `小欧_发布小红书`, `小欧_生成小红书`, `小欧_小红书状态`
- `小欧_重启OpenClaw`, `小欧_切换模型`, `小欧_更新OpenClaw`

---

## 🔧 mcporter 配置

配置文件：`/root/.openclaw/workspace/config/mcporter.json`

```json
{
  "mcpServers": {
    "xiaozhi": {
      "command": "node",
      "args": ["/root/.openclaw/workspace/xiaozhi-mcp/xiaozhi-mcp-stdio.js"],
      "env": {
        "XIAOZHI_MCP_URL": "wss://api.xiaozhi.me/mcp/?token=你的token"
      }
    }
  }
}
```

---

## 📝 直接调用 stdio 接口

```bash
# 初始化
INIT='{"jsonrpc":"2.0","id":1,"method":"initialize"}'
printf "Content-Length: ${#INIT}\r\n\r\n$INIT" | \
  node /root/.openclaw/workspace/xiaozhi-mcp/xiaozhi-mcp-stdio.js

# 列出工具
LIST='{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
printf "Content-Length: ${#LIST}\r\n\r\n$LIST" | \
  node /root/.openclaw/workspace/xiaozhi-mcp/xiaozhi-mcp-stdio.js

# 调用工具
CALL='{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"xiaozhi_系统信息"}}'
printf "Content-Length: ${#CALL}\r\n\r\n$CALL" | \
  node /root/.openclaw/workspace/xiaozhi-mcp/xiaozhi-mcp-stdio.js
```

---

## 🌐 桥接服务器

让小智硬件设备连接：

```bash
# 启动桥接服务器
cd /root/.openclaw/workspace/xiaozhi-mcp
./manage.sh start

# 小智设备连接到
ws://localhost:18790/xiaozhi

# 测试连接
curl http://localhost:18790/
```

---

## 🔍 故障排查

```bash
# 查看进程
ps aux | grep xiaozhi | grep -v grep

# 查看端口占用
lsof -i:18790

# 查看日志
tail -f /root/.openclaw/workspace/xiaozhi-mcp/xiaozhi.log

# 测试连接
curl -s "https://api.xiaozhi.me/mcp/?token=你的token"
```

---

## 📌 重要文件位置

| 文件 | 路径 |
|------|------|
| 主目录 | `/root/.openclaw/workspace/xiaozhi-mcp/` |
| 管理脚本 | `/root/.openclaw/workspace/xiaozhi-mcp/manage.sh` |
| 配置文件 | `/root/.openclaw/workspace/xiaozhi-mcp/.env` |
| mcporter 配置 | `/root/.openclaw/workspace/config/mcporter.json` |
| 日志文件 | `/root/.openclaw/workspace/xiaozhi-mcp/xiaozhi.log` |

---

## 🎯 常见问题

### Q: mcporter 列出工具超时？
A: stdio 客户端与 mcporter 兼容性待优化，建议使用长连接版本。

### Q: 如何重启服务？
A: `cd /root/.openclaw/workspace/xiaozhi-mcp && ./manage.sh restart`

### Q: Token 在哪里配置？
A: 编辑 `.env` 文件中的 `XIAOZHI_MCP_URL`

### Q: 如何添加新工具？
A: 编辑 `xiaozhi-client-persistent.js` 中的 `TOOLS` 数组

---

**更新时间**: 2026-03-03