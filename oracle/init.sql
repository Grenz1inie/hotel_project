-- ==========================================
-- 1. 切换到你的 PDB 容器 (匹配你的强制参数 ORACLE_PDB=hotelpdb)
-- ==========================================
ALTER SESSION SET CONTAINER = hotelpdb;

-- ==========================================
-- 2. 创建表空间 (数据持久化目录)
-- ==========================================
-- 如果已存在则跳过，初次执行需确保目录 /opt/oracle/oradata 存在
CREATE TABLESPACE HOTEL_DATA DATAFILE '/opt/oracle/oradata/hotel_data01.dbf' SIZE 100M AUTOEXTEND ON NEXT 50M MAXSIZE UNLIMITED;

-- ==========================================
-- 3. 创建开发用户 hotel_user
-- ==========================================
-- 权限清理（重新实验时可选）: DROP USER hotel_user CASCADE;

CREATE USER hotel_user IDENTIFIED BY hotel_pass DEFAULT TABLESPACE HOTEL_DATA TEMPORARY TABLESPACE TEMP;

-- 授予开发权限
GRANT CONNECT, RESOURCE, CREATE VIEW TO hotel_user;
-- 授予存储过程、序列、触发器权限（后端 Spring Boot 常需）
GRANT
CREATE PROCEDURE,
CREATE SEQUENCE,
CREATE TRIGGER TO hotel_user;
-- 允许用户使用表空间额度
ALTER USER hotel_user QUOTA UNLIMITED ON HOTEL_DATA;

-- ==========================================
-- 4. 切换到 hotel_user 用户下创建表
-- ==========================================
-- 在 SQL 工具中执行时，接下来的操作将以 hotel_user 身份进行
ALTER SESSION SET CURRENT_SCHEMA = hotel_user;

-- 创建酒店信息表
CREATE TABLE hotel_user.hotels (
    id NUMBER (19) PRIMARY KEY,
    name VARCHAR2 (100) NOT NULL,
    address VARCHAR2 (255),
    star_level NUMBER (1),
    price NUMBER (10, 2),
    is_active NUMBER (1) DEFAULT 1, -- 0:不可用, 1:可用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建序列（Oracle 习惯，用于主键自增）
CREATE SEQUENCE hotel_user.hotel_seq START WITH 100 INCREMENT BY 1;

-- ==========================================
-- 5. 插入简单样例数据 (用于前端/后端测试)
-- ==========================================
INSERT INTO
    hotel_user.hotels (
        id,
        name,
        address,
        star_level,
        price
    )
VALUES (
        1,
        '云端大酒店',
        '上海市浦东新区 88 号',
        5,
        1288.50
    );

INSERT INTO
    hotel_user.hotels (
        id,
        name,
        address,
        star_level,
        price
    )
VALUES (
        2,
        '悦享快捷酒店',
        '北京市朝阳区 101 号',
        3,
        350.00
    );

INSERT INTO
    hotel_user.hotels (
        id,
        name,
        address,
        star_level,
        price
    )
VALUES (
        3,
        '山水度假村',
        '杭州市西湖区 202 号',
        4,
        880.00
    );

-- ==========================================
-- 6. 提交所有变更
-- ==========================================
COMMIT;

-- 验证查询
SELECT * FROM hotel_user.hotels;