import React from 'react';
import { 
  Alert, 
  Card, 
  Space, 
  Typography, 
  Form, 
  Input, 
  Button, 
  message, 
  InputNumber, 
  Radio, 
  Progress, 
  Table, 
  Tag, 
  Divider,
  Row,
  Col,
  Statistic,
  Avatar,
  Badge,
  Timeline,
  theme
} from 'antd';
import { 
  UserOutlined,
  WalletOutlined,
  CrownOutlined,
  DollarOutlined,
  RiseOutlined,
  PhoneOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  GiftOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  HomeOutlined,
  StarFilled,
  AppstoreOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, updateMyProfile, getWalletSummary, rechargeWallet, getVipPricingSnapshot, getBookingsByUser, checkVipUpgrade } from '../services/api';
import dayjs from 'dayjs';
import { getBookingStatusMeta } from '../constants/booking';
import { DEFAULT_CHECKIN_HOUR, computeStayNights, normalizeStayRange } from '../utils/stayRange';

const { Title, Text } = Typography;

function normalizeDiscountMap(baseRates, discounts) {
  const result = new Map();
  const baseEntries = Object.entries(baseRates || {});
  baseEntries.forEach(([level, rate]) => {
    result.set(Number(level), typeof rate === 'number' ? rate : Number(rate));
  });
  if (discounts) {
    Object.entries(discounts).forEach(([level, rate]) => {
      result.set(Number(level), typeof rate === 'number' ? rate : Number(rate));
    });
  }
  return result;
}

function toRateNumber(value, fallback = 1) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatPercentValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '--';
  }
  const text = Number.isInteger(num) ? `${num}` : num.toFixed(1).replace(/\.0+$/, '');
  return `${text}%`;
}

