# Sentinel Dashboard 部署与使用指南

## 概览

Sentinel Dashboard 已部署为独立的 Docker 容器，用于实时监控和动态配置流量控制规则。

## 端口配置

| 服务 | 宿主机端口 | 容器内部端口 | 用途 |
|------|-----------|-------------|------|
| hotel-backend | 8080 | 8080 | 后端 REST API |
| sentinel-dashboard | 8858 | 8080 | Sentinel 控制台（Web UI） |
| sentinel-transport | - | 8719 | 后端与 Dashboard 心跳通信 |

## 启动与停止

### 开发环境

```bash
# 启动所有服务（包括 Sentinel Dashboard）
docker-compose -f docker-compose.dev.yml up -d

# 仅重启 Sentinel Dashboard
docker-compose -f docker-compose.dev.yml restart sentinel-dashboard

# 停止 Sentinel Dashboard
docker-compose -f docker-compose.dev.yml stop sentinel-dashboard

# 查看 Sentinel Dashboard 日志
docker-compose -f docker-compose.dev.yml logs -f sentinel-dashboard
```

### 生产环境

```bash
# 启动所有服务（包括 Sentinel Dashboard）
docker-compose -f docker-compose.prod.yml up -d

# 仅重启 Sentinel Dashboard
docker-compose -f docker-compose.prod.yml restart sentinel-dashboard
```

## 访问控制台

### 开发环境
- **URL**: http://localhost:8858
- **默认账号**: sentinel
- **默认密码**: sentinel

### 生产环境
- **URL**: http://服务器IP:8858
- **默认账号**: sentinel
- **默认密码**: sentinel
- **建议**: 生产环境应修改默认密码或配置 OAuth2 认证

## 配置流控规则

### 1. 等待应用注册

启动后端应用后，调用几次 API（如登录、查询房间），Sentinel Dashboard 会自动发现应用实例。

### 2. 查看资源列表

在 Dashboard 左侧菜单：
- **簇点链路**: 查看所有被 @SentinelResource 标记的资源
- **实时监控**: 查看当前流量 QPS、响应时间等

### 3. 添加流控规则

进入"流控规则"页面，为以下资源配置 QPS 限流：

| 资源名 | 推荐 QPS | 说明 |
|--------|---------|------|
| `booking-create` | 20 | 预订接口，防止超卖与刷单 |
| `auth-login` | 10 | 登录接口，防暴力破解 |
| `auth-register` | 5 | 注册接口，防恶意注册 |
| `room-day-availability` | 50 | 公开可用性查询 |
| `booking-cancel` | 30 | 取消订单接口 |
| `booking-refund-request` | 20 | 退款申请接口 |
| `booking-reschedule` | 20 | 改期请求接口 |
| `wallet-recharge` | 10 | 钱包充值接口 |
| `wallet-query` | 100 | 钱包查询接口 |

### 4. 流控效果

- **直接拒绝（默认）**: 超过阈值直接返回 HTTP 429
- **Warm Up**: 预热启动，逐步增加限流阈值
- **排队等待**: 匀速排队，适用于消息队列场景

## 验证限流效果

### 方法1：使用 curl 快速请求

```bash
# 快速连续请求登录接口10次
for i in {1..10}; do
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' \
    -w "\n%{http_code}\n"
done
```

如果 QPS 设置为 10，连续快速请求会触发限流，返回 429 状态码：
```json
{
  "code": "TOO_MANY_REQUESTS",
  "message": "登录请求过于频繁，请稍后再试"
}
```

### 方法2：查看 Dashboard 监控

在 Dashboard 的"实时监控"页面可以看到：
- 通过 QPS（绿色）
- 拒绝 QPS（红色）
- 响应时间
- 异常比例

## 网络架构

```
┌─────────────────────────────────────────────────────┐
│                   Docker 网络                        │
│                                                     │
│  ┌──────────────┐           ┌──────────────────┐   │
│  │   Backend    │◄─────────►│    Sentinel      │   │
│  │  (容器内:8080)│  心跳8719   │   Dashboard      │   │
│  │              │           │  (容器内:8080)    │   │
│  └──────┬───────┘           └────────┬─────────┘   │
│         │                             │             │
└─────────┼─────────────────────────────┼─────────────┘
          │                             │
          │ 映射                         │ 映射
          ▼                             ▼
    宿主机:8080                     宿主机:8858
```

## 环境变量配置

### 后端应用（hotel-backend）

配置项 `application.yml`:
```yaml
spring:
  cloud:
    sentinel:
      transport:
        dashboard: ${SENTINEL_DASHBOARD_ADDR:localhost:8858}  # Dashboard 地址
        port: 8719                                            # 心跳端口
      eager: false                                            # 延迟连接，避免启动阻塞
      filter:
        enabled: false                                        # 禁用 Web 过滤器
```

Docker 环境变量覆盖：
```yaml
environment:
  SENTINEL_DASHBOARD_ADDR: sentinel-dashboard:8080  # 容器间通信用服务名
```

## 故障排查

### 问题1: Dashboard 看不到应用

**原因**: 应用未发送心跳到 Dashboard

**排查步骤**:
1. 检查后端日志是否有 Sentinel 连接错误
   ```bash
   docker-compose logs backend | grep -i sentinel
   ```
2. 检查环境变量是否正确
   ```bash
   docker exec hotel-backend-dev env | grep SENTINEL
   ```
3. 确认网络连通性
   ```bash
   docker exec hotel-backend-dev ping sentinel-dashboard
   ```
4. 调用几次后端 API，触发资源注册

### 问题2: 限流规则不生效

**原因**: 规则未持久化或 Dashboard 配置错误

**解决方法**:
1. 在 Dashboard 中重新添加规则
2. 检查资源名是否与 `@SentinelResource(value="xxx")` 中的值完全一致
3. 确认规则阈值类型（QPS、线程数、异常比例等）

### 问题3: 启动卡住不动

**原因**: `eager: true` 且 Dashboard 不可达

**解决方法**:
- 已修改为 `eager: false`，延迟连接
- 确保 Dashboard 先于后端启动（通过 `depends_on` 已配置）

## 规则持久化（可选）

当前配置下，规则保存在 Dashboard 内存中，重启后丢失。如需持久化，可配置 Nacos 作为规则存储中心：

```yaml
spring:
  cloud:
    sentinel:
      datasource:
        flow:
          nacos:
            server-addr: nacos:8848
            dataId: sentinel-flow-rules
            groupId: SENTINEL_GROUP
            rule-type: flow
```

## 安全建议

1. **修改默认密码**: 生产环境务必修改 Dashboard 默认账号密码
2. **访问控制**: 通过 Nginx 反向代理添加 IP 白名单或 OAuth2 认证
3. **网络隔离**: 生产环境建议将 Dashboard 部署在内网，不对外暴露
4. **HTTPS**: 生产环境启用 HTTPS 加密传输

## 参考资料

- [Sentinel 官方文档](https://sentinelguard.io/zh-cn/docs/introduction.html)
- [Sentinel Dashboard 使用指南](https://github.com/alibaba/Sentinel/wiki/%E6%8E%A7%E5%88%B6%E5%8F%B0)
- [Spring Cloud Alibaba Sentinel](https://github.com/alibaba/spring-cloud-alibaba/wiki/Sentinel)
