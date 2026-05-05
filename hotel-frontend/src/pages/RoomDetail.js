import React from 'react';
import { Button, Descriptions, Image, Space, Typography, Form, InputNumber, message, Tag, Input, Alert, Radio, Card, Statistic, Divider, Popover, TimePicker, Row, Col, Avatar, Badge, theme } from 'antd';
import { PlayCircleOutlined, WechatOutlined, CreditCardOutlined, DollarCircleOutlined, WalletOutlined, CalendarOutlined, HomeOutlined, UserOutlined, PhoneOutlined, EnvironmentOutlined, StarFilled, ThunderboltOutlined, ClockCircleOutlined, CheckCircleOutlined, SafetyCertificateOutlined, GiftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getRoomById, getImageList, createBooking, getRoomAvailability, getVipPricingSnapshot, getWalletSummary, getMyProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import RoomVRViewer from '../components/RoomVRViewer';
import RoomAvailabilityStrip from '../components/RoomAvailabilityStrip';
import { getVrEntry } from '../services/vr';
import { getBookingStatusMeta, getPaymentMethodLabel } from '../constants/booking';
import { DEFAULT_CHECKIN_HOUR, normalizeStayRange, computeStayNights, createDefaultStayRange } from '../utils/stayRange';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

const { Title, Paragraph, Text } = Typography;
const MINIMUM_NIGHTS = 1;

export default function RoomDetail({ id, onBack, initialShowVr = false }) {
  const [room, setRoom] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [bookingLoading, setBookingLoading] = React.useState(false);
  const [pricing, setPricing] = React.useState(null);
  const [wallet, setWallet] = React.useState(null);
  const [vrVisible, setVrVisible] = React.useState(initialShowVr);
  const [pendingAutoOpen, setPendingAutoOpen] = React.useState(initialShowVr);
  const [form] = Form.useForm();
  const rangeValue = Form.useWatch('range', form);
  const arrivalTimeValue = Form.useWatch('arrivalTime', form);
  const paymentMethodValue = Form.useWatch('paymentMethod', form);
  const [rangePanelOpen, setRangePanelOpen] = React.useState(false);
  const [draftRange, setDraftRange] = React.useState({ startDate: null, endDate: null });
  const [isCompactCalendar, setIsCompactCalendar] = React.useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth < 768;
  });
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const isDarkMode = token.colorBgBase === '#000000' || token.colorBgBase === '#141414';
  const isAdmin = user?.role === 'ADMIN';
  const defaultContactPhone = React.useMemo(() => (isAdmin ? '' : (user?.phone || '')), [isAdmin, user?.phone]);
  const defaultPaymentMethod = isAdmin ? 'ADMIN' : 'WALLET';
  const defaultPaymentChannel = isAdmin ? 'ADMIN' : 'WALLET';
  const checkoutHourMap = React.useMemo(() => {
    const map = new Map([[0, 12], [1, 13], [2, 14], [3, 15], [4, 16]]);
    if (pricing?.checkoutHours) {
      Object.entries(pricing.checkoutHours).forEach(([lvl, hour]) => {
        const levelNum = Number(lvl);
        const hourNum = Number(hour);
        if (!Number.isNaN(levelNum) && !Number.isNaN(hourNum)) {
          map.set(levelNum, hourNum);
        }
      });
    }
    if (Array.isArray(pricing?.levels)) {
      pricing.levels.forEach((item) => {
        const levelNum = Number(item.level ?? item.vipLevel ?? item.id);
        const hourCandidate = item.checkoutHour ?? item.checkout_hour ?? item.checkoutHours;
        const hourNum = Number(hourCandidate);
        if (!Number.isNaN(levelNum) && !Number.isNaN(hourNum)) {
          map.set(levelNum, hourNum);
        }
      });
    }
    return map;
  }, [pricing]);

  const rangeDisplay = React.useMemo(() => {
    if (!Array.isArray(rangeValue) || rangeValue.length !== 2) return '';
    const [startRaw, endRaw] = rangeValue;
    const start = dayjs(startRaw);
    const end = dayjs(endRaw);
    if (!start.isValid() || !end.isValid()) return '';
    return `${start.format('YYYY-MM-DD HH:mm')} 至 ${end.format('YYYY-MM-DD HH:mm')}`;
  }, [rangeValue]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setIsCompactCalendar(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calendarMonths = isCompactCalendar ? 1 : 2;
  const calendarDirection = isCompactCalendar ? 'vertical' : 'horizontal';

  const resolveCheckoutHour = React.useCallback((level) => {
    const levelNum = Number(level);
    if (!Number.isNaN(levelNum) && checkoutHourMap.has(levelNum)) {
      return checkoutHourMap.get(levelNum);
    }
    return checkoutHourMap.get(0) ?? 12;
  }, [checkoutHourMap]);

  const checkoutBoundaryHour = React.useMemo(() => resolveCheckoutHour(user?.vipLevel), [resolveCheckoutHour, user?.vipLevel]);
  const buildDefaultRange = React.useCallback(
    () => createDefaultStayRange(checkoutBoundaryHour, { minNights: MINIMUM_NIGHTS, arrivalTime: arrivalTimeValue }),
    [checkoutBoundaryHour, arrivalTimeValue]
  );

  const defaultRangeValue = React.useMemo(() => buildDefaultRange(), [buildDefaultRange]);

  const draftSelection = React.useMemo(() => {
    const [defaultStartRaw] = buildDefaultRange();
    const defaultStart = dayjs(defaultStartRaw);
    const currentStartCandidate = draftRange?.startDate ?? (Array.isArray(rangeValue) ? rangeValue[0] : null);
    const currentEndCandidate = draftRange?.endDate ?? (Array.isArray(rangeValue) ? rangeValue[1] : null);
    let startMoment = dayjs(currentStartCandidate);
    if (!startMoment.isValid()) {
      startMoment = defaultStart.isValid() ? defaultStart : dayjs();
    }
    let endMoment = dayjs(currentEndCandidate);
    if (!endMoment.isValid() || !endMoment.isAfter(startMoment)) {
      endMoment = startMoment.add(1, 'day');
    }
    return {
      start: startMoment.toDate(),
      end: endMoment.toDate()
    };
  }, [draftRange, rangeValue, buildDefaultRange]);

  const normalizedRange = React.useMemo(
    () => normalizeStayRange(rangeValue, checkoutBoundaryHour, { minNights: MINIMUM_NIGHTS, arrivalTime: arrivalTimeValue }),
    [rangeValue, checkoutBoundaryHour, arrivalTimeValue]
  );

  const applyNormalizedRange = React.useCallback((candidate, arrivalOverride) => {
    if (!Array.isArray(candidate) || candidate.length !== 2) {
      return candidate;
    }
    const normalized = normalizeStayRange(candidate, checkoutBoundaryHour, {
      minNights: MINIMUM_NIGHTS,
      arrivalTime: arrivalOverride ?? arrivalTimeValue
    });
    if (!Array.isArray(normalized) || normalized.length !== 2) {
      return candidate;
    }
    const [targetStart, targetEnd] = normalized;
    const [originalStart, originalEnd] = candidate;
    const targetStartValid = dayjs(targetStart).isValid();
    const targetEndValid = dayjs(targetEnd).isValid();
    const startMatched = dayjs(originalStart).isValid() && targetStartValid ? dayjs(originalStart).isSame(targetStart) : originalStart === targetStart;
    const endMatched = dayjs(originalEnd).isValid() && targetEndValid ? dayjs(originalEnd).isSame(targetEnd) : originalEnd === targetEnd;
    if (!startMatched || !endMatched) {
      form.setFieldsValue({ range: normalized });
    }
    return normalized;
  }, [checkoutBoundaryHour, form, arrivalTimeValue]);

  const prepareDraftRange = React.useCallback(() => {
    let start = null;
    let end = null;
    if (Array.isArray(rangeValue) && rangeValue.length === 2) {
      start = rangeValue[0] ? dayjs(rangeValue[0]) : null;
      end = rangeValue[1] ? dayjs(rangeValue[1]) : null;
    }
    if (!start || !start.isValid()) {
      const [defaultStart, defaultEnd] = buildDefaultRange();
      start = dayjs(defaultStart);
      end = dayjs(defaultEnd);
    } else if (!end || !end.isValid()) {
      end = start.add(1, 'day');
    }
    setDraftRange({ startDate: start.toDate(), endDate: end.toDate() });
  }, [rangeValue, buildDefaultRange]);

  const handleRangePopoverOpenChange = React.useCallback((open) => {
    setRangePanelOpen((prev) => {
      if (open && !prev) {
        prepareDraftRange();
      }
      return open;
    });
  }, [prepareDraftRange]);

  const handleDraftRangeChange = React.useCallback((ranges) => {
    const selection = ranges?.selection;
    if (!selection) return;
    setDraftRange({
      startDate: selection.startDate ? new Date(selection.startDate) : null,
      endDate: selection.endDate ? new Date(selection.endDate) : null
    });
  }, []);

  const handleRangeConfirm = React.useCallback(() => {
    if (!draftRange?.startDate || !draftRange?.endDate) {
      setRangePanelOpen(false);
      return;
    }
    const start = dayjs(draftRange.startDate);
    const end = dayjs(draftRange.endDate);
    const normalized = applyNormalizedRange([start, end]);
    if (Array.isArray(normalized) && normalized.length === 2) {
      form.setFieldsValue({ range: normalized });
    }
    setRangePanelOpen(false);
  }, [draftRange, applyNormalizedRange, form]);

  const handleRangeCancel = React.useCallback(() => {
    setRangePanelOpen(false);
  }, []);

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getRoomById(id);
      setRoom(data);
      if (data) {
        const defaultGuests = 1;
        const [defaultStart, defaultEnd] = buildDefaultRange();
        form.setFieldsValue({
          range: [defaultStart, defaultEnd],
          arrivalTime: dayjs(defaultStart),
          guests: defaultGuests,
          contactName: isAdmin ? '' : (user?.username || ''),
          contactPhone: isAdmin ? '' : (user?.phone || ''),
          remark: '',
          hotelId: data.hotelId,
          paymentMethod: defaultPaymentMethod,
          paymentChannel: defaultPaymentChannel
        });
      }
    } catch (e) {
      console.error(e);
      navigate('/error', { state: { status: '500', title: '加载失败', subTitle: '无法连接后端', backTo: '/rooms' }, replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, form, isAdmin, buildDefaultRange, user?.phone, user?.username, defaultPaymentChannel, defaultPaymentMethod]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (!Array.isArray(rangeValue) || rangeValue.length !== 2) return;
    applyNormalizedRange(rangeValue);
  }, [rangeValue, applyNormalizedRange]);

  React.useEffect(() => {
    if (!arrivalTimeValue) return;
    if (!Array.isArray(rangeValue) || rangeValue.length !== 2) return;
    applyNormalizedRange(rangeValue, arrivalTimeValue);
  }, [arrivalTimeValue, rangeValue, applyNormalizedRange]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getVipPricingSnapshot();
        setPricing(data);
      } catch (err) {
        console.warn('加载会员策略失败', err);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (!user || isAdmin) return;
    if (user.phone) {
      form.setFieldsValue({ contactPhone: user.phone });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await getMyProfile();
        if (cancelled) return;
        if (profile?.phone) {
          updateUser({ phone: profile.phone });
          form.setFieldsValue({ contactPhone: profile.phone });
        }
      } catch (err) {
        console.warn('加载用户联系电话失败', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, updateUser, form]);

  React.useEffect(() => {
    if (!user) {
      setWallet(null);
      return;
    }
    (async () => {
      try {
        const data = await getWalletSummary(5);
        setWallet(data);
      } catch (err) {
        console.warn('加载钱包信息失败', err);
      }
    })();
  }, [user]);

  React.useEffect(() => {
    if (!paymentMethodValue) return;
    if (paymentMethodValue === 'WALLET') {
      form.setFieldsValue({ paymentChannel: 'WALLET' });
      return;
    }
    if (paymentMethodValue === 'ONLINE') {
      const currentChannel = form.getFieldValue('paymentChannel');
      const nextChannel = currentChannel && currentChannel !== 'WALLET' ? currentChannel : 'WECHAT';
      form.setFieldsValue({ paymentChannel: nextChannel });
      return;
    }
    if (paymentMethodValue === 'ARRIVAL') {
      form.setFieldsValue({ paymentChannel: 'ARRIVAL' });
    }
  }, [paymentMethodValue, form]);

  const vrEntry = React.useMemo(() => getVrEntry(room), [room]);

  const discountLookup = React.useMemo(() => {
    if (!pricing) return { base: {}, rooms: new Map() };
    const baseRates = Object.entries(pricing.baseRates || {}).reduce((acc, [level, rate]) => {
      const key = Number(level);
      acc[key] = typeof rate === 'number' ? rate : Number(rate);
      return acc;
    }, {});
    const roomMap = new Map();
    const list = Array.isArray(pricing.rooms) ? pricing.rooms : [];
    list.forEach((item) => {
      const roomId = Number(item.roomTypeId ?? item.room_type_id ?? item.id);
      if (Number.isNaN(roomId)) return;
      const discounts = item.discounts || {};
      const normalized = Object.entries(discounts).reduce((acc, [lvl, rate]) => {
        const key = Number(lvl);
        acc[key] = typeof rate === 'number' ? rate : Number(rate);
        return acc;
      }, {});
      roomMap.set(roomId, normalized);
    });
    return { base: baseRates, rooms: roomMap };
  }, [pricing]);

  const pricingSummary = React.useMemo(() => {
    if (!room) return null;
    const basePrice = Number(room.pricePerNight);
    if (Number.isNaN(basePrice)) return null;
    const vipLevel = user?.vipLevel != null ? Number(user.vipLevel) : null;
    const checkoutHour = checkoutBoundaryHour;
  const days = computeStayNights(normalizedRange, checkoutHour, { minNights: MINIMUM_NIGHTS, arrivalTime: arrivalTimeValue });
    let rate = 1;
    if (vipLevel != null && !Number.isNaN(vipLevel)) {
      const roomSpecific = discountLookup.rooms.get(Number(room.id)) || {};
      rate = roomSpecific[vipLevel] ?? discountLookup.base[vipLevel] ?? 1;
    }
    const originalAmount = Number((basePrice * days).toFixed(2));
    const nightlyDiscountedPrice = Number((basePrice * rate).toFixed(2));
    const payableAmount = Number((originalAmount * rate).toFixed(2));
    return {
      days,
      basePrice,
      rate,
      originalAmount,
      payableAmount,
      nightlyDiscountedPrice,
      discountAmount: Number((originalAmount - payableAmount).toFixed(2)),
      checkoutHour
    };
  }, [room, normalizedRange, discountLookup, user, checkoutBoundaryHour, arrivalTimeValue]);

  const checkoutBoundaryLabel = React.useMemo(() => {
    const hourNum = Number(checkoutBoundaryHour);
    if (!Number.isFinite(hourNum)) {
      return '当日 12:00';
    }
    const normalizedHour = ((hourNum % 24) + 24) % 24;
    const extraDays = Math.floor(hourNum / 24);
    const dayText = extraDays > 0 ? `第 ${extraDays + 1} 天 ` : '当日 ';
    return `${dayText}${String(normalizedHour).padStart(2, '0')}:00`;
  }, [checkoutBoundaryHour]);

  const rangeSummary = React.useMemo(() => {
    if (!Array.isArray(normalizedRange) || normalizedRange.length !== 2) return null;
    const [startRaw, endRaw] = normalizedRange;
    if (!startRaw || !endRaw) return null;
    const start = dayjs(startRaw);
    const end = dayjs(endRaw);
    if (!start.isValid() || !end.isValid()) return null;
  const nights = pricingSummary?.days ?? computeStayNights([start, end], checkoutBoundaryHour, { minNights: MINIMUM_NIGHTS, arrivalTime: arrivalTimeValue });
    return {
      startText: start.format('YYYY-MM-DD HH:mm'),
      endText: end.format('YYYY-MM-DD HH:mm'),
      nights
    };
  }, [normalizedRange, pricingSummary, checkoutBoundaryHour, arrivalTimeValue]);

  const rangeHelp = React.useMemo(() => {
    if (rangeSummary) {
      return (
        <Space direction="vertical" size={0}>
          <Text type="secondary">退房截止时间：{rangeSummary.endText}（共 {rangeSummary.nights} 晚）</Text>
        </Space>
      );
    }
    return (
      <Text type="secondary">
        默认参考入住时间为当日 {String(DEFAULT_CHECKIN_HOUR).padStart(2, '0')}:00，可在下方调整具体到店时间；退房需在 {checkoutBoundaryLabel} 前完成。
      </Text>
    );
  }, [rangeSummary, checkoutBoundaryLabel]);

  React.useEffect(() => {
    if (room && pendingAutoOpen) {
      if (vrEntry?.src) {
        setVrVisible(true);
      } else {
        message.info('该房型暂未关联 VR 影像，敬请期待。');
      }
      setPendingAutoOpen(false);
    }
  }, [room, pendingAutoOpen, vrEntry]);

  const onFinish = async (vals) => {
    try {
      setBookingLoading(true);
      const normalizedRangeForSubmit = applyNormalizedRange(vals.range);
      const effectiveRange = Array.isArray(normalizedRangeForSubmit) && normalizedRangeForSubmit.length === 2
        ? normalizedRangeForSubmit
        : (Array.isArray(vals.range) ? vals.range : []);
      const startMoment = effectiveRange?.[0] ? dayjs(effectiveRange[0]) : null;
      const endMoment = effectiveRange?.[1] ? dayjs(effectiveRange[1]) : null;
      if (!startMoment || !endMoment || !startMoment.isValid() || !endMoment.isValid()) {
        message.warning('请选择开始和结束时间');
        return;
      }
      const start = startMoment.format('YYYY-MM-DDTHH:mm:ss');
      const end = endMoment.format('YYYY-MM-DDTHH:mm:ss');
      let paymentMethod;
      let paymentChannel;
      let payNow;
      if (isAdmin) {
        paymentMethod = 'ADMIN';
        paymentChannel = 'ADMIN';
        payNow = false;
      } else {
        const rawMethod = (vals.paymentMethod || 'WALLET').toUpperCase();
        paymentMethod = rawMethod;
        if (rawMethod !== 'WALLET' && rawMethod !== 'ONLINE' && rawMethod !== 'ARRIVAL') {
          paymentMethod = 'WALLET';
        }
        paymentChannel = 'WALLET';
        if (paymentMethod === 'ONLINE') {
          paymentChannel = (vals.paymentChannel || 'WECHAT').toUpperCase();
        } else if (paymentMethod === 'ARRIVAL') {
          paymentChannel = 'ARRIVAL';
        }
        if (paymentMethod === 'ONLINE') {
          message.info('在线支付功能完善中，请选择其他支付方式');
          return;
        }
        payNow = paymentMethod !== 'ARRIVAL';
        if (paymentMethod === 'WALLET' && payNow && wallet?.balance != null && pricingSummary?.payableAmount != null) {
          const balanceNum = Number(wallet.balance);
          if (!Number.isNaN(balanceNum) && balanceNum < pricingSummary.payableAmount) {
            message.warning('钱包余额不足，请先充值或改用其他支付方式');
            return;
          }
        }
      }
      // availability pre-check
      try {
        const avail = await getRoomAvailability(id, { start, end });
        if (!avail?.available) {
          message.error('该时段库存不足，请更换时间');
          return;
        }
      } catch (e) {
        if (e.status === 404) {
          navigate('/error', { state: { status: '404', title: '房型不存在', subTitle: '请返回列表重试', backTo: '/rooms' }, replace: true });
          return;
        }
        // 422 or other errors继续尝试创建时由后端返回原因
      }
      const payload = {
        roomId: id,
        userId: undefined,
        start,
        end,
        guests: vals.guests,
        contactName: vals.contactName,
        contactPhone: vals.contactPhone,
        remark: vals.remark,
        hotelId: vals.hotelId ?? room?.hotelId,
        paymentMethod,
        paymentChannel,
        payNow,
      };
      const data = await createBooking(payload);
      if (!data) {
        message.error('预订失败，可能无可用房间');
      } else {
        const statusMeta = getBookingStatusMeta(data.status);
        const parts = [`预订成功，状态：${statusMeta.label}`];
        if (paymentMethod) {
          parts.push(`支付方式：${getPaymentMethodLabel(paymentMethod)}`);
        }
        if (isAdmin && data.userId && data.userId !== user?.id) {
          const phone = vals.contactPhone || data.contactPhone || '未知';
          parts.push(`已为客户创建/查找账号 (用户ID: ${data.userId}，用户名和初始密码均为：${phone})`);
        }
        message.success(parts.join('，'));
        form.resetFields();
        const [resetStart, resetEnd] = buildDefaultRange();
        form.setFieldsValue({
          range: [resetStart, resetEnd],
          arrivalTime: dayjs(resetStart),
          guests: 1,
          contactName: isAdmin ? '' : (user?.username || ''),
          contactPhone: defaultContactPhone,
          remark: '',
          hotelId: room?.hotelId,
          paymentMethod: defaultPaymentMethod,
          paymentChannel: defaultPaymentChannel
        });
        if (user) {
          try {
            const refreshed = await getWalletSummary(5);
            setWallet(refreshed);
          } catch (refreshErr) {
            console.warn('刷新钱包失败', refreshErr);
          }
        }
        load();
      }
    } catch (e) {
      console.error(e);
      const msg = e?.data?.message || '预订失败';
      if (e?.status === 402) {
        message.error(msg || '钱包余额不足，请先充值');
        return;
      }
      navigate('/error', { state: { status: String(e.status || 500), title: '预订失败', subTitle: msg, backTo: `/rooms/${id}` }, replace: true });
    } finally {
      setBookingLoading(false);
    }
  };

  if (!room) return <Text type="secondary">{loading ? '加载中…' : '未找到房间'}</Text>;
  const images = getImageList(room.images);
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const isActive = room.isActive !== undefined ? !!room.isActive : true;
  const priceValue = Number(room.pricePerNight);
  const priceDisplay = Number.isNaN(priceValue) ? room.pricePerNight : priceValue.toFixed(2);
  const maxGuestsValue = Number(room.maxGuests);
  const maxGuestsDisplay = Number.isNaN(maxGuestsValue) || maxGuestsValue <= 0 ? room.maxGuests ?? '—' : maxGuestsValue;
  const maxGuestsLimit = Number.isNaN(maxGuestsValue) || maxGuestsValue <= 0 ? undefined : maxGuestsValue;
  const defaultGuestCount = 1;
  const totalCountValue = Number(room.totalCount);
  const availableCountValue = Number(room.availableCount);
  const walletBalance = wallet?.balance != null ? Number(wallet.balance) : null;
  const isWalletSufficient = walletBalance == null || !pricingSummary?.payableAmount
    ? true
    : walletBalance >= pricingSummary.payableAmount;

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* 页面标题区域 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16,
        padding: '32px 40px',
        boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
      }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space size={20} align="center">
            <Button 
              onClick={onBack}
              size="large"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              返回列表
            </Button>
            <div>
              <Title level={2} style={{ margin: '0 0 8px 0', color: '#fff', fontWeight: 700 }}>
                <Space>
                  <HomeOutlined />
                  {room.name}
                </Space>
              </Title>
              <Space size={12}>
                <Tag 
                  color={isActive ? 'success' : 'error'}
                  icon={isActive ? <CheckCircleOutlined /> : null}
                  style={{ 
                    fontSize: 14, 
                    padding: '4px 12px', 
                    borderRadius: 8,
                    border: 'none',
                  }}
                >
                  {isActive ? '可预订' : '暂不可售'}
                </Tag>
                <Tag 
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.25)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: '#fff',
                    fontSize: 14,
                    padding: '4px 12px',
                    borderRadius: 8,
                  }}
                >
                  {room.type}
                </Tag>
              </Space>
            </div>
          </Space>
          <Button
            icon={<PlayCircleOutlined />}
            type="primary"
            size="large"
            onClick={() => {
              if (vrEntry?.src) {
                setVrVisible(true);
              } else {
                message.info('该房型暂未关联 VR 影像，敬请期待。');
              }
            }}
            style={{
              height: 48,
              borderRadius: 10,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            VR 看房
          </Button>
        </Space>
      </div>

      {/* 图集展示 */}
      <Card
        title={<Space><EnvironmentOutlined style={{ color: '#1890ff' }} /> 图集预览</Space>}
        style={{
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
        headStyle={{ borderBottom: '2px solid #f0f0f0' }}
      >
        <Image.PreviewGroup>
          <Row gutter={[16, 16]}>
            {images.length ? images.map((u, i) => (
              <Col xs={24} sm={12} md={8} lg={6} key={i}>
                <div style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  const img = e.currentTarget.querySelector('img');
                  if (img) {
                    img.style.transform = 'scale(1.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  const img = e.currentTarget.querySelector('img');
                  if (img) {
                    img.style.transform = 'scale(1)';
                  }
                }}
                >
                  <Image 
                    src={u} 
                    width="100%" 
                    height={180} 
                    style={{ 
                      objectFit: 'cover',
                      borderRadius: 12,
                      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }} 
                  />
                </div>
              </Col>
            )) : (
              <Col span={24}>
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: isDarkMode ? token.colorBgLayout : '#fafafa',
                  borderRadius: 12,
                }}>
                  <Text type="secondary">暂无图片</Text>
                </div>
              </Col>
            )}
          </Row>
        </Image.PreviewGroup>
      </Card>
      {/* 房型信息 */}
      <Row gutter={[20, 20]}>
        {/* 价格和库存 */}
        <Col xs={24} md={12}>
          <Card
            hoverable
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
              height: '100%',
            }}
            bodyStyle={{ padding: '24px' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
            }}
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div style={{
                background: 'linear-gradient(135deg, #fa8c16 0%, #faad14 100%)',
                borderRadius: 12,
                padding: '20px 24px',
                textAlign: 'center',
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>房价</Text>
                <Title level={1} style={{ color: '#fff', margin: '8px 0 0', fontSize: 48, fontWeight: 700 }}>
                  ¥{priceDisplay}
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>每晚</Text>
              </div>
              
              {pricingSummary && pricingSummary.rate < 1 && (
                <div style={{
                  background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
                  border: '1px solid #b7eb8f',
                  borderRadius: 12,
                  padding: '16px 20px',
                  textAlign: 'center',
                }}>
                  <Space direction="vertical" size={4}>
                    <Space>
                      <GiftOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                      <Text strong style={{ color: '#52c41a', fontSize: 16 }}>会员专享价</Text>
                    </Space>
                    <Title level={2} style={{ color: '#52c41a', margin: '4px 0', fontSize: 36 }}>
                      ¥{pricingSummary.nightlyDiscountedPrice.toFixed(2)}
                    </Title>
                    <Tag color="success" style={{ fontSize: 13, padding: '2px 10px', borderRadius: 6 }}>
                      {Math.round(pricingSummary.rate * 100)}% 折扣
                    </Tag>
                  </Space>
                </div>
              )}

              <Divider style={{ margin: '8px 0' }} />
              
              <Row gutter={12}>
                <Col span={12}>
                  <Card size="small" style={{ background: isDarkMode ? '#262626' : '#f5f5f5', border: 'none', textAlign: 'center' }}>
                    <Statistic
                      title={<Space><HomeOutlined /> 剩余</Space>}
                      value={Number.isNaN(availableCountValue) ? room.availableCount : availableCountValue}
                      suffix={`/ ${Number.isNaN(totalCountValue) ? room.totalCount : totalCountValue}`}
                      valueStyle={{ color: availableCountValue > 5 ? '#52c41a' : '#fa541c', fontSize: 24 }}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" style={{ background: isDarkMode ? '#262626' : '#f5f5f5', border: 'none', textAlign: 'center' }}>
                    <Statistic
                      title={<Space><UserOutlined /> 最大入住</Space>}
                      value={maxGuestsDisplay}
                      suffix="人"
                      valueStyle={{ color: '#1890ff', fontSize: 24 }}
                    />
                  </Card>
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>
        
        {/* 房型详情 */}
        <Col xs={24} md={12}>
          <Card
            title={<Space><StarFilled style={{ color: '#faad14' }} /> 房型详情</Space>}
            hoverable
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
              height: '100%',
            }}
            headStyle={{ borderBottom: '2px solid #f0f0f0' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
            }}
          >
            <Descriptions column={1} size="middle">
              <Descriptions.Item label={<Text strong>房型描述</Text>}>
                <Paragraph style={{ margin: 0 }}>{room.description || '—'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong>面积</Text>}>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px', borderRadius: 6 }}>
                  {room.areaSqm ? `${room.areaSqm} ㎡` : '—'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong>床型</Text>}>
                <Tag color="purple" style={{ fontSize: 14, padding: '4px 12px', borderRadius: 6 }}>
                  {room.bedType || '—'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong>设施</Text>}>
                {amenities.length ? (
                  <Space wrap size={[8, 8]}>
                    {amenities.map((am, idx) => (
                      <Tag 
                        key={idx}
                        color="geekblue"
                        style={{ 
                          fontSize: 13, 
                          padding: '4px 10px', 
                          borderRadius: 6,
                          border: '1px solid #adc6ff',
                        }}
                      >
                        <CheckCircleOutlined /> {am}
                      </Tag>
                    ))}
                  </Space>
                ) : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* 预订时段预览条：登录/不登录均可查看 */}
      {room && (
        <RoomAvailabilityStrip roomTypeId={room.id} hotelId={room.hotelId} />
      )}

      {/* 预订标题 */}
      <div style={{
        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        borderRadius: 16,
        padding: '24px 32px',
        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.25)',
      }}>
        <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
          <Space>
            <CalendarOutlined />
            在线预订
          </Space>
        </Title>
      </div>
      {!user && (
        <Space>
          <Typography.Text type="secondary">登入/注册后才能预订。</Typography.Text>
          <Button type="primary" onClick={() => navigate('/login')}>去登入/注册</Button>
        </Space>
      )}
      {user && (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          {isAdmin && (
            <Alert
              showIcon
              type="info"
              icon={<SafetyCertificateOutlined />}
              message={<Text strong>管理员代客预订</Text>}
              description="系统会根据联系电话自动匹配或创建客户账号，新账号用户名和初始密码均为电话号码。"
              style={{
                borderRadius: 12,
                background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                border: '1px solid #91d5ff',
              }}
            />
          )}
          
          {pricingSummary && (
            <Card 
              hoverable
              style={{
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s ease',
                background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
              }}
              bodyStyle={{ padding: '28px 32px' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
              }}
            >
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <Title level={4} style={{ margin: 0 }}>
                  <Space><ThunderboltOutlined style={{ color: '#fa8c16' }} /> 费用概览</Space>
                </Title>
                
                <Row gutter={[20, 20]}>
                  <Col xs={24} sm={12} md={6}>
                    <div style={{
                      background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                      borderRadius: 12,
                      padding: '20px',
                      textAlign: 'center',
                      border: '1px solid #91d5ff',
                    }}>
                      <Statistic
                        title={<Text style={{ color: '#1890ff', fontWeight: 600 }}>入住天数</Text>}
                        value={pricingSummary.days}
                        suffix="晚"
                        precision={0}
                        valueStyle={{ color: '#1890ff', fontSize: 32, fontWeight: 700 }}
                      />
                    </div>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <div style={{
                      background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
                      borderRadius: 12,
                      padding: '20px',
                      textAlign: 'center',
                      border: '1px solid #d9d9d9',
                    }}>
                      <Statistic
                        title={<Text style={{ color: '#595959', fontWeight: 600 }}>原价合计</Text>}
                        prefix="¥"
                        value={pricingSummary.originalAmount}
                        precision={2}
                        valueStyle={{ color: '#595959', fontSize: 28, fontWeight: 700 }}
                      />
                    </div>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <div style={{
                      background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
                      borderRadius: 12,
                      padding: '20px',
                      textAlign: 'center',
                      border: '1px solid #b7eb8f',
                    }}>
                      <Statistic
                        title={<Text style={{ color: '#52c41a', fontWeight: 600 }}>折扣金额</Text>}
                        prefix="-¥"
                        value={pricingSummary.discountAmount}
                        precision={2}
                        valueStyle={{ color: '#52c41a', fontSize: 28, fontWeight: 700 }}
                      />
                    </div>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <div style={{
                      background: 'linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%)',
                      borderRadius: 12,
                      padding: '20px',
                      textAlign: 'center',
                      border: '2px solid #ff7875',
                    }}>
                      <Statistic
                        title={<Text style={{ color: '#fa541c', fontWeight: 600 }}>应付金额</Text>}
                        prefix="¥"
                        value={pricingSummary.payableAmount}
                        precision={2}
                        valueStyle={{ color: '#fa541c', fontSize: 32, fontWeight: 700 }}
                      />
                    </div>
                  </Col>
                </Row>
                
                {paymentMethodValue === 'WALLET' && walletBalance != null && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <Alert
                      showIcon
                      type={isWalletSufficient ? 'success' : 'warning'}
                      icon={<WalletOutlined />}
                      message={
                        <Space>
                          <Text strong>钱包余额：</Text>
                          <Text strong style={{ fontSize: 16, color: isWalletSufficient ? '#52c41a' : '#fa8c16' }}>
                            ¥{walletBalance.toFixed(2)}
                          </Text>
                          {!isWalletSufficient && <Text type="danger">（余额不足，请充值或改用其他方式）</Text>}
                        </Space>
                      }
                      style={{ borderRadius: 10 }}
                    />
                  </>
                )}
              </Space>
            </Card>
          )}
          
          <Card
            title={<Space><CalendarOutlined style={{ color: '#1890ff' }} /> 预订信息</Space>}
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
            headStyle={{ borderBottom: '2px solid #f0f0f0' }}
          >
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              range: defaultRangeValue,
              arrivalTime: defaultRangeValue?.[0] ? dayjs(defaultRangeValue[0]) : dayjs().startOf('day').add(DEFAULT_CHECKIN_HOUR, 'hour'),
              guests: defaultGuestCount,
              contactName: isAdmin ? '' : (user?.username || ''),
              contactPhone: defaultContactPhone,
              remark: '',
              hotelId: room?.hotelId,
              paymentMethod: defaultPaymentMethod,
              paymentChannel: defaultPaymentChannel
            }}
          >
            <Row gutter={[20, 20]}>
              <Col span={24}>
                <Form.Item name="hotelId" hidden>
                  <Input type="hidden" />
                </Form.Item>
                <Form.Item
                  name="range"
                  label={<Text strong style={{ fontSize: 15 }}><CalendarOutlined /> 入住与离店日期</Text>}
                  rules={[{ required: true, message: '请选择入住与离店日期' }]}
                  extra={rangeHelp}
                >
                  <Popover
                    trigger="click"
                    placement="bottomLeft"
                    open={rangePanelOpen}
                    onOpenChange={handleRangePopoverOpenChange}
                    destroyTooltipOnHide
                    overlayClassName="stay-range-popover"
                    content={(
                      <div className={isCompactCalendar ? 'stay-range-popover-content stay-range-popover-content--compact' : 'stay-range-popover-content'}>
                        <DateRange
                          onChange={handleDraftRangeChange}
                          moveRangeOnFirstSelection={false}
                          ranges={[{
                            startDate: draftSelection.start,
                            endDate: draftSelection.end,
                            key: 'selection'
                          }]}
                          showDateDisplay={false}
                          rangeColors={['#1677ff']}
                          direction={calendarDirection}
                          months={calendarMonths}
                          minDate={dayjs().startOf('day').toDate()}
                        />
                        <div className="stay-range-popover-actions">
                          <Space size={8}>
                            <Button size="small" onClick={handleRangeCancel}>取消</Button>
                            <Button size="small" type="primary" onClick={handleRangeConfirm}>确定</Button>
                          </Space>
                        </div>
                      </div>
                    )}
                  >
                    <Input
                      className="stay-range-input"
                      readOnly
                      size="large"
                      value={rangeDisplay || ''}
                      placeholder="选择入住与离店日期"
                      suffix={<CalendarOutlined />}
                      onClick={() => handleRangePopoverOpenChange(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRangePopoverOpenChange(true);
                        }
                      }}
                      style={{ borderRadius: 10 }}
                    />
                  </Popover>
                </Form.Item>
              </Col>
              
              <Col xs={24} md={12}>
                <Form.Item
                  name="arrivalTime"
                  label={<Text strong style={{ fontSize: 15 }}><ClockCircleOutlined /> 预计到店时间</Text>}
                  rules={[{ required: true, message: '请选择预计到店时间' }]}
                >
                  <TimePicker
                    format="HH:mm"
                    minuteStep={15}
                    allowClear={false}
                    size="large"
                    style={{ width: '100%', borderRadius: 10 }}
                  />
                </Form.Item>
              </Col>
              
              <Col xs={24} md={12}>
                <Form.Item 
                  name="guests" 
                  label={<Text strong style={{ fontSize: 15 }}><UserOutlined /> 入住人数</Text>} 
                  rules={[{ required: true, message: '请输入人数' }]}
                >
                  <InputNumber 
                    min={1} 
                    max={maxGuestsLimit || 10} 
                    size="large"
                    style={{ width: '100%', borderRadius: 10 }} 
                  />
                </Form.Item>
              </Col>
              
              {!isAdmin && (
                <Col xs={24} md={12}>
                  <Form.Item 
                    name="contactName" 
                    label={<Text strong style={{ fontSize: 15 }}><UserOutlined /> 联系人姓名</Text>} 
                    rules={[{ required: true, message: '请输入联系人姓名' }]}
                  >
                    <Input 
                      placeholder="请输入联系人姓名" 
                      size="large"
                      prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                      style={{ borderRadius: 10 }}
                    />
                  </Form.Item>
                </Col>
              )}
              
              <Col xs={24} md={isAdmin ? 24 : 12}>
                <Form.Item 
                  name="contactPhone" 
                  label={<Text strong style={{ fontSize: 15 }}><PhoneOutlined /> 联系电话</Text>}
                  tooltip={isAdmin ? "输入客户电话号码，系统将自动查找或创建用户账号（用户名和密码均为电话号码）" : undefined}
                  rules={[
                    { required: true, message: '请输入联系电话' },
                    { 
                      pattern: /^(1[3-9]\d{9}|\+?[1-9]\d{1,14})$/, 
                      message: '请输入正确的手机号（国内11位或国际号码）' 
                    }
                  ]}
                >
                  <Input 
                    placeholder={isAdmin ? "输入电话号码自动创建/查找用户" : "请输入手机号（国内11位或国际号码）"} 
                    maxLength={20}
                    size="large"
                    prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
                    style={{ borderRadius: 10 }}
                  />
                </Form.Item>
              </Col>
              
              {isAdmin ? (
                <>
                  <Form.Item name="paymentMethod" hidden>
                    <Input type="hidden" />
                  </Form.Item>
                  <Form.Item name="paymentChannel" hidden>
                    <Input type="hidden" />
                  </Form.Item>
                </>
              ) : (
                <Col span={24}>
                  <Form.Item 
                    name="paymentMethod" 
                    label={<Text strong style={{ fontSize: 15 }}><WalletOutlined /> 支付方式</Text>}
                    rules={[{ required: true, message: '请选择支付方式' }]}
                  >
                    <Radio.Group size="large" style={{ width: '100%' }}>
                      <Radio.Button value="WALLET" style={{ borderRadius: 10, marginRight: 12, marginBottom: 12 }}>
                        <Space size={6} align="center">
                          <WalletOutlined />
                          <span>钱包支付{walletBalance != null ? `（余额 ¥${walletBalance.toFixed(2)}）` : ''}</span>
                        </Space>
                      </Radio.Button>
                      <Radio.Button value="ONLINE" style={{ borderRadius: 10, marginRight: 12, marginBottom: 12 }}>
                        <Space size={6} align="center">
                          <WechatOutlined />
                          <span>在线支付</span>
                        </Space>
                      </Radio.Button>
                      <Radio.Button value="ARRIVAL" style={{ borderRadius: 10, marginBottom: 12 }}>
                        <Space size={6} align="center">
                          <DollarCircleOutlined />
                          <span>到店支付</span>
                        </Space>
                      </Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              )}
              
              <Col span={24}>
                <Form.Item shouldUpdate noStyle>
                  {({ getFieldValue }) => getFieldValue('paymentMethod') === 'ONLINE' ? (
                    <Form.Item 
                      name="paymentChannel" 
                      label={<Text strong style={{ fontSize: 15 }}>在线支付渠道</Text>}
                      rules={[{ required: true, message: '请选择在线支付渠道' }]}
                    > 
                      <Radio.Group size="large">
                        <Radio.Button value="WECHAT" style={{ borderRadius: 10, marginRight: 12 }}>
                          <Space size={6} align="center">
                            <WechatOutlined />
                            <span>微信支付</span>
                          </Space>
                        </Radio.Button>
                        <Radio.Button value="PAYPAL" style={{ borderRadius: 10, marginRight: 12 }}>
                          <Space size={6} align="center">
                            <DollarCircleOutlined />
                            <span>PayPal</span>
                          </Space>
                        </Radio.Button>
                        <Radio.Button value="VISA" style={{ borderRadius: 10 }}>
                          <Space size={6} align="center">
                            <CreditCardOutlined />
                            <span>Visa</span>
                          </Space>
                        </Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                  ) : null}
                </Form.Item>
              </Col>
              
              <Col span={24}>
                <Form.Item shouldUpdate noStyle>
                  {({ getFieldValue }) => getFieldValue('paymentMethod') === 'ARRIVAL' ? (
                    <Alert
                      type="warning"
                      showIcon
                      icon={<ClockCircleOutlined />}
                      message={<Text strong>到店支付提醒</Text>}
                      description="请在办理入住时于前台完成支付，房间将为您保留至到店时间当日。"
                      style={{
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)',
                        border: '1px solid #ffd591',
                      }}
                    />
                  ) : null}
                </Form.Item>
              </Col>
              
              <Col span={24}>
                <Form.Item 
                  name="remark" 
                  label={<Text strong style={{ fontSize: 15 }}>备注</Text>}
                >
                  <Input.TextArea 
                    rows={4} 
                    placeholder="可选，填写特殊需求" 
                    size="large"
                    style={{ borderRadius: 10 }}
                  />
                </Form.Item>
              </Col>
              
              <Col span={24}>
                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={bookingLoading} 
                    disabled={!isActive || Number(room.availableCount) <= 0}
                    icon={<CheckCircleOutlined />}
                    size="large"
                    block
                    style={{
                      height: 52,
                      borderRadius: 10,
                      fontSize: 16,
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                    }}
                  >
                    {isAdmin ? '为客户创建预约' : '立即预订'}
                  </Button>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
        </Space>
      )}
      <RoomVRViewer
        open={vrVisible}
        onClose={() => setVrVisible(false)}
        entry={vrEntry}
        roomName={room.name}
      />
    </Space>
  );
}