export default function AccountCenter() {
  const { user, updateUser, refreshUser } = useAuth();
  const { token } = theme.useToken();
  const isDarkMode = token.colorBgBase === '#000000' || token.colorBgBase === '#141414';
  const [profile, setProfile] = React.useState(null);
  const [wallet, setWallet] = React.useState(null);
  const [pricing, setPricing] = React.useState(null);
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  const [loadingWallet, setLoadingWallet] = React.useState(false);
  const [loadingPricing, setLoadingPricing] = React.useState(false);
  const [updatingProfile, setUpdatingProfile] = React.useState(false);
  const [recharging, setRecharging] = React.useState(false);
  const [checkingVip, setCheckingVip] = React.useState(false);
  const [profileForm] = Form.useForm();
  const [rechargeForm] = Form.useForm();
  const [orderSnapshot, setOrderSnapshot] = React.useState([]);
  const [upcomingStay, setUpcomingStay] = React.useState(null);

  const loadOrderSnapshot = React.useCallback(async () => {
    if (!user?.id) {
      setOrderSnapshot([]);
      return;
    }
    try {
      const res = await getBookingsByUser(user.id, { page: 1, size: 20 });
      const items = Array.isArray(res) ? res : res?.items;
      setOrderSnapshot(Array.isArray(items) ? items : []);
    } catch (err) {
      console.warn('加载订单概览失败', err);
      setOrderSnapshot([]);
    }
  }, [user?.id]);

  const loadProfile = React.useCallback(async () => {
    setLoadingProfile(true);
    try {
      const data = await getMyProfile();
      setProfile(data);
      profileForm.setFieldsValue({
        username: data?.username,
        phone: data?.phone,
        email: data?.email,
      });
    } catch (err) {
      message.error(err?.data?.message || '获取个人资料失败');
    } finally {
      setLoadingProfile(false);
    }
  }, [profileForm]);

  const loadWallet = React.useCallback(async () => {
    if (!user) return;
    setLoadingWallet(true);
    try {
      const data = await getWalletSummary(10);
      setWallet(data);
    } catch (err) {
      message.error(err?.data?.message || '获取钱包信息失败');
    } finally {
      setLoadingWallet(false);
    }
  }, [user]);

  const loadPricing = React.useCallback(async () => {
    setLoadingPricing(true);
    try {
      const data = await getVipPricingSnapshot();
      setPricing(data);
    } catch (err) {
      console.warn('加载会员策略失败', err);
    } finally {
      setLoadingPricing(false);
    }
  }, []);

  const acceptedStatusSet = React.useMemo(() => new Set(['CONFIRMED', 'CHECKED_IN']), []);

  // 监听 user 的关键字段变化（vipLevel、username等），当这些字段更新时重新加载 profile
  // 这样可以在 refreshUser() 被调用后（例如从其他页面切回）自动更新页面显示
  React.useEffect(() => {
    if (user?.id && profile?.id && user.id === profile.id) {
      // 只有当 user 的某些字段与 profile 不一致时才重新加载
      const needsUpdate = 
        user.vipLevel !== profile.vipLevel ||
        user.username !== profile.username;
      
      if (needsUpdate) {
        loadProfile();
      }
    }
  }, [user?.id, user?.vipLevel, user?.username, profile?.id, profile?.vipLevel, profile?.username, loadProfile]);

  React.useEffect(() => {
    loadProfile();
    loadWallet();
    loadPricing();
    loadOrderSnapshot();
    
    // 监听页面可见性变化，页面重新可见时刷新钱包、订单和个人资料（包含VIP等级）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadProfile(); // 刷新个人资料以获取最新VIP等级和年度消费
        loadWallet();
        loadOrderSnapshot();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadOrderSnapshot, loadProfile, loadWallet, loadPricing]);

  const onProfileSubmit = async (values) => {
    try {
      setUpdatingProfile(true);
      const payload = {
        username: values.username,
        phone: values.phone,
        email: values.email,
      };
      const updated = await updateMyProfile(payload);
      setProfile(updated);
      updateUser({
        username: updated.username,
        vipLevel: updated.vipLevel,
        phone: updated.phone,
        email: updated.email,
      });
      message.success('资料更新成功');
    } catch (err) {
      message.error(err?.data?.message || '资料更新失败');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const onRechargeSubmit = async (values) => {
    try {
      setRecharging(true);
      await rechargeWallet({ amount: values.amount, channel: values.channel, referenceNo: values.referenceNo, remark: values.remark });
      message.success('充值成功');
      rechargeForm.resetFields();
      loadWallet();
    } catch (err) {
      message.error(err?.data?.message || '充值失败');
    } finally {
      setRecharging(false);
    }
  };

  const handleCheckVipUpgrade = async () => {
    try {
      setCheckingVip(true);
      const result = await checkVipUpgrade();
      
      if (result.upgraded) {
        message.success(`恭喜！您的VIP等级已从 VIP${result.oldLevel} 升级到 VIP${result.newLevel}！`);
        // 刷新用户信息和个人资料
        if (refreshUser) {
          await refreshUser();
        }
        await loadProfile();
      } else {
        message.info(`当前VIP等级：VIP${result.newLevel}，年度消费：¥${Number(result.yearlyConsumption || 0).toFixed(2)}`);
      }
    } catch (err) {
      message.error(err?.data?.message || 'VIP等级检查失败');
    } finally {
      setCheckingVip(false);
    }
  };

  const levelAverageRates = React.useMemo(() => {
    if (!pricing) return new Map();
    const baseRates = pricing.baseRates || {};
    const stats = new Map();
    if (Array.isArray(pricing.rooms) && pricing.rooms.length > 0) {
      pricing.rooms.forEach((item) => {
        const map = normalizeDiscountMap(baseRates, item.discounts);
        map.forEach((rate, lvl) => {
          const levelNum = Number(lvl);
          const rateNum = toRateNumber(rate, 1);
          if (Number.isNaN(levelNum)) return;
          const entry = stats.get(levelNum) || { total: 0, count: 0 };
          entry.total += rateNum;
          entry.count += 1;
          stats.set(levelNum, entry);
        });
      });
    }
    const result = new Map();
    stats.forEach(({ total, count }, level) => {
      if (count > 0) {
        result.set(level, total / count);
      }
    });
    Object.entries(baseRates).forEach(([lvl, rate]) => {
      const levelNum = Number(lvl);
      if (!result.has(levelNum)) {
        result.set(levelNum, toRateNumber(rate, 1));
      }
    });
    if (Array.isArray(pricing.levels)) {
      pricing.levels.forEach((item) => {
        const levelNum = Number(item.level ?? 0);
        if (!result.has(levelNum)) {
          result.set(levelNum, toRateNumber(item.discountRate, 1));
        }
      });
    }
    return result;
  }, [pricing]);

  const renderPercentLabel = React.useCallback((value) => formatPercentValue(value), []);

  const checkoutHourMap = React.useMemo(() => {
    const map = new Map([[0, 12], [1, 13], [2, 14], [3, 15], [4, 16]]);
    if (pricing?.checkoutHours && typeof pricing.checkoutHours === 'object') {
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

  const resolveCheckoutHour = React.useCallback((level) => {
    const levelNum = Number(level);
    if (!Number.isNaN(levelNum) && checkoutHourMap.has(levelNum)) {
      return checkoutHourMap.get(levelNum);
    }
    return checkoutHourMap.get(0) ?? 12;
  }, [checkoutHourMap]);

  const computeAdjustedStayRange = React.useCallback((startRaw, endRaw, levelHint) => {
    const checkoutHour = resolveCheckoutHour(levelHint);
    const start = startRaw ? dayjs(startRaw) : null;
    const end = endRaw ? dayjs(endRaw) : null;
    if (!start || !start.isValid() || !end || !end.isValid()) {
      return { checkoutHour, start: start && start.isValid() ? start : null, end: end && end.isValid() ? end : null };
    }
    const nights = computeStayNights([start, end], checkoutHour, { minNights: 1, checkinHour: DEFAULT_CHECKIN_HOUR });
    const normalized = normalizeStayRange([start, end], checkoutHour, { minNights: nights, checkinHour: DEFAULT_CHECKIN_HOUR });
    if (Array.isArray(normalized) && normalized.length === 2) {
      const [normalizedStart, normalizedEnd] = normalized;
      const resolvedStart = dayjs(normalizedStart);
      const resolvedEnd = dayjs(normalizedEnd);
      return { checkoutHour, start: resolvedStart, end: resolvedEnd };
    }
    return { checkoutHour, start, end };
  }, [resolveCheckoutHour]);

  React.useEffect(() => {
    if (!Array.isArray(orderSnapshot) || orderSnapshot.length === 0) {
      setUpcomingStay(null);
      return;
    }
    const now = dayjs();
    const normalized = orderSnapshot
      .filter((item) => item && acceptedStatusSet.has(String(item.status || '').toUpperCase()) && item.endTime)
      .map((item) => {
        const start = item.startTime ? dayjs(item.startTime) : null;
        const end = dayjs(item.endTime);
        return {
          raw: item,
          start,
          end,
          startValue: start && start.isValid() ? start.valueOf() : Number.MAX_SAFE_INTEGER,
          endValid: end.isValid(),
        };
      })
      .filter((entry) => entry.endValid);
    if (!normalized.length) {
      setUpcomingStay(null);
      return;
    }
    normalized.sort((a, b) => a.startValue - b.startValue);
    const candidate = normalized.find((entry) => entry.end.isAfter(now)) ?? normalized[0];
    const candidateVipLevel = candidate.raw?.vipLevel
      ?? candidate.raw?.vip_level
      ?? candidate.raw?.userVipLevel
      ?? candidate.raw?.user_vip_level
      ?? user?.vipLevel;
    const adjusted = computeAdjustedStayRange(candidate.start, candidate.end, candidateVipLevel);
    const resolvedStart = adjusted.start && adjusted.start.isValid() ? adjusted.start : (candidate.start && candidate.start.isValid() ? candidate.start : null);
    const resolvedEnd = adjusted.end && adjusted.end.isValid() ? adjusted.end : candidate.end;
    setUpcomingStay({
      bookingId: candidate.raw.id,
      status: candidate.raw.status,
      start: resolvedStart,
      end: resolvedEnd,
    });
  }, [orderSnapshot, acceptedStatusSet, computeAdjustedStayRange, user?.vipLevel]);

  const levelDescriptors = React.useMemo(() => {
    if (!pricing?.levels) return [];
    const baseRates = pricing.baseRates || {};
    return pricing.levels.map((item) => {
      const level = Number(item.level ?? 0);
      const fallbackRate = toRateNumber(item.discountRate ?? baseRates[level] ?? baseRates[String(level)], 1);
      const averageRate = toRateNumber(levelAverageRates.get(level), fallbackRate);
      const checkoutCandidate = item.checkoutHour ?? item.checkout_hour ?? (pricing?.checkoutHours ? pricing.checkoutHours[String(level)] : undefined);
      const checkoutHour = Number(checkoutCandidate);
      const percent = Number.isFinite(averageRate) ? Number((averageRate * 100).toFixed(1)) : 100;
      const progressPercent = percent >= 100 ? 99.999 : Math.max(percent, 0);
      return {
        level,
        name: item.name ?? `VIP ${level}`,
        discountRate: averageRate,
        baseDiscountRate: fallbackRate,
        percent,
        progressPercent,
        description: item.description ?? '',
        checkoutHour: Number.isNaN(checkoutHour) ? null : checkoutHour,
      };
    });
  }, [pricing, levelAverageRates]);

  const roomRows = React.useMemo(() => {
    if (!pricing?.rooms) return [];
    const baseRates = pricing.baseRates || {};
    const vipLevel = user?.vipLevel ?? 0;
    return pricing.rooms.map((item) => {
      const map = normalizeDiscountMap(baseRates, item.discounts);
      const currentRate = map.get(Number(vipLevel));
      return {
        key: item.roomTypeId ?? item.room_type_id ?? item.id,
        roomName: item.roomName ?? item.room_name ?? `房型 ${item.roomTypeId}`,
        currentRate,
        map,
      };
    });
  }, [pricing, user?.vipLevel]);

  const walletBalanceRaw = wallet?.balance != null ? Number(wallet.balance) : 0;
  const walletBalance = Number.isNaN(walletBalanceRaw) ? 0 : walletBalanceRaw;
  const walletBalanceDisplay = walletBalance.toFixed(2);
  const vipLevel = user?.vipLevel ?? 0;

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* 页面标题 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16,
        padding: '32px 40px',
        boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
      }}>
        <Space size={16} align="center">
          <Avatar 
            size={64} 
            icon={<UserOutlined />}
            style={{
              background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
              boxShadow: '0 4px 12px rgba(255, 215, 0, 0.4)',
            }}
          />
          <div>
            <Title level={2} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
              {profile?.username || '用户'}的个人中心
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 15 }}>
              管理您的账户信息、钱包和会员权益
            </Text>
          </div>
        </Space>
      </div>

      {/* 行程提醒 */}
      {upcomingStay && upcomingStay.end && (
        <Alert
          type="info"
          showIcon
          icon={<CalendarOutlined />}
          message={<Text strong style={{ fontSize: 16 }}>行程提醒</Text>}
          description={(
            <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text>入住时间：<Text strong>{upcomingStay.start ? upcomingStay.start.format('YYYY-MM-DD HH:mm') : '待定'}</Text></Text>
              </Space>
              <Space>
                <ThunderboltOutlined style={{ color: '#fa8c16' }} />
                <Text>退房时间：<Text strong style={{ color: '#fa8c16' }}>{upcomingStay.end.format('YYYY-MM-DD HH:mm')}</Text></Text>
              </Space>
              <Text type="secondary">当前状态：{getBookingStatusMeta(upcomingStay.status).label}</Text>
            </Space>
          )}
          style={{
            borderRadius: 12,
            border: '1px solid #91d5ff',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%)',
          }}
        />
      )}

      {/* 概览卡片 */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 16,
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
            }}
          >
            <Statistic
              title={<Space><WalletOutlined style={{ color: '#1890ff' }} /> 钱包余额</Space>}
              value={walletBalanceDisplay}
              prefix="¥"
              valueStyle={{ color: '#1890ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 16,
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
            }}
          >
            <Statistic
              title={<Space><CrownOutlined style={{ color: '#faad14' }} /> 会员等级</Space>}
              value={`VIP${vipLevel}`}
              valueStyle={{ color: '#faad14', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 16,
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
            }}
          >
            <Statistic
              title={<Space><RiseOutlined style={{ color: '#52c41a' }} /> 年度消费</Space>}
              value={profile?.yearlyConsumption || 0}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 16,
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
            }}
          >
            <Statistic
              title={<Space><CalendarOutlined style={{ color: '#722ed1' }} /> 订单总数</Space>}
              value={orderSnapshot.length}
              valueStyle={{ color: '#722ed1', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* 基本信息 */}
        <Card 
          title={<Space><UserOutlined /> 基本信息</Space>}
          loading={loadingProfile}
          style={{
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          headStyle={{ borderBottom: '2px solid #f0f0f0' }}
        >
          <Form 
            layout="vertical" 
            form={profileForm} 
            onFinish={onProfileSubmit} 
            initialValues={{ username: profile?.username, phone: profile?.phone, email: profile?.email }}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item 
                  label="用户名" 
                  name="username" 
                  rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少 3 个字符' }]}
                >
                  <Input 
                    prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                    placeholder="请输入用户名" 
                    allowClear 
                    size="large"
                    style={{ borderRadius: 10 }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item 
                  label="联系电话" 
                  name="phone" 
                  rules={[
                    { required: true, message: '请输入联系电话' },
                    { 
                      pattern: /^(1[3-9]\d{9}|\+?[1-9]\d{1,14})$/, 
                      message: '请输入正确的手机号（国内11位或国际号码）' 
                    }
                  ]}
                >
                  <Input 
                    prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
                    placeholder="请输入手机号（国内11位或国际号码）" 
                    allowClear 
                    maxLength={20} 
                    size="large"
                    style={{ borderRadius: 10 }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '请输入有效邮箱' }]}>
                  <Input 
                    prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
                    placeholder="可选，填写邮箱" 
                    allowClear 
                    size="large"
                    style={{ borderRadius: 10 }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={updatingProfile}
                size="large"
                style={{
                  borderRadius: 10,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                }}
              >
                保存修改
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* 钱包中心 */}
        <Card 
          title={<Space><WalletOutlined /> 钱包中心</Space>}
          loading={loadingWallet}
          style={{
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          headStyle={{ borderBottom: '2px solid #f0f0f0' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={20}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                borderRadius: 16,
                padding: '28px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                color: '#fff',
                flexWrap: 'wrap',
                boxShadow: '0 8px 24px rgba(24, 144, 255, 0.3)',
              }}
            >
              <Space direction="vertical" size={8}>
                <Space size={8}>
                  <WalletOutlined style={{ fontSize: 24 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>可用余额</Text>
                </Space>
                <Title level={1} style={{ margin: 0, color: '#fff', letterSpacing: 2, fontSize: 48 }}>
                  ¥{walletBalanceDisplay}
                </Title>
              </Space>
              <div
                style={{
                  minWidth: 180,
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: isDarkMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <Space direction="vertical" size={4}>
                  <Space size={6}>
                    <CrownOutlined style={{ fontSize: 18, color: '#ffd700' }} />
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>当前会员等级</Text>
                  </Space>
                  <Title level={2} style={{ margin: 0, color: '#fff', fontSize: 32 }}>VIP{vipLevel}</Title>
                </Space>
              </div>
            </div>
            
            <Divider style={{ margin: '8px 0' }} />
            
            <Form 
              layout="vertical" 
              form={rechargeForm} 
              onFinish={onRechargeSubmit} 
              initialValues={{ channel: 'ONLINE' }}
            >
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="充值金额" name="amount" rules={[{ required: true, message: '请输入金额' }]}>
                    <InputNumber 
                      min={1} 
                      precision={2} 
                      style={{ width: '100%', borderRadius: 10 }} 
                      prefix={<DollarOutlined />}
                      size="large"
                      placeholder="请输入充值金额"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="充值渠道" name="channel">
                    <Radio.Group size="large" style={{ width: '100%' }}>
                      <Radio.Button value="ONLINE" style={{ flex: 1, textAlign: 'center' }}>在线支付</Radio.Button>
                      <Radio.Button value="MANUAL" style={{ flex: 1, textAlign: 'center' }}>前台</Radio.Button>
                      <Radio.Button value="TRANSFER" style={{ flex: 1, textAlign: 'center' }}>转账</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="凭证号码" name="referenceNo">
                    <Input 
                      placeholder="可选" 
                      style={{ width: '100%', borderRadius: 10 }} 
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="备注信息" name="remark">
                    <Input.TextArea 
                      placeholder="可选" 
                      rows={3}
                      style={{ borderRadius: 10 }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={recharging}
                  size="large"
                  icon={<ThunderboltOutlined />}
                  style={{
                    borderRadius: 10,
                    fontWeight: 600,
                    height: 48,
                    fontSize: 16,
                    boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                  }}
                >
                  立即充值
                </Button>
              </Form.Item>
            </Form>
          </Space>
        </Card>

        {/* 会员优惠策略 */}
        <Card 
          title={<Space><GiftOutlined /> 会员优惠策略</Space>}
          extra={
            <Button 
              type="primary" 
              loading={checkingVip} 
              onClick={handleCheckVipUpgrade}
              icon={<SafetyCertificateOutlined />}
              style={{
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              检查VIP升级
            </Button>
          }
          loading={loadingPricing}
          style={{
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          headStyle={{ borderBottom: '2px solid #f0f0f0' }}
        >
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            {profile?.yearlyConsumption != null && (
              <Alert
                message={
                  <Space>
                    <RiseOutlined />
                    <Text strong>本年度累计消费：</Text>
                    <Text strong style={{ color: '#1890ff', fontSize: 18 }}>
                      ¥{Number(profile.yearlyConsumption || 0).toFixed(2)}
                    </Text>
                  </Space>
                }
                type="success"
                style={{
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
                  border: '1px solid #b7eb8f',
                }}
              />
            )}
            
            <Row gutter={[16, 16]}>
              {levelDescriptors.map((level) => (
                <Col xs={24} sm={12} md={8} lg={4} key={level.level}>
                  <Badge.Ribbon 
                    text={level.level === vipLevel ? '当前等级' : `目标VIP${level.level}`} 
                    color={level.level === vipLevel ? '#fa8c16' : '#1890ff'}
                  >
                    <Card
                      hoverable
                      style={{
                        borderRadius: 16,
                        border: level.level === vipLevel ? '2px solid #fa8c16' : '1px solid #e8e8e8',
                        boxShadow: level.level === vipLevel 
                          ? '0 4px 16px rgba(250, 140, 22, 0.25)' 
                          : '0 2px 8px rgba(0, 0, 0, 0.06)',
                        transition: 'all 0.3s ease',
                        background: level.level === vipLevel 
                          ? 'linear-gradient(135deg, #fff7e6 0%, #ffffff 100%)' 
                          : '#fff',
                      }}
                      bodyStyle={{ padding: '20px' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-6px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = level.level === vipLevel 
                          ? '0 4px 16px rgba(250, 140, 22, 0.25)' 
                          : '0 2px 8px rgba(0, 0, 0, 0.06)';
                      }}
                    >
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <div style={{ textAlign: 'center' }}>
                          <CrownOutlined style={{ 
                            fontSize: 32, 
                            color: level.level === vipLevel ? '#fa8c16' : '#1890ff' 
                          }} />
                          <Title level={4} style={{ margin: '8px 0 0', color: level.level === vipLevel ? '#fa8c16' : '#1890ff' }}>
                            {level.name}
                          </Title>
                        </div>
                        
                        <Progress
                          type="circle"
                          percent={level.progressPercent}
                          size={120}
                          strokeColor={{
                            '0%': level.level === vipLevel ? '#fa8c16' : '#1890ff',
                            '100%': level.level === vipLevel ? '#ffc069' : '#69c0ff',
                          }}
                          format={() => (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 24, fontWeight: 700, color: level.level === vipLevel ? '#fa8c16' : '#1890ff' }}>
                                {renderPercentLabel(level.percent)}
                              </div>
                              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>平均折扣</div>
                            </div>
                          )}
                        />
                        
                        <Divider style={{ margin: '8px 0' }} />
                        
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          <div style={{
                            background: level.level === vipLevel ? 'rgba(250, 140, 22, 0.1)' : 'rgba(24, 144, 255, 0.08)',
                            borderRadius: 8,
                            padding: '10px 12px',
                            border: level.level === vipLevel ? '1px solid rgba(250, 140, 22, 0.3)' : '1px solid rgba(24, 144, 255, 0.16)',
                          }}>
                            <Space size={4}>
                              <CalendarOutlined style={{ color: level.level === vipLevel ? '#fa8c16' : '#1890ff' }} />
                              <Text strong style={{ fontSize: 14 }}>
                                退房延长至次日 {String((level.checkoutHour ?? 12)).padStart(2, '0')}:00
                              </Text>
                            </Space>
                          </div>
                          {level.description && (
                            <div style={{
                              background: isDarkMode ? '#262626' : '#f5f5f5',
                              borderRadius: 8,
                              padding: '10px 12px',
                            }}>
                              <Text style={{ fontSize: 13, color: '#595959' }}>
                                {level.description}
                              </Text>
                            </div>
                          )}
                        </Space>
                      </Space>
                    </Card>
                  </Badge.Ribbon>
                </Col>
              ))}
            </Row>
            
            <Divider style={{ margin: '12px 0' }} />
            
            <div style={{
              background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #e8e8e8',
            }}>
              <Title level={5} style={{ margin: '0 0 16px 0' }}>
                <Space><ThunderboltOutlined style={{ color: '#fa8c16' }} /> 房型折扣 · 各等级一览</Space>
              </Title>
              <Table
                rowKey="key"
                dataSource={roomRows}
                pagination={false}
                size="middle"
                bordered
                style={{
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
                columns={[
                  { 
                    title: <Space><HomeOutlined /> 房型</Space>, 
                    dataIndex: 'roomName', 
                    key: 'roomName',
                    render: (text) => <Text strong style={{ fontSize: 14 }}>{text}</Text>
                  },
                  {
                    title: <Space><StarFilled style={{ color: '#fa8c16' }} /> 我的等级价格</Space>,
                    dataIndex: 'currentRate',
                    key: 'currentRate',
                    render: (value) => value != null ? (
                      <Tag 
                        color="volcano" 
                        icon={<CrownOutlined />}
                        style={{ 
                          fontSize: 13, 
                          padding: '4px 12px', 
                          borderRadius: 8,
                          fontWeight: 600,
                        }}
                      >
                        VIP{vipLevel}：{formatPercentValue(value * 100)}
                      </Tag>
                    ) : <Tag color="default">暂未定义</Tag>
                  },
                  {
                    title: <Space><AppstoreOutlined /> 全部等级</Space>,
                    key: 'map',
                    render: (_, record) => (
                      <Space size={[6, 6]} wrap>
                        {Array.from(record.map.entries()).map(([lvl, rate]) => (
                          <Tag 
                            key={lvl} 
                            color={Number(lvl) === vipLevel ? 'volcano' : 'blue'}
                            icon={Number(lvl) === vipLevel ? <CrownOutlined /> : null}
                            style={{ 
                              fontSize: 12, 
                              padding: '2px 10px', 
                              borderRadius: 6,
                              fontWeight: Number(lvl) === vipLevel ? 600 : 400,
                            }}
                          >
                            VIP{lvl}：{formatPercentValue(toRateNumber(rate, 1) * 100)}
                          </Tag>
                        ))}
                      </Space>
                    )
                  }
                ]}
              />
            </div>
          </Space>
        </Card>
      </Space>
    </Space>
  );
}
