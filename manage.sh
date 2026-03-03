#!/bin/bash
# 小智 MCP 管理脚本 v2.0
# 用法: ./manage.sh [start|stop|status|restart|logs|test|health|clean]

set -e

XIAOZHI_DIR="/root/.openclaw/workspace/xiaozhi-mcp"
LOG_FILE="$XIAOZHI_DIR/xiaozhi.log"
PID_FILE="$XIAOZHI_DIR/xiaozhi.pid"
BRIDGE_PID_FILE="$XIAOZHI_DIR/bridge.pid"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 工具函数
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# 加载环境变量
if [ -f "$XIAOZHI_DIR/.env" ]; then
  export $(grep -v '^#' "$XIAOZHI_DIR/.env" | xargs)
fi

XIAOZHI_MCP_URL="${XIAOZHI_MCP_URL:-wss://api.xiaozhi.me/mcp/?token=your_token}"

# 检查依赖
check_dependencies() {
  local deps=("node" "curl")
  for dep in "${deps[@]}"; do
    if ! command -v "$dep" &> /dev/null; then
      print_error "缺少依赖: $dep"
      return 1
    fi
  done
  return 0
}

# 检查文件
check_files() {
  local files=(
    "$XIAOZHI_DIR/xiaozhi-client-persistent.js"
    "$XIAOZHI_DIR/xiaozhi-bridge-server.js"
    "$XIAOZHI_DIR/xiaozhi-mcp-stdio.js"
  )
  for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
      print_error "文件不存在: $file"
      return 1
    fi
  done
  return 0
}

# 获取进程状态
get_process_status() {
  local pid_file=$1
  local name=$2

  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      local uptime=$(ps -p "$pid" -o etime= | tr -d ' ')
      echo "running:$pid:$uptime"
      return 0
    else
      rm -f "$pid_file"
      echo "stopped"
      return 1
    fi
  else
    echo "stopped"
    return 1
  fi
}

# 启动长连接客户端
start_client() {
  local status=$(get_process_status "$PID_FILE" "xiaozhi-client")
  if [[ "$status" == running:* ]]; then
    local pid=$(echo "$status" | cut -d: -f2)
    print_warning "长连接客户端已在运行 (PID: $pid)"
    return 0
  fi

  print_info "启动长连接客户端..."
  cd "$XIAOZHI_DIR"

  XIAOZHI_MCP_URL="$XIAOZHI_MCP_URL" \
    nohup node xiaozhi-client-persistent.js >> "$LOG_FILE" 2>&1 &
  local pid=$!
  echo $pid > "$PID_FILE"

  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    print_success "长连接客户端已启动 (PID: $pid)"
    return 0
  else
    print_error "长连接客户端启动失败"
    rm -f "$PID_FILE"
    return 1
  fi
}

# 启动桥接服务器
start_bridge() {
  local status=$(get_process_status "$BRIDGE_PID_FILE" "xiaozhi-bridge")
  if [[ "$status" == running:* ]]; then
    local pid=$(echo "$status" | cut -d: -f2)
    print_warning "桥接服务器已在运行 (PID: $pid)"
    return 0
  fi

  print_info "启动桥接服务器..."
  cd "$XIAOZHI_DIR"

  nohup node xiaozhi-bridge-server.js >> "$LOG_FILE" 2>&1 &
  local pid=$!
  echo $pid > "$BRIDGE_PID_FILE"

  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    print_success "桥接服务器已启动 (PID: $pid)"
    return 0
  else
    print_error "桥接服务器启动失败"
    rm -f "$BRIDGE_PID_FILE"
    return 1
  fi
}

