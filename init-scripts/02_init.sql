ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = HOTEL_USER;

-- ============================================================================
-- 建表
-- ============================================================================

-- 酒店主表
CREATE TABLE hotel (
    id               NUMBER(19) PRIMARY KEY,
    name             VARCHAR2(100) NOT NULL,
    address          VARCHAR2(255) NOT NULL,
    city             VARCHAR2(50) NOT NULL,
    phone            VARCHAR2(20) NOT NULL,
    star_level       NUMBER(3) DEFAULT 0 NOT NULL,
    status           NUMBER(3) DEFAULT 1 NOT NULL,
    introduction     CLOB NOT NULL,
    hero_image_url   VARCHAR2(500) NOT NULL,
    created_time     DATE DEFAULT SYSDATE NOT NULL,
    updated_time     DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT uq_hotel_name UNIQUE (name)
) LOB (introduction) STORE AS SECUREFILE (TABLESPACE hotel_lob_ts);

COMMENT ON TABLE hotel IS '酒店信息表';
COMMENT ON COLUMN hotel.id IS '酒店ID';
COMMENT ON COLUMN hotel.name IS '酒店名称';
COMMENT ON COLUMN hotel.address IS '酒店地址';
COMMENT ON COLUMN hotel.city IS '城市';
COMMENT ON COLUMN hotel.phone IS '联系电话（支持国内和国际号码）';
COMMENT ON COLUMN hotel.star_level IS '星级（0 = 未评级）';
COMMENT ON COLUMN hotel.status IS '状态（1 = 营业中，0 = 已关闭）';
COMMENT ON COLUMN hotel.introduction IS '酒店介绍';
COMMENT ON COLUMN hotel.hero_image_url IS '主图URL';
COMMENT ON COLUMN hotel.created_time IS '创建时间';
COMMENT ON COLUMN hotel.updated_time IS '更新时间';

-- 酒店相册子表
CREATE TABLE hotel_gallery (
    id         NUMBER(19) PRIMARY KEY,
    hotel_id   NUMBER(19) NOT NULL,
    url        VARCHAR2(500) NOT NULL,
    sort_order NUMBER(10) DEFAULT 0 NOT NULL,
    created_at DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_hotel_gallery_hotel FOREIGN KEY (hotel_id) REFERENCES hotel(id) ON DELETE CASCADE
);

COMMENT ON TABLE hotel_gallery IS '酒店相册图片表';

-- 用户表
CREATE TABLE users (
    id                 NUMBER(19) PRIMARY KEY,
    username           VARCHAR2(20) NOT NULL,
    password           VARCHAR2(255) NOT NULL,
    role               VARCHAR2(10) DEFAULT 'USER' NOT NULL CHECK (role IN ('ADMIN', 'USER')),
    vip_level          NUMBER(3) DEFAULT 0 NOT NULL,
    total_consumption  NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    phone              VARCHAR2(20) NOT NULL,
    email              VARCHAR2(255),
    status             VARCHAR2(10) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at         DATE DEFAULT SYSDATE NOT NULL,
    updated_at         DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_username_length CHECK (LENGTH(username) BETWEEN 3 AND 20),
    CONSTRAINT chk_password_length CHECK (LENGTH(password) BETWEEN 6 AND 50),
    CONSTRAINT chk_phone_format CHECK (REGEXP_LIKE(phone, '^(1[3-9][0-9]{9}|\+?[1-9][0-9]{1,14})$')),
    CONSTRAINT chk_email_format CHECK (email IS NULL OR REGEXP_LIKE(email, '^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'))
);

COMMENT ON TABLE users IS '用户表';

-- VIP 等级政策
CREATE TABLE vip_level_policy (
    vip_level      NUMBER(3) PRIMARY KEY,
    name           VARCHAR2(50) NOT NULL,
    discount_rate  NUMBER(4,3) DEFAULT 1.000 NOT NULL,
    checkout_hour  NUMBER(3) DEFAULT 12 NOT NULL,
    description    VARCHAR2(255),
    created_at     DATE DEFAULT SYSDATE NOT NULL,
    updated_at     DATE DEFAULT SYSDATE NOT NULL
);

COMMENT ON TABLE vip_level_policy IS 'VIP等级权益政策';

-- 房型表
CREATE TABLE room_type (
    id               NUMBER(19) PRIMARY KEY,
    hotel_id         NUMBER(19) NOT NULL,
    name             VARCHAR2(80) NOT NULL,
    type             VARCHAR2(60) NOT NULL,
    theme_color      CHAR(7) DEFAULT '#2F54EB' NOT NULL,
    description      CLOB,
    price_per_night  NUMBER(10,2) NOT NULL,
    total_count      NUMBER(10) DEFAULT 0 NOT NULL,
    available_count  NUMBER(10) DEFAULT 0 NOT NULL,
    images           CLOB,
    amenities        JSON,
    area_sqm         NUMBER(6,2),
    bed_type         VARCHAR2(30),
    max_guests       NUMBER(10) DEFAULT 2 NOT NULL,
    is_active        NUMBER(3) DEFAULT 1 NOT NULL,
    created_time     DATE DEFAULT SYSDATE NOT NULL,
    updated_time     DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_room_type_hotel FOREIGN KEY (hotel_id) REFERENCES hotel(id) ON DELETE CASCADE
) LOB (description) STORE AS SECUREFILE (TABLESPACE hotel_lob_ts);

COMMENT ON TABLE room_type IS '房型表';
COMMENT ON COLUMN room_type.amenities IS '设施列表（JSON格式）';

-- 房间表
CREATE TABLE room (
    id                 NUMBER(19) PRIMARY KEY,
    hotel_id           NUMBER(19) NOT NULL,
    room_type_id       NUMBER(19) NOT NULL,
    room_number        VARCHAR2(20) NOT NULL,
    floor              NUMBER(5),
    status             NUMBER(3) DEFAULT 1 NOT NULL,
    last_checkout_time DATE,
    created_time       DATE DEFAULT SYSDATE NOT NULL,
    updated_time       DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_room_hotel FOREIGN KEY (hotel_id) REFERENCES hotel(id) ON DELETE CASCADE,
    CONSTRAINT fk_room_room_type FOREIGN KEY (room_type_id) REFERENCES room_type(id) ON DELETE CASCADE,
    CONSTRAINT uk_room_hotel_no UNIQUE (hotel_id, room_number)
);

COMMENT ON TABLE room IS '房间表';

-- 房型图片
CREATE TABLE room_images (
    id           NUMBER(19) PRIMARY KEY,
    room_type_id NUMBER(19) NOT NULL,
    url          VARCHAR2(1000) NOT NULL,
    is_primary   NUMBER(1) DEFAULT 0 NOT NULL,
    sort_order   NUMBER(10) DEFAULT 0 NOT NULL,
    created_at   DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_room_images_type FOREIGN KEY (room_type_id) REFERENCES room_type(id) ON DELETE CASCADE
);

COMMENT ON TABLE room_images IS '房型图片表';

-- 价格策略
CREATE TABLE room_price_strategy (
    id            NUMBER(19) PRIMARY KEY,
    hotel_id      NUMBER(19) NOT NULL,
    room_type_id  NUMBER(19) NOT NULL,
    strategy_type NUMBER(3) NOT NULL,
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    price_adjust  NUMBER(10,2) DEFAULT 0.00,
    discount_rate NUMBER(3,2),
    vip_level     NUMBER(3),
    min_stay_days NUMBER(3) DEFAULT 1,
    status        NUMBER(3) DEFAULT 1 NOT NULL,
    created_time  DATE DEFAULT SYSDATE NOT NULL,
    updated_time  DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_price_strategy_hotel FOREIGN KEY (hotel_id) REFERENCES hotel(id) ON DELETE CASCADE,
    CONSTRAINT fk_price_strategy_type FOREIGN KEY (room_type_id) REFERENCES room_type(id) ON DELETE CASCADE
);

COMMENT ON TABLE room_price_strategy IS '房间价格策略表';

-- 维护记录
CREATE TABLE room_maintenance (
    id               NUMBER(19) PRIMARY KEY,
    room_id          NUMBER(19) NOT NULL,
    maintenance_type VARCHAR2(50) NOT NULL,
    description      CLOB,
    start_time       DATE NOT NULL,
    end_time         DATE,
    operator         VARCHAR2(50) NOT NULL,
    status           NUMBER(3) DEFAULT 1 NOT NULL,
    created_time     DATE DEFAULT SYSDATE NOT NULL,
    updated_time     DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_room_maintenance_room FOREIGN KEY (room_id) REFERENCES room(id) ON DELETE CASCADE
) LOB (description) STORE AS SECUREFILE (TABLESPACE hotel_lob_ts);

COMMENT ON TABLE room_maintenance IS '维护记录表';

