import React from 'react';
import { DatePicker, Spin, Space, Typography, Card, Badge } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getRoomDayAvailability } from '../services/api';
import './RoomAvailabilityStrip.css';

const { Text } = Typography;

/** 24 小时时间轴上显示的刻度点（0-24小时全部显示） */
const TICKS = Array.from({ length: 25 }, (_, i) => i);

/**
 * 利用区间扫描算法，将预订时间段列表转换为带颜色类型的可视化区段。
 *
 * 规则（覆盖完整 24 小时）：
 *   占用数 >= totalRooms → 'occupied'（红）
 *   占用数 < totalRooms  → 'available'（绿）
 *
 * @param {dayjs.Dayjs} selectedDate 选中日期
 * @param {Array<{startTime: string, endTime: string}>} periods 预订时段列表
 * @param {number} totalRooms 房间总数
 * @returns {Array<{leftPct: number, widthPct: number, type: 'available'|'occupied'}>}
 */
function computeSegments(selectedDate, periods, totalRooms) {
  const dayStartMs = selectedDate.startOf('day').valueOf();
  const dayDurationMs = 24 * 60 * 60 * 1000;
  const dayEndMs = dayStartMs + dayDurationMs;

  const toLeftPct = (ms) => ((ms - dayStartMs) / dayDurationMs) * 100;
  const toWidthPct = (startMs, endMs) => ((endMs - startMs) / dayDurationMs) * 100;

  // 将 periods 转换为事件流，裁剪到当日 [00:00, 24:00)
  const events = [];
  for (const period of (periods || [])) {
    const pStart = dayjs(period.startTime).valueOf();
    const pEnd = dayjs(period.endTime).valueOf();
    const clipStart = Math.max(pStart, dayStartMs);
    const clipEnd = Math.min(pEnd, dayEndMs);
    if (clipEnd > clipStart) {
      events.push({ time: clipStart, delta: +1 });
      events.push({ time: clipEnd, delta: -1 });
    }
  }

  // 排序：时间升序；同一时刻先处理结束事件（delta=-1）再处理开始事件（delta=+1）
  events.sort((a, b) => a.time !== b.time ? a.time - b.time : a.delta - b.delta);

  const result = [];
  let occupancy = 0;
  let cursor = dayStartMs;

  for (const event of events) {
    if (event.time > cursor) {
      // 只要有任何预订(occupancy > 0)，就显示为占用状态(红色)
      const type = occupancy > 0 ? 'occupied' : 'available';
      result.push({
        leftPct: toLeftPct(cursor),
        widthPct: toWidthPct(cursor, event.time),
        type,
      });
      cursor = event.time;
    }
    occupancy += event.delta;
  }

  // 最后一段剩余区间
  if (cursor < dayEndMs) {
    const type = occupancy > 0 ? 'occupied' : 'available';
    result.push({
      leftPct: toLeftPct(cursor),
      widthPct: toWidthPct(cursor, dayEndMs),
      type,
    });
  }

  return result;
}

/**
 * 房型预订时段预览条。
 * 展示选定日期 24 小时内各时段的可用性，无需登录即可查看。
 *
 * @param {object} props
 * @param {number} props.roomTypeId  房型 ID
 * @param {number} [props.hotelId]   可选酒店 ID
 */
function RoomAvailabilityStrip({ roomTypeId, hotelId }) {
  const [selectedDate, setSelectedDate] = React.useState(() => dayjs());
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!roomTypeId) return;
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await getRoomDayAvailability(roomTypeId, selectedDate, hotelId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err?.message || '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [roomTypeId, hotelId, selectedDate]);

  const segments = React.useMemo(() => {
    if (!data) return [];
    return computeSegments(selectedDate, data.periods, data.totalRooms);
  }, [data, selectedDate]);

  // 禁用今天之前的日期
  const disabledDate = React.useCallback(
    (current) => current && current.isBefore(dayjs().startOf('day')),
    [],
  );

  return (
    <Card
      className="ras-card"
      bodyStyle={{ padding: '20px 24px' }}
    >
      {/* 标题行 */}
      <div className="ras-header">
        <Space size={8} align="center">
          <ClockCircleOutlined className="ras-header__icon" />
          <Text strong className="ras-header__title">预订时段预览</Text>
          {data?.totalRooms != null && (
            <Text type="secondary" className="ras-header__rooms">
              共 {data.totalRooms} 间
            </Text>
          )}
        </Space>
        <DatePicker
          value={selectedDate}
          onChange={(val) => val && setSelectedDate(val)}
          disabledDate={disabledDate}
          allowClear={false}
          size="small"
          className="ras-datepicker"
        />
      </div>

      {/* 时间轴主体 */}
      <div className="ras-timeline-wrap">
        {loading ? (
          <div className="ras-loading">
            <Spin size="small" />
          </div>
        ) : error ? (
          <div className="ras-error">
            <Text type="secondary">{error}</Text>
          </div>
        ) : (
          <>
            {/* 色块轨道 */}
              <div className="ras-track" aria-label="预订时段可视化轨道">
              {segments.map((seg, idx) => (
                <div
                  key={idx}
                  className={`ras-segment ras-segment--${seg.type}`}
                  style={{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }}
                />
              ))}
            </div>

            {/* 时间刻度 */}
            <div className="ras-axis" aria-hidden="true">
              {TICKS.map((hour) => (
                <div
                  key={hour}
                  className="ras-tick"
                  style={{ left: `${(hour / 24) * 100}%` }}
                >
                  <span className="ras-tick__label">
                    {hour === 24 ? '24:00' : `${String(hour).padStart(2, '0')}:00`}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 图例 */}
      {!loading && !error && (
        <div className="ras-legend">
          <Space size={16} wrap>
            <Space size={6}>
              <Badge color="#52c41a" />
              <Text type="secondary" className="ras-legend__text">有房可订</Text>
            </Space>
            <Space size={6}>
              <Badge color="#ff4d4f" />
              <Text type="secondary" className="ras-legend__text">已全部预订</Text>
            </Space>
          </Space>
        </div>
      )}
    </Card>
  );
}

export default RoomAvailabilityStrip;
