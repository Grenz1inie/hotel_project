SET SERVEROUTPUT ON;
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
        IF SQLCODE = -1543 THEN 
            DBMS_OUTPUT.PUT_LINE('>> [跳过] 表空间 hotel_ts 已存在。');
        ELSE 
            DBMS_OUTPUT.PUT_LINE('>> [异常] 创建 hotel_ts 失败: ' || SQLERRM);
            RAISE; 
        END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE '
        CREATE TABLESPACE hotel_idx_ts
        DATAFILE ''/opt/oracle/oradata/hotel_idx_ts.dbf'' SIZE 200M
        AUTOEXTEND ON NEXT 50M MAXSIZE 2G
        EXTENT MANAGEMENT LOCAL
        SEGMENT SPACE MANAGEMENT AUTO
    ';
    DBMS_OUTPUT.PUT_LINE('>> [成功] 表空间 hotel_idx_ts 创建成功。');
EXCEPTION 
    WHEN OTHERS THEN
        IF SQLCODE = -1543 THEN 
            DBMS_OUTPUT.PUT_LINE('>> [跳过] 表空间 hotel_idx_ts 已存在。');
        ELSE 
            DBMS_OUTPUT.PUT_LINE('>> [异常] 创建 hotel_idx_ts 失败: ' || SQLERRM);
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
        IF SQLCODE = -1543 THEN 
            DBMS_OUTPUT.PUT_LINE('>> [跳过] 表空间 hotel_lob_ts 已存在。');
        ELSE
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
    DBMS_OUTPUT.PUT_LINE('>> [成功] 用户 hotel_user 创建成功。');
EXCEPTION 
    WHEN OTHERS THEN
        IF SQLCODE = -1920 THEN 
            DBMS_OUTPUT.PUT_LINE('>> [跳过] 用户 hotel_user 已存在。');
        ELSE 
            DBMS_OUTPUT.PUT_LINE('>> [异常] 创建用户 hotel_user 失败: ' || SQLERRM);
            RAISE; 
        END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'CREATE ROLE hotel_app_role';
    DBMS_OUTPUT.PUT_LINE('>> [成功] 角色 hotel_app_role 创建成功。');
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE = -1921 THEN
            DBMS_OUTPUT.PUT_LINE('>> [跳过] 角色 hotel_app_role 已存在。');
        ELSE
            DBMS_OUTPUT.PUT_LINE('>> [异常] 创建角色失败: ' || SQLERRM);
            RAISE;
        END IF;
END;
/

-- 1. 基础权限可以保留在角色中 (用于常规操作)
GRANT CREATE SESSION, CREATE VIEW, CREATE SEQUENCE, CREATE TRIGGER,
      CREATE PROCEDURE, CREATE TYPE, CREATE JOB, CREATE SYNONYM TO hotel_app_role;

-- 2. 【关键修正】必须直接授予用户的权限 (用于创建物化视图和表)
-- 只有直接授权，创建物化视图时才不会报 ORA-01031
GRANT CREATE TABLE TO hotel_user;
GRANT CREATE MATERIALIZED VIEW TO hotel_user;

-- 3. 关联角色
GRANT hotel_app_role TO hotel_user;
ALTER SESSION SET CURRENT_SCHEMA = HOTEL_USER;

