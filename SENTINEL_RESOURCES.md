# Sentinel 资源保护完整清单

## 概览

本项目已为所有业务接口添加 Sentinel 限流保护，通过 `@SentinelResource` 注解标记资源，并通过 Sentinel Dashboard + Nacos 实现动态规则配置和持久化。

## 资源分组策略

为了便于管理，我们将资源按照业务场景和访问特征进行了分组，同类接口共享资源名和限流阈值。

---

## 资源清单

### 1. 昂贵/高频操作（严格限流）

#### AI 聊天接口
- **资源名**: `ai-chat`
- **Controller**: `ChatController`
- **接口**:
  - `POST /api/chat`
- **推荐 QPS**: 5
- **说明**: 调用 DeepSeek API，成本高且耗时，需严格限流防止滥用

#### 用户信息更新
- **资源名**: `user-profile-update`
- **Controller**: `UserProfileController`
- **接口**:
  - `PUT /api/users/me/profile`
- **推荐 QPS**: 10
- **说明**: 用户资料修改，防止频繁修改

#### VIP 升级检查
- **资源名**: `user-vip-upgrade`
- **Controller**: `UserProfileController`
- **接口**:
  - `POST /api/users/me/check-vip-upgrade`
- **推荐 QPS**: 20
- **说明**: VIP 等级检查与升级，涉及消费统计计算

#### 核心交易接口（已有专用 blockHandler）
- **资源名**: `booking-create`
- **Controller**: `RoomController`
- **接口**: `POST /api/rooms/{id}/book`
- **推荐 QPS**: 20
- **说明**: 预订接口，防止超卖与刷单，使用专用错误处理

- **资源名**: `auth-login`
- **Controller**: `AuthController`
- **接口**: `POST /api/auth/login`
- **推荐 QPS**: 10
- **说明**: 登录接口，防暴力破解，使用专用错误处理

- **资源名**: `auth-register`
- **Controller**: `AuthController`
- **接口**: `POST /api/auth/register`
- **推荐 QPS**: 5
- **说明**: 注册接口，防恶意注册，使用专用错误处理

- **资源名**: `wallet-recharge`
- **Controller**: `WalletController`
- **接口**: `POST /api/wallet/recharge`
- **推荐 QPS**: 10
- **说明**: 钱包充值接口，涉及资金操作，使用专用错误处理

---

### 2. 普通查询接口（统一资源名）

#### 房间查询
- **资源名**: `room-query`
- **Controller**: `RoomController`
- **接口**:
  - `GET /api/rooms` - 房间列表
  - `GET /api/rooms/{id}` - 房间详情
  - `GET /api/rooms/{id}/availability` - 可用性查询
  - `GET /api/rooms/{roomTypeId}/day-availability` - 每日可用性（已有专用 blockHandler）
- **推荐 QPS**: 100
- **说明**: 公开查询接口，访问量大但成本低

#### 订单查询
- **资源名**: `booking-query`
- **Controller**: `BookingController`
- **接口**:
  - `GET /api/users/{userId}/bookings` - 用户订单列表
  - `GET /api/bookings/{id}` - 订单详情
- **推荐 QPS**: 100
- **说明**: 需要登录，查询个人订单信息

#### 酒店信息查询
- **资源名**: `hotel-query`
- **Controller**: `HotelController`
- **接口**:
  - `GET /api/hotel/primary` - 主酒店信息
  - `GET /api/hotel/{id}` - 酒店详情
- **推荐 QPS**: 200
- **说明**: 基础信息查询，高频且轻量

#### 价格与 VIP 查询
- **资源名**: `pricing-query`
- **Controller**: `PricingController`
- **接口**:
  - `GET /api/pricing/vip` - VIP 价格快照
  - `GET /api/pricing/vip/rooms/{roomTypeId}` - 房型 VIP 折扣
- **推荐 QPS**: 100
- **说明**: 价格信息查询，中等频率

#### 用户资料查询
- **资源名**: `user-profile-query`
- **Controller**: `UserProfileController`
- **接口**:
  - `GET /api/users/me/profile` - 查询个人资料
