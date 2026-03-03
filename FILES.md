# 小智 MCP 文件清单

## 📁 目录结构

```
/root/.openclaw/workspace/xiaozhi-mcp/
├── xiaozhi-bridge-server.js       # 桥接服务器 - 让小智设备连接
├── xiaozhi-client-persistent.js   # 长连接客户端 - MCP 服务器 (18个工具)
├── xiaozhi-mcp-stdio.js          # stdio 客户端 - 供 mcporter 调用
├── manage.sh                      # 管理脚本 (启动/停止/状态/健康检查)
├── test.sh                        # 测试脚本
├── .env                           # 环境配置 (包含 token)
├── .env.example                   # 配置模板
├── README.md                      # 完整文档
├── QUICKREF.md                    # 快速参考
├── CHANGELOG.md                   # 版本更新日志
├── OPTIMIZATION.md                # 优化说明
├── FILES.md                       # 本文件 - 文件清单
├── xiaozhi.log                    # 运行日志
├── xiaozhi.pid                    # 长连接客户端 PID
├── bridge.pid                     # 桥接服务器 PID
└── data/                          # 数据目录 (自动创建)
    ├── pending-emails.json        # 待发送邮件
    ├── xiaozhi-notes.md           # 笔记
    ├── calendar-events.json       # 日程事件
    └── expenses.json              # 消费记录
```

## 📄 文件说明

### 核心程序 (3个)

| 文件 | 大小 | 行数 | 用途 |
|------|------|------|------|
| `xiaozhi-client-persistent.js` | 26KB | ~670 | 长连接客户端，支持18个工具 |
| `xiaozhi-mcp-stdio.js` | 14KB | ~400 | stdio 客户端，供 mcporter 调用 |
| `xiaozhi-bridge-server.js` | 4KB | ~120 | 桥接服务器，端口 18790 |

### 脚本文件 (2个)

| 文件 | 权限 | 用途 |
|------|------|------|
| `manage.sh` | 可执行 | 服务管理: start/stop/status/restart/health/clean |
| `test.sh` | 可执行 | stdio 接口测试 |

### 配置文件 (2个)

| 文件 | 用途 |
|------|------|
| `.env` | 实际环境配置 (含 token) |
| `.env.example` | 配置模板 |

### 文档文件 (5个)

| 文件 | 大小 | 内容 |
|------|------|------|
| `README.md` | 4.8KB | 完整使用文档 |
| `QUICKREF.md` | 4.7KB | 快速参考指南 |
| `CHANGELOG.md` | 2.2KB | 版本更新历史 |
| `OPTIMIZATION.md` | 5.0KB | v2.0 优化详情 |
| `FILES.md` | 3.4KB | 文件清单（本文件）|

### 运行时文件 (3个)

| 文件 | 说明 |
|------|------|
| `xiaozhi.log` | 运行日志 |
| `xiaozhi.pid` | 长连接客户端进程 ID |
| `bridge.pid` | 桥接服务器进程 ID |

### 数据目录 (data/)

所有应用数据都存储在 `xiaozhi-mcp/data/` 目录下：

| 文件 | 用途 |
|------|------|
| `pending-emails.json` | 待发送邮件队列 |
| `xiaozhi-notes.md` | 笔记记录 |
| `calendar-events.json` | 日程事件 |
| `expenses.json` | 消费记录 |

## 🛠️ 工具清单

### 长连接客户端 (18个工具)

```
1.  小欧_读取文件
2.  小欧_列出文件
3.  小欧_发送电报
4.  小欧_发送邮件
5.  小欧_系统信息
6.  小欧_网络搜索
7.  小欧_网页截图
8.  小欧_状态 (Git)
9.  小欧_执行命令
10. 小欧_重启OpenClaw
11. 小欧_切换模型
12. 小欧_检查版本
13. 小欧_更新OpenClaw
14. 小欧_保存笔记
15. 小欧_添加日程
16. 小欧_查看日程
17. 小欧_记账
18. 小欧_消费报告
```

### stdio 客户端 (6个工具)

```
1.  xiaozhi_读取文件
2.  xiaozhi_列出文件
3.  xiaozhi_发送电报
4.  xiaozhi_系统信息
5.  xiaozhi_执行命令
6.  xiaozhi_检查服务
```

## 🚀 快速开始

```bash
cd /root/.openclaw/workspace/xiaozhi-mcp

# 启动服务
./manage.sh start

# 查看状态
./manage.sh status

# 健康检查
./manage.sh health

# 查看日志
./manage.sh logs

# 停止服务
./manage.sh stop
```

## 📊 文件统计

- **总文件数**: 14个 (不含 . 和 ..)
- **核心代码**: 3个 JS 文件
- **脚本**: 2个 Shell 脚本
- **文档**: 5个 Markdown 文件
- **配置**: 2个 环境文件
- **运行时**: 3个 动态文件
- **数据目录**: 1个目录 (含4个数据文件)

**总大小**: ~90KB (不含日志)

## 🔧 数据文件说明

### 邮件队列 (pending-emails.json)
```json
[
  {
    "to": "example@email.com",
    "subject": "邮件主题",
    "body": "邮件内容",
    "timestamp": "2026-03-03T22:00:00.000Z",
    "status": "pending"
  }
]
```

### 笔记 (xiaozhi-notes.md)
```markdown
## 2026-03-03T22:00:00.000Z [标签]
笔记内容
```

### 日程事件 (calendar-events.json)
```json
[
  {
    "title": "事件标题",
    "startTime": "2026-03-03T10:00:00.000Z",
    "endTime": "2026-03-03T11:00:00.000Z",
    "description": "事件描述",
    "location": "地点",
    "createdAt": "2026-03-03T22:00:00.000Z"
  }
]
```

### 消费记录 (expenses.json)
```json
[
  {
    "amount": 100.50,
    "category": "餐饮",
    "item": "午餐",
    "note": "备注",
    "timestamp": "2026-03-03T22:00:00.000Z",
    "date": "2026/03/03"
  }
]
```

---

**更新时间**: 2026-03-03
**版本**: v2.0.0