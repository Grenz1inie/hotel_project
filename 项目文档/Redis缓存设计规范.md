# Redis 缓存设计与命名规范

## 1. 设计目标与原则
本项目采用**旁路缓存策略 (Cache Aside Pattern)** 进行核心业务的性能优化。为了平衡系统性能提升与开发维护成本，我们采用了轻量级、扁平化的 NoSQL 结构设计。

**核心原则：**
- **规范化命名**：通过严格的命名空间防止 Key 冲突，便于后期排查、统计与清理。
- **统一数据格式**：Value 统一采用 JSON 字符串格式序列化存储（项目已配置 `Jackson2JsonRedisSerializer`），应用层依然面向对象编程，无需手写格式转换逻辑。
- **防止脏数据**：推荐所有缓存设置 TTL（过期时间，项目全局默认为10分钟），避免极端情况下缓存与数据库永久不一致。
- **文档同步**：**【重要】若业务需要扩充缓存节点或修改现有结构，请务必参照本规范进行设计，并将新扩充的内容（CacheName / Key 格式 / 存放实体）同步添加进本文档！**

---

## 2. Key 命名规范要求

目前项目主要依托 Spring Cache 注解（`@Cacheable`, `@CacheEvict` 等）进行缓存管理。
Spring Cache 默认在 Redis 中生成的 Key 格式为：`CacheName::Key`。

为了保持结构清晰，未来如果需要引入手动操作 `RedisTemplate` 的场景（如高并发扣减库存），非 Spring Cache 自动生成的自定义 Key 应遵循以下冒号分隔的**命名空间规则**：

`业务模块:实体/功能级:唯一标识[:子标识]`

> **正确示例：**
> `hotel:info:1` (存放 ID 为 1 的酒店基础信息)
> `hotel:inventory:roomTypeId:101:date:2026-05-01` (存放 101 房型在某天的剩余库存量)

---

## 3. 已有缓存设计 (一期优化已落实)

以下缓存节点已在代码中实现，维护和修改相关业务时，请留意连带清除其对应缓存。

### 3.1 酒店基础信息缓存
由于主推酒店信息变动低且所有用户首页访问查询频繁，故将其全量加入缓存。
- **CacheName (value)**: `hotelCache`
- **Key**: `'primary'`
- **Redis 实际 Key示例**: `hotelCache::primary`
- **数据结构**: `String (JSON)` -> 存放 `Hotel` 实体对象。
- **对应代码**: `HotelServiceImpl.getPrimaryHotel()`

### 3.2 VIP 与价格策略字典缓存
VIP 等级描述、对应折扣率及延迟退房时间等属于典型的系统字典，读极多写极少。
- **业务明细**:
  - `vipBaseRates` -> 存储：`Map<Integer, BigDecimal>` (各等级基础折扣率)
  - `vipLevelNames` -> 存储：`Map<Integer, String>` (各等级展示名称)
  - `vipCheckoutHours` -> 存储：`Map<Integer, Integer>` (各等级最迟退房时间)
  - `vipLevelDescriptors` -> 存储：`List<VipLevelDescriptor>` (各等级完整权益描述)
- **Key**: `'all'` (统一为 all 表示所有等级全量缓存)
- **Redis 实际 Key示例**: `vipBaseRates::all` 等
- **数据结构**: `String (JSON)`
- **对应代码**: `VipPricingServiceImpl` 下的各读取接口。

### 3.3 房型基础信息缓存
房型信息的展示和浏览占比极大，因此对全量的基础房型名、面积、设施等进行了完整的单页缓存。
- **业务明细**:
  - `roomInfoCache` -> 单体房型缓存。
  - `roomListCache` -> 全量房型列表缓存。
- **Key**: `#id` 或者 `'all'`。
- **数据结构**: `String (JSON)` -> 存放 `Room` 或 `List<Room>` 实体。
- **对应代码**: `RoomServiceImpl` 下的方法及覆盖更新的 `@CacheEvict` 闭环。

### 3.4 后台分析看板(空房率等)定时预热
系统分析看板涉及多表连接和聚合计算，响应慢。为此，我们为其引入了容忍小幅度延迟的自动预热极致优化策略。
- **CacheName**: (不使用 Spring Cache 注解，使用 RedisTemplate)
- **Key**: `analytics:dashboard:vacancy`
- **数据结构**: `String (JSON)` -> Dashboard 响应DTO
- **对应代码**: `AnalyticsServiceImpl.warmupDashboardAnalytics()` (每 5 分钟定时执行)。
  此时所有用户的默认看板拉取都直接读取 Redis 中的预热结果。

### 3.5 核心查询端点状态与库存缓存（二期优化）
由于 `RoomController` 中的部分查询动作频繁且涉及大量数据库库存比对、聚合连接，极易在高并发下成为瓶颈（甚至宕机）。对以下接口进行了完整的查询缓存控制计算：
- **CacheName**: 
  - `dynamicRoomListCache`: 缓存带有实时可用库存运算的房型全量集合。Key 固定为 `'all'`。
  - `roomOccupancyCache`: 缓存整体入住房态概览（附带日期、房型筛选器支持）。
  - `roomTimelineCache`: 缓存指定房型的实时预订时间轴排布表。
  - `roomAvailabilityCache`: 缓存精细的入住日期时间段冲突可用性查询。
  - `roomInstancesCache` / `roomInstancesByTypeCache`: 缓存房间物理实例节点。
- **失效策略 (@CacheEvict)**：
  - 当任何房型的库存增减（`adjust`）、状态更新（`update/delete`）、新建入住单 (`book`)、完单结算 (`checkout`) 或者后台导入变动时，上述四项短效/高频读缓存会全部被集体驱逐 (`allEntries=true`)，从而保证业务一致性。
- **对应代码**: `RoomController` 层的读写接口及自动注解切面。

---

## 4. 扩充指南
开发人员在后续（如第二阶段高并发优化、第三阶段分析数据缓存）进行功能扩充时，请遵循以下步骤：

1. **评估场景**：确认业务是“读多写少”还是“高频写”，前者适合 `@Cacheable` 旁路缓存，后者适合 `RedisTemplate` 手动控制 + MQ 异步落库。
2. **查询接入**：在需要缓存的 Service 方法上添加 `@Cacheable(value="模块名", key="唯一标识")`。
3. **一致性保证**：在对应的 `update`、`delete`、`insert` 导致数据变更的方法上，**务必**添加 `@CacheEvict(value="模块名", key="唯一标识")` 以主动作废缓存。
4. **文档登记**：添加完成并测试无误后，**请继续编辑本文档，在【已有缓存设计】区域增加你的缓存说明段落**。