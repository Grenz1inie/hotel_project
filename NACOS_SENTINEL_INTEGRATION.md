# Nacos + Sentinel 集成配置说明

## 概览

本项目已完成 Nacos 与 Sentinel 的深度集成，实现了以下功能：
- **服务注册与发现**：后端应用自动注册到 Nacos
- **配置中心**：从 Nacos 读取配置（可选）
- **Sentinel 规则持久化**：流控、熔断、热点参数规则自动同步到 Nacos

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker 网络                             │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Backend    │───►│    Nacos     │◄───│   Sentinel   │  │
│  │              │    │              │    │   Dashboard  │  │
│  │  • 注册服务   │    │  • 服务注册   │    │              │  │
│  │  • 读取规则   │    │  • 配置中心   │    │  • 推送规则  │  │
│  │  • 上报心跳   │    │  • 规则存储   │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 已完成的配置

### 1. Maven 依赖（pom.xml）

```xml
<!-- Nacos 服务注册与发现 -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
</dependency>

<!-- Nacos 配置中心 -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
</dependency>

<!-- Sentinel 限流与熔断 -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>

<!-- Sentinel Nacos 数据源：实现规则持久化 -->
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-datasource-nacos</artifactId>
</dependency>
```

### 2. 应用配置（application.yml）

```yaml
spring:
  application:
    name: hotel-backend
  config:
    import: optional:nacos:application.yml
  
  cloud:
    nacos:
      discovery:
        server-addr: ${NACOS_SERVER_ADDR:127.0.0.1:8848}
      config:
        server-addr: ${NACOS_SERVER_ADDR:127.0.0.1:8848}
    
    sentinel:
      transport:
        dashboard: ${SENTINEL_DASHBOARD_ADDR:localhost:8858}
        port: 8719
      eager: false
      filter:
        enabled: false
      datasource:
        # 流控规则
        flow:
          nacos:
            server-addr: ${NACOS_SERVER_ADDR:127.0.0.1:8848}
            dataId: hotel-backend-flow-rules
            groupId: SENTINEL_GROUP
            rule-type: flow
            data-type: json
        # 熔断降级规则
        degrade:
          nacos:
            server-addr: ${NACOS_SERVER_ADDR:127.0.0.1:8848}
            dataId: hotel-backend-degrade-rules
            groupId: SENTINEL_GROUP
            rule-type: degrade
            data-type: json
        # 热点参数限流规则
        param-flow:
          nacos:
            server-addr: ${NACOS_SERVER_ADDR:127.0.0.1:8848}
            dataId: hotel-backend-param-flow-rules
            groupId: SENTINEL_GROUP
            rule-type: param-flow
            data-type: json
```

### 3. 环境配置

#### 开发环境（application-dev.yml）
```yaml
spring:
  cloud:
    nacos:
      discovery:
        server-addr: nacos:8848
      config:
        server-addr: nacos:8848
```

#### 生产环境（application-prod.yml）
```yaml
spring:
  cloud:
    nacos:
      discovery:
        server-addr: nacos:8848
      config:
        server-addr: nacos:8848
```

### 4. Docker 配置

#### Nacos 容器（docker/apps/nacos.yml）
```yaml
services:
  nacos:
    image: nacos/nacos-server:v3.0.3
    container_name: hotel-nacos
    environment:
      MODE: standalone
      PREFER_HOST_MODE: hostname
      NACOS_AUTH_ENABLE: "false"
    ports:
      - "8848:8848"
      - "9848:9848"
```

#### 后端环境变量
- `NACOS_SERVER_ADDR=nacos:8848`
- `SENTINEL_DASHBOARD_ADDR=sentinel-dashboard:8080`

## 使用流程

### 步骤1：在 Sentinel Dashboard 中配置规则

1. 访问 Sentinel Dashboard: http://localhost:8858
2. 登录（sentinel / sentinel）
3. 等待应用注册（调用几次 API 触发注册）
4. 在"流控规则"页面添加规则，例如：
   - 资源名：`auth-login`
   - 阈值类型：QPS
   - 单机阈值：10

### 步骤2：Dashboard 自动推送规则到 Nacos

当你在 Dashboard 中配置规则后，规则会自动推送到 Nacos 配置中心。你可以在 Nacos 控制台验证：

1. 访问 Nacos 控制台: http://localhost:8848/nacos
2. 进入"配置管理" → "配置列表"
3. 查找 Group 为 `SENTINEL_GROUP` 的配置项：
   - `hotel-backend-flow-rules`（流控规则）
   - `hotel-backend-degrade-rules`（熔断规则）
   - `hotel-backend-param-flow-rules`（热点参数规则）

### 步骤3：后端应用自动读取并应用规则

后端应用启动时会自动从 Nacos 读取已存在的规则，运行时也会实时监听规则变化。

### 步骤4：重启验证

重启后端应用后，之前配置的规则依然生效，不会丢失。

## 规则配置示例

### 在 Nacos 中手动创建流控规则

如果你想直接在 Nacos 中配置规则（不通过 Dashboard），可以按以下格式创建配置：