-- 预订表
CREATE TABLE bookings (
    id                   NUMBER(19) PRIMARY KEY,
    hotel_id             NUMBER(19) NOT NULL,
    room_type_id         NUMBER(19) NOT NULL,
    room_id              NUMBER(19) NOT NULL,
    user_id              NUMBER(19) NOT NULL,
    start_time           DATE NOT NULL,
    end_time             DATE NOT NULL,
    status               VARCHAR2(30) DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING','PENDING_CONFIRMATION','PENDING_PAYMENT','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','REFUND_REQUESTED','REFUNDED')),
    guests               NUMBER(10) DEFAULT 1 NOT NULL,
    amount               NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    original_amount      NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    discount_amount      NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    payable_amount       NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    paid_amount          NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    discount_rate        NUMBER(4,3) DEFAULT 1.000 NOT NULL,
    payment_status       VARCHAR2(20) DEFAULT 'UNPAID' NOT NULL CHECK (payment_status IN ('UNPAID','PAID','PARTIAL_REFUND','REFUNDED','WAIVED')),
    payment_method       VARCHAR2(40),
    payment_channel      VARCHAR2(40),
    wallet_transaction_id NUMBER(19),
    payment_record_id    NUMBER(19),
    currency             CHAR(3) DEFAULT 'CNY' NOT NULL,
    contact_name         VARCHAR2(100),
    contact_phone        VARCHAR2(30),
    remark               VARCHAR2(500),
    refund_reason        VARCHAR2(500),
    refund_requested_at  DATE,
    refund_approved_at   DATE,
    refund_rejected_at   DATE,
    refund_approved_by   NUMBER(19),
    created_at           DATE DEFAULT SYSDATE NOT NULL,
    updated_at           DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_bookings_hotel FOREIGN KEY (hotel_id) REFERENCES hotel(id),
    CONSTRAINT fk_bookings_room_type FOREIGN KEY (room_type_id) REFERENCES room_type(id),
    CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES room(id),
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id)
);

COMMENT ON TABLE bookings IS '预订表';

-- 空房统计
CREATE TABLE vacancy_statistics (
    id                NUMBER(19) PRIMARY KEY,
    hotel_id          NUMBER(19) NOT NULL,
    room_type_id      NUMBER(19) NOT NULL,
    stat_date         DATE NOT NULL,
    stat_hour         NUMBER(3),
    total_rooms       NUMBER(10) DEFAULT 0 NOT NULL,
    available_rooms   NUMBER(10) DEFAULT 0 NOT NULL,
    occupied_rooms    NUMBER(10) DEFAULT 0 NOT NULL,
    reserved_rooms    NUMBER(10) DEFAULT 0 NOT NULL,
    maintenance_rooms NUMBER(10) DEFAULT 0 NOT NULL,
    locked_rooms      NUMBER(10) DEFAULT 0 NOT NULL,
    vacancy_count     NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    vacancy_rate      NUMBER(5,4) DEFAULT 0.0000 NOT NULL,
    occupancy_rate    NUMBER(5,4) DEFAULT 0.0000 NOT NULL,
    booking_rate      NUMBER(5,4) DEFAULT 0.0000 NOT NULL,
    average_price     NUMBER(10,2),
    created_at        DATE DEFAULT SYSDATE NOT NULL,
    updated_at        DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_vacancy_stats_hotel FOREIGN KEY (hotel_id) REFERENCES hotel(id) ON DELETE CASCADE,
    CONSTRAINT fk_vacancy_stats_room_type FOREIGN KEY (room_type_id) REFERENCES room_type(id) ON DELETE CASCADE,
    CONSTRAINT uq_vacancy_stats UNIQUE (hotel_id, room_type_id, stat_date, stat_hour)
);

COMMENT ON TABLE vacancy_statistics IS '空房统计表';

-- 钱包账户
CREATE TABLE wallet_account (
    id             NUMBER(19) PRIMARY KEY,
    user_id        NUMBER(19) NOT NULL,
    balance        NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    frozen_balance NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    status         VARCHAR2(10) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'FROZEN')),
    created_at     DATE DEFAULT SYSDATE NOT NULL,
    updated_at     DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_wallet_account_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_wallet_account_user UNIQUE (user_id)
);

COMMENT ON TABLE wallet_account IS '钱包账户表';

