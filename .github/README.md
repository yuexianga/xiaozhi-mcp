# 小智 MCP 服务器

小智 AI MCP（Model Context Protocol）服务器的完整实现，支持18个实用工具。

## 🚀 特性

- ✅ 长连接客户端 - 18个工具
- ✅ stdio 客户端 - 供 mcporter 调用
- ✅ 桥接服务器 - 让小智设备连接
- ✅ 管理脚本 - start/stop/status/health/clean
- ✅ 数据管理 - 所有数据统一存储在 data/ 目录

## 🛠️ 可用工具

### 基础工具 (6个)
- 读取文件、列出文件、发送电报、系统信息、执行命令、Git状态

### 高级工具 (12个)
- 发送邮件、网络搜索、网页截图
- OpenClaw管理：重启、切换模型、检查版本、更新
- 笔记和日程：保存笔记、添加日程、查看日程
- 账单管理：记账、消费报告

## 📁 项目结构

```
xiaozhi-mcp/
├── 核心程序 (3个)
├── 脚本文件 (2个)
├── 配置文件 (2个)
├── 文档文件 (5个)
├── 运行时文件 (3个)
└── data/ (4个数据文件)
```

## 📖 快速开始

```bash
cd xiaozhi-mcp
./manage.sh start
```

## 📄 文档

- [README.md](README.md) - 完整文档
- [QUICKREF.md](QUICKREF.md) - 快速参考
- [FILES.md](FILES.md) - 文件清单
- [CHANGELOG.md](CHANGELOG.md) - 版本日志
- [OPTIMIZATION.md](OPTIMIZATION.md) - 优化说明

## 📊 统计

- 18个可用工具
- 14个文件
- ~90KB代码

## 📄 许可证

MIT

---

**版本**: v2.0.0
**更新时间**: 2026-03-03