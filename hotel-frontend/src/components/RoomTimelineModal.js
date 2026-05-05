import React from 'react';
import {
  Modal,
  Space,
  Typography,
  Button,
  DatePicker,
  Tooltip,
  Tag,
  Pagination,
  Spin,
  Empty,
  Alert,
} from 'antd';
import {
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getRoomOccupancyTimeline, ROOM_TIMELINE_PAGE_LIMIT } from '../services/api';
import { BOOKING_STATUS_META, getBookingStatusMeta } from '../constants/booking';
import { getRoomStatusMeta } from '../constants/room';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const SCALE_LEVELS = [
  { key: 'hour', label: '小时', multiplier: 6, tickUnit: 'hour', tickStep: 1, format: 'MM-DD HH:mm' },
  { key: 'day', label: '天', multiplier: 1, tickUnit: 'day', tickStep: 1, format: 'MM-DD' },
  { key: 'week', label: '周', multiplier: 0.5, tickUnit: 'day', tickStep: 1, format: 'MM-DD' },
  { key: 'month', label: '月', multiplier: 0.25, tickUnit: 'month', tickStep: 1, format: 'YYYY-MM' },
];

const DEFAULT_SCALE_INDEX = Math.max(0, SCALE_LEVELS.findIndex((level) => level.key === 'day'));
const BASE_DAY_WIDTH = 480; // px per day at默认尺度
const MIN_TIMELINE_WIDTH = 720;
const MAX_TIMELINE_WIDTH = 50000;
const MIN_BAR_WIDTH = 6;
const PAGE_SIZE = ROOM_TIMELINE_PAGE_LIMIT;

const STATUS_COLOR_PALETTE = {
  GOLD: '#faad14',
  ORANGE: '#fa8c16',
  GREEN: '#52c41a',
  CYAN: '#13c2c2',
  BLUE: '#1677ff',
  RED: '#ff4d4f',
  PURPLE: '#722ed1',
  DEFAULT: '#8c8c8c',
};

function buildDefaultRange() {
  const start = dayjs().startOf('month');
  const end = dayjs().endOf('month').endOf('day');
  return [start, end];
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resolveStatusColor(status) {
  const meta = getBookingStatusMeta(status);
  const key = meta?.color ? String(meta.color).toUpperCase() : 'DEFAULT';
  return STATUS_COLOR_PALETTE[key] || meta?.color || STATUS_COLOR_PALETTE.DEFAULT;
}

function hexToRgb(hex) {
  if (!hex) return null;
  let normalized = hex.trim();
  if (!normalized.startsWith('#')) {
    return null;
  }
  normalized = normalized.substring(1);
  if (normalized.length === 3) {
    normalized = normalized.split('').map((c) => c + c).join('');
  }
  if (normalized.length !== 6) {
    return null;
  }
  const intVal = parseInt(normalized, 16);
  if (Number.isNaN(intVal)) return null;
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

function getTextColorForBackground(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    return '#1f1f1f';
  }
  const { r, g, b } = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? '#1f1f1f' : '#ffffff';
}

function toRgba(hexColor, alpha) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    return hexColor;
  }
  const { r, g, b } = rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeTimelinePayload(payload, fallbackRange) {
  if (!payload || typeof payload !== 'object') {
    return {
      items: [],
      total: 0,
      page: 1,
      size: PAGE_SIZE,
      windowStart: fallbackRange?.[0] || null,
      windowEnd: fallbackRange?.[1] || null,
    };
  }
  const { windowStart, windowEnd } = payload;
  const resolvedStart = windowStart ? dayjs(windowStart) : fallbackRange?.[0];
  const resolvedEnd = windowEnd ? dayjs(windowEnd) : fallbackRange?.[1];
  const items = Array.isArray(payload.items) ? payload.items.map((item) => ({
    ...item,
    bookings: Array.isArray(item.bookings) ? item.bookings.map((booking) => ({
      ...booking,
      startTime: booking.startTime ? dayjs(booking.startTime) : null,
      endTime: booking.endTime ? dayjs(booking.endTime) : null,
    })) : [],
  })) : [];
  return {
    items,
    total: toNumber(payload.total, 0),
    page: Math.max(1, toNumber(payload.page, 1)),
    size: Math.max(1, toNumber(payload.size, PAGE_SIZE)),
    windowStart: resolvedStart,
    windowEnd: resolvedEnd,
  };
}