-- 钱包交易
CREATE TABLE wallet_transaction (
    id              NUMBER(19) GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    wallet_id       NUMBER(19) NOT NULL,
    user_id         NUMBER(19) NOT NULL,
    booking_id      NUMBER(19),
    type            VARCHAR2(20) NOT NULL CHECK (type IN ('RECHARGE', 'PAYMENT', 'REFUND', 'ADJUST')),
    direction       VARCHAR2(3) NOT NULL CHECK (direction IN ('IN', 'OUT')),
    amount          NUMBER(12,2) NOT NULL,
    balance_after   NUMBER(12,2) NOT NULL,
    payment_channel VARCHAR2(40),
    reference_no    VARCHAR2(100),
    remark          VARCHAR2(255),
    created_at      DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_wallet_tx_wallet FOREIGN KEY (wallet_id) REFERENCES wallet_account(id) ON DELETE CASCADE,
    CONSTRAINT fk_wallet_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_wallet_tx_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

COMMENT ON TABLE wallet_transaction IS '钱包交易记录表';

-- 支付记录
CREATE TABLE payment_record (
    id           NUMBER(19) PRIMARY KEY,
    booking_id   NUMBER(19) NOT NULL,
    user_id      NUMBER(19) NOT NULL,
    amount       NUMBER(12,2) NOT NULL,
    method       VARCHAR2(40) NOT NULL,
    channel      VARCHAR2(40),
    status       VARCHAR2(20) DEFAULT 'PAID' NOT NULL CHECK (status IN ('PENDING', 'PAID', 'REFUNDED', 'PARTIAL_REFUND')),
    paid_at      DATE,
    refunded_at  DATE,
    reference_no VARCHAR2(100),
    created_at   DATE DEFAULT SYSDATE NOT NULL,
    updated_at   DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_payment_record_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_record_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE payment_record IS '支付记录表';

-- ============================================================================
-- 序列
-- ============================================================================
CREATE SEQUENCE seq_hotel START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_hotel_gallery START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_users START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_room_type START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_room START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_room_images START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_room_price_strategy START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_room_maintenance START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_bookings START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_vacancy_statistics START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_wallet_account START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_wallet_transaction START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_payment_record START WITH 1 INCREMENT BY 1;

-- ============================================================================
-- 索引创建
-- ============================================================================
CREATE INDEX idx_hotel_city ON hotel(city) TABLESPACE hotel_idx_ts;

CREATE INDEX idx_users_status ON users(status) TABLESPACE hotel_idx_ts;

CREATE INDEX idx_room_type_hotel ON room_type(hotel_id) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_room_type_active ON room_type(hotel_id, is_active) TABLESPACE hotel_idx_ts;

CREATE INDEX idx_room_type ON room(room_type_id) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_room_status ON room(hotel_id, status) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_room_type_status ON room(room_type_id, status) TABLESPACE hotel_idx_ts;

CREATE INDEX idx_room_images_type ON room_images(room_type_id) TABLESPACE hotel_idx_ts;

CREATE INDEX idx_price_strategy_rt ON room_price_strategy(room_type_id, start_date, end_date) TABLESPACE hotel_idx_ts;

CREATE INDEX idx_room_maintenance_room ON room_maintenance(room_id) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_room_maintenance_status ON room_maintenance(status, start_time) TABLESPACE hotel_idx_ts;

CREATE INDEX idx_bookings_user ON bookings(user_id) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_bookings_status ON bookings(status) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_bookings_room ON bookings(room_id) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_bookings_room_period_full ON bookings(room_id, start_time, end_time) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_bookings_period ON bookings(start_time, end_time) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_bookings_room_type_period ON bookings(room_type_id, start_time) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_bookings_room_type_room ON bookings(room_type_id, room_id, start_time) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_bookings_hotel_fk ON bookings(hotel_id) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_bookings_roomtype_fk ON bookings(room_type_id) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_bookings_start_trunc ON bookings(TRUNC(start_time)) TABLESPACE hotel_idx_ts;

CREATE INDEX idx_wallet_tx_user ON wallet_transaction(user_id, id) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_wallet_tx_booking ON wallet_transaction(booking_id) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_payment_record_user ON payment_record(user_id, id) TABLESPACE hotel_idx_ts;

CREATE INDEX idx_vacancy_stats_date ON vacancy_statistics(stat_date) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_vacancy_stats_room_type_date ON vacancy_statistics(room_type_id, stat_date) TABLESPACE hotel_idx_ts;
CREATE INDEX idx_vacancy_stats_hotel_date ON vacancy_statistics(hotel_id, stat_date) TABLESPACE hotel_idx_ts;

-- ============================================================================
-- 触发器
-- ============================================================================

-- 强制校验时间重叠的触发器
CREATE OR REPLACE TRIGGER trg_bookings_overlap_check
FOR INSERT OR UPDATE ON bookings
COMPOUND TRIGGER
    TYPE t_booking_info IS RECORD (
        id         NUMBER(19),
        room_id    NUMBER(19),
        start_time DATE,
        end_time   DATE,
        status     VARCHAR2(30)
    );
    TYPE t_booking_list IS TABLE OF t_booking_info INDEX BY PLS_INTEGER;
    v_bookings t_booking_list;

    AFTER EACH ROW IS
    BEGIN
        -- 仅对有效状态的订单进行重叠校验
        IF :NEW.status NOT IN ('CANCELLED', 'REFUNDED') THEN
            v_bookings(v_bookings.COUNT + 1).id := :NEW.id;
            v_bookings(v_bookings.COUNT).room_id := :NEW.room_id;
            v_bookings(v_bookings.COUNT).start_time := :NEW.start_time;
            v_bookings(v_bookings.COUNT).end_time := :NEW.end_time;
            v_bookings(v_bookings.COUNT).status := :NEW.status;
        END IF;
    END AFTER EACH ROW;

    AFTER STATEMENT IS
        v_overlap_count NUMBER;
    BEGIN
        FOR i IN 1 .. v_bookings.COUNT LOOP
            SELECT COUNT(*)
            INTO v_overlap_count
            FROM bookings
            WHERE room_id = v_bookings(i).room_id
              AND id != NVL(v_bookings(i).id, 0) -- 排除自身（针对更新操作）
              AND status NOT IN ('CANCELLED', 'REFUNDED')
              -- 核心重叠判定算法：(A.Start < B.End) AND (A.End > B.Start)
              AND start_time < v_bookings(i).end_time
              AND end_time > v_bookings(i).start_time;

            IF v_overlap_count > 0 THEN
                RAISE_APPLICATION_ERROR(-20002, 
                    '房间ID ' || v_bookings(i).room_id || ' 在 ' || 
                    TO_CHAR(v_bookings(i).start_time, 'YYYY-MM-DD HH24:MI') || ' 至 ' || 
                    TO_CHAR(v_bookings(i).end_time, 'YYYY-MM-DD HH24:MI') || ' 期间已有预订冲突！');
            END IF;
        END LOOP;
    END AFTER STATEMENT;
END;
/

CREATE OR REPLACE TRIGGER trg_booking_status_update
FOR UPDATE OF status ON bookings
COMPOUND TRIGGER
    -- 用于存储受影响的房间ID，避免变异表错误
    TYPE t_room_info IS RECORD (
        room_id NUMBER(19),
        status  VARCHAR2(50)
    );
    TYPE t_room_list IS TABLE OF t_room_info INDEX BY PLS_INTEGER;
    v_rooms t_room_list;

    AFTER EACH ROW IS
    BEGIN
        -- 记录受影响的房间和最新的订单状态
        v_rooms(v_rooms.COUNT + 1).room_id := :NEW.room_id;
        v_rooms(v_rooms.COUNT).status := :NEW.status;

        -- 立即执行不需要查询 bookings 表的逻辑
        IF :NEW.status = 'CHECKED_IN' THEN
            UPDATE room SET status = 3, updated_time = SYSDATE WHERE id = :NEW.room_id;
        END IF;
    END AFTER EACH ROW;

    AFTER STATEMENT IS
        v_exists NUMBER;
    BEGIN
        FOR i IN 1 .. v_rooms.COUNT LOOP
            -- 处理退房逻辑
            IF v_rooms(i).status = 'CHECKED_OUT' THEN
                SELECT COUNT(*) INTO v_exists
                FROM bookings
                WHERE room_id = v_rooms(i).room_id
                  AND status IN ('CONFIRMED', 'PENDING', 'PENDING_CONFIRMATION', 'PENDING_PAYMENT')
                  AND start_time > SYSDATE;

                IF v_exists > 0 THEN
                    UPDATE room SET status = 2, updated_time = SYSDATE WHERE id = v_rooms(i).room_id;
                ELSE
                    UPDATE room SET status = 1, last_checkout_time = SYSDATE, updated_time = SYSDATE WHERE id = v_rooms(i).room_id;
                END IF;

            -- 处理取消/退款逻辑
            ELSIF v_rooms(i).status IN ('CANCELLED', 'REFUNDED') THEN
                SELECT COUNT(*) INTO v_exists
                FROM bookings
                WHERE room_id = v_rooms(i).room_id
                  AND status IN ('CONFIRMED', 'CHECKED_IN', 'PENDING', 'PENDING_CONFIRMATION', 'PENDING_PAYMENT');

                IF v_exists > 0 THEN
                    UPDATE room SET status = 2, updated_time = SYSDATE WHERE id = v_rooms(i).room_id;
                ELSE
                    UPDATE room SET status = 1, updated_time = SYSDATE WHERE id = v_rooms(i).room_id;
                END IF;
            END IF;
        END LOOP;
    END AFTER STATEMENT;
END;
/

CREATE OR REPLACE TRIGGER trg_booking_insert
AFTER INSERT ON bookings
FOR EACH ROW
DECLARE
    v_available_count NUMBER;
BEGIN
    IF :NEW.status IN ('PENDING','PENDING_CONFIRMATION','PENDING_PAYMENT','CONFIRMED','CHECKED_IN') THEN
        UPDATE room_type
        SET available_count = available_count - 1,
            updated_time = SYSDATE
        WHERE id = :NEW.room_type_id AND available_count > 0
        RETURNING available_count INTO v_available_count;

        IF SQL%NOTFOUND THEN
            RAISE_APPLICATION_ERROR(-20001, '房型库存不足，无法预订');
        END IF;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_booking_cancel_refund
AFTER UPDATE OF status ON bookings
FOR EACH ROW
BEGIN
    IF :OLD.status IN ('PENDING','PENDING_CONFIRMATION','PENDING_PAYMENT','CONFIRMED','CHECKED_IN')
       AND :NEW.status IN ('CANCELLED','REFUNDED') THEN
        UPDATE room_type
        SET available_count = available_count + 1,
            updated_time = SYSDATE
        WHERE id = :NEW.room_type_id;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_user_vip_upgrade
BEFORE UPDATE OF total_consumption ON users
FOR EACH ROW
DECLARE
    v_new_level NUMBER(3);
BEGIN
    v_new_level := CASE
        WHEN :NEW.total_consumption >= 50000 THEN 4
        WHEN :NEW.total_consumption >= 30000 THEN 3
        WHEN :NEW.total_consumption >= 15000 THEN 2
        WHEN :NEW.total_consumption >= 5000  THEN 1
        ELSE 0
    END;
    IF v_new_level != :NEW.vip_level THEN
        :NEW.vip_level := v_new_level;
        :NEW.updated_at := SYSDATE;
    END IF;
END;
/

-- ============================================================================
-- 存储过程与函数
-- ============================================================================
CREATE OR REPLACE PROCEDURE generate_daily_stats(
    p_start_date DATE,
    p_end_date   DATE
) IS
    v_stat_date DATE;
    v_total_rooms NUMBER;
    v_available_rooms NUMBER;
    v_occupied_rooms NUMBER;
    v_reserved_rooms NUMBER;
    v_maintenance_rooms NUMBER;
    v_locked_rooms NUMBER;
    v_vacancy_rate NUMBER(5,4);
BEGIN
    v_stat_date := p_start_date;

    WHILE v_stat_date <= p_end_date LOOP
        FOR rec IN (
            SELECT h.id AS hotel_id, rt.id AS room_type_id
            FROM hotel h
            JOIN room_type rt ON rt.hotel_id = h.id
            WHERE rt.is_active = 1
        ) LOOP
            SELECT 
                COUNT(*),
                SUM(CASE WHEN r.status = 1 THEN 1 ELSE 0 END),
                SUM(CASE WHEN r.status = 3 THEN 1 ELSE 0 END),
                SUM(CASE WHEN r.status = 2 THEN 1 ELSE 0 END),
                SUM(CASE WHEN r.status = 5 THEN 1 ELSE 0 END)
            INTO 
                v_total_rooms, 
                v_available_rooms, 
                v_occupied_rooms, 
                v_reserved_rooms, 
                v_maintenance_rooms
            FROM room r
            WHERE r.room_type_id = rec.room_type_id;

            v_locked_rooms := 0;

            IF v_total_rooms > 0 THEN
                v_vacancy_rate := v_available_rooms / v_total_rooms;
            ELSE
                v_vacancy_rate := 0;
            END IF;

            MERGE INTO vacancy_statistics vs
            USING (
                SELECT 
                    rec.hotel_id AS hid, 
                    rec.room_type_id AS rtid, 
                    v_stat_date AS sdate, 
                    NULL AS shour 
                FROM DUAL
            ) src
            ON (
                vs.hotel_id = src.hid 
                AND vs.room_type_id = src.rtid 
                AND vs.stat_date = src.sdate 
                AND vs.stat_hour IS NULL
            )
            WHEN MATCHED THEN
                UPDATE SET
                    total_rooms = v_total_rooms,
                    available_rooms = v_available_rooms,
                    occupied_rooms = v_occupied_rooms,
                    reserved_rooms = v_reserved_rooms,
                    maintenance_rooms = v_maintenance_rooms,
                    locked_rooms = v_locked_rooms,
                    vacancy_count = v_available_rooms,
                    vacancy_rate = v_vacancy_rate,
                    occupancy_rate = v_occupied_rooms / NULLIF(v_total_rooms,0),
                    booking_rate = v_reserved_rooms / NULLIF(v_total_rooms,0),
                    updated_at = SYSDATE
            WHEN NOT MATCHED THEN
                INSERT (
                    hotel_id, room_type_id, stat_date, stat_hour,
                    total_rooms, available_rooms,
                    occupied_rooms, reserved_rooms,
                    maintenance_rooms, locked_rooms,
                    vacancy_count, vacancy_rate,
                    occupancy_rate, booking_rate,
                    created_at, updated_at
                )
                VALUES (
                    rec.hotel_id,
                    rec.room_type_id,
                    v_stat_date,
                    NULL,
                    v_total_rooms,
                    v_available_rooms,
                    v_occupied_rooms,
                    v_reserved_rooms,
                    v_maintenance_rooms,
                    v_locked_rooms,
                    v_available_rooms,
                    v_vacancy_rate,
                    v_occupied_rooms / NULLIF(v_total_rooms,0),
                    v_reserved_rooms / NULLIF(v_total_rooms,0),
                    SYSDATE,
                    SYSDATE
                );

        END LOOP;

        v_stat_date := v_stat_date + 1;
    END LOOP;

    COMMIT;

    DBMS_OUTPUT.PUT_LINE(
        '统计生成完成，日期范围: ' 
        || TO_CHAR(p_start_date, 'YYYY-MM-DD') 
        || ' 至 ' 
        || TO_CHAR(p_end_date, 'YYYY-MM-DD')
    );
END generate_daily_stats;
/

CREATE OR REPLACE PROCEDURE monthly_vip_upgrade IS
    CURSOR c_user IS
        SELECT id, total_consumption, vip_level FROM users;
BEGIN
    FOR u IN c_user LOOP
        DECLARE
            v_new_level NUMBER(3);
        BEGIN
            v_new_level := CASE
                WHEN u.total_consumption >= 50000 THEN 4
                WHEN u.total_consumption >= 30000 THEN 3
                WHEN u.total_consumption >= 15000 THEN 2
                WHEN u.total_consumption >= 5000  THEN 1
                ELSE 0
            END;
            IF v_new_level != u.vip_level THEN
                UPDATE users
                SET vip_level = v_new_level,
                    updated_at = SYSDATE
                WHERE id = u.id;
            END IF;
        END;
    END LOOP;
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('月度VIP升级已完成');
END monthly_vip_upgrade;
/

CREATE OR REPLACE FUNCTION get_user_discount(p_user_id NUMBER) RETURN NUMBER IS
    v_discount_rate NUMBER(4,3);
BEGIN
    SELECT v.discount_rate
    INTO v_discount_rate
    FROM users u
    JOIN vip_level_policy v ON v.vip_level = u.vip_level
    WHERE u.id = p_user_id;
    RETURN v_discount_rate;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 1.000;
END get_user_discount;
/

CREATE OR REPLACE FUNCTION calculate_booking_amount(
    p_room_type_id NUMBER,
    p_start_date DATE,
    p_end_date DATE,
    p_user_id NUMBER
) RETURN NUMBER IS
    v_base_price NUMBER(10,2);
    v_days NUMBER;
    v_discount NUMBER(4,3);
BEGIN
    SELECT price_per_night INTO v_base_price
    FROM room_type WHERE id = p_room_type_id;
    v_days := p_end_date - p_start_date;
    IF v_days <= 0 THEN
        RETURN 0;
    END IF;
    v_discount := get_user_discount(p_user_id);
    RETURN v_base_price * v_days * v_discount;
END calculate_booking_amount;
/

CREATE OR REPLACE FUNCTION calculate_refund_amount(p_booking_id NUMBER) RETURN NUMBER IS
    v_paid_amount NUMBER(10,2);
    v_status VARCHAR2(30);
    v_start_date DATE;
BEGIN
    SELECT paid_amount, status, start_time INTO v_paid_amount, v_status, v_start_date
    FROM bookings WHERE id = p_booking_id;
    IF v_paid_amount > 0 AND v_status NOT IN ('REFUNDED','CANCELLED','CHECKED_OUT') AND v_start_date > SYSDATE THEN
        RETURN v_paid_amount;
    ELSE
        RETURN 0;
    END IF;
END calculate_refund_amount;
/


-- ============================================================================
-- Oracle Text 索引
-- ============================================================================
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX idx_hotel_intro_text ON hotel(introduction) INDEXTYPE IS CTXSYS.CONTEXT';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/


-- ============================================================================
-- 初始化数据
-- ============================================================================

-- 酒店
INSERT INTO hotel (id, name, address, city, phone, star_level, status, introduction, hero_image_url)
VALUES (seq_hotel.NEXTVAL, '星河国际大酒店', '北京市朝阳区建国路99号', '北京', '010-88886666', 5, 1,
        '星河国际大酒店坐落于国贸CBD核心区，拥有双塔地标建筑和330间现代客房，为商旅人士和高端宾客提供“云中居停”体验。酒店引入数字化前台、24小时行政酒廊、跨界艺术展以及京派与法餐融合的餐饮场景，提供一站式会议与社交服务。',
        'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/hotels/xinghe-hero.jpg');

INSERT INTO hotel_gallery (id, hotel_id, url, sort_order)
SELECT seq_hotel_gallery.NEXTVAL, h.id, 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/hotels/xinghe-gallery0.jpg', 1
FROM hotel h WHERE h.name = '星河国际大酒店';

INSERT INTO hotel_gallery (id, hotel_id, url, sort_order)
SELECT seq_hotel_gallery.NEXTVAL, h.id, 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/hotels/xinghe-gallery1.jpg', 2
FROM hotel h WHERE h.name = '星河国际大酒店';

INSERT INTO hotel (id, name, address, city, phone, star_level, status, introduction, hero_image_url)
VALUES (seq_hotel.NEXTVAL, '海滩假日酒店', '上海市浦东新区滨江大道68号', '上海', '021-66668888', 4, 1,
        '海滩假日酒店依江而建，以“都市中心度假”为理念，设有阳台景观客房、儿童探险乐园和江景无边泳池。酒店引入空气净化、智能语音控制和亲子烘焙课程，满足城市家庭和情侣的周末微度假需求。',
        'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/hotels/xinghe-hero.jpg');

INSERT INTO hotel_gallery (id, hotel_id, url, sort_order)
SELECT seq_hotel_gallery.NEXTVAL, h.id, 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/hotels/xinghe-gallery0.jpg', 1
FROM hotel h WHERE h.name = '海滩假日酒店';

INSERT INTO hotel (id, name, address, city, phone, star_level, status, introduction, hero_image_url)
VALUES (seq_hotel.NEXTVAL, '云栖温泉度假酒店', '成都市都江堰市青城山路18号', '成都', '028-86668888', 5, 1,
        '云栖温泉度假酒店依青城山脚而建，拥抱自然山林与温泉，提供私汤别墅、露天温泉泡池和瑜伽冥想课程。酒店以“回归自然”的生活方式为灵感，引入从农场到餐桌的有机餐饮、亲子自然课堂和星空露营，为都市旅人带来深度疗愈体验。',
        'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/hotels/xinghe-hero.jpg');

INSERT INTO hotel_gallery (id, hotel_id, url, sort_order)
SELECT seq_hotel_gallery.NEXTVAL, h.id, 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/hotels/xinghe-gallery0.jpg', 1
FROM hotel h WHERE h.name = '云栖温泉度假酒店';

-- 用户
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'admin', 'adminpass', 'ADMIN', 0, 0.00, '13912345678', 'admin@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'frontdesk', 'frontdesk', 'ADMIN', 0, 0.00, '13923456789', 'frontdesk@hotel.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'alice', 'alicepwd', 'USER', 1, 5309.40, '13812345678', 'alice@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'bob', 'bobpwd', 'USER', 0, 2576.00, '15987654321', 'bob@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'charlie', 'charliepwd', 'USER', 2, 16085.36, '13698745632', 'charlie@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'diana', 'dianapwd', 'USER', 1, 1079.20, '18611223344', 'diana@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'leo', 'leopwd', 'USER', 3, 0.00, '13712349876', 'leo@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'mia', 'miapwd', 'USER', 2, 15363.12, '15712348765', 'mia@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'nina', 'ninapwd', 'USER', 0, 1996.00, '13698761234', 'nina@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'oscar', 'oscarpwd', 'USER', 1, 1320.96, '18623456789', 'oscar@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'paul', 'paulpwd', 'USER', 2, 17338.96, '13787654321', 'paul@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'quinn', 'quinnpwd', 'USER', 3, 32699.60, '15876543210', 'quinn@example.com');
INSERT INTO users (id, username, password, role, vip_level, total_consumption, phone, email)
VALUES (seq_users.NEXTVAL, 'rachel', 'rachelpwd', 'USER', 4, 52243.52, '13911112222', 'rachel@example.com');

-- VIP 等级政策
INSERT INTO vip_level_policy (vip_level, name, discount_rate, checkout_hour, description) VALUES (0, '标准会员', 1.000, 12, '免费注册，标准退房时间为次日中午12:00');
INSERT INTO vip_level_policy (vip_level, name, discount_rate, checkout_hour, description) VALUES (1, '白银会员', 0.950, 13, '年累计消费满5000元升级，退房延至次日13:00');
INSERT INTO vip_level_policy (vip_level, name, discount_rate, checkout_hour, description) VALUES (2, '黄金会员', 0.900, 14, '年累计消费满15000元升级，退房延至次日14:00');
INSERT INTO vip_level_policy (vip_level, name, discount_rate, checkout_hour, description) VALUES (3, '铂金会员', 0.880, 15, '年累计消费满30000元升级，退房延至次日15:00');
INSERT INTO vip_level_policy (vip_level, name, discount_rate, checkout_hour, description) VALUES (4, '钻石会员', 0.850, 16, '核心客户定向邀请（建议年消费5万元以上），额外VIP特权及私人管家服务');

-- 钱包账户
INSERT INTO wallet_account (id, user_id, balance, frozen_balance)
SELECT seq_wallet_account.NEXTVAL, id,
       CASE WHEN vip_level >= 3 THEN 18500.00
            WHEN vip_level = 2 THEN 5000.00
            WHEN vip_level = 1 THEN 1600.00
            ELSE 400.00
       END,
       0.00
FROM users;

-- 房型
INSERT INTO room_type (id, hotel_id, name, type, theme_color, description, price_per_night, total_count, available_count, images, amenities, area_sqm, bed_type, max_guests)
SELECT seq_room_type.NEXTVAL, h.id, '星河行政大床房', '行政', '#2F54EB',
       '落地窗景观，含行政酒廊使用权及双人早餐', 568.00, 18, 11, NULL,
       '["WIFI","55寸电视","空气净化器","浴缸","行政酒廊","USB充电口","高速办公桌","智能窗帘"]',
       35.0, '大床', 2
FROM hotel h WHERE h.name = '星河国际大酒店';

INSERT INTO room_type (id, hotel_id, name, type, theme_color, description, price_per_night, total_count, available_count, images, amenities, area_sqm, bed_type, max_guests)
SELECT seq_room_type.NEXTVAL, h.id, '星河家庭套房', '家庭套房', '#D46B08',
       '双卧室设计，客厅带儿童帐篷及游戏角', 1188.00, 8, 4, NULL,
       '["WIFI","洗衣机/烘干机","咖啡机","儿童玩具","浴缸","儿童餐具","微波炉","家庭桌游"]',
       68.0, '大床+单人床', 4
FROM hotel h WHERE h.name = '星河国际大酒店';

INSERT INTO room_type (id, hotel_id, name, type, theme_color, description, price_per_night, total_count, available_count, images, amenities, area_sqm, bed_type, max_guests)
SELECT seq_room_type.NEXTVAL, h.id, '星河城市景观房', '城景', '#13C2C2',
       '高层城景房，含欢迎水果及晚间甜点', 468.00, 24, 15, NULL,
       '["WIFI","蓝牙音箱","迷你吧","浴袍","智能语音控制","夜床服务","香薰机","电子保险箱"]',
       30.0, '大床', 2
FROM hotel h WHERE h.name = '星河国际大酒店';

INSERT INTO room_type (id, hotel_id, name, type, theme_color, description, price_per_night, total_count, available_count, images, amenities, area_sqm, bed_type, max_guests)
SELECT seq_room_type.NEXTVAL, h.id, '海景观景房', '海景尊享', '#1D39C4',
       '阳台直面黄浦江夜景', 828.00, 12, 10, NULL,
       '["WIFI","阳台躺椅","奈斯派索咖啡机","浴缸","智能窗帘","户外泡池","香薰机","BOSE音响"]',
       36.0, '大床', 2
FROM hotel h WHERE h.name = '海滩假日酒店';

INSERT INTO room_type (id, hotel_id, name, type, theme_color, description, price_per_night, total_count, available_count, images, amenities, area_sqm, bed_type, max_guests)
SELECT seq_room_type.NEXTVAL, h.id, '海豚家庭主题房', '亲子主题', '#EB2F96',
       '家庭主题装饰，含儿童滑梯、绘本和加湿器', 688.00, 14, 12, NULL,
       '["WIFI","儿童滑梯","绘本角","空气加湿器","浴袍","益智拼图","儿童浴袍","夜光墙贴"]',
       42.0, '大床+单人床', 4
FROM hotel h WHERE h.name = '海滩假日酒店';

INSERT INTO room_type (id, hotel_id, name, type, theme_color, description, price_per_night, total_count, available_count, images, amenities, area_sqm, bed_type, max_guests)
SELECT seq_room_type.NEXTVAL, h.id, '海天云顶套房', '云顶套房', '#722ED1',
       '挑高客厅，含私人管家服务', 1368.00, 5, 3, NULL,
       '["WIFI","私人管家","家庭影院","梳妆台","浴缸","私人影院","云办公桌","香槟迷你吧"]',
       92.0, '大床', 3
FROM hotel h WHERE h.name = '海滩假日酒店';

INSERT INTO room_type (id, hotel_id, name, type, theme_color, description, price_per_night, total_count, available_count, images, amenities, area_sqm, bed_type, max_guests)
SELECT seq_room_type.NEXTVAL, h.id, '云栖私汤大床房', '温泉', '#FA541C',
       '房内私享温泉泡池，含欢迎水果和晨间瑜伽', 998.00, 10, 9, NULL,
       '["WIFI","私汤温泉","壁炉","空气净化系统","瑜伽垫","香氛枕","森林浴原声","有机茶包"]',
       48.0, '大床', 2
FROM hotel h WHERE h.name = '云栖温泉度假酒店';

INSERT INTO room_type (id, hotel_id, name, type, theme_color, description, price_per_night, total_count, available_count, images, amenities, area_sqm, bed_type, max_guests)
SELECT seq_room_type.NEXTVAL, h.id, '云栖森林木屋', '木屋', '#389E0D',
       '独栋木质别墅，带露台可观星，适合小型聚会', 1288.00, 6, 4, NULL,
       '["WIFI","露台壁炉","厨房","投影仪","咖啡机","露营灯","户外烧烤炉","观星望远镜"]',
       75.0, '大床+沙发床', 4
FROM hotel h WHERE h.name = '云栖温泉度假酒店';

INSERT INTO room_type (id, hotel_id, name, type, theme_color, description, price_per_night, total_count, available_count, images, amenities, area_sqm, bed_type, max_guests)
SELECT seq_room_type.NEXTVAL, h.id, '云栖禅意套房', '禅意套房', '#531DAB',
       '榻榻米客厅与茶道角，含双人禅修课程', 1588.00, 4, 3, NULL,
       '["WIFI","香薰加湿器","茶道角","冥想坐垫","BOSE音响","焚香礼盒","手作茶具","睡眠香薰"]',
       85.0, '榻榻米', 3
FROM hotel h WHERE h.name = '云栖温泉度假酒店';

-- 常规价格策略（VIP折扣）
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.95, 1, 1, 1
FROM room_type rt WHERE rt.name = '星河行政大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.90, 2, 1, 1
FROM room_type rt WHERE rt.name = '星河行政大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.88, 3, 1, 1
FROM room_type rt WHERE rt.name = '星河行政大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.85, 4, 1, 1
FROM room_type rt WHERE rt.name = '星河行政大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.96, 1, 1, 1
FROM room_type rt WHERE rt.name = '星河家庭套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.92, 2, 1, 1
FROM room_type rt WHERE rt.name = '星河家庭套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.89, 3, 1, 1
FROM room_type rt WHERE rt.name = '星河家庭套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.86, 4, 1, 1
FROM room_type rt WHERE rt.name = '星河家庭套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.97, 1, 1, 1
FROM room_type rt WHERE rt.name = '星河城市景观房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.93, 2, 1, 1
FROM room_type rt WHERE rt.name = '星河城市景观房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.90, 3, 1, 1
FROM room_type rt WHERE rt.name = '星河城市景观房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.87, 4, 1, 1
FROM room_type rt WHERE rt.name = '星河城市景观房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.94, 1, 1, 1
FROM room_type rt WHERE rt.name = '海景观景房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.89, 2, 1, 1
FROM room_type rt WHERE rt.name = '海景观景房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.86, 3, 1, 1
FROM room_type rt WHERE rt.name = '海景观景房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.83, 4, 1, 1
FROM room_type rt WHERE rt.name = '海景观景房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.96, 1, 1, 1
FROM room_type rt WHERE rt.name = '海豚家庭主题房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.91, 2, 1, 1
FROM room_type rt WHERE rt.name = '海豚家庭主题房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.88, 3, 1, 1
FROM room_type rt WHERE rt.name = '海豚家庭主题房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.85, 4, 1, 1
FROM room_type rt WHERE rt.name = '海豚家庭主题房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.93, 1, 1, 1
FROM room_type rt WHERE rt.name = '海天云顶套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.88, 2, 1, 1
FROM room_type rt WHERE rt.name = '海天云顶套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.85, 3, 1, 1
FROM room_type rt WHERE rt.name = '海天云顶套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.82, 4, 1, 1
FROM room_type rt WHERE rt.name = '海天云顶套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.95, 1, 1, 1
FROM room_type rt WHERE rt.name = '云栖私汤大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.90, 2, 1, 1
FROM room_type rt WHERE rt.name = '云栖私汤大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.87, 3, 1, 1
FROM room_type rt WHERE rt.name = '云栖私汤大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.84, 4, 1, 1
FROM room_type rt WHERE rt.name = '云栖私汤大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.94, 1, 1, 1
FROM room_type rt WHERE rt.name = '云栖森林木屋' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.89, 2, 1, 1
FROM room_type rt WHERE rt.name = '云栖森林木屋' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.86, 3, 1, 1
FROM room_type rt WHERE rt.name = '云栖森林木屋' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.83, 4, 1, 1
FROM room_type rt WHERE rt.name = '云栖森林木屋' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.93, 1, 1, 1
FROM room_type rt WHERE rt.name = '云栖禅意套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.88, 2, 1, 1
FROM room_type rt WHERE rt.name = '云栖禅意套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.85, 3, 1, 1
FROM room_type rt WHERE rt.name = '云栖禅意套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, DATE '2024-01-01', DATE '2030-12-31', 0.00, 0.82, 4, 1, 1
FROM room_type rt WHERE rt.name = '云栖禅意套房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');

-- 房型图片
INSERT INTO room_images (id, room_type_id, url, is_primary, sort_order)
SELECT seq_room_images.NEXTVAL, rt.id, urls.url, urls.is_primary, urls.sort_order
FROM room_type rt
JOIN (
    SELECT '星河行政大床房' AS name, 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-exec-1.jpg' AS url, 1 AS is_primary, 1 AS sort_order FROM DUAL UNION ALL
    SELECT '星河行政大床房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-exec-2.jpg', 0, 2 FROM DUAL UNION ALL
    SELECT '星河行政大床房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-exec-3.jpg', 0, 3 FROM DUAL UNION ALL
    SELECT '星河家庭套房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-family-1.jpg', 1, 1 FROM DUAL UNION ALL
    SELECT '星河家庭套房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-family-2.jpg', 0, 2 FROM DUAL UNION ALL
    SELECT '星河家庭套房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-family-3.jpg', 0, 3 FROM DUAL UNION ALL
    SELECT '星河城市景观房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-city-1.jpg', 1, 1 FROM DUAL UNION ALL
    SELECT '星河城市景观房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-city-2.jpg', 0, 2 FROM DUAL UNION ALL
    SELECT '海景观景房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-exec-1.jpg', 1, 1 FROM DUAL UNION ALL
    SELECT '海景观景房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-exec-2.jpg', 0, 2 FROM DUAL UNION ALL
    SELECT '海豚家庭主题房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-family-1.jpg', 1, 1 FROM DUAL UNION ALL
    SELECT '海豚家庭主题房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-family-2.jpg', 0, 2 FROM DUAL UNION ALL
    SELECT '海天云顶套房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-city-1.jpg', 1, 1 FROM DUAL UNION ALL
    SELECT '海天云顶套房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-city-2.jpg', 0, 2 FROM DUAL UNION ALL
    SELECT '云栖私汤大床房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-exec-1.jpg', 1, 1 FROM DUAL UNION ALL
    SELECT '云栖私汤大床房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-exec-2.jpg', 0, 2 FROM DUAL UNION ALL
    SELECT '云栖森林木屋', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-family-1.jpg', 1, 1 FROM DUAL UNION ALL
    SELECT '云栖森林木屋', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-family-2.jpg', 0, 2 FROM DUAL UNION ALL
    SELECT '云栖禅意套房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-city-1.jpg', 1, 1 FROM DUAL UNION ALL
    SELECT '云栖禅意套房', 'https://hotelhotel.oss-cn-beijing.aliyuncs.com/images/rooms/xinghe-city-2.jpg', 0, 2 FROM DUAL
) urls ON urls.name = rt.name;

-- 更新房型图片字段
UPDATE room_type rt
SET images = (
    SELECT LISTAGG(url, ',') WITHIN GROUP (ORDER BY sort_order)
    FROM room_images ri
    WHERE ri.room_type_id = rt.id
);

SAVEPOINT before_room_insert;

-- 插入房间（已补充 id 列及序列）
INSERT INTO room (id, hotel_id, room_type_id, room_number, floor, status)
WITH room_type_ranked AS (
    SELECT id, hotel_id, total_count,
           ROW_NUMBER() OVER (PARTITION BY hotel_id ORDER BY id) AS type_rank
    FROM room_type
),
numbers AS (
    SELECT LEVEL AS n FROM DUAL CONNECT BY LEVEL <= (SELECT MAX(total_count) FROM room_type)
)
SELECT seq_room.NEXTVAL, rt.hotel_id, rt.id,
       CHR(64 + rt.type_rank) || LPAD(FLOOR((n-1)/8) + 1, 2, '0') || LPAD(MOD(n-1,8) + 1, 2, '0') AS room_number,
       FLOOR((n-1)/8) + 1 AS floor,
       1 AS status
FROM room_type_ranked rt
JOIN numbers ON n <= rt.total_count;

-- 额外价格策略
INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 2, TRUNC(SYSDATE), TRUNC(SYSDATE) + 30, NULL, 0.92, 1, 1, 1
FROM room_type rt WHERE rt.name = '星河城市景观房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 1, TRUNC(SYSDATE) + 5, TRUNC(SYSDATE) + 12, 180.00, NULL, NULL, 1, 1
FROM room_type rt WHERE rt.name = '星河行政大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 3, TRUNC(SYSDATE) + 14, TRUNC(SYSDATE) + 45, NULL, 0.88, NULL, 2, 1
FROM room_type rt WHERE rt.name = '海豚家庭主题房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店');

