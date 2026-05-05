import React from 'react';
import { 
  Card, Table, Button, Tag, Space, Typography, Modal, Input, 
  Form, Select, DatePicker, Row, Col, Statistic, Alert, Descriptions,
  Timeline, Divider, Empty, Tooltip, Badge, message, theme
} from 'antd';
import {
  ClockCircleOutlined, CheckCircleOutlined, HomeOutlined, 
  LogoutOutlined, CloseCircleOutlined, CalendarOutlined,
  PhoneOutlined, UserOutlined, DollarOutlined, FilterOutlined,
  SearchOutlined, ReloadOutlined, EyeOutlined, StopOutlined,
  RollbackOutlined, SafetyCertificateOutlined, BellOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { getBookingsByUser, cancelBooking, requestRefund, getRooms, getMyProfile } from '../services/api';
import { BOOKING_STATUS_META, getPaymentMethodLabel, getPaymentStatusLabel } from '../constants/booking';
import dayjs from 'dayjs';
import { DEFAULT_CHECKIN_HOUR, computeStayNights } from '../utils/stayRange';

const { Text, Title } = Typography;

// 辅助函数：获取订单状态元数据
const getBookingStatusMeta = (status) => {
  return BOOKING_STATUS_META[status] || { label: status, color: 'default', icon: null };
};

// 添加CSS动画样式
const style = document.createElement('style');
style.innerHTML = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }
  
  .table-row-light {
    background: #fafafa;
  }
  
  .table-row-light:hover {
    background: #f0f0f0 !important;
  }
  
  .table-row-dark:hover {
    background: #f5f5f5 !important;
  }
  
  .ant-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
  }
  
  .ant-table-cell {
    transition: all 0.3s ease;
  }
  
  .ant-btn {
    transition: all 0.3s ease;
  }
  
  .ant-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