function computeResponsiveWidth() {
  if (typeof window === 'undefined') {
    return 1100;
  }
  const viewportWidth = window.innerWidth || 0;
  if (!viewportWidth) {
    return 1100;
  }
  const maxWidth = 2000;
  const minWidth = 320;
  const viewportAllowance = Math.max(minWidth, viewportWidth - 24);
  const target = Math.max(minWidth, viewportWidth - 48);
  return Math.min(maxWidth, Math.min(viewportAllowance, target));
}

function RoomTimelineModal({ open, roomType, onClose }) {
  const [range, setRange] = React.useState(buildDefaultRange);
  const [pagination, setPagination] = React.useState({ page: 1, size: PAGE_SIZE });
  const [scaleIndex, setScaleIndex] = React.useState(DEFAULT_SCALE_INDEX);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState(() => normalizeTimelinePayload(null, buildDefaultRange()));
  const [reloadSignal, setReloadSignal] = React.useState(0);
  const scrollRef = React.useRef(null);
  const [modalWidth, setModalWidth] = React.useState(() => computeResponsiveWidth());

  const effectiveScaleIndex = clamp(scaleIndex, 0, SCALE_LEVELS.length - 1);
  const scaleLevel = SCALE_LEVELS[effectiveScaleIndex] || SCALE_LEVELS[DEFAULT_SCALE_INDEX];

  const windowStart = data.windowStart || range?.[0];
  const windowEnd = data.windowEnd || range?.[1];
  const windowDurationMs = windowStart && windowEnd ? Math.max(windowEnd.diff(windowStart, 'millisecond'), 60_000) : 60_000;
  const windowDays = windowDurationMs / (24 * 60 * 60 * 1000);
  const adaptiveMinWidth = React.useMemo(() => {
    if (!modalWidth || Number.isNaN(modalWidth)) {
      return MIN_TIMELINE_WIDTH;
    }
    const viewportScaled = modalWidth * 0.9;
    const lowerBound = 480;
    return Math.min(MIN_TIMELINE_WIDTH, Math.max(lowerBound, viewportScaled));
  }, [modalWidth]);
  const timelineWidth = clamp(windowDays * BASE_DAY_WIDTH * scaleLevel.multiplier, adaptiveMinWidth, MAX_TIMELINE_WIDTH);
  const timelineStartMs = windowStart ? windowStart.valueOf() : 0;
  const timelineEndMs = windowStart ? timelineStartMs + windowDurationMs : 0;

  const ticks = React.useMemo(() => {
    if (!windowStart || !windowEnd) return [];
    const list = [];
    let cursor = windowStart.startOf(scaleLevel.tickUnit);
    if (cursor.isBefore(windowStart)) {
      cursor = cursor.add(1, scaleLevel.tickUnit);
    }
    while (cursor.isBefore(windowEnd) || cursor.isSame(windowEnd)) {
      const offset = cursor.diff(windowStart, 'millisecond');
      const left = (offset / windowDurationMs) * timelineWidth;
      list.push({ time: cursor, left });
      cursor = cursor.add(scaleLevel.tickStep, scaleLevel.tickUnit);
    }
    return list;
  }, [windowStart, windowEnd, scaleLevel, windowDurationMs, timelineWidth]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const defaultRange = buildDefaultRange();
    setRange(defaultRange);
    setPagination({ page: 1, size: PAGE_SIZE });
    setScaleIndex(DEFAULT_SCALE_INDEX);
    setData(normalizeTimelinePayload(null, defaultRange));
    setError(null);
    setModalWidth(computeResponsiveWidth());
  }, [open, roomType?.id]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleResize = () => {
      setModalWidth(computeResponsiveWidth());
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !roomType?.id || !Array.isArray(range) || !range[0] || !range[1]) {
      return;
    }
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const payload = await getRoomOccupancyTimeline(roomType.id, {
          start: range[0],
          end: range[1],
          page: pagination.page,
          size: pagination.size,
          hotelId: roomType.hotelId,
        });
        if (cancelled) return;
        const normalized = normalizeTimelinePayload(payload, range);
        setData(normalized);
      } catch (err) {
        if (cancelled) return;
        const message = err?.data?.message || err?.message || '加载入住规划失败';
        setError(message);
        setData(normalizeTimelinePayload(null, range));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [open, roomType?.id, roomType?.hotelId, range, pagination.page, pagination.size, reloadSignal]);

  const handleRangeChange = (value) => {
    if (!value || value.length !== 2) {
      return;
    }
    setRange(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleRefresh = () => {
    setReloadSignal((prev) => prev + 1);
  };

  const handleZoomIn = React.useCallback(() => {
    setScaleIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleZoomOut = React.useCallback(() => {
    setScaleIndex((prev) => Math.min(SCALE_LEVELS.length - 1, prev + 1));
  }, []);

  const handleWheel = React.useCallback((event) => {
    if (!scrollRef.current) return;
    
    // 如果按住 Shift 键，允许水平滚动
    if (event.shiftKey) {
      // 不阻止默认行为，让浏览器处理滚动
      if (Math.abs(event.deltaY) > 0) {
        // 将垂直滚动转换为水平滚动
        event.preventDefault();
        scrollRef.current.scrollLeft += event.deltaY;
      }
      return;
    }
    
    // 默认情况下（没有按 Shift），处理缩放
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      // 水平滚动仍然允许
      scrollRef.current.scrollLeft += event.deltaX;
      return;
    }
    
    // 垂直滚动用于缩放
    event.preventDefault();
    if (event.deltaY > 0) {
      handleZoomOut();
    } else if (event.deltaY < 0) {
      handleZoomIn();
    }
  }, [handleZoomIn, handleZoomOut]);

  const handlePaginationChange = (page) => {
    setPagination({ page, size: PAGE_SIZE });
  };

  const legendItems = React.useMemo(() => Object.entries(BOOKING_STATUS_META).map(([key, meta]) => {
    const color = resolveStatusColor(key);
    return (
      <Tag key={key} color={color} className="room-timeline-legend__tag">
        {meta.label}
      </Tag>
    );
  }), []);

  const rows = Array.isArray(data.items) ? data.items : [];

  return (
    <Modal
      open={open}
      width={modalWidth}
      centered
      onCancel={onClose}
      footer={null}
      destroyOnClose
      className="room-timeline-modal"
      title={
        <Space size={12} align="start">
          <CalendarOutlined />
          <div>
            <Text strong>{roomType?.name || '入住规划'}</Text>
            {roomType?.type ? <div className="room-timeline-subtitle">{roomType.type}</div> : null}
          </div>
        </Space>
      }
    >
      <div className="room-timeline-modal__content">
        <div className="room-timeline-toolbar">
          <Space size={12} wrap>
            <RangePicker
              value={range}
              onChange={handleRangeChange}
              showTime
              allowClear={false}
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} disabled={loading}>
              刷新
            </Button>
          </Space>
          <Space size={8} align="center" wrap>
            <Alert
              type="info"
              message="提示：滚轮缩放时间尺度，左右拖动查看不同时间段"
              banner
              className="room-timeline-alert"
            />
            <Space>
              <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} size="small" />
              <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} size="small" />
              <Text type="secondary">当前尺度：{scaleLevel.label}</Text>
            </Space>
          </Space>
        </div>
        <div className="room-timeline-legend">
          {legendItems}
        </div>
        {error ? (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
        ) : null}
        <div
          className="room-timeline-scroll"
          ref={scrollRef}
          onWheel={handleWheel}
        >
          <div className="room-timeline-body" style={{ width: timelineWidth + 240 }}>
            <div className="room-timeline-axis-row">
              <div className="room-timeline-axis-meta">
                <Text type="secondary">时间轴</Text>
                {windowStart && windowEnd ? (
                  <div className="room-timeline-axis-range">
                    {windowStart.format('YYYY-MM-DD HH:mm')} ~ {windowEnd.format('YYYY-MM-DD HH:mm')}
                  </div>
                ) : null}
              </div>
              <div className="room-timeline-axis-track" style={{ width: timelineWidth }}>
                {ticks.map((tick, index) => (
                  <div
                    key={`${tick.time.valueOf()}-${index}`}
                    className="room-timeline-tick"
                    style={{ left: tick.left }}
                  >
                    <span className="room-timeline-tick__label">{tick.time.format(scaleLevel.format)}</span>
                  </div>
                ))}
              </div>
            </div>
            {loading ? (
              <div className="room-timeline-loading">
                <Spin />
              </div>
            ) : rows.length === 0 ? (
              <div className="room-timeline-empty">
                <Empty description="暂无入住规划" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : (
              rows.map((item) => {
                const rowKey = item.roomId ?? `${item.roomTypeId || 'type'}-${item.roomNumber || 'unknown'}`;
                const statusMeta = getRoomStatusMeta(item.status);
                return (
                  <div className="room-timeline-row" key={rowKey}>
                    <div className="room-timeline-row__meta">
                      <div className="room-timeline-row__title">
                        房间 {item.roomNumber || item.roomId}
                      </div>
                      <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                      {item.floor != null ? (
                        <Text type="secondary" className="room-timeline-row__floor">{item.floor}F</Text>
                      ) : null}
                    </div>
                    <div className="room-timeline-row__track" style={{ width: timelineWidth }}>
                      {Array.isArray(item.bookings) && item.bookings.length ? item.bookings.map((booking, index) => {
                        if (!booking.startTime || !booking.endTime) return null;
                        const bookingStartMs = booking.startTime.valueOf();
                        const bookingEndMs = booking.endTime.valueOf();
                        const clipStart = Math.max(bookingStartMs, timelineStartMs);
                        const clipEnd = Math.min(bookingEndMs, timelineEndMs);
                        if (clipEnd <= clipStart) return null;
                        const widthPx = Math.max(((clipEnd - clipStart) / windowDurationMs) * timelineWidth, MIN_BAR_WIDTH);
                        const leftPx = ((clipStart - timelineStartMs) / windowDurationMs) * timelineWidth;
                        const color = resolveStatusColor(booking.status);
                        const textColor = getTextColorForBackground(color);
                        const gradient = `linear-gradient(90deg, ${toRgba(color, 0.92)} 0%, ${toRgba(color, 0.78)} 100%)`;
                        const tooltipTitle = (
                          <div className="room-timeline-tooltip">
                            <div><strong>订单ID：</strong>{booking.id}</div>
                            <div><strong>状态：</strong>{getBookingStatusMeta(booking.status).label}</div>
                            <div><strong>入住：</strong>{booking.startTime.format('YYYY-MM-DD HH:mm')}</div>
                            <div><strong>退房：</strong>{booking.endTime.format('YYYY-MM-DD HH:mm')}</div>
                            {booking.contactName ? <div><strong>联系人：</strong>{booking.contactName}</div> : null}
                            {booking.contactPhone ? <div><strong>电话：</strong>{booking.contactPhone}</div> : null}
                            {booking.guests != null ? <div><strong>入住人数：</strong>{booking.guests}</div> : null}
                            {booking.amount != null ? <div><strong>金额：</strong>¥{Number(booking.amount).toFixed(2)}</div> : null}
                            {booking.remark ? <div><strong>备注：</strong>{booking.remark}</div> : null}
                          </div>
                        );
                        const bookingKey = booking.id ?? `${rowKey}-${index}-${bookingStartMs}`;
                        return (
                          <Tooltip title={tooltipTitle} key={bookingKey} color={color} overlayClassName="room-timeline-tooltip__overlay">
                            <div
                              className="room-timeline-bar"
                              style={{
                                left: leftPx,
                                width: widthPx,
                                background: gradient,
                                borderColor: toRgba(color, 0.95),
                                color: textColor,
                              }}
                            >
                              <span className="room-timeline-bar__label">
                                {booking.startTime.format('MM-DD HH:mm')} ~ {booking.endTime.format('MM-DD HH:mm')}
                              </span>
                            </div>
                          </Tooltip>
                        );
                      }) : (
                        <div className="room-timeline-row__placeholder">当前时间段暂无预订</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="room-timeline-pagination">
          <Pagination
            size="small"
            showSizeChanger={false}
            pageSize={PAGE_SIZE}
            current={pagination.page}
            total={data.total}
            onChange={handlePaginationChange}
            showTotal={(total, rangeInfo) => `${rangeInfo[0]}-${rangeInfo[1]} / 共 ${total} 间`}
            disabled={loading}
          />
        </div>
      </div>
    </Modal>
  );
}

export default RoomTimelineModal;