INSERT INTO room_price_strategy (id, hotel_id, room_type_id, strategy_type, start_date, end_date, price_adjust, discount_rate, vip_level, min_stay_days, status)
SELECT seq_room_price_strategy.NEXTVAL, rt.hotel_id, rt.id, 1, TRUNC(SYSDATE) + 20, TRUNC(SYSDATE) + 35, -120.00, NULL, NULL, 1, 1
FROM room_type rt WHERE rt.name = '云栖私汤大床房' AND rt.hotel_id = (SELECT id FROM hotel WHERE name='云栖温泉度假酒店');

-- 维护记录（已补充 id 列及序列）
INSERT INTO room_maintenance (id, room_id, maintenance_type, description, start_time, end_time, operator, status)
SELECT seq_room_maintenance.NEXTVAL, room_id, '空调维修', '温度传感器故障，已联系供应商更换传感器', SYSDATE - 1, NULL, '张维修', 1
FROM (
    SELECT id AS room_id FROM room
    WHERE room_type_id = (SELECT id FROM room_type WHERE name = '星河城市景观房' AND hotel_id = (SELECT id FROM hotel WHERE name='星河国际大酒店'))
    ORDER BY room_number
    OFFSET 4 ROWS FETCH NEXT 1 ROWS ONLY
);

