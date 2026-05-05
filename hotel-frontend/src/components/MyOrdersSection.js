import React from 'react';
import { Typography, Table, Tag, Space, Button, message, InputNumber, Form, Card, Row, Col, Statistic, Badge, Tooltip, Empty, theme } from 'antd';
import { CalendarOutlined, DollarOutlined, HomeOutlined, UserOutlined, PhoneOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBookingsByUser, cancelBooking, getMyProfile } from '../services/api';
import { getBookingStatusMeta, getPaymentStatusLabel, getPaymentMethodLabel } from '../constants/booking';

const { Title, Text } = Typography;

export default function MyOrdersSection({
  showAdminFilter = false,
  embedded = false,
  pageSize = 10,
  forceUserId,
  emptyText = '暂无订单记录',
  onDataLoaded
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const isDarkMode = token.colorBgBase === '#000000' || token.colorBgBase === '#141414';
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState({ items: [], page: 1, size: pageSize, total: 0 });
  const [queryUserId, setQueryUserId] = React.useState(undefined);
  const [profile, setProfile] = React.useState(null);

  const effectiveUserId = React.useMemo(() => {
    if (forceUserId) return forceUserId;
    if (user?.role === 'ADMIN' && queryUserId) return queryUserId;
    return user?.id;
  }, [forceUserId, user, queryUserId]);

  // 加载用户profile以获取年度消费数据
  const loadProfile = React.useCallback(async () => {
    if (!effectiveUserId || effectiveUserId !== user?.id) {
      // 如果是管理员查看其他用户订单，则不显示总消费
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
  }, [effectiveUserId, user?.id]);

  const load = React.useCallback(async (page = 1, size = pageSize) => {
    if (!effectiveUserId) {
      setData((prev) => ({ ...prev, items: [], total: 0, page: 1, size }));
      if (typeof onDataLoaded === 'function') {
        onDataLoaded([]);
      }
      return;
    }
    try {
      setLoading(true);
      const res = await getBookingsByUser(effectiveUserId, { page, size });
      const payload = Array.isArray(res)
        ? { items: res, page, size, total: res.length }
        : (res || { items: [], page, size, total: 0 });
      setData({ ...payload, page, size });
      if (typeof onDataLoaded === 'function') {
        const items = Array.isArray(payload.items) ? payload.items : [];
        onDataLoaded(items);
      }
    } catch (e) {
      const msg = e?.data?.message || '加载失败';
      navigate('/error', {
        state: { status: String(e?.status || 500), title: '加载失败', subTitle: msg, backTo: '/me/profile' },
        replace: true
      });
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, navigate, pageSize, onDataLoaded]);

  React.useEffect(() => {
    load(1, pageSize);
    loadProfile();
  }, [load, loadProfile, pageSize]);

  const onCancel = React.useCallback(async (record) => {
    try {
      await cancelBooking(record.id);
      message.success('已取消预订');
      load(data.page, data.size);
      loadProfile(); // 刷新profile数据以更新总消费
    } catch (e) {
      const msg = e?.data?.message || '取消失败';
      navigate('/error', {
        state: { status: String(e?.status || 500), title: '取消失败', subTitle: msg, backTo: '/me/profile' },
        replace: true
      });
    }
  }, [data.page, data.size, load, loadProfile, navigate]);

  const columns = React.useMemo(() => [
    { 
      title: <Space><FileTextOutlined /> 订单ID</Space>, 
      dataIndex: 'id', 
      key: 'id', 
      width: 100,
      render: (v) => <Text strong style={{ color: '#1890ff' }}>#{v}</Text>
    },
    { 
      title: <Space><HomeOutlined /> 房型ID</Space>, 
      dataIndex: 'roomTypeId', 
      key: 'roomTypeId', 
      width: 100, 
      render: (v, record) => <Tag color="blue">{v ?? record.roomId}</Tag>
    },
    { 
      title: <Space><UserOutlined /> 入住人数</Space>, 
      dataIndex: 'guests', 
      key: 'guests', 
      width: 110, 
      render: (v) => (
        <Tag color="cyan" icon={<UserOutlined />}>
          {v ?? '—'} 人
        </Tag>
      )
    },
    { 
      title: <Space><CalendarOutlined /> 入住时间</Space>, 
      dataIndex: 'startTime', 
      key: 'startTime', 
      width: 160,
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ClockCircleOutlined style={{ color: '#52c41a' }} />
          <Text>{v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'}</Text>
        </div>
      )
    },
    { 
      title: <Space><CalendarOutlined /> 离店时间</Space>, 
      dataIndex: 'endTime', 
      key: 'endTime', 
      width: 160,
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ClockCircleOutlined style={{ color: '#fa8c16' }} />
          <Text>{v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'}</Text>
        </div>
      )
    },
    { 
      title: <Space><DollarOutlined /> 金额</Space>, 
      dataIndex: 'amount', 
      key: 'amount', 
      width: 120,
      render: (v) => (
        <Text strong style={{ color: '#fa541c', fontSize: 16 }}>
          {v != null ? `¥${Number(v).toFixed(2)}` : '-'}
        </Text>
      )
    },
    { 
      title: <Space><UserOutlined /> 联系人</Space>, 
      dataIndex: 'contactName', 
      key: 'contactName', 
      width: 110,
      render: (v) => <Text>{v || '—'}</Text>
    },
    { 
      title: <Space><PhoneOutlined /> 电话</Space>, 
      dataIndex: 'contactPhone', 
      key: 'contactPhone', 
      width: 130,
      render: (v) => <Text copyable={!!v}>{v || '—'}</Text>
    },
    { 
      title: '备注', 
      dataIndex: 'remark', 
      key: 'remark', 
      ellipsis: true, 
      width: 150,
      render: (v) => (
        v ? (
          <Tooltip title={v}>
            <Text type="secondary" ellipsis>{v}</Text>
          </Tooltip>
        ) : '—'
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const meta = getBookingStatusMeta(status);
        const icons = {
          PENDING: <ClockCircleOutlined />,
          CONFIRMED: <CheckCircleOutlined />,
          CANCELLED: <CloseCircleOutlined />,
          CHECKED_IN: <CheckCircleOutlined />,
          CHECKED_OUT: <CheckCircleOutlined />
        };
        return (
          <Tag 
            color={meta.color} 
            icon={icons[status]}
            style={{ 
              fontSize: 13, 
              padding: '4px 12px', 
              borderRadius: 8,
              fontWeight: 600
            }}
          >
            {meta.label}
          </Tag>
        );
      }
    },
    {
      title: '支付',
      key: 'payment',
      width: 130,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Tag color={record.paymentStatus === 'PAID' ? 'success' : 'warning'} style={{ borderRadius: 6 }}>
            {getPaymentStatusLabel(record.paymentStatus)}
          </Tag>
          {record.paymentMethod && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {getPaymentMethodLabel(record.paymentMethod)}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          danger
          disabled={record.status === 'CANCELLED' || record.status === 'CHECKED_OUT'}
          onClick={() => onCancel(record)}
          icon={<CloseCircleOutlined />}
          style={{ borderRadius: 8 }}
        >
          取消订单
        </Button>
      )
    }
  ], [onCancel]);

  const showFilter = showAdminFilter && user?.role === 'ADMIN' && !forceUserId;

  // 计算订单统计
  const orderStats = React.useMemo(() => {
    const items = data.items || [];
    return {
      total: items.length,
      pending: items.filter(item => item.status === 'PENDING').length,
      confirmed: items.filter(item => item.status === 'CONFIRMED').length,
      completed: items.filter(item => item.status === 'CHECKED_OUT').length,
      cancelled: items.filter(item => item.status === 'CANCELLED').length
    };
  }, [data.items]);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {!embedded && (
        <>
          {/* 页面标题 */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 16,
            padding: '32px 40px',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
          }}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div>
                <Title level={2} style={{ margin: '0 0 8px 0', color: '#fff', fontWeight: 700 }}>
                  <Space>
                    <FileTextOutlined />
                    我的订单
                  </Space>
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>
                  查看和管理您的所有预订记录
                </Text>
              </div>
              {showFilter && (
                <Form layout="inline" onFinish={() => load(1, data.size)}>
                  <Form.Item label={<Text style={{ color: '#fff' }}>用户ID</Text>}>
                    <InputNumber
                      min={1}
                      value={queryUserId}
                      onChange={setQueryUserId}
                      placeholder="默认查询当前用户"
                      size="large"
                      style={{ borderRadius: 10, width: 200 }}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Button 
                        type="primary" 
                        htmlType="submit" 
                        icon={<SearchOutlined />}
                        size="large"
                        style={{
                          borderRadius: 10,
                          fontWeight: 600,
                          background: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)',
                          backdropFilter: 'blur(10px)',
                          border: isDarkMode ? '1px solid rgba(0, 0, 0, 0.3)' : '1px solid rgba(255, 255, 255, 0.3)',
                        }}
                      >
                        查询
                      </Button>
                      <Button 
                        onClick={() => { setQueryUserId(undefined); load(1, data.size); }}
                        icon={<ReloadOutlined />}
                        size="large"
                        style={{
                          borderRadius: 10,
                          background: isDarkMode ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)',
                          backdropFilter: 'blur(10px)',
                          border: isDarkMode ? '1px solid rgba(0, 0, 0, 0.25)' : '1px solid rgba(255, 255, 255, 0.25)',
                          color: '#fff',
                        }}
                      >
                        重置
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              )}
            </Space>
          </div>

          {/* 统计卡片 */}
          <Row gutter={[20, 20]}>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card
                hoverable
                style={{
                  borderRadius: 16,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
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
                <Statistic
                  title={<Text style={{ color: '#595959', fontWeight: 600 }}>总订单</Text>}
                  value={orderStats.total}
                  valueStyle={{ color: '#1890ff', fontSize: 32, fontWeight: 700 }}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card
                hoverable
                style={{
                  borderRadius: 16,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
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
                <Statistic
                  title={<Text style={{ color: '#595959', fontWeight: 600 }}>待确认</Text>}
                  value={orderStats.pending}
                  valueStyle={{ color: '#fa8c16', fontSize: 32, fontWeight: 700 }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card
                hoverable
                style={{
                  borderRadius: 16,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
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
                <Statistic
                  title={<Text style={{ color: '#595959', fontWeight: 600 }}>已确认</Text>}
                  value={orderStats.confirmed}
                  valueStyle={{ color: '#52c41a', fontSize: 32, fontWeight: 700 }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card
                hoverable
                style={{
                  borderRadius: 16,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
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
                <Statistic
                  title={<Text style={{ color: '#595959', fontWeight: 600 }}>已完成</Text>}
                  value={orderStats.completed}
                  valueStyle={{ color: '#13c2c2', fontSize: 32, fontWeight: 700 }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card
                hoverable
                style={{
                  borderRadius: 16,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
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
                <Statistic
                  title={<Text style={{ color: '#595959', fontWeight: 600 }}>已取消</Text>}
                  value={orderStats.cancelled}
                  valueStyle={{ color: '#ff4d4f', fontSize: 32, fontWeight: 700 }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card
                hoverable
                style={{
                  borderRadius: 16,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
                  background: 'linear-gradient(135deg, #fa8c16 0%, #faad14 100%)',
                }}
                bodyStyle={{ padding: '24px' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(250, 140, 22, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                }}
              >
                <Statistic
                  title={<Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>年度消费</Text>}
                  value={profile?.yearlyConsumption || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
      
      {embedded && showFilter && (
        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          bodyStyle={{ padding: '20px' }}
        >
          <Form layout="inline" onFinish={() => load(1, data.size)}>
            <Form.Item label="用户ID">
              <InputNumber
                min={1}
                value={queryUserId}
                onChange={setQueryUserId}
                placeholder="默认查询当前用户"
                size="large"
                style={{ borderRadius: 10 }}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<SearchOutlined />}
                  size="large"
                  style={{ borderRadius: 10, fontWeight: 600 }}
                >
                  查询
                </Button>
                <Button 
                  onClick={() => { setQueryUserId(undefined); load(1, data.size); }}
                  icon={<ReloadOutlined />}
                  size="large"
                  style={{ borderRadius: 10 }}
                >
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}
      
      {showFilter && user?.role === 'ADMIN' && !embedded && (
        <Card
          style={{
            borderRadius: 12,
            background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
            border: '1px solid #91d5ff',
          }}
          bodyStyle={{ padding: '16px 24px' }}
        >
          <Space>
            <UserOutlined style={{ color: '#1890ff', fontSize: 16 }} />
            <Text strong>当前查询用户ID：</Text>
            <Text strong style={{ color: '#1890ff', fontSize: 16 }}>{effectiveUserId ?? '—'}</Text>
          </Space>
        </Card>
      )}
      
      {/* 订单表格 */}
      <Card
        style={{
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data.items}
          locale={{ 
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">{emptyText}</Text>}
                style={{ padding: '40px 0' }}
              />
            )
          }}
          columns={columns}
          scroll={{ x: 1600 }}
          pagination={{
            current: data.page,
            pageSize: data.size,
            total: data.total,
            showSizeChanger: true,
            showTotal: (total) => (
              <Text strong style={{ fontSize: 14 }}>
                共 <Text style={{ color: '#1890ff' }}>{total}</Text> 条记录
              </Text>
            ),
            onChange: (p, s) => load(p, s),
            style: { padding: '16px 24px' }
          }}
          rowClassName={(record, index) => {
            return index % 2 === 0 ? 'table-row-even' : 'table-row-odd';
          }}
          style={{
            borderRadius: 16,
          }}
        />
      </Card>
      
      <style jsx>{`
        .table-row-even {
          background: #fafafa;
          transition: all 0.3s ease;
        }
        .table-row-odd {
          background: #ffffff;
          transition: all 0.3s ease;
        }
        .table-row-even:hover,
        .table-row-odd:hover {
          background: #e6f7ff !important;
          transform: scale(1.01);
        }
      `}</style>
    </Space>
  );
}