- **推荐 QPS**: 100
- **说明**: 需要登录，查询个人信息

#### 钱包查询
- **资源名**: `wallet-query`
- **Controller**: `WalletController`
- **接口**:
  - `GET /api/wallet/me` - 钱包余额与交易记录
- **推荐 QPS**: 100
- **说明**: 需要登录，查询钱包信息（已有专用 blockHandler）

---

### 3. 订单操作接口（用户级）

#### 订单取消
- **资源名**: `booking-cancel`
- **Controller**: `BookingController`
- **接口**:
  - `PUT /api/bookings/{id}/cancel`
- **推荐 QPS**: 30
- **说明**: 用户取消订单，使用专用错误处理

#### 退款申请
- **资源名**: `booking-refund-request`
- **Controller**: `BookingController`
- **接口**:
  - `PUT /api/bookings/{id}/request-refund`
- **推荐 QPS**: 20
- **说明**: 用户申请退款，使用专用错误处理

#### 改期申请
- **资源名**: `booking-reschedule`
- **Controller**: `BookingController`
- **接口**:
  - `PUT /api/bookings/{id}/reschedule`
- **推荐 QPS**: 20
- **说明**: 用户改期请求，使用专用错误处理

---

### 4. 管理员接口（防爬虫/防误操作）

#### 房间管理操作
- **资源名**: `admin-room-ops`
- **Controller**: `RoomController`
- **接口**:
  - `POST /api/rooms/import` - 批量导入房间
  - `PUT /api/rooms/{id}/adjust` - 调整房间数量
  - `GET /api/rooms/instances` - 房间实例列表
  - `GET /api/rooms/occupancy-overview` - 占用概况
  - `GET /api/rooms/{roomTypeId}/timeline` - 时间轴
  - `GET /api/rooms/room-types/{roomTypeId}/rooms` - 获取房型下的所有房间
  - `POST /api/rooms/room-types/{roomTypeId}/rooms` - 创建房间实例
  - `PUT /api/rooms/rooms/{roomId}` - 更新房间实例
  - `DELETE /api/rooms/rooms/{roomId}` - 删除房间实例
- **推荐 QPS**: 50
- **说明**: 管理员后台房间管理，中等频率

#### 订单管理操作
- **资源名**: `admin-booking-ops`
- **Controller**: `BookingController`, `RoomController`
- **接口**:
  - `GET /api/bookings` - 管理员订单列表（筛选查询）
  - `PUT /api/bookings/{id}/confirm` - 确认订单
  - `PUT /api/bookings/{id}/checkin` - 办理入住
  - `PUT /api/bookings/{id}/checkout` - 办理退房
  - `PUT /api/bookings/{id}/reject` - 拒绝订单
  - `DELETE /api/bookings/{id}` - 删除订单
  - `PUT /api/bookings/{id}/approve-refund` - 批准退款
  - `PUT /api/bookings/{id}/reject-refund` - 拒绝退款
  - `PUT /api/rooms/bookings/{bookingId}/confirm` - 确认入住（旧路径）
  - `PUT /api/rooms/bookings/{bookingId}/checkout` - 退房（旧路径）
- **推荐 QPS**: 50
- **说明**: 管理员后台订单管理，中等频率

#### 数据统计与分析
- **资源名**: `admin-analytics`
- **Controller**: `AnalyticsController`
- **接口**:
  - `GET /api/analytics/vacancy` - 空房率分析
- **推荐 QPS**: 20
- **说明**: 管理员数据分析，复杂查询

#### 空房统计管理
- **资源名**: `admin-statistics`
- **Controller**: `VacancyStatisticsController`
- **接口**:
  - `POST /api/vacancy-statistics/calculate` - 计算统计
  - `POST /api/vacancy-statistics/batch-calculate` - 批量计算
  - `GET /api/vacancy-statistics` - 查询统计
  - `DELETE /api/vacancy-statistics` - 删除统计
- **推荐 QPS**: 20
- **说明**: 管理员统计数据管理，低频操作

---

## 全局异常处理