INSERT INTO room_maintenance (id, room_id, maintenance_type, description, start_time, end_time, operator, status)
SELECT seq_room_maintenance.NEXTVAL, room_id, '地毯清洗', '家庭房地毯上有巧克力渍，需深度清洁', SYSDATE - 3, SYSDATE - 2, '李清洁', 2
FROM (
    SELECT id AS room_id FROM room
    WHERE room_type_id = (SELECT id FROM room_type WHERE name = '海豚家庭主题房' AND hotel_id = (SELECT id FROM hotel WHERE name='海滩假日酒店'))
    ORDER BY room_number
    OFFSET 1 ROWS FETCH NEXT 1 ROWS ONLY
);

-- ============================================================================
-- 预订数据（所有 INSERT 均已补充 id 列及 seq_bookings.NEXTVAL）
-- ============================================================================
SAVEPOINT before_bookings;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 3 + 15/24, TRUNC(SYSDATE) + 5 + 12/24,
       'CONFIRMED', 2, 1079.20, 1136.00, 56.80, 1079.20, 1079.20, 0.95,
       'PAID', 'WALLET', 'WALLET', 'CNY', '爱丽丝', '13812345678', '要求高楼层'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河行政大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'alice'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) - 12 + 15/24, TRUNC(SYSDATE) - 9 + 12/24,
       'CHECKED_OUT', 2, 1333.80, 1404.00, 70.20, 1333.80, 1333.80, 0.95,
       'PAID', 'WALLET', 'WALLET', 'CNY', '爱丽丝', '13812345678', '已完成住宿，体验不错'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河城市景观房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'alice'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 25 + 15/24, TRUNC(SYSDATE) + 28 + 12/24,
       'CANCELLED', 3, 1981.44, 2064.00, 82.56, 1981.44, 0.00, 0.96,
       'UNPAID', 'CNY', '爱丽丝', '13812345678', '用户取消行程'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海豚家庭主题房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'alice'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 5 + 15/24, TRUNC(SYSDATE) + 7 + 12/24,
       'PENDING_PAYMENT', 4, 2376.00, 2376.00, 0.00, 2376.00, 0.00, 1.00,
       'UNPAID', 'CNY', '鲍勃', '15987654321', '等待支付'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河家庭套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'bob'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) - 40 + 15/24, TRUNC(SYSDATE) - 37 + 12/24,
       'CHECKED_OUT', 4, 2576.00, 2576.00, 0.00, 2576.00, 2576.00, 1.00,
       'PAID', 'DIRECT', 'ARRIVAL', 'CNY', '鲍勃', '15987654321', '朋友聚会，好评'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖森林木屋' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'bob'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) - 20 + 15/24, TRUNC(SYSDATE) - 18 + 12/24,
       'CANCELLED', 2, 1656.00, 1656.00, 0.00, 1656.00, 0.00, 1.00,
       'UNPAID', 'CNY', '鲍勃', '15987654321', '超时未支付自动取消'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海景观景房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'bob'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) - 1 + 15/24, TRUNC(SYSDATE) + 1 + 12/24,
       'CHECKED_IN', 2, 1473.84, 1656.00, 182.16, 1473.84, 1473.84, 0.89,
       'PAID', 'WALLET', 'WALLET', 'CNY', '查理', '13698745632', '正在入住'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海景观景房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'charlie'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) - 30 + 15/24, TRUNC(SYSDATE) - 27 + 12/24,
       'CHECKED_OUT', 2, 3611.52, 4104.00, 492.48, 3611.52, 3611.52, 0.88,
       'PAID', 'WALLET', 'WALLET', 'CNY', '查理', '13698745632', '纪念日入住'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海天云顶套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'charlie'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark, refund_reason, refund_requested_at, refund_approved_at, refund_approved_by)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 15 + 15/24, TRUNC(SYSDATE) + 17 + 12/24,
       'REFUNDED', 2, 1796.40, 1996.00, 199.60, 1796.40, 0.00, 0.90,
       'REFUNDED', 'ONLINE', 'VISA', 'CNY', '查理', '13698745632', '已全额退款',
       '行程变更，需要退款', TRUNC(SYSDATE) + 10, TRUNC(SYSDATE) + 11,
       (SELECT id FROM users WHERE username = 'admin' FETCH FIRST 1 ROWS ONLY)
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖私汤大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'charlie'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 10 + 15/24, TRUNC(SYSDATE) + 13 + 12/24,
       'PENDING', 3, 1881.36, 1980.00, 98.64, 1881.36, 0.00, 0.95,
       'UNPAID', 'CNY', '戴安娜', '18611223344', '需要婴儿床围栏'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海豚家庭主题房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'diana'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 1 + 15/24, TRUNC(SYSDATE) + 3 + 12/24,
       'CONFIRMED', 2, 1079.20, 1136.00, 56.80, 1079.20, 1079.20, 0.95,
       'PAID', 'ONLINE', 'ALIPAY', 'CNY', '戴安娜', '18611223344', '提前安排婴儿床'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河行政大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'diana'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 20 + 15/24, TRUNC(SYSDATE) + 23 + 12/24,
       'PENDING_CONFIRMATION', 2, 4525.80, 4764.00, 238.20, 4525.80, 0.00, 0.95,
       'UNPAID', 'CNY', '戴安娜', '18611223344', '等待酒店确认禅修课程'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖禅意套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'diana'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 8 + 15/24, TRUNC(SYSDATE) + 10 + 12/24,
       'PENDING', 2, 936.00, 936.00, 0.00, 936.00, 0.00, 1.00,
       'UNPAID', 'CNY', '鲍勃', '15987654321', '商务出差预订'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河城市景观房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'bob'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 30 + 15/24, TRUNC(SYSDATE) + 32 + 12/24,
       'CONFIRMED', 2, 1896.40, 1996.00, 99.60, 1896.40, 1896.40, 0.95,
       'PAID', 'WALLET', 'WALLET', 'CNY', '爱丽丝', '13812345678', '温泉放松'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖私汤大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'alice'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 2 + 14/24, TRUNC(SYSDATE) + 4 + 11/24,
       'CONFIRMED', 4, 2292.64, 2576.00, 283.36, 2292.64, 2292.64, 0.89,
       'PAID', 'WALLET', 'WALLET', 'CNY', '米娅', '15712348765', '需要安排烧烤食材'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖森林木屋' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'mia'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) - 8 + 15/24, TRUNC(SYSDATE) - 6 + 12/24,
       'CHECKED_OUT', 2, 870.48, 936.00, 65.52, 870.48, 870.48, 0.93,
       'PAID', 'WALLET', 'WALLET', 'CNY', '米娅', '15712348765', '城市漫步住宿'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河城市景观房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'mia'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark, refund_reason, refund_requested_at, refund_approved_at, refund_approved_by)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 7 + 15/24, TRUNC(SYSDATE) + 10 + 12/24,
       'REFUNDED', 3, 1878.24, 2064.00, 185.76, 1878.24, 0.00, 0.91,
       'REFUNDED', 'ONLINE', 'WECHAT', 'CNY', '米娅', '15712348765', '因行程变动退款',
       '孩子生病，无法出行', TRUNC(SYSDATE) + 7 - 10, TRUNC(SYSDATE) + 7 - 9,
       (SELECT id FROM users WHERE username = 'admin' FETCH FIRST 1 ROWS ONLY)
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海豚家庭主题房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'mia'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 6 + 15/24, TRUNC(SYSDATE) + 8 + 12/24,
       'PENDING', 1, 936.00, 936.00, 0.00, 936.00, 0.00, 1.00,
       'UNPAID', 'ONLINE', 'WECHAT', 'CNY', '妮娜', '13698761234', '首次入住体验'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河城市景观房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'nina'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) - 5 + 15/24, TRUNC(SYSDATE) - 3 + 12/24,
       'CHECKED_OUT', 1, 1996.00, 1996.00, 0.00, 1996.00, 1996.00, 1.00,
       'PAID', 'DIRECT', 'ARRIVAL', 'CNY', '妮娜', '13698761234', '温泉放松'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖私汤大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'nina'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 4 + 15/24, TRUNC(SYSDATE) + 6 + 12/24,
       'PENDING_PAYMENT', 2, 1556.64, 1656.00, 99.36, 1556.64, 0.00, 0.94,
       'UNPAID', 'ONLINE', 'WECHAT', 'CNY', '奥斯卡', '18623456789', '等待公司审批付款'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海景观景房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'oscar'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) - 3 + 15/24, TRUNC(SYSDATE) - 1 + 12/24,
       'CONFIRMED', 3, 1320.96, 1376.00, 55.04, 1320.96, 1320.96, 0.96,
       'PAID', 'WALLET', 'WALLET', 'CNY', '奥斯卡', '18623456789', '家庭周末短途游'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海豚家庭主题房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'oscar'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 9 + 15/24, TRUNC(SYSDATE) + 11 + 12/24,
       'PENDING_CONFIRMATION', 2, 1022.40, 1136.00, 113.60, 1022.40, 0.00, 0.90,
       'UNPAID', 'ONLINE', 'VISA', 'CNY', '保罗', '13787654321', '等待公司批准'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河行政大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'paul'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) - 18 + 15/24, TRUNC(SYSDATE) - 15 + 12/24,
       'CHECKED_OUT', 3, 3438.96, 3864.00, 425.04, 3438.96, 3438.96, 0.89,
       'PAID', 'WALLET', 'WALLET', 'CNY', '保罗', '13787654321', '团队建设活动'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖森林木屋' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'paul'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 3 + 15/24, TRUNC(SYSDATE) + 5 + 12/24,
       'CONFIRMED', 2, 2699.60, 3176.00, 476.40, 2699.60, 2699.60, 0.85,
       'PAID', 'DIRECT', 'MANUAL', 'CNY', '奎恩', '15876543210', '参加VIP沙龙'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖禅意套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'quinn'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark, refund_reason, refund_requested_at, refund_approved_at, refund_approved_by)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 14 + 15/24, TRUNC(SYSDATE) + 17 + 12/24,
       'REFUNDED', 3, 3488.40, 4104.00, 615.60, 3488.40, 0.00, 0.85,
       'REFUNDED', 'ONLINE', 'VISA', 'CNY', '奎恩', '15876543210', '改期至明年',
       '计划变更，改期至明年同期', TRUNC(SYSDATE) + 14 - 7, TRUNC(SYSDATE) + 14 - 6,
       (SELECT id FROM users WHERE username = 'admin' FETCH FIRST 1 ROWS ONLY)
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海天云顶套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'quinn'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 8 + 15/24, TRUNC(SYSDATE) + 10 + 12/24,
       'CONFIRMED', 2, 2243.52, 2736.00, 492.48, 2243.52, 2243.52, 0.82,
       'PAID', 'WALLET', 'WALLET', 'CNY', '瑞秋', '13598761234', '享受钻石专属权益'