**Data ID**: `hotel-backend-flow-rules`  
**Group**: `SENTINEL_GROUP`  
**配置格式**: JSON  
**配置内容**:
```json
[
  {
    "resource": "auth-login",
    "limitApp": "default",
    "grade": 1,
    "count": 10,
    "strategy": 0,
    "controlBehavior": 0,
    "clusterMode": false
  },
  {
    "resource": "booking-create",
    "limitApp": "default",
    "grade": 1,
    "count": 20,
    "strategy": 0,
    "controlBehavior": 0,
    "clusterMode": false
  }
]
```

**字段说明**：
- `resource`: 资源名（对应 @SentinelResource 的 value）
- `limitApp`: 来源应用（默认 default）
- `grade`: 阈值类型（1=QPS，0=线程数）
- `count`: 阈值
- `strategy`: 流控模式（0=直接，1=关联，2=链路）
- `controlBehavior`: 流控效果（0=快速失败，1=Warm Up，2=排队等待）
- `clusterMode`: 是否集群模式

## 访问地址

| 服务 | 地址 | 账号/密码 |
|------|------|----------|
| Nacos 控制台 | http://localhost:8848/nacos | nacos / nacos |
| Sentinel Dashboard | http://localhost:8858 | sentinel / sentinel |
| 后端 API | http://localhost:8080 | - |

## 端口说明

| 服务 | 宿主机端口 | 容器内部端口 | 用途 |
|------|-----------|-------------|------|
| Nacos | 8848 | 8848 | Nacos HTTP API |
| Nacos | 9848 | 9848 | Nacos gRPC |
| Nacos | 9849 | 9849 | Nacos gRPC 客户端 |
| Sentinel Dashboard | 8858 | 8080 | Sentinel 控制台 |
| Backend | 8080 | 8080 | 后端 REST API |
| Backend | - | 8719 | Sentinel 心跳端口 |

## 推荐的流控规则配置

基于当前项目的接口特点，推荐以下 QPS 配置：

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

## 配置验证

### 1. 验证服务注册

```bash
# 查看 Nacos 中注册的服务
curl http://localhost:8848/nacos/v1/ns/instance/list?serviceName=hotel-backend
```

### 2. 验证 Sentinel 规则同步

在 Nacos 控制台查看配置列表，确认以下配置存在：
- `hotel-backend-flow-rules`（流控规则）
- `hotel-backend-degrade-rules`（熔断规则）
- `hotel-backend-param-flow-rules`（热点参数规则）

### 3. 验证限流效果

```bash
# 快速连续请求登录接口，触发限流
for i in {1..15}; do
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' \
    -w "\n%{http_code}\n"
done
```

如果配置生效，超过阈值的请求会返回 429 状态码。

## 故障排查

### 问题1: Nacos 中看不到规则配置

**原因**：Dashboard 推送规则失败或未连接 Nacos

**解决方法**：
1. 确认 Dashboard 能访问 Nacos（检查网络连通性）
2. 在 Dashboard 的"机器列表"中查看应用是否在线
3. 手动在 Nacos 中创建配置，验证应用能否读取

### 问题2: 应用启动时报 Nacos 连接失败

**原因**：Nacos 服务未就绪或地址配置错误

**解决方法**：
1. 确认 Nacos 容器已启动：`docker ps | grep nacos`
2. 检查环境变量：`docker exec hotel-backend-dev env | grep NACOS`
3. 验证网络连通性：`docker exec hotel-backend-dev ping nacos`

### 问题3: 规则持久化不生效（重启后规则丢失）

**原因**：Nacos 数据源配置错误或未加载

**检查清单**：
1. 确认 `sentinel-datasource-nacos` 依赖已添加
2. 检查 `application.yml` 中的 `datasource` 配置
3. 查看后端启动日志，搜索 "datasource" 关键字
4. 确认 Nacos 中配置的 dataId 和 groupId 与应用配置一致

## 高级配置

### 使用 Namespace 隔离环境

如需区分开发、测试、生产环境，可以使用 Nacos 的 namespace 功能：

```yaml
spring:
  cloud:
    nacos:
      discovery:
        namespace: ${NACOS_NAMESPACE:}  # 开发环境可设为 dev
      config:
        namespace: ${NACOS_NAMESPACE:}
    sentinel:
      datasource:
        flow:
          nacos:
            namespace: ${NACOS_NAMESPACE:}
```

### 配置权限认证

生产环境建议启用 Nacos 的权限认证：

```yaml
spring:
  cloud:
    nacos:
      discovery:
        username: ${NACOS_USERNAME:nacos}
        password: ${NACOS_PASSWORD:nacos}
      config:
        username: ${NACOS_USERNAME:nacos}
        password: ${NACOS_PASSWORD:nacos}
```

同时在 Nacos 容器中启用认证：
```yaml
environment:
  NACOS_AUTH_ENABLE: "true"
```

## 参考资料

- [Nacos 官方文档](https://nacos.io/zh-cn/docs/what-is-nacos.html)
- [Sentinel 官方文档](https://sentinelguard.io/zh-cn/docs/introduction.html)
- [Spring Cloud Alibaba 文档](https://github.com/alibaba/spring-cloud-alibaba/wiki)
- [Sentinel 动态规则扩展](https://github.com/alibaba/Sentinel/wiki/%E5%8A%A8%E6%80%81%E8%A7%84%E5%88%99%E6%89%A9%E5%B1%95)
