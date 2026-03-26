# Docker 一体化部署说明（前后端分离 + Oracle23ai + Redis + MinIO + Nginx + Adminer）

## 目录约定
- 根目录: 包含 docker-compose.yml
- 根目录: 包含 .dockerignore（限制后端与 nginx 的构建上下文）
- 根目录: 包含统一 Dockerfile（通过 target 构建 backend 与 nginx 镜像）
- Nginx 独立目录: nginx/nginx.conf
- MinIO 独立目录: minio/data (宿主机数据目录)
- 前端项目目录保持低侵入，不放置 Dockerfile 与 nginx 配置文件
- 后端项目目录保持低侵入，不放置 Dockerfile

## 启动步骤
1. 在项目根目录复制环境变量文件
```bash
copy .env.example .env
```

2. 构建并启动全部服务
```bash
docker compose up -d --build
```

3. 访问入口
- Web 入口: http://localhost/
- 后端 API: http://localhost/api/
- 后端直连: http://localhost:8080/
- MinIO API: http://localhost:9000/
- MinIO Console: http://localhost:9001/
- Nacos API: http://localhost:8848/nacos/
- Nacos Console (v3): http://localhost:8082/
- Adminer 面板: http://localhost:8081/
- Adminer 网关映射: http://localhost/db/
- Oracle 监听端口: localhost:1521

## 服务说明
- oracle: gvenzl/oracle-free:23-slim，提供 Oracle 23ai Free
- redis: redis:7.4-alpine
- minio: 对象存储服务
- backend: Spring Boot 服务，使用环境变量连接 Oracle/Redis/MinIO
- nginx: 统一入口，静态托管前端并反向代理 /api 与 /images
- adminer: 轻量级数据库 Web 控制台，用于管理 Oracle 等数据库

## 数据挂载
- Oracle 数据卷: Docker named volume (oracle-data)
- Redis 数据卷: Docker named volume (redis-data)
- MinIO 数据目录: ./minio/data 映射到容器 /data

## Adminer 连接 Oracle 指引
- System: Oracle
- Server: oracle
- Username: ${ORACLE_APP_USER:-hotel_user} 或 system
- Password: 使用 .env 中的 ORACLE_APP_USER_PASSWORD 或 ORACLE_PASSWORD
- Database: FREEPDB1

## 常见运维命令
```bash
# 查看服务状态
docker compose ps

# 查看某个服务日志
docker compose logs -f backend

# 停止并删除容器（保留数据卷）
docker compose down

# 停止并删除容器与数据卷（重置数据库/缓存/对象存储）
docker compose down -v
```

## 注意事项
- 首次拉起 Oracle 23ai 初始化耗时较长，backend 会等待 oracle 健康检查通过后启动。
- 当前后端配置使用 FREEPDB1 作为数据库服务名。
- 如果你后续加入数据库初始化 SQL，可在 compose 中为 oracle 增加初始化脚本挂载目录。
