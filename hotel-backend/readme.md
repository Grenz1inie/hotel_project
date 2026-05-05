## 数据库环境
- **数据库型号**：Oracle 19c

## 授权语句

```sql
-- 授予用户 hotel 创建会话的权限
GRANT CREATE SESSION TO hotel;

-- 授予用户 hotel 创建表的权限
GRANT CREATE TABLE TO hotel;

-- 授予用户 hotel 创建序列的权限
GRANT CREATE SEQUENCE TO hotel;

-- 授予用户 hotel 无限使用表空间的权限
GRANT UNLIMITED TABLESPACE TO hotel;

-- 授予用户 hotel 执行 DBMS_RANDOM 包的权限
GRANT EXECUTE ON DBMS_RANDOM TO hotel;