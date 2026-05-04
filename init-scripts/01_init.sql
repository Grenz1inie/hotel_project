ALTER SESSION SET CONTAINER = FREEPDB1;

-- ============================================================================
-- 表空间管理
-- ============================================================================
BEGIN
    EXECUTE IMMEDIATE '
        CREATE TABLESPACE hotel_ts
        DATAFILE ''/opt/oracle/oradata/hotel_ts.dbf'' SIZE 500M
        AUTOEXTEND ON NEXT 100M MAXSIZE 2G
        EXTENT MANAGEMENT LOCAL
        SEGMENT SPACE MANAGEMENT AUTO
    ';
    DBMS_OUTPUT.PUT_LINE('>> [成功] 表空间 hotel_ts 创建成功。');

EXCEPTION 
    WHEN OTHERS THEN
        -- -1543: ORA-01543: tablespace 'HOTEL_TS' already exists
        IF SQLCODE = -1543 THEN 
            DBMS_OUTPUT.PUT_LINE('>> [跳过] 表空间 hotel_ts 已存在，无需重复创建。');
        ELSE 
            -- 如果是其他错误（比如磁盘空间不足），则打印具体错误并抛出
            DBMS_OUTPUT.PUT_LINE('>> [异常] 创建 hotel_ts 发生未知错误: ' || SQLERRM);
            RAISE; 
        END IF;
END;
/

SET SERVEROUTPUT ON;

BEGIN
    EXECUTE IMMEDIATE '
        CREATE TABLESPACE hotel_idx_ts
        DATAFILE ''/opt/oracle/oradata/hotel_idx_ts.dbf'' SIZE 200M
        AUTOEXTEND ON NEXT 50M MAXSIZE 2G
        EXTENT MANAGEMENT LOCAL
        SEGMENT SPACE MANAGEMENT AUTO
    ';
    DBMS_OUTPUT.PUT_LINE('>> [成功] 表空间 hotel_idx_ts 创建完毕。');
EXCEPTION 
    WHEN OTHERS THEN
        -- 核心修正：捕获 -1543 (已存在)，且捕获后不 RAISE
        IF SQLCODE = -1543 THEN 
            DBMS_OUTPUT.PUT_LINE('>> [跳过] 表空间 hotel_idx_ts 已存在，无需重复创建。');
        ELSE 
            -- 只有真正的意外（如权限不足、磁盘满）才抛出错误
            DBMS_OUTPUT.PUT_LINE('>> [致命错误] 创建 hotel_idx_ts 失败: ' || SQLERRM);
            RAISE; 
        END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE '
        CREATE TABLESPACE hotel_lob_ts
        DATAFILE ''/opt/oracle/oradata/hotel_lob_ts.dbf'' SIZE 200M
        AUTOEXTEND ON NEXT 50M MAXSIZE 2G
        EXTENT MANAGEMENT LOCAL
        SEGMENT SPACE MANAGEMENT AUTO
    ';
    DBMS_OUTPUT.PUT_LINE('>> [成功] 表空间 hotel_lob_ts 创建成功。');
EXCEPTION 
    WHEN OTHERS THEN
        -- 核心修正：捕获 -1543 (已存在)，并且捕获后不使用 RAISE，这样就不会弹红色的 Error
        IF SQLCODE = -1543 THEN 
            DBMS_OUTPUT.PUT_LINE('>> [跳过] 表空间 hotel_lob_ts 已存在，无需重复创建。');
        ELSE 
            -- 对于真正的异常（如路径无效、磁盘满），依然打印详细信息并抛出
            DBMS_OUTPUT.PUT_LINE('>> [异常] 创建 hotel_lob_ts 失败: ' || SQLERRM);
            RAISE; 
        END IF;
END;
/

-- ============================================================================
-- 用户与角色
-- ============================================================================
BEGIN
    EXECUTE IMMEDIATE '
        CREATE USER hotel_user
        IDENTIFIED BY 123456
        DEFAULT TABLESPACE hotel_ts
        TEMPORARY TABLESPACE TEMP
        QUOTA UNLIMITED ON hotel_ts
        QUOTA UNLIMITED ON hotel_idx_ts
        QUOTA UNLIMITED ON hotel_lob_ts
    ';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE != -1920 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'CREATE ROLE hotel_app_role';
    DBMS_OUTPUT.PUT_LINE('Role created.');
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE = -1921 THEN
            DBMS_OUTPUT.PUT_LINE('Role already exists, skipping...');
        ELSE
            RAISE;
        END IF;
END;
/

GRANT CREATE SESSION TO hotel_app_role;
GRANT CREATE TABLE TO hotel_app_role;
GRANT CREATE VIEW TO hotel_app_role;
GRANT CREATE MATERIALIZED VIEW TO hotel_app_role;
GRANT CREATE SEQUENCE TO hotel_app_role;
GRANT CREATE TRIGGER TO hotel_app_role;
GRANT CREATE PROCEDURE TO hotel_app_role;
GRANT CREATE TYPE TO hotel_app_role;
GRANT CREATE JOB TO hotel_app_role;
GRANT CREATE SYNONYM TO hotel_app_role;
GRANT CREATE INDEXTYPE TO hotel_app_role;
GRANT hotel_app_role TO hotel_user;

ALTER SESSION SET CURRENT_SCHEMA = HOTEL_USER;

-- ============================================================================
-- 清理旧对象（包括序列）
-- ============================================================================
BEGIN
    FOR rec IN (SELECT table_name FROM user_tables WHERE table_name IN (
        'VACANCY_STATISTICS','VIP_LEVEL_POLICY','WALLET_TRANSACTION','PAYMENT_RECORD',
        'WALLET_ACCOUNT','BOOKINGS','ROOM_MAINTENANCE','ROOM_PRICE_STRATEGY',
        'ROOM_IMAGES','ROOM','ROOM_TYPE','USERS','HOTEL_GALLERY','HOTEL',
        'MV_DAILY_BOOKING_STATS'
    )) LOOP
        EXECUTE IMMEDIATE 'DROP TABLE "' || rec.table_name || '" CASCADE CONSTRAINTS';
    END LOOP;
    FOR rec IN (SELECT sequence_name FROM user_sequences) LOOP
        BEGIN
            EXECUTE IMMEDIATE 'DROP SEQUENCE "' || rec.sequence_name || '"';
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE = -2289 THEN NULL; -- 如果突然找不到了，就随它去吧
                ELSE RAISE; END IF;
        END;
    END LOOP;
    FOR rec IN (SELECT view_name FROM user_views WHERE view_name IN (
        'V_HOTEL_ROOM_AVAILABILITY','V_USER_VIP_INFO','V_DAILY_BOOKING_STATS'
    )) LOOP
        EXECUTE IMMEDIATE 'DROP VIEW "' || rec.view_name || '"';
    END LOOP;
    FOR rec IN (SELECT mview_name FROM user_mviews WHERE mview_name = 'MV_DAILY_BOOKING_STATS') LOOP
        EXECUTE IMMEDIATE 'DROP MATERIALIZED VIEW "' || rec.mview_name || '"';
    END LOOP;
END;
/