FROM hotel h, room_type rt, users u,
     (SELECT * FROM (SELECT id, room_type_id FROM room ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1) r
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海天云顶套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'rachel';

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 26 + 15/24, TRUNC(SYSDATE) + 29 + 12/24,
       'PENDING', 2, 4001.76, 4764.00, 762.24, 4001.76, 0.00, 0.84,
       'UNPAID', 'ONLINE', 'WECHAT', 'CNY', '瑞秋', '13598761234', '等待确认私教禅修大师'
FROM hotel h, room_type rt, users u,
     (SELECT * FROM (SELECT id, room_type_id FROM room ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1) r
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖禅意套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'rachel';

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 2 + 13/24, TRUNC(SYSDATE) + 4 + 11/24,
       'CONFIRMED', 2, 1045.12, 1136.00, 90.88, 1045.12, 1045.12, 0.92,
       'PAID', 'WALLET', 'WALLET', 'CNY', '爱丽丝', '13812345678', '行政房额外预订'
FROM hotel h, room_type rt, users u,
     (SELECT * FROM (SELECT id, room_type_id FROM room ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1) r
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河行政大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'alice';

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 6 + 16/24, TRUNC(SYSDATE) + 9 + 11/24,
       'PENDING_CONFIRMATION', 2, 1618.80, 1704.00, 85.20, 1618.80, 0.00, 0.95,
       'UNPAID', 'ONLINE', 'ALIPAY', 'CNY', '鲍勃', '15987654321', '等待审批确认'
FROM hotel h, room_type rt, users u,
     (SELECT * FROM (SELECT id, room_type_id FROM room ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1) r
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河行政大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'bob';

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark, refund_reason, refund_requested_at)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 4 + 14/24, TRUNC(SYSDATE) + 7 + 11/24,
       'REFUND_REQUESTED', 4, 2138.40, 2376.00, 237.60, 2138.40, 2138.40, 0.90,
       'PAID', 'WALLET', 'WALLET', 'CNY', '查理', '13698745632', '家庭旅行预订',
       '家中有急事，需要退员', TRUNC(SYSDATE) - 1
FROM hotel h, room_type rt, users u,
     (SELECT * FROM (SELECT id, room_type_id FROM room ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1) r
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河家庭套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'charlie';

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 1 + 12/24, TRUNC(SYSDATE) + 3 + 10/24,
       'CONFIRMED', 4, 1140.48, 1188.00, 47.52, 1140.48, 1140.48, 0.96,
       'PAID', 'WALLET', 'WALLET', 'CNY', '妮娜', '13698761234', '家庭入住中'
FROM hotel h, room_type rt, users u,
     (SELECT * FROM (SELECT id, room_type_id FROM room ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1) r
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河家庭套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'nina';

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 5 + 15/24, TRUNC(SYSDATE) + 7 + 12/24,
       'CONFIRMED', 2, 842.40, 936.00, 93.60, 842.40, 842.40, 0.90,
       'PAID', 'ONLINE', 'WECHAT', 'CNY', '奥斯卡', '18623456789', '城景房要求高楼层'
FROM hotel h, room_type rt, users u,
     (SELECT * FROM (SELECT id, room_type_id FROM room ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1) r
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河城市景观房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'oscar';

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 10 + 17/24, TRUNC(SYSDATE) + 13 + 11/24,
       'PENDING_CONFIRMATION', 2, 1333.80, 1404.00, 70.20, 1333.80, 0.00, 0.95,
       'UNPAID', 'ONLINE', 'WECHAT', 'CNY', '保罗', '13787654321', '等待出差审批'
FROM hotel h, room_type rt, users u,
     (SELECT * FROM (SELECT id, room_type_id FROM room ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1) r
WHERE h.name = '星河国际大酒店'
  AND rt.name = '星河城市景观房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'paul';

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 2 + 15/24, TRUNC(SYSDATE) + 5 + 12/24,
       'CONFIRMED', 2, 1457.28, 1656.00, 198.72, 1457.28, 1457.28, 0.88,
       'PAID', 'WALLET', 'WALLET', 'CNY', '奎恩', '15876543210', '已办理入住'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海景观景房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'quinn'
  AND ROWNUM = 2;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 11 + 15/24, TRUNC(SYSDATE) + 14 + 12/24,
       'CONFIRMED', 2, 2111.40, 2484.00, 372.60, 2111.40, 2111.40, 0.85,
       'PAID', 'WALLET', 'WALLET', 'CNY', '瑞秋', '13598761234', '安排晚间甜品'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海景观景房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'rachel'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 3 + 14/24, TRUNC(SYSDATE) + 6 + 11/24,
       'CONFIRMED', 3, 1238.40, 1376.00, 137.60, 1238.40, 1238.40, 0.90,
       'PAID', 'ONLINE', 'WECHAT', 'CNY', '戴安娜', '18611223344', '亲子活动预订成功'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海豚家庭主题房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'diana'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 8 + 16/24, TRUNC(SYSDATE) + 10 + 12/24,
       'PENDING_PAYMENT', 4, 1307.20, 1376.00, 68.80, 1307.20, 0.00, 0.95,
       'UNPAID', 'WALLET', 'WALLET', 'CNY', '米娅', '15712348765', '等待余额支付'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海豚家庭主题房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'mia'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 1 + 15/24, TRUNC(SYSDATE) + 3 + 12/24,
       'CONFIRMED', 2, 2407.68, 2736.00, 328.32, 2407.68, 2407.68, 0.88,
       'PAID', 'WALLET', 'WALLET', 'CNY', '里奥', '13712349876', '预约私人管家服务'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '海滩假日酒店'
  AND rt.name = '海天云顶套房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'leo'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 4 + 15/24, TRUNC(SYSDATE) + 6 + 12/24,
       'CONFIRMED', 2, 1796.40, 1996.00, 199.60, 1796.40, 1796.40, 0.90,
       'PAID', 'WALLET', 'WALLET', 'CNY', '爱丽丝', '13812345678', '温泉体验已预订'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖私汤大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'alice'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 2 + 14/24, TRUNC(SYSDATE) + 4 + 12/24,
       'CONFIRMED', 4, 2318.40, 2576.00, 257.60, 2318.40, 2318.40, 0.90,
       'PAID', 'DIRECT', 'ARRIVAL', 'CNY', '鲍勃', '15987654321', '木屋体验中'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖森林木屋' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'bob'
  AND ROWNUM = 3;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 9 + 15/24, TRUNC(SYSDATE) + 12 + 12/24,
       'CONFIRMED', 3, 3554.88, 3864.00, 309.12, 3554.88, 3554.88, 0.92,
       'PAID', 'WALLET', 'WALLET', 'CNY', '保罗', '13787654321', '团队秋游，包栋木屋'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖森林木屋' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'paul'
  AND ROWNUM = 1;

INSERT INTO bookings (id, hotel_id, room_type_id, room_id, user_id, start_time, end_time, status, guests, amount, original_amount, discount_amount, payable_amount, paid_amount, discount_rate, payment_status, payment_method, payment_channel, currency, contact_name, contact_phone, remark)
SELECT seq_bookings.NEXTVAL, h.id, rt.id, r.id, u.id,
       TRUNC(SYSDATE) + 7 + 16/24, TRUNC(SYSDATE) + 9 + 12/24,
       'PENDING_CONFIRMATION', 2, 1856.28, 1996.00, 139.72, 1856.28, 0.00, 0.93,
       'UNPAID', 'ONLINE', 'WECHAT', 'CNY', '奎恩', '15876543210', '等待确认温泉时间'
FROM hotel h, room_type rt, room r, users u
WHERE h.name = '云栖温泉度假酒店'
  AND rt.name = '云栖私汤大床房' AND rt.hotel_id = h.id
  AND r.room_type_id = rt.id
  AND u.username = 'quinn'
  AND ROWNUM = 1;

-- ============================================================================
-- 更新房间状态
-- ============================================================================
UPDATE room r SET status = CASE
    WHEN EXISTS (SELECT 1 FROM room_maintenance m WHERE m.room_id = r.id AND m.status = 1) THEN 5
    WHEN EXISTS (SELECT 1 FROM bookings b WHERE b.room_id = r.id AND b.status = 'CHECKED_IN') THEN 3
    WHEN EXISTS (SELECT 1 FROM bookings b WHERE b.room_id = r.id AND b.status IN ('PENDING','PENDING_CONFIRMATION','PENDING_PAYMENT','CONFIRMED')) THEN 2
    ELSE 1
END;

UPDATE room r SET last_checkout_time = (
    SELECT MAX(b.end_time) FROM bookings b
    WHERE b.room_id = r.id AND b.status = 'CHECKED_OUT'
)
WHERE EXISTS (SELECT 1 FROM bookings b WHERE b.room_id = r.id AND b.status = 'CHECKED_OUT');

UPDATE room_type rt SET available_count = (
    SELECT COUNT(*) FROM room r WHERE r.room_type_id = rt.id AND r.status = 1
);

COMMIT;

-- ============================================================================
-- 视图（普通视图 + 物化视图）
-- ============================================================================
CREATE OR REPLACE VIEW v_hotel_room_availability AS
SELECT
    h.id AS hotel_id,
    h.name AS hotel_name,
    rt.id AS room_type_id,
    rt.name AS room_type_name,
    rt.price_per_night,
    rt.total_count,
    rt.available_count,
    rt.is_active,
    (SELECT COUNT(*) FROM room r WHERE r.room_type_id = rt.id AND r.status = 1) AS actual_vacant_rooms
FROM hotel h
JOIN room_type rt ON rt.hotel_id = h.id
WHERE rt.is_active = 1;

CREATE OR REPLACE VIEW v_user_vip_info AS
SELECT
    u.id AS user_id,
    u.username,
    u.vip_level,
    v.name AS level_name,
    v.discount_rate,
    v.checkout_hour,
    u.total_consumption,
    u.status
FROM users u
JOIN vip_level_policy v ON v.vip_level = u.vip_level;

CREATE MATERIALIZED VIEW LOG ON bookings WITH ROWID, PRIMARY KEY (hotel_id, start_time, status, amount) INCLUDING NEW VALUES;

CREATE MATERIALIZED VIEW mv_daily_booking_stats
REFRESH COMPLETE ON DEMAND
AS
SELECT
    h.id AS hotel_id,
    h.name AS hotel_name,
    TRUNC(b.start_time) AS stat_date,
    COUNT(b.id) AS total_bookings,
    SUM(CASE WHEN b.status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT') THEN 1 ELSE 0 END) AS confirmed_bookings,
    SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_bookings,
    SUM(b.amount) AS total_revenue
FROM hotel h
LEFT JOIN bookings b ON b.hotel_id = h.id
GROUP BY h.id, h.name, TRUNC(b.start_time);

CREATE OR REPLACE VIEW v_daily_booking_stats AS SELECT * FROM mv_daily_booking_stats;


-- ============================================================================
-- 调度作业
-- ============================================================================
BEGIN
    DBMS_SCHEDULER.CREATE_JOB (
        job_name        => 'DAILY_VACANCY_STATS_JOB',
        job_type        => 'PLSQL_BLOCK',
        job_action      => 'BEGIN hotel_user.generate_daily_stats(TRUNC(SYSDATE)-1, TRUNC(SYSDATE)-1); END;',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=DAILY; BYHOUR=1; BYMINUTE=0; BYSECOND=0',
        enabled         => TRUE,
        comments        => '每日凌晨1点生成昨日的空房统计'
    );
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    DBMS_SCHEDULER.CREATE_JOB (
        job_name        => 'MONTHLY_VIP_UPGRADE_JOB',
        job_type        => 'PLSQL_BLOCK',
        job_action      => 'BEGIN hotel_user.monthly_vip_upgrade(); END;',
        start_date      => TRUNC(SYSDATE, 'MM') + 1,
        repeat_interval => 'FREQ=MONTHLY; BYMONTHDAY=1; BYHOUR=3; BYMINUTE=0; BYSECOND=0',
        enabled         => TRUE,
        comments        => '每月1日凌晨3点执行VIP等级批量升级'
    );
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

