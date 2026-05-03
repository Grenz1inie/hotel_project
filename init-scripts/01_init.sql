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
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE != -959 THEN RAISE; END IF;
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
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE != -959 THEN RAISE; END IF;
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
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE != -959 THEN RAISE; END IF;
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

CREATE ROLE hotel_app_role;
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
        EXECUTE IMMEDIATE 'DROP SEQUENCE "' || rec.sequence_name || '"';
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
