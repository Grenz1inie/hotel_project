# 酒店系统 API 压测指南 (Performance Testing Guide)

本文档基于 `API_DOC.md` 提取并整理了适用于自动化压测（如使用 JMeter、k6、Gatling 等）的核心接口与压测场景设计。

## 1. 压测前置准备

### 1.1 数据准备
- **测试用户池**：批量生成测试账号（如 1000 个 User，几十个 Admin），并提前或在 Setup 线程组中调用 `POST /api/auth/login` 获取并提取 `token`。
- **房型与库存**：确保目标压测房型在压测时间段内有充足的 `availableCount` （主要用于测正常下单）或极少的库存（专门用于测并发超卖和库存扣减的线程安全）。
- **时间变量**：预订涉及的 `start` 和 `end` 参数建议在压测工具中使用函数动态生成（如 `__timeShift`），确保跨过业务逻辑的时间校验。

### 1.2 环境变量配制
- `BASE_URL`: `http://localhost:8080` (或实际测试服务器地址)
- `TOKEN`: 动态从登录接口提取，并注入到后续请求的 Header `Authorization: Bearer ${TOKEN}` 中。

---

## 2. 核心压测场景设计

### 场景一：高频只读场景（日常浏览）
**目的**：模拟大量用户日常浏览房源资源，主要考验数据库读性能及缓存（若有）命中率。
- **占比建议**：70% 的流量
- **涉及接口**：
  1. 获取房型列表: `GET /api/rooms`
  2. 查看房型详情: `GET /api/rooms/${roomId}`
  3. 查询库存前置校验: `GET /api/rooms/${roomId}/availability?start=${startDate}&end=${endDate}`

### 场景二：高并发抢房（写冲突与事务）
**目的**：模拟热点节假日或促销时，多用户对同一房型进行抢订。重点监控**不发生超卖**（HTTP 409 返回比例应符合由于并发导致的库存不足情况）、死锁及事务回滚异常。
- **占比建议**：20% 的流量
- **涉及接口**：
  1. 登录拿 Token: `POST /api/auth/login`
  2. 创建预订: `POST /api/rooms/${roomId}/book?start=${startDate}&end=${endDate}`

### 场景三：读写混合与订单流转（全链路核心流）
**目的**：模拟完整的使用生命周期，涵盖下单、查单、取消等综合压力。
- **占比建议**：10% 的流量
- **涉及接口**：
  1. 用户下单: `POST /api/rooms/${roomId}/book`
  2. 获取订单详情: `GET /api/bookings/${bookingId}`
  3. 我的订单分页: `GET /api/users/${userId}/bookings?page=1&size=10`
  4. 取消订单: `PUT /api/bookings/${bookingId}/cancel`

---

## 3. 压测接口规范与断言细节

### 3.1 登录 (Login)
- **请求方式**: `POST /api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Body**: 
  ```json
  {
    "username": "testuser_${__threadNum}",
    "password": "password123"
  }
  ```
- **断言提取**: JSON Path `$.token` 保存为变量 `USER_TOKEN`。`$.user.id` 保存为 `USER_ID`。

### 3.2 房型列表与可用性 (Rooms & Availability)
- **请求方式**: `GET /api/rooms`
- **请求方式**: `GET /api/rooms/${roomId}/availability?start=${startDate}&end=${endDate}`
- **鉴权**: 均公开，不需要 Token。
- **断言**: HTTP Status `200`，JSON 响应中 `available` 字段的布尔值及结构完整性。

### 3.3 创建预订 (Create Booking)
- **请求方式**: `POST /api/rooms/${roomId}/book`
- **Headers**: `Authorization: Bearer ${USER_TOKEN}`
- **Query/Form Data**:
  - `start`: `2025-10-01T14:00:00`
  - `end`: `2025-10-03T12:00:00`
- **断言**: 
  - 成功时：HTTP `200`，返回状态包含 `"status": "PENDING"`
  - 失败时（并发抢空）：允许 HTTP `409`，提示库存不足或冲突。不允许出现 `500` 内部错误。

### 3.4 订单查询 (Get User Bookings)
- **请求方式**: `GET /api/users/${USER_ID}/bookings?page=1&size=20`
- **Headers**: `Authorization: Bearer ${USER_TOKEN}`
- **断言**: HTTP `200`，响应必须包含 `items`, `page`, `total` 字段。

### 3.5 取消预订 (Cancel Booking)
- **请求方式**: `PUT /api/bookings/${bookingId}/cancel`
- **Headers**: `Authorization: Bearer ${USER_TOKEN}`
- **断言**: HTTP `200`，返回状态必须变更为 `"status": "CANCELLED"`。

---

## 4. 性能指标预期要求 (SLA)

在进行负载测试及压力测试时，建议按以下标准评估目标达成情况：
1. **响应时间 (Response Time)**：
   - 查询类接口（GET）：95% 响应时间 (P95) < 150ms。
   - 事务类接口（POST/PUT）：95% 响应时间 (P95) < 300ms。
2. **错误率 (Error Rate)**：
   - 业务逻辑错误（如因无库存引发的 409）视为正常预期拦截。
   - 5xx 服务端异常错误率须控制在 **< 0.1%**。
3. **并发处理指标**：
   - 无超卖情况发生（库存原子扣减、乐观锁或数据库行锁生效）。
   - JVM GC 频率和 CPU 使用率在可承受阈值内，不会因连接池（JDBC Pool）排队导致大量由超时引发的 500 连接错误。
