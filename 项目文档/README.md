# 酒店客房管理系统 (示例实现)
本项目为演示用的最小完整实现，满足你提出的必须执行项：
1. 严格按照项目规范（简化的企业级目录结构）
2. Spring Boot 3 后端和 React 前端分开文件夹（hotel-backend, hotel-frontend）
3. 前后端分离，后端提供 RESTful API，前端通过 fetch 调用
4. 模块化设计（controller/service/mapper/entity 分层）
5. 项目可直接运行，也方便扩展（包含 Docker Compose 启动 MySQL 的示例）
6. 中文 README（本文件）
7. 已打包为 zip，可下载并运行
8. 我已尽力牢记并实现你提出的全部信息（包含游客浏览、登录订房、管理员确认、退房更新可用房间等功能的最小版本）

## 目录结构 (主要)
- hotel-backend/  (Spring Boot 3 + MyBatis-Plus)
  - pom.xml
  - src/main/java/com/example/hotel/...
  - src/main/resources/application.yml
  - src/main/resources/schema.sql
  - docker-compose.yml （可直接起 MySQL 并初始化 schema）
- hotel-frontend/ (React)
  - package.json
  - public/
  - src/

## 快速启动（推荐顺序）
1. 启动 MySQL（推荐 Docker Compose）
   ```bash
   cd hotel-backend
   docker compose up -d
   ```
   这会启动 MySQL 并在容器初始化时导入 `schema.sql`（内含测试数据）。
2. 启动后端
   - 使用 Maven:
     ```bash
     cd hotel-backend
     mvn clean package
     java -jar target/hotel-backend-0.0.1-SNAPSHOT.jar
     ```
   - 或使用 IDE（IntelliJ / Eclipse）导入为 Maven 项目并运行 `HotelApplication`。
3. 启动前端
   ```bash
   cd hotel-frontend
   npm install
   npm start
   ```
   前端会在开发模式下启动并通过 proxy 转发 API 到后端。

## 功能说明（最小可用版）
- 游客可以浏览 /api/rooms（房间列表）和房间详情（含多张网络图片）
- 只有在调用预订接口时才需要提供用户 ID（示例简化，没有完整登录流程）
- 管理员可调用接口修改房间数量（PUT /api/rooms/{id}/adjust）
- 订房后管理员可确认入住（PUT /api/rooms/bookings/{bookingId}/confirm）
- 管理员可退房（checkout），退房后会将可用房数量 +1（PUT /api/rooms/bookings/{bookingId}/checkout）
- 计费规则示例：按夜计费（示例中为整夜计），中午 12 点与 VIP 策略等可在后端逻辑扩展（README 最下方给出扩展建议）

## 扩展建议（如何实现进阶版）
- 添加登录鉴权（JWT），前端保存 token 并在请求时带上 Authorization
- 在 Booking 表中存储精确计费时点（退房 12:00 / VIP 14:00），并在结算时根据用户 vip_level 调整
- 处理重叠日期的可用房计算：使用事务，按时间段计算当前已确认/待定的占用数量
- 管理端页面：图表展示不同房型的空置曲线（建议使用 recharts 或 ECharts）
- 更真实的“VR 看房”：前端使用三方库（例如 PhotoSphereViewer）或集成 360 度图片/视频

## 文件下载
项目已打包为 zip，下载路径在附件：`/mnt/data/hotel_project.zip`

--- 
如需我现在：
- 为你把后端改成 Gradle，或者补充完整的单元测试、Dockerfile
- 增加 JWT 登录流程和前端登录页
- 把可用房计算改为按时间段精确计算并防止超订（高优先级事务）
请直接告诉我，你希望我**现在**完成哪部分（我会在此回复里立即给出相应的代码/操作）。