-- ============================================================================
-- 清理旧对象（包括序列）
-- ============================================================================
BEGIN
    DBMS_OUTPUT.PUT_LINE('>> [开始] 环境清理...');

    -- 1. 清理物化视图
    FOR rec IN (
        SELECT owner, mview_name 
        FROM all_mviews 
        WHERE owner = 'HOTEL_USER' 
          AND mview_name = 'MV_DAILY_BOOKING_STATS'
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE 'DROP MATERIALIZED VIEW ' || rec.owner || '."' || rec.mview_name || '"';
            DBMS_OUTPUT.PUT_LINE('>> [清理] 物化视图 ' || rec.mview_name || ' 已删除。');
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE = -12003 THEN 
                    DBMS_OUTPUT.PUT_LINE('>> [跳过] 物化视图 ' || rec.mview_name || ' 不存在。');
                ELSE 
                    DBMS_OUTPUT.PUT_LINE('>> [警告] 清理物化视图出错: ' || SQLERRM);
                END IF;
        END;
    END LOOP;

    -- 2. 清理业务表
    FOR rec IN (
        SELECT owner, table_name 
        FROM all_tables 
        WHERE owner = 'HOTEL_USER' 
          AND table_name IN (
            'VACANCY_STATISTICS','VIP_LEVEL_POLICY','WALLET_TRANSACTION','PAYMENT_RECORD',
            'WALLET_ACCOUNT','BOOKINGS','ROOM_MAINTENANCE','ROOM_PRICE_STRATEGY',
            'ROOM_IMAGES','ROOM','ROOM_TYPE','USERS','HOTEL_GALLERY','HOTEL',
            'MV_DAILY_BOOKING_STATS'
          )
    ) LOOP
        BEGIN
            DECLARE
                v_is_mview NUMBER;
            BEGIN
                SELECT count(*) INTO v_is_mview FROM all_mviews 
                WHERE owner = rec.owner AND mview_name = rec.table_name;
                
                IF v_is_mview > 0 THEN
                    DBMS_OUTPUT.PUT_LINE('>> [跳过] ' || rec.table_name || ' 是物化视图，已由前置逻辑处理。');
                ELSE
                    EXECUTE IMMEDIATE 'DROP TABLE ' || rec.owner || '."' || rec.table_name || '" CASCADE CONSTRAINTS';
                    DBMS_OUTPUT.PUT_LINE('>> [清理] 表 ' || rec.table_name || ' 已删除。');
                END IF;
            END;
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE = -942 THEN 
                    DBMS_OUTPUT.PUT_LINE('>> [跳过] 表 ' || rec.table_name || ' 已不存在。');
                ELSE 
                    DBMS_OUTPUT.PUT_LINE('>> [异常] 删除表 ' || rec.table_name || ' 失败: ' || SQLERRM);
                END IF;
        END;
    END LOOP;

    -- 3. 清理视图
    FOR rec IN (
        SELECT owner, view_name 
        FROM all_views 
        WHERE owner = 'HOTEL_USER' 
          AND view_name IN ('V_HOTEL_ROOM_AVAILABILITY','V_USER_VIP_INFO','V_DAILY_BOOKING_STATS')
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE 'DROP VIEW ' || rec.owner || '."' || rec.view_name || '"';
            DBMS_OUTPUT.PUT_LINE('>> [清理] 视图 ' || rec.view_name || ' 已删除。');
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE = -942 THEN 
                    DBMS_OUTPUT.PUT_LINE('>> [跳过] 视图 ' || rec.view_name || ' 不存在。');
                ELSE 
                    DBMS_OUTPUT.PUT_LINE('>> [异常] 删除视图失败: ' || SQLERRM);
                END IF;
        END;
    END LOOP;

    -- 4. 清理序列
    FOR rec IN (
        SELECT sequence_owner, sequence_name 
        FROM all_sequences 
        WHERE sequence_owner = 'HOTEL_USER' AND sequence_name NOT LIKE 'ISEQ$$%'
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE 'DROP SEQUENCE ' || rec.sequence_owner || '."' || rec.sequence_name || '"';
            DBMS_OUTPUT.PUT_LINE('>> [清理] 序列 ' || rec.sequence_name || ' 已删除。');
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE = -2289 THEN 
                    DBMS_OUTPUT.PUT_LINE('>> [跳过] 序列 ' || rec.sequence_name || ' 不存在。');
                ELSE 
                    DBMS_OUTPUT.PUT_LINE('>> [异常] 删除序列失败: ' || SQLERRM);
                END IF;
        END;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('>> [完成] 环境清理结束。');
END;
/