`;
document.head.appendChild(style);

export default function MyOrders() {
  const { user } = useAuth();
  const { token } = theme.useToken();
  const isDarkMode = token.colorBgBase === '#000000' || token.colorBgBase === '#141414';
  const [loading, setLoading] = React.useState(false);
  const [orders, setOrders] = React.useState({ items: [], page: 1, size: 10, total: 0 });
  const [rooms, setRooms] = React.useState([]);
  const [profile, setProfile] = React.useState(null);
  const [selectedOrder, setSelectedOrder] = React.useState(null);
  const [timelineVisible, setTimelineVisible] = React.useState(false);
  const [filters, setFilters] = React.useState({});

  // 加载用户profile以获取年度消费数据
  const loadProfile = React.useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    try {
      const res = await getMyProfile();
      setProfile(res);
    } catch (e) {
      console.error('加载用户资料失败:', e);
      setProfile(null);
    }
  }, [user?.id]);

  const load = React.useCallback(async (page = 1, size = 10) => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [ordersRes, roomsRes] = await Promise.all([
        getBookingsByUser(user.id, { page, size }),
        getRooms()
      ]);
      
      const payload = Array.isArray(ordersRes)
        ? { items: ordersRes, page, size, total: ordersRes.length }
        : (ordersRes || { items: [], page, size, total: 0 });
      
      setOrders(payload);
      setRooms(Array.isArray(roomsRes) ? roomsRes : []);
    } catch (e) {
      message.error(e?.data?.message || '加载订单失败');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    load();
    loadProfile();
  }, [load, loadProfile]);

  const handleCancel = React.useCallback(async (record) => {
    Modal.confirm({
      title: '确认取消订单',
      content: `确定要取消订单 #${record.id} 吗？此操作不可撤销。`,
      okText: '确认取消',
      cancelText: '返回',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await cancelBooking(record.id);
          message.success('订单已取消');
          load(orders.page, orders.size);
          loadProfile(); // 刷新profile数据以更新年度消费
        } catch (e) {
          message.error(e?.data?.message || '取消订单失败');
        }
      }
    });
  }, [orders.page, orders.size, load, loadProfile]);

  const handleRequestRefund = React.useCallback(async (record) => {
    let refundReason = '';
    
    // 检查是否已退房
    const hasCheckedOut = record.status === 'CHECKED_OUT';
    
    Modal.confirm({
      title: hasCheckedOut ? '申请退款' : '申请退房',
      content: (
        <div>
          <p>订单 #{record.id} 已支付，确定要{hasCheckedOut ? '申请退款' : '申请退房'}吗？</p>
          {!hasCheckedOut && (
            <p style={{ color: '#ff4d4f', fontSize: 12 }}>
              注意: 退房后将退回相应金额，需要管理员审批。
            </p>
          )}
          <textarea 
            placeholder="请简要说明原因（可选）"
            style={{ width: '100%', minHeight: 80, marginTop: 8, padding: 8 }}
            onChange={(e) => { refundReason = e.target.value; }}
          />
        </div>
      ),
      okText: '提交申请',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await requestRefund(record.id, refundReason);
          message.success('申请已提交，等待管理员审核');
          load(orders.page, orders.size);
          loadProfile(); // 刷新profile数据以更新年度消费
        } catch (e) {
          message.error(e?.data?.message || '申请失败');
        }
      }
    });
  }, [orders.page, orders.size, load, loadProfile]);

  const showTimeline = React.useCallback((record) => {
    setSelectedOrder(record);
    setTimelineVisible(true);
  }, []);

  // 筛选后的订单列表
  const filteredOrders = React.useMemo(() => {
    let list = [...(orders.items || [])];
    
    // 按状态筛选
    if (filters.status) {
      list = list.filter(o => o.status === filters.status);
    }
    
    // 按房型ID筛选
    if (filters.roomTypeId) {
      list = list.filter(o => o.roomTypeId === filters.roomTypeId);
    }
    
    // 按联系电话搜索
    if (filters.contactPhone) {
      const phone = filters.contactPhone.toLowerCase();
      list = list.filter(o => o.contactPhone && o.contactPhone.toLowerCase().includes(phone));
    }
    
    // 按时间范围筛选
    if (filters.start && filters.end) {
      const start = dayjs(filters.start);
      const end = dayjs(filters.end);
      list = list.filter(o => {
        const orderStart = dayjs(o.startTime);
        return orderStart.isAfter(start) && orderStart.isBefore(end);
      });
    }
    
    // 按创建时间排序(从新到旧)
    list.sort((a, b) => {
      const timeA = a.createdAt ? dayjs(a.createdAt).valueOf() : 0;
      const timeB = b.createdAt ? dayjs(b.createdAt).valueOf() : 0;
      return timeB - timeA;
    });
    
    return list;
  }, [orders.items, filters]);

  // 统计数据
  const statistics = React.useMemo(() => {
    const items = orders.items || [];
    return {
      total: items.length,
      pending: items.filter(o => ['PENDING', 'CONFIRMED', 'REFUND_REQUESTED'].includes(o.status)).length,
      checkedIn: items.filter(o => o.status === 'CHECKED_IN').length,
      completed: items.filter(o => o.status === 'CHECKED_OUT').length,
      cancelled: items.filter(o => ['CANCELLED', 'REFUNDED'].includes(o.status)).length,
    };
  }, [orders.items]);

  // 即将入住的订单
  const upcomingOrders = React.useMemo(() => {
    const now = dayjs();
    return (orders.items || [])
      .filter(o => ['CONFIRMED', 'PENDING'].includes(o.status))
      .filter(o => {
        const start = dayjs(o.startTime);
        return start.isAfter(now) && start.diff(now, 'day') <= 7;
      })
      .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf());
  }, [orders.items]);

  const columns = [
    {
      title: () => (
        <Space size={4}>
          <CalendarOutlined style={{ color: '#722ed1' }} />
          <span>编号</span>
        </Space>
      ),
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id) => (
        <Tooltip title="点击复制订单号">
          <Tag 
            color="purple" 
            style={{ 
              fontWeight: 'bold',
              cursor: 'pointer',
              borderRadius: 6,
              fontSize: 12
            }}
            onClick={() => {
              navigator.clipboard.writeText(id);
              message.success('订单号已复制');
            }}
          >
            #{id}
          </Tag>
        </Tooltip>
      )
    },
    {
      title: () => (
        <Space size={4}>
          <HomeOutlined style={{ color: '#1890ff' }} />
          <span>房型</span>
        </Space>
      ),
      key: 'room',
      width: 110,
      render: (_, record) => {
        const room = rooms.find(r => r.id === record.roomTypeId || r.id === record.roomId);
        return (
          <Tooltip title={`${room?.type || '—'} · ${room?.bedType || '—'}`}>
            <Tag color="blue" icon={<HomeOutlined />} style={{ borderRadius: 6, fontSize: 12 }}>
              {room?.name || '未知'}
            </Tag>
          </Tooltip>
        );
      }
    },
    {
      title: () => (
        <Space size={4}>
          <CalendarOutlined style={{ color: '#faad14' }} />
          <span>入住时间</span>
        </Space>
      ),
      key: 'time',
      width: 150,
      render: (_, record) => {
        const start = dayjs(record.startTime);
        const end = dayjs(record.endTime);
        const nights = computeStayNights([record.startTime, record.endTime], DEFAULT_CHECKIN_HOUR);
        return (
          <Tooltip title={`${start.format('YYYY-MM-DD HH:mm')} 至 ${end.format('YYYY-MM-DD HH:mm')}`}>
            <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
              <Text strong style={{ fontSize: 12 }}>{start.format('MM-DD HH:mm')}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {nights}晚
              </Text>
            </Space>
          </Tooltip>
        );
      }
    },
    {
      title: () => (
        <Space size={4}>
          <UserOutlined style={{ color: '#13c2c2' }} />
          <span>人数</span>
        </Space>
      ),
      dataIndex: 'guests',
      key: 'guests',
      width: 60,
      align: 'center',
      render: (guests) => (
        <Text strong style={{ color: '#13c2c2' }}>{guests || 1}</Text>
      )
    },
    {
      title: () => (
        <Space size={4}>
          <DollarOutlined style={{ color: '#ff4d4f' }} />
          <span>金额</span>
        </Space>
      ),
      dataIndex: 'amount',
      key: 'amount',
      width: 90,
      render: (amount) => (
        <Text strong style={{ color: '#ff4d4f', fontSize: 14 }}>
          ¥{Number(amount || 0).toFixed(0)}
        </Text>
      )
    },
    {
      title: () => (
        <Space size={4}>
          <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
          <span>支付</span>
        </Space>
      ),
      key: 'payment',
      width: 80,
      render: (_, record) => (
        <Tooltip title={getPaymentMethodLabel(record.paymentMethod)}>
          <Tag 
            color={record.paymentStatus === 'PAID' ? 'success' : 'warning'} 
            style={{ fontSize: 11, borderRadius: 6 }}
            icon={record.paymentStatus === 'PAID' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          >
            {getPaymentStatusLabel(record.paymentStatus)}
          </Tag>
        </Tooltip>
      )
    },
    {
      title: () => (
        <Space size={4}>
          <BellOutlined style={{ color: '#eb2f96' }} />
          <span>状态</span>
        </Space>
      ),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const meta = getBookingStatusMeta(status);
        return (
          <Tag color={meta.color} icon={meta.icon} style={{ borderRadius: 6, fontSize: 11, padding: '2px 8px' }}>
            {meta.label}
          </Tag>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => {
        const isPaid = record.paymentStatus === 'PAID';
        const status = record.status;
        
        const canCancel = ['PENDING', 'PENDING_CONFIRMATION', 'PENDING_PAYMENT', 'CONFIRMED'].includes(status) && !isPaid;
        const canRequestRefund = isPaid && 
          !['REFUND_REQUESTED', 'REFUNDED', 'CANCELLED'].includes(status);
        const isRefundRequested = status === 'REFUND_REQUESTED';
        
        return (
          <Space size={8} wrap>
            <Button 
              size="small" 
              type="link"
              icon={<EyeOutlined />}
              onClick={() => showTimeline(record)}
            >
              查看详情
            </Button>
            {canCancel && (
              <Button
                size="small"
                type="link"
                danger
                icon={<StopOutlined />}
                onClick={() => handleCancel(record)}
              >
                取消订单
              </Button>
            )}
            {canRequestRefund && (
              <Button
                size="small"
                type="link"
                danger
                icon={<RollbackOutlined />}
                onClick={() => handleRequestRefund(record)}
              >
                {status === 'CHECKED_OUT' ? '申请退款' : '申请退房'}
              </Button>
            )}
            {isRefundRequested && (
              <Tag color="orange" icon={<ClockCircleOutlined />} style={{ borderRadius: 6, fontSize: 11 }}>
                审核中
              </Tag>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      {/* 紫色渐变标题区域 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '60px 24px 100px',
        marginBottom: -76,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: isDarkMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
          animation: 'float 6s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute',
          bottom: -100,
          left: -100,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: isDarkMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
          animation: 'float 8s ease-in-out infinite reverse'
        }} />
        
        <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <Space direction="vertical" size={12} style={{ color: 'white' }}>
            <Title level={1} style={{ margin: 0, color: 'white', fontSize: 42, fontWeight: 700 }}>
              <CalendarOutlined style={{ marginRight: 16 }} />
              我的订单
            </Title>
            <Text style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.9)' }}>
              查看和管理您的所有酒店预订记录
            </Text>
          </Space>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', maxWidth: 1400, margin: '0 auto' }}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card 
                hoverable
                style={{ 
                  borderRadius: 16, 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  border: 'none'
                }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 14, color: '#8c8c8c' }}>全部订单</Text>}
                  value={statistics.total}
                  prefix={<CalendarOutlined style={{ color: '#722ed1', fontSize: 24 }} />}
                  valueStyle={{ color: '#722ed1', fontSize: 28, fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card 
                hoverable
                style={{ 
                  borderRadius: 16, 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  border: 'none'
                }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 14, color: '#8c8c8c' }}>待入住</Text>}
                  value={statistics.pending}
                  prefix={<ClockCircleOutlined style={{ color: '#faad14', fontSize: 24 }} />}
                  valueStyle={{ color: '#faad14', fontSize: 28, fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card 
                hoverable
                style={{ 
                  borderRadius: 16, 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  border: 'none'
                }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 14, color: '#8c8c8c' }}>已入住</Text>}
                  value={statistics.checkedIn}
                  prefix={<HomeOutlined style={{ color: '#1890ff', fontSize: 24 }} />}
                  valueStyle={{ color: '#1890ff', fontSize: 28, fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card 
                hoverable
                style={{ 
                  borderRadius: 16, 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  border: 'none'
                }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 14, color: '#8c8c8c' }}>已完成</Text>}
                  value={statistics.completed}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />}
                  valueStyle={{ color: '#52c41a', fontSize: 28, fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card 
                hoverable
                style={{ 
                  borderRadius: 16, 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  border: 'none'
                }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 14, color: '#8c8c8c' }}>已取消</Text>}
                  value={statistics.cancelled}
                  prefix={<CloseCircleOutlined style={{ color: '#999', fontSize: 24 }} />}
                  valueStyle={{ color: '#999', fontSize: 28, fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card 
                hoverable
                style={{ 
                  borderRadius: 16, 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>年度消费</Text>}
                  value={profile?.yearlyConsumption || 0}
                  precision={2}
                  prefix={<DollarOutlined style={{ color: 'white', fontSize: 24 }} />}
                  valueStyle={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}
                  suffix={<Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>元</Text>}
                />
              </Card>
            </Col>
          </Row>

          {/* 即将入住提醒 */}
          {upcomingOrders.length > 0 && (
            <Card
              style={{
                borderRadius: 16,
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                background: 'linear-gradient(135deg, #fff5e6 0%, #ffe7ba 100%)'
              }}
            >
              <Alert
                message={
                  <Space>
                    <BellOutlined style={{ fontSize: 18 }} />
                    <Text strong style={{ fontSize: 16 }}>即将入住</Text>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
                    {upcomingOrders.slice(0, 3).map(order => {
                      const room = rooms.find(r => r.id === order.roomTypeId || r.id === order.roomId);
                      const start = dayjs(order.startTime);
                      const daysLeft = start.diff(dayjs(), 'day');
                      return (
                        <Card
                          key={order.id}
                          size="small"
                          style={{
                            borderRadius: 10,
                            border: '1px solid #ffd591',
                            background: isDarkMode ? 'rgba(20, 20, 20, 0.8)' : 'rgba(255, 255, 255, 0.8)'
                          }}
                        >
                          <Space split="·" size={16}>
                            <Tag color="blue" icon={<HomeOutlined />}>
                              {room?.name || '未知房型'}
                            </Tag>
                            <Text>
                              <CalendarOutlined style={{ marginRight: 6 }} />
                              {start.format('MM月DD日 HH:mm')}
                            </Text>
                            <Tag color={daysLeft === 0 ? 'error' : 'warning'} style={{ fontWeight: 'bold' }}>
                              {daysLeft === 0 ? '今天入住' : `${daysLeft}天后入住`}
                            </Tag>
                          </Space>
                        </Card>
                      );
                    })}
                  </Space>
                }
                type="warning"
                showIcon
                icon={<ClockCircleOutlined style={{ fontSize: 24 }} />}
                style={{ border: 'none', background: 'transparent' }}
              />
            </Card>
          )}

          {/* 订单表格 */}
          <Card 
            title={
              <Space>
                <FilterOutlined style={{ fontSize: 18, color: '#722ed1' }} />
                <Text strong style={{ fontSize: 18 }}>订单列表</Text>
                <Badge 
                  count={filteredOrders.length} 
                  showZero 
                  style={{ backgroundColor: '#722ed1' }} 
                />
              </Space>
            }
            style={{
              borderRadius: 16,
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}
            bodyStyle={{ padding: '24px' }}
          >
            {/* 筛选表单 */}
            <Form
              layout="inline"
              style={{ 
                marginBottom: 20, 
                padding: 20, 
                background: 'linear-gradient(135deg, #f5f7fa 0%, #e8eaf6 100%)',
                borderRadius: 12
              }}
              onFinish={(values) => {
                const newFilters = {};
                if (values.status) newFilters.status = values.status;
                if (values.roomTypeId) newFilters.roomTypeId = values.roomTypeId;
                if (values.contactPhone) newFilters.contactPhone = values.contactPhone;
                if (values.range?.[0] && values.range?.[1]) {
                  newFilters.start = values.range[0].toISOString();
                  newFilters.end = values.range[1].toISOString();
                }
                setFilters(newFilters);
              }}
            >
              <Form.Item label="订单状态" name="status">
                <Select
                  allowClear
                  placeholder="选择状态"
                  size="large"
                  style={{ width: 160, borderRadius: 10 }}
                  options={Object.entries(BOOKING_STATUS_META).map(([value, meta]) => ({
                    label: meta.label,
                    value
                  }))}
                />
              </Form.Item>
              <Form.Item label="房型" name="roomTypeId">
                <Select
                  allowClear
                  placeholder="选择房型"
                  size="large"
                  style={{ width: 160, borderRadius: 10 }}
                  options={rooms.map(r => ({ label: r.name, value: r.id }))}
                />
              </Form.Item>
              <Form.Item label="联系电话" name="contactPhone">
                <Input 
                  placeholder="输入电话号码" 
                  allowClear 
                  size="large"
                  prefix={<PhoneOutlined />}
                  style={{ width: 180, borderRadius: 10 }} 
                />
              </Form.Item>
              <Form.Item label="入住时间" name="range">
                <DatePicker.RangePicker showTime size="large" style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    size="large"
                    icon={<SearchOutlined />}
                    style={{ 
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none'
                    }}
                  >
                    查询
                  </Button>
                  <Button 
                    onClick={() => setFilters({})} 
                    size="large"
                    icon={<ReloadOutlined />}
                    style={{ borderRadius: 10 }}
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>

            <Table
              rowKey="id"
              loading={loading}
              dataSource={filteredOrders}
              columns={columns}
              rowClassName={(record, index) => index % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
              pagination={{
                current: orders.page,
                pageSize: orders.size,
                total: filteredOrders.length,
                showSizeChanger: true,
                showTotal: (total) => (
                  <Text strong style={{ fontSize: 14 }}>
                    共 <Text style={{ color: '#722ed1', fontSize: 16 }}>{total}</Text> 条订单
                  </Text>
                ),
                onChange: (p, s) => {
                  setOrders(prev => ({ ...prev, page: p, size: s }));
                }
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <Space direction="vertical" size={12}>
                        <Text type="secondary" style={{ fontSize: 16 }}>暂无订单记录</Text>
                        <Text type="secondary">快去预订您心仪的房间吧！</Text>
                      </Space>
                    }
                  >
                    <Button 
                      type="primary" 
                      size="large"
                      icon={<HomeOutlined />}
                      onClick={() => window.location.href = '/rooms'}
                      style={{
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        marginTop: 16
                      }}
                    >
                      去预订房间
                    </Button>
                  </Empty>
                )
              }}
            />
          </Card>
      </Space>

      {/* 订单详情和时间轴 Modal */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#722ed1', fontSize: 20 }} />
            <Text strong style={{ fontSize: 18 }}>订单详情 #{selectedOrder?.id || ''}</Text>
          </Space>
        }
        open={timelineVisible}
        onCancel={() => setTimelineVisible(false)}
        footer={[
          <Button 
            key="close" 
            size="large"
            onClick={() => setTimelineVisible(false)}
            style={{ borderRadius: 10 }}
          >
            关闭
          </Button>
        ]}
        width={800}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {selectedOrder && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* 基本信息 */}
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="订单编号" span={2}>
                <Text strong>#{selectedOrder.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {selectedOrder.createdAt ? dayjs(selectedOrder.createdAt).format('YYYY-MM-DD HH:mm:ss') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="房型ID">
                {selectedOrder.roomTypeId || selectedOrder.roomId}
              </Descriptions.Item>
              <Descriptions.Item label="房间ID">
                {selectedOrder.roomId || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="入住时间" span={2}>
                {dayjs(selectedOrder.startTime).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="退房时间" span={2}>
                {dayjs(selectedOrder.endTime).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="入住人数">
                {selectedOrder.guests || 1} 人
              </Descriptions.Item>
              <Descriptions.Item label="订单金额">
                <Text strong style={{ color: '#ff4d4f' }}>
                  ¥{Number(selectedOrder.amount || 0).toFixed(2)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="联系人">
                {selectedOrder.contactName || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {selectedOrder.contactPhone || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="支付方式">
                {getPaymentMethodLabel(selectedOrder.paymentMethod)}
              </Descriptions.Item>
              <Descriptions.Item label="支付状态">
                <Tag color={selectedOrder.paymentStatus === 'PAID' ? 'success' : 'default'}>
                  {getPaymentStatusLabel(selectedOrder.paymentStatus)}
                </Tag>
              </Descriptions.Item>
              {selectedOrder.remark && (
                <Descriptions.Item label="备注" span={2}>
                  {selectedOrder.remark}
                </Descriptions.Item>
              )}
              {selectedOrder.status === 'REFUND_REQUESTED' && (
                <>
                  <Descriptions.Item label="退房/退款申请时间" span={2}>
                    {selectedOrder.refundRequestedAt ? dayjs(selectedOrder.refundRequestedAt).format('YYYY-MM-DD HH:mm:ss') : '—'}
                  </Descriptions.Item>
                  {selectedOrder.refundReason && (
                    <Descriptions.Item label="申请原因" span={2}>
                      {selectedOrder.refundReason}
                    </Descriptions.Item>
                  )}
                </>
              )}
              {selectedOrder.status === 'REFUNDED' && (
                <>
                  <Descriptions.Item label="退款完成时间" span={2}>
                    {selectedOrder.refundApprovedAt ? dayjs(selectedOrder.refundApprovedAt).format('YYYY-MM-DD HH:mm:ss') : '—'}
                  </Descriptions.Item>
                  {selectedOrder.refundReason && (
                    <Descriptions.Item label="退款原因" span={2}>
                      {selectedOrder.refundReason}
                    </Descriptions.Item>
                  )}
                </>
              )}
            </Descriptions>

            <Divider>订单状态时间轴</Divider>

            {/* 订单时间轴 */}
            <Timeline
              items={[
                {
                  color: 'green',
                  dot: <CheckCircleOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text strong>订单创建</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {selectedOrder.createdAt ? dayjs(selectedOrder.createdAt).format('YYYY-MM-DD HH:mm:ss') : '—'}
                      </Text>
                    </Space>
                  )
                },
                selectedOrder.status === 'CONFIRMED' || selectedOrder.status === 'CHECKED_IN' || selectedOrder.status === 'CHECKED_OUT' ? {
                  color: 'blue',
                  dot: <CheckCircleOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text strong>订单确认</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>酒店已确认您的预订</Text>
                    </Space>
                  )
                } : {
                  color: 'gray',
                  dot: <ClockCircleOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text>等待确认</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>酒店确认中</Text>
                    </Space>
                  )
                },
                selectedOrder.status === 'CHECKED_IN' || selectedOrder.status === 'CHECKED_OUT' ? {
                  color: 'blue',
                  dot: <HomeOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text strong>已入住</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(selectedOrder.startTime).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </Space>
                  )
                } : dayjs(selectedOrder.startTime).isBefore(dayjs()) ? {
                  color: 'orange',
                  dot: <ClockCircleOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text type="warning">待办理入住</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>入住时间已到</Text>
                    </Space>
                  )
                } : {
                  color: 'gray',
                  dot: <ClockCircleOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text>待入住</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        预计 {dayjs(selectedOrder.startTime).format('MM-DD HH:mm')}
                      </Text>
                    </Space>
                  )
                },
                selectedOrder.status === 'CHECKED_OUT' ? {
                  color: 'green',
                  dot: <LogoutOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text strong>已退房</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(selectedOrder.endTime).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </Space>
                  )
                } : selectedOrder.status === 'CANCELLED' ? {
                  color: 'red',
                  dot: <CloseCircleOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text type="danger">已取消</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>订单已取消</Text>
                    </Space>
                  )
                } : selectedOrder.status === 'REFUND_REQUESTED' ? {
                  color: 'orange',
                  dot: <ClockCircleOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text type="warning">退房/退款申请中</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {selectedOrder.refundRequestedAt ? dayjs(selectedOrder.refundRequestedAt).format('YYYY-MM-DD HH:mm:ss') : '等待管理员审核'}
                      </Text>
                    </Space>
                  )
                } : selectedOrder.status === 'REFUNDED' ? {
                  color: 'purple',
                  dot: <CheckCircleOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text strong style={{ color: '#722ed1' }}>退款完成</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {selectedOrder.refundApprovedAt ? dayjs(selectedOrder.refundApprovedAt).format('YYYY-MM-DD HH:mm:ss') : '退款已到账'}
                      </Text>
                    </Space>
                  )
                } : {
                  color: 'gray',
                  dot: <ClockCircleOutlined />,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text>待退房</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        预计 {dayjs(selectedOrder.endTime).format('MM-DD HH:mm')}
                      </Text>
                    </Space>
                  )
                }
              ]}
            />
          </Space>
        )}
      </Modal>
      </div>
    </div>
  );
}