# 停止服务
stop_process() {
  local pid_file=$1
  local name=$2

  if [ ! -f "$pid_file" ]; then
    print_warning "$name 未启动"
    return 0
  fi

  local pid=$(cat "$pid_file")
  if kill -0 "$pid" 2>/dev/null; then
    print_info "停止 $name (PID: $pid)..."
    kill "$pid"
    local count=0
    while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
      sleep 1
      count=$((count + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
      print_warning "$name 未响应，强制停止..."
      kill -9 "$pid" 2>/dev/null || true
    fi
    print_success "$name 已停止"
  else
    print_warning "$name 未运行"
  fi
  rm -f "$pid_file"
}

# 健康检查
health_check() {
  print_info "执行健康检查..."

  local checks_passed=0
  local checks_failed=0

  # 检查依赖
  if check_dependencies; then
    print_success "依赖检查通过"
    checks_passed=$((checks_passed + 1))
  else
    print_error "依赖检查失败"
    checks_failed=$((checks_failed + 1))
  fi

  # 检查文件
  if check_files; then
    print_success "文件检查通过"
    checks_passed=$((checks_passed + 1))
  else
    print_error "文件检查失败"
    checks_failed=$((checks_failed + 1))
  fi

  # 检查环境变量
  if [ -n "$XIAOZHI_MCP_URL" ] && [[ ! "$XIAOZHI_MCP_URL" == *"your_token"* ]]; then
    print_success "环境变量配置正确"
    checks_passed=$((checks_passed + 1))
  else
    print_error "环境变量未正确配置"
    checks_failed=$((checks_failed + 1))
  fi

  # 检查端口
  if curl -s http://localhost:18790/ > /dev/null 2>&1; then
    print_success "桥接服务器端口响应正常"
    checks_passed=$((checks_passed + 1))
  else
    print_warning "桥接服务器端口无响应 (可能未启动)"
  fi

  echo ""
  print_info "检查结果: $checks_passed 通过, $checks_failed 失败"

  return $checks_failed
}

# 主命令处理
case "$1" in
  start)
    print_info "启动小智 MCP 服务..."
    echo ""

    check_dependencies || exit 1
    check_files || exit 1

    start_client || exit 1
    start_bridge || exit 1

    echo ""
    print_success "所有服务已启动"
    echo ""
    print_info "使用 './manage.sh status' 查看状态"
    ;;

  stop)
    print_info "停止小智 MCP 服务..."
    echo ""

    stop_process "$PID_FILE" "长连接客户端"
    stop_process "$BRIDGE_PID_FILE" "桥接服务器"

    echo ""
    print_success "所有服务已停止"
    ;;

  status)
    echo "📊 小智 MCP 运行状态"
    echo "================================"
    echo ""

    # 长连接客户端
    client_status=$(get_process_status "$PID_FILE" "xiaozhi-client")
    if [[ "$client_status" == running:* ]]; then
      client_pid=$(echo "$client_status" | cut -d: -f2)
      client_uptime=$(echo "$client_status" | cut -d: -f3)
      print_success "长连接客户端: 运行中"
      echo "   PID: $client_pid"
      echo "   运行时间: $client_uptime"
    else
      print_error "长连接客户端: 未运行"
    fi
    echo ""

    # 桥接服务器
    bridge_status=$(get_process_status "$BRIDGE_PID_FILE" "xiaozhi-bridge")
    if [[ "$bridge_status" == running:* ]]; then
      bridge_pid=$(echo "$bridge_status" | cut -d: -f2)
      bridge_uptime=$(echo "$bridge_status" | cut -d: -f3)
      print_success "桥接服务器: 运行中"
      echo "   PID: $bridge_pid"
      echo "   运行时间: $bridge_uptime"
      echo "   监听端口: 18790"
    else
      print_error "桥接服务器: 未运行"
    fi
    echo ""

    # 日志信息
    print_info "日志文件: $LOG_FILE"
    if [ -f "$LOG_FILE" ]; then
      log_size=$(du -h "$LOG_FILE" | cut -f1)
      echo "日志大小: $log_size"
      last_modified=$(stat -c %y "$LOG_FILE" | cut -d'.' -f1)
      echo "最后更新: $last_modified"
    fi
    ;;

  restart)
    print_info "重启小智 MCP 服务..."
    $0 stop
    sleep 2
    $0 start
    ;;

  logs)
    lines=${2:-50}
    if [ -f "$LOG_FILE" ]; then
      print_info "小智 MCP 日志 (最近 $lines 行)"
      echo "================================"
      tail -n "$lines" "$LOG_FILE"
    else
      print_error "日志文件不存在: $LOG_FILE"
    fi
    ;;

  test)
    print_info "测试 stdio 接口..."
    echo ""

    INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}'
    LIST='{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
    PING='{"jsonrpc":"2.0","id":3,"method":"ping"}'

    print_info "发送初始化请求..."
    printf "Content-Length: ${#INIT}\r\n\r\n$INIT" | \
      node "$XIAOZHI_DIR/xiaozhi-mcp-stdio.js" 2>&1 | \
      grep -v "DEBUG" | grep -v "INFO" | head -3

    echo ""
    print_info "发送 Ping 请求..."
    printf "Content-Length: ${#PING}\r\n\r\n$PING" | \
      node "$XIAOZHI_DIR/xiaozhi-mcp-stdio.js" 2>&1 | \
      grep -v "DEBUG" | grep -v "INFO" | head -2

    echo ""
    print_success "测试完成"
    ;;

  health)
    health_check
    ;;

  clean)
    print_info "清理日志和临时文件..."
    echo ""

    [ -f "$LOG_FILE" ] && { rm -f "$LOG_FILE" && print_success "日志已清理"; }
    [ -f "$PID_FILE" ] && ! kill -0 $(cat "$PID_FILE") 2>/dev/null && { rm -f "$PID_FILE" && print_success "PID 文件已清理"; }
    [ -f "$BRIDGE_PID_FILE" ] && ! kill -0 $(cat "$BRIDGE_PID_FILE") 2>/dev/null && { rm -f "$BRIDGE_PID_FILE" && print_success "PID 文件已清理"; }

    echo ""
    print_success "清理完成"
    ;;

  *)
    echo "📖 小智 MCP 管理脚本 v2.0"
    echo ""
    echo "用法: $0 [命令] [参数]"
    echo ""
    echo "命令:"
    echo "  start    - 启动所有服务"
    echo "  stop     - 停止所有服务"
    echo "  status   - 查看运行状态"
    echo "  restart  - 重启所有服务"
    echo "  logs     - 查看日志 (默认50行, 可指定行数)"
    echo "  test     - 测试 stdio 接口"
    echo "  health   - 执行健康检查"
    echo "  clean    - 清理日志和临时文件"
    echo ""
    echo "示例:"
    echo "  $0 start           # 启动服务"
    echo "  $0 status          # 查看状态"
    echo "  $0 logs 100        # 查看最近100行日志"
    echo "  $0 health          # 健康检查"
    exit 1
    ;;
esac