所有未指定 `blockHandler` 的接口，触发限流时会被 `GlobalExceptionHandler` 统一处理，返回标准的 HTTP 429 响应：

```json
{
  "code": "TOO_MANY_REQUESTS",
  "message": "请求过于频繁，请稍后再试"
}
```

## 专用 BlockHandler

以下资源配置了专用的 `blockHandler`，提供更精准的错误提示：

| 资源名 | 错误提示 | Handler 方法 |
|--------|---------|-------------|
| `booking-create` | "预订请求过于频繁，请稍后再试" | `handleBookingBlock` |
| `auth-login` | "登录请求过于频繁，请稍后再试" | `handleLoginBlock` |
| `auth-register` | "注册请求过于频繁，请稍后再试" | `handleRegisterBlock` |
| `room-day-availability` | "查询过于频繁，请稍后再试" | `handleDayAvailabilityBlock` |
| `booking-cancel` | "取消订单请求过于频繁，请稍后再试" | `handleBookingCancelBlock` |
| `booking-refund-request` | "退款申请请求过于频繁，请稍后再试" | `handleRefundRequestBlock` |
| `booking-reschedule` | "改期请求过于频繁，请稍后再试" | `handleRescheduleBlock` |
| `wallet-recharge` | "充值请求过于频繁，请稍后再试" | `handleWalletRechargeBlock` |
| `wallet-query` | "钱包查询过于频繁，请稍后再试" | `handleWalletQueryBlock` |

## 规则配置步骤

### 方式一：通过 Sentinel Dashboard 配置（推荐）

1. 启动 Sentinel Dashboard: http://localhost:8858
2. 登录（sentinel / sentinel）
3. 调用几次后端 API，等待应用注册
4. 在"流控规则"页面为上述资源名添加 QPS 限流规则
5. 规则自动推送到 Nacos，应用实时生效且重启不丢失

### 方式二：直接在 Nacos 中配置

1. 访问 Nacos 控制台: http://localhost:8848/nacos
2. 进入"配置管理" → "配置列表"
3. 创建配置：
   - **Data ID**: `hotel-backend-flow-rules`
   - **Group**: `SENTINEL_GROUP`
   - **配置格式**: JSON
   - **配置内容**: 参考 `NACOS_SENTINEL_INTEGRATION.md` 中的规则示例

## 监控与验证

### 查看实时流量

在 Sentinel Dashboard 的"实时监控"页面可以看到：
- 通过 QPS（绿色）
- 拒绝 QPS（红色）
- 响应时间
- 异常比例

### 验证限流效果

```bash
# 快速连续请求房间列表接口 200 次
for i in {1..200}; do
  curl http://localhost:8080/api/rooms -w "\n%{http_code}\n"
done
```

如果 QPS 设置为 100，超过阈值的请求会返回 429 状态码。

## 资源统计

| 类型 | 资源数量 | 说明 |
|------|---------|------|
| 昂贵/高频操作 | 8 | 需要严格限流的核心接口 |
| 普通查询接口 | 6 组（约 20 个接口） | 统一资源名，共享阈值 |
| 订单操作接口 | 3 | 用户级订单操作 |
| 管理员接口 | 4 组（约 30 个接口） | 后台管理操作 |
| **总计** | **21 个资源名** | **覆盖所有业务接口** |

## 注意事项

1. **硬编码规则已移除**: 所有规则通过 Sentinel Dashboard 或 Nacos 动态配置，无硬编码规则
2. **规则持久化**: 规则存储在 Nacos 中，应用重启后自动加载
3. **资源名统一**: 同类查询接口共享资源名，便于管理
4. **分级保护**: 根据接口的重要性和成本，配置不同的 QPS 阈值
5. **全局兜底**: 所有接口都有全局异常处理器兜底，确保限流后的友好响应

## 相关文档

- [Sentinel Dashboard 部署指南](docker/tools/SENTINEL_README.md)
- [Nacos + Sentinel 集成说明](NACOS_SENTINEL_INTEGRATION.md)
- [Sentinel 官方文档](https://sentinelguard.io/zh-cn/docs/introduction.html)
