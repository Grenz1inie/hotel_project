# 酒店后端 API 文档

本版本对齐前端反馈并已在后端实现以下要点：
- 统一鉴权：除登录、健康检查以及房型公开浏览（GET /api/rooms、GET /api/rooms/{id}、GET /api/rooms/{id}/availability）外，其余 /api/** 接口均要求 Bearer JWT
- 统一错误响应格式与合理 4xx/409/5xx 状态码
- 必需接口：登录、我的订单分页查询、取消预订
- 房型可用量查询，预订创建时做时段重叠检查与基础库存校验
- 新增订单扩展接口：订单详情、管理员订单列表筛选、改期（reschedule）、以及 /api/bookings 下的管理员确认/退房
- DDL 升级为“酒店-房型-房间”三级结构，保留 `rooms` 视图以兼容现有 API

约定
- Base URL: /api
- 鉴权: Bearer JWT
  - 请求头: Authorization: Bearer <token>
  - 公开接口: POST /api/auth/login, GET /api/health, GET /api/rooms, GET /api/rooms/{id}, GET /api/rooms/{id}/availability
- 错误响应（4xx/5xx）:
  { code: string, message: string, details?: any }
  - 常见 code: BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, INTERNAL_ERROR
- 分页（统一形态）
  - 请求: page=1&size=10
  - 响应: { items: T[], page: number, size: number, total: number }
- 日期时间: ISO 8601 字符串（示例 2025-10-01T14:00:00）
- 金额: BigDecimal 数值（JSON 数字，示例 299.00），单位 CNY

数据模型
- Hotel
  - id: Long
  - name / address / city / phone
  - starLevel: Integer
  - status: 1=营业中, 0=停业
- RoomType（通过 `rooms` 视图对外暴露，兼容旧字段）
  - id: Long
  - hotelId: Long
  - name: String（展示名称）
  - type: String（分类标签，如 Deluxe / Suite）
  - totalCount / availableCount: Integer
  - pricePerNight: number(BigDecimal)
  - images: String（逗号分隔 URL）
  - description: String
  - amenities: JSON 数组
  - areaSqm: number
  - bedType: String
  - maxGuests: Integer
  - isActive: boolean (0/1)
  - createdTime / updatedTime: ISO 8601 字符串
- Room（物理房间，用于房态与维护）
  - id: Long
  - hotelId: Long
  - roomTypeId: Long
  - roomNumber: String
  - floor: Integer
  - status: 1空房 2已预订 3已入住 4待打扫 5维修中
  - lastCheckoutTime: String(ISO 8601)
- Booking
  - id: Long
  - hotelId / roomTypeId / roomId / userId
  - startTime / endTime: String(ISO 8601)
  - status: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "REFUNDED"
  - guests: Integer
  - amount: number(BigDecimal)
  - currency: String (默认 "CNY")
  - contactName / contactPhone / remark
  - createdAt / updatedAt: ISO 8601 字符串
- RoomInventory
  - id: Long
  - hotelId / roomTypeId
  - date: Date（yyyy-MM-dd）
  - availableCount: Integer
  - price: number(BigDecimal)
  - status: "OPEN" | "CLOSED"
- RoomPriceStrategy
  - id: Long
  - hotelId / roomTypeId
  - strategyType: 1日期加价 2会员折扣 3连住优惠
  - startDate / endDate: Date
  - priceAdjust: number(BigDecimal)
  - discountRate: number (0-1)
  - minStayDays: Integer
- RoomMaintenance
  - id: Long
  - roomId: Long
  - maintenanceType / description
  - startTime / endTime
  - operator
  - status: 1处理中 2已完成
- Payment
  - id: Long
  - bookingId: Long
  - payMethod: "WECHAT" | "ALIPAY" | "CARD" | "CASH"
  - amount / currency / status / transactionNo / paidAt
- Review
  - id: Long
  - bookingId / hotelId / roomTypeId / userId
  - rating: Integer (1-5)
  - content: String
  - createdAt: ISO 8601 字符串
- User（返回时不包含 password）
  - id: Long
  - username: String
  - role: "ADMIN" | "USER"
  - vipLevel: Integer

数据库结构补充
- `hotel`：支持多门店场景；`room_type`、`room`、`bookings`、`reviews` 等均带 `hotel_id`
- `room_type`：承载房型聚合信息；通过 updatable 视图 `rooms` 对外暴露以兼容既有 API
- `room`：记录物理房间及房态，便于入住规划、保洁与维护
- `room_price_strategy`：配置节假日加价、会员折扣、连住优惠等策略
- `room_inventory`：以房型维度预加载未来 30 天库存与价格，供房态/预订查询
- `room_maintenance`：追踪维修、保养工单
- `payments` / `reviews`：保持与旧版本一致，新增 hotel / roomType 维度
- 初始化脚本创建 2 家酒店、6 个房型、实房房间号、30 天库存、价格策略、维护/订单/支付/评价示例数据

一、认证与用户（Auth & Users）
1) 登录
- POST /api/auth/login
- Headers: Content-Type: application/json
- Body: { username: string, password: string }
- 200: { token: string, user: { id, username, role, vipLevel } }
- 401: { code: "UNAUTHORIZED", message: "用户名或密码错误" }

2) 获取当前登录用户
- GET /api/auth/me
- Header: Authorization: Bearer <token>
- 200: { id, username, role, vipLevel }
- 401: { code: "UNAUTHORIZED", message }

二、房型与库存（Rooms）
1) 列表房型（当前为全量列表，后续可扩展分页/筛选）
- GET /api/rooms
- 权限: 公开，无需鉴权
- 200: Room[]

2) 房型详情
- GET /api/rooms/{id}
- 权限: 公开，无需鉴权
- 200: Room
- 404: { code: "NOT_FOUND", message: "房型不存在" }

3) 管理员调整房型总数（ADMIN）
- PUT /api/rooms/{id}/adjust?totalCount=number
- 200: Room
- 400: totalCount < 0
- 403: 非管理员
- 404: 房型不存在

4) 查询房型在时段的可用量
- GET /api/rooms/{id}/availability?start=&end=
- 权限: 公开，无需鉴权
- 200: { available: boolean, availableCount: number }
- 404: 房型不存在
- 422: 开始时间必须早于结束时间（code: UNPROCESSABLE_ENTITY）

5) 创建预订（预定房型）
- POST /api/rooms/{id}/book
- Form/Query 参数:
  - userId?: Long（默认使用当前登录用户；仅管理员可为他人创建）
  - start: ISO 8601 字符串
  - end: ISO 8601 字符串
- 200: Booking（status: "PENDING"）
- 401: 未登录
- 403: 为他人创建但非管理员
- 404: 房型不存在
- 409: 库存不足或时间段冲突（基于重叠检查）
- 422: 开始时间必须早于结束时间（code: UNPROCESSABLE_ENTITY）
- 计费说明：按 start/end 日期（去时分秒）的天数差计费，最少 1 天；amount = pricePerNight * days

6) 管理员确认入住（ADMIN）
- PUT /api/rooms/bookings/{bookingId}/confirm
- 200: Booking（status: "CONFIRMED"）
- 403: 非管理员
- 404: 预订不存在

7) 管理员退房（ADMIN）
- PUT /api/rooms/bookings/{bookingId}/checkout
- 200: Booking（status: "CHECKED_OUT"），同时对应房型 availableCount +1
- 403: 非管理员
- 404: 预订不存在

三、预订/订单（Bookings）
1) 查询用户的订单（分页）
- GET /api/users/{userId}/bookings?status=&page=&size=
- 权限: 仅本人或管理员
- 200: { items: Booking[], page, size, total }（按 startTime 降序）
- 401: 未登录
- 403: 无权限

2) 取消预订（用户/管理员）
- PUT /api/bookings/{id}/cancel
- 权限: 订单所属用户或管理员
- 200: Booking（status: "CANCELLED"）；并将对应房型 availableCount +1
- 401: 未登录
- 403: 无权限
- 404: 预订不存在
- 409: 状态不允许取消（如已 CHECKED_IN/OUT）

3) 获取订单详情（用户/管理员）
- GET /api/bookings/{id}
- 权限: 订单所属用户或管理员
- 200: Booking
- 401: 未登录
- 403: 无权限
- 404: 预订不存在

4) 管理员订单列表（筛选 + 分页）
- GET /api/bookings?status=&userId=&roomId=&start=&end=&page=&size=
- 权限: 管理员
- 参数:
  - status?: 过滤订单状态，可选值 PENDING / CONFIRMED / CHECKED_IN / CHECKED_OUT / CANCELLED / REFUNDED
  - userId?: 按用户过滤
  - roomId?: 按房型过滤
  - start? & end?: 如果同时传入，则按时间段重叠过滤（lt start < end & gt end > start）
- 200: { items: Booking[], page, size, total }
- 401: 未登录
- 403: 非管理员
- 422: 开始时间必须早于结束时间

5) 改期（用户/管理员）
- PUT /api/bookings/{id}/reschedule
- 权限: 订单所属用户或管理员
- 参数: start, end（ISO 8601）
- 逻辑: 校验状态（CANCELLED/CHECKED_OUT 不允许）、做重叠校验（排除自身）、重算金额
- 200: Booking（更新后的 startTime/endTime/amount）
- 401: 未登录
- 403: 无权限
- 404: 预订不存在 或 房型不存在
- 409: 库存不足或时间段冲突 / 状态不允许
- 422: 开始时间必须早于结束时间

6) 管理员确认入住/退房（等价端点）
- PUT /api/bookings/{id}/confirm
- PUT /api/bookings/{id}/checkout
- 与 /api/rooms/bookings/{id}/confirm、/api/rooms/bookings/{id}/checkout 等价
- 200: Booking（status: "CONFIRMED" 或 "CHECKED_OUT"）
- 403: 非管理员
- 404: 预订不存在

四、系统与健康检查（System）
1) 健康检查（公开）
- GET /api/health
- 200: { status: "UP", time: "..." }

与前端需求映射（本次已覆盖）
- 登录页: POST /api/auth/login → 已实现
- 我的订单: GET /api/users/{userId}/bookings → 已实现（分页）
- 订单详情: GET /api/bookings/{id} → 已实现
- 取消预订: PUT /api/bookings/{id}/cancel → 已实现
- 管理员订单列表筛选: GET /api/bookings → 已实现
- 改期（reschedule）: PUT /api/bookings/{id}/reschedule → 已实现
- 管理员确认/退房: PUT /api/bookings/{id}/confirm、/api/bookings/{id}/checkout（与 rooms 路径等价）→ 已实现
- 房型列表与详情: GET /api/rooms、GET /api/rooms/{id} → 已实现
- 创建预订（含重叠校验）: POST /api/rooms/{id}/book → 已实现
- 房型可用量: GET /api/rooms/{id}/availability → 已实现
- 统一错误体与状态码 → 已实现
- 多酒店 DDL 升级：`hotel`-`room_type`-`room` 架构、价格策略、维护等表已落地，并通过 `rooms` 视图兼容旧接口

示例（Windows cmd.exe 使用 curl）
1) 订单详情
curl "http://localhost:8080/api/bookings/5" -H "Authorization: Bearer %TOKEN%"

2) 管理员订单列表筛选（按状态与时间段）
curl "http://localhost:8080/api/bookings?status=CONFIRMED&start=2025-10-01T00:00:00&end=2025-11-01T00:00:00&page=1&size=10" -H "Authorization: Bearer %TOKEN%"

3) 改期（reschedule）
curl -X PUT "http://localhost:8080/api/bookings/5/reschedule" -H "Authorization: Bearer %TOKEN%" -d "start=2025-11-02T14:00:00" -d "end=2025-11-05T12:00:00"

4) 管理员确认/退房
curl -X PUT "http://localhost:8080/api/bookings/5/confirm" -H "Authorization: Bearer %TOKEN%"
curl -X PUT "http://localhost:8080/api/bookings/5/checkout" -H "Authorization: Bearer %TOKEN%"

变更记录（相对上一版）
- 新增订单详情、管理员订单列表筛选、改期端点
- 在 /api/bookings 下新增管理员确认/退房的等价端点
- 补充错误码、参数释义和 curl 示例
- 更新鉴权策略：房型公开浏览接口无需登录，文档同步开放列表/详情/可用量
- 补充数据库结构说明（room_images、room_inventory、payments、reviews 等）以及 Room/Booking 字段
