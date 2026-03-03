# 小智 MCP 更新日志

## v2.0.0 (2026-03-03)

### 优化项

#### 1. stdio 客户端优化 (xiaozhi-mcp-stdio.js)

- **日志系统改进**
  - 支持可配置日志级别 (silent/error/warn/info/debug)
  - 通过环境变量 `XIAOZHI_LOG_LEVEL` 控制
  - 默认为 error 级别，减少噪音输出

- **参数验证增强**
  - 完整的 JSON Schema 验证
  - 类型检查、长度检查、范围检查
  - 更友好的错误提示

- **新增工具**
  - `xiaozhi_检查服务` - 检查服务运行状态
  - 显示运行时间、消息计数

- **安全性提升**
  - 危险命令黑名单 (rm -rf /, mkfs, dd 等)
  - 文件大小限制 (100KB)
  - 命令执行超时保护 (30秒)
  - 缓冲区大小限制 (1MB)

- **性能优化**
  - 并行执行系统信息查询
  - 文件读取行数限制 (10000行)
  - 更高效的日志处理

#### 2. 管理脚本优化 (manage.sh v2.0)

- **增强的功能**
  - 健康检查命令 (`health`)
  - 清理命令 (`clean`)
  - 可配置日志行数 (`logs [行数]`)

- **改进的状态显示**
  - 彩色输出 (支持终端颜色)
  - 运行时间显示
  - 日志文件大小和更新时间
  - 更友好的进度反馈

- **更好的错误处理**
  - 依赖检查
  - 文件完整性检查
  - 环境变量验证
  - 优雅的进程停止 (SIGTERM → SIGKILL)

#### 3. 文档改进

- 新增 `QUICKREF.md` 快速参考指南
- 更新 `README.md` 包含完整的功能说明
- 新增更新日志 (`CHANGELOG.md`)

### 向后兼容性

✅ 完全向后兼容 v1.0
✅ 配置文件格式不变
✅ API 接口不变

### 升级指南

```bash
cd /root/.openclaw/workspace/xiaozhi-mcp

# 停止服务
./manage.sh stop

# 备份旧版本（可选）
cp xiaozhi-mcp-stdio.js xiaozhi-mcp-stdio.js.bak
cp manage.sh manage.sh.bak

# 启动服务
./manage.sh start

# 健康检查
./manage.sh health
```

---

## v1.0.0 (2026-03-03)

### 初始版本

- ✅ 长连接客户端 (xiaozhi-client-persistent.js)
- ✅ 桥接服务器 (xiaozhi-bridge-server.js)
- ✅ stdio 客户端 (xiaozhi-mcp-stdio.js)
- ✅ 基础管理脚本 (manage.sh)
- ✅ 5个基础工具
- ✅ 23个高级工具 (长连接版本)