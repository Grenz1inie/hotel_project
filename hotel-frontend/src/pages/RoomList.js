import React from 'react';
import { Card, Row, Col, Tag, Typography, Space, Input, Empty, Skeleton, Button, Tooltip, Badge, Divider, Progress, theme } from 'antd';
import { 
  PlayCircleOutlined, 
  SearchOutlined, 
  UserOutlined, 
  ExpandOutlined, 
  HomeOutlined, 
  WifiOutlined, 
  CoffeeOutlined, 
  CarOutlined,
  StarFilled,
  ThunderboltOutlined,
  EyeOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getRooms, getImageList, getVipPricingSnapshot } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

export default function RoomList({ onOpen }) {
  const [rooms, setRooms] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [pricing, setPricing] = React.useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { token } = theme.useToken();
  const isDarkMode = token.colorBgBase === '#000000' || token.colorBgBase === '#141414';

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRooms();
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.data?.message || '无法连接后端';
      navigate('/error', { state: { status: String(e.status || 500), title: '加载失败', subTitle: msg, backTo: '/rooms' }, replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getVipPricingSnapshot();
        setPricing(data);
      } catch (e) {
        console.warn('无法加载会员折扣策略', e);
      }
    })();
  }, []);

  const discountLookup = React.useMemo(() => {
    if (!pricing) return { base: {}, rooms: new Map() };
    const baseRates = Object.entries(pricing.baseRates || {}).reduce((acc, [level, rate]) => {
      const key = Number(level);
      acc[key] = typeof rate === 'number' ? rate : Number(rate);
      return acc;
    }, {});
    const roomMap = new Map();
    const roomsList = Array.isArray(pricing.rooms) ? pricing.rooms : [];
    roomsList.forEach((item) => {
      const roomId = Number(item.roomTypeId ?? item.room_type_id ?? item.id);
      const discounts = item.discounts || {};
      const normalized = Object.entries(discounts).reduce((acc, [lvl, rate]) => {
        const key = Number(lvl);
        acc[key] = typeof rate === 'number' ? rate : Number(rate);
        return acc;
      }, {});
      if (!Number.isNaN(roomId)) {
        roomMap.set(roomId, normalized);
      }
    });
    return { base: baseRates, rooms: roomMap };
  }, [pricing]);

  const computeDiscountedPrice = React.useCallback((room) => {
    if (!user || user.vipLevel == null) return null;
    const vipLevel = Number(user.vipLevel);
    if (Number.isNaN(vipLevel)) return null;
    const baseRate = discountLookup.base[vipLevel] ?? 1;
    const specific = discountLookup.rooms.get(Number(room.id)) || {};
    const rate = specific[vipLevel] ?? baseRate ?? 1;
    const basePrice = Number(room.pricePerNight);
    if (Number.isNaN(basePrice)) return null;
    return {
      rate,
      price: Number((basePrice * rate).toFixed(2))
    };
  }, [discountLookup, user]);

  const sanitizedRooms = React.useMemo(
    () => rooms.filter((item) => item && typeof item === 'object'),
    [rooms]
  );

  const list = React.useMemo(() => {
    if (!q) return sanitizedRooms;
    const key = q.toLowerCase();
    return sanitizedRooms.filter(r => {
      const name = (r.name || '').toLowerCase();
      const type = (r.type || '').toLowerCase();
      const bed = (r.bedType || '').toLowerCase();
      const amenities = Array.isArray(r.amenities) ? r.amenities.join(',').toLowerCase() : '';
      return name.includes(key) || type.includes(key) || bed.includes(key) || amenities.includes(key);
    });
  }, [sanitizedRooms, q]);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div style={{ 
        background: isDarkMode 
          ? 'linear-gradient(135deg, #177ddc 0%, #0958d9 100%)'
          : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        borderRadius: 16,
        padding: '32px 40px',
        boxShadow: '0 8px 24px rgba(24, 144, 255, 0.25)',
      }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Title level={2} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>探索精选房型</Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 16 }}>
            为您精心挑选的舒适住宿体验
          </Text>
        </Space>
      </div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <Input.Search
          placeholder="搜索房间名称、类型或设施"
          allowClear
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onSearch={(v)=>setQ(v)}
          size="large"
          prefix={<SearchOutlined style={{ color: isDarkMode ? token.colorTextTertiary : '#bfbfbf' }} />}
          style={{ 
            maxWidth: 420,
            borderRadius: 12,
          }}
        />
        {!user && (
          <Space size={12}>
            <Text type="secondary" style={{ fontSize: 15 }}>登入后可预订房间</Text>
            <Button 
              type="primary" 
              size="large"
              onClick={() => navigate('/login')}
              style={{
                borderRadius: 10,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
              }}
            >
              去登入/注册
            </Button>
          </Space>
        )}
      </div>
      {loading ? (
        <Row gutter={[20, 20]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Col xs={24} sm={12} md={8} lg={6} key={i}>
              <Card style={{ borderRadius: 12 }}>
                <Skeleton active avatar paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : list.length === 0 ? (
        <Empty 
          description="暂无房间" 
          style={{ 
            padding: '60px 20px',
            background: isDarkMode ? token.colorBgLayout : '#fafafa',
            borderRadius: 12,
          }}
        />
      ) : (
        <Row gutter={[20, 20]}>
          {list.map(r => {
            const imgs = getImageList(r.images);
            const cover = imgs[0] || 'https://picsum.photos/seed/hotel/400/250';
            const available = Number.isFinite(Number(r.availableCount)) ? Number(r.availableCount) : 0;
            const total = Number.isFinite(Number(r.totalCount)) ? Number(r.totalCount) : 0;
            const price = Number(r.pricePerNight);
            const discountInfo = computeDiscountedPrice(r);
            const amenities = Array.isArray(r.amenities) ? r.amenities : [];
            const isActive = r.isActive !== undefined ? !!r.isActive : true;
            const areaValue = Number(r.areaSqm);
            const areaDisplay = Number.isNaN(areaValue) ? null : Number.isInteger(areaValue) ? areaValue : areaValue.toFixed(1);
            const maxGuestsValue = Number(r.maxGuests);
            const maxGuests = Number.isNaN(maxGuestsValue) || maxGuestsValue <= 0 ? (r.maxGuests ?? '—') : maxGuestsValue;
            const occupancyRate = total > 0 ? ((total - available) / total * 100) : 0;
            
            // 设施图标映射
            const amenityIcons = {
              'WiFi': <WifiOutlined />,
              '免费WiFi': <WifiOutlined />,
              '咖啡机': <CoffeeOutlined />,
              '停车': <CarOutlined />,
              '免费停车': <CarOutlined />,
            };
            
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={r.id}>
                <Badge.Ribbon 
                  text={available > 0 ? `${available}间可订` : '已满房'} 
                  color={available > 0 ? '#52c41a' : '#ff4d4f'}
                  style={{ display: !isActive ? 'none' : undefined }}
                >
                  <Card
                    hoverable
                    cover={
                      <div style={{ 
                        position: 'relative', 
                        overflow: 'hidden',
                        height: 220,
                      }}>
                        <img 
                          alt={r.name} 
                          src={cover} 
                          style={{ 
                            height: '100%',
                            width: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15) rotate(2deg)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1) rotate(0deg)'}
                        />
                        {/* 图片渐变遮罩 */}
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: '50%',
                          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
                          pointerEvents: 'none',
                        }} />
                        
                        {/* 热门标签 */}
                        {occupancyRate >= 70 && (
                          <div style={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
                            color: '#fff',
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            boxShadow: '0 2px 8px rgba(255, 77, 79, 0.4)',
                            animation: 'pulse 2s infinite',
                          }}>
                            <ThunderboltOutlined />
                            热门房型
                          </div>
                        )}
                        
                        {/* 房型标签 */}
                        <div style={{
                          position: 'absolute',
                          bottom: 12,
                          left: 12,
                          background: isDarkMode 
                            ? 'rgba(20, 20, 20, 0.95)' 
                            : 'rgba(255, 255, 255, 0.95)',
                          backdropFilter: 'blur(8px)',
                          padding: '6px 14px',
                          borderRadius: 20,
                          fontSize: 13,
                          fontWeight: 600,
                          color: isDarkMode ? '#40a9ff' : '#1890ff',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        }}>
                          {r.type}
                        </div>
                        
                        {/* 查看图标 */}
                        <div style={{
                          position: 'absolute',
                          bottom: 12,
                          right: 12,
                          background: 'rgba(0, 0, 0, 0.6)',
                          backdropFilter: 'blur(8px)',
                          padding: '8px',
                          borderRadius: '50%',
                          color: '#fff',
                          fontSize: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(24, 144, 255, 0.9)';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(r.id);
                        }}
                        >
                          <EyeOutlined />
                        </div>
                        
                        {!isActive && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Tag color="magenta" style={{ fontSize: 16, padding: '6px 16px' }}>已下架</Tag>
                          </div>
                        )}
                      </div>
                    }
                    onClick={() => onOpen(r.id)}
                    style={{
                      borderRadius: 16,
                      overflow: 'hidden',
                      border: isDarkMode ? `1px solid ${token.colorBorder}` : '1px solid #e8e8e8',
                      background: isDarkMode ? token.colorBgContainer : '#fff',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      height: '100%',
                    }}
                    bodyStyle={{ padding: '16px' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-10px)';
                      e.currentTarget.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.14), 0 6px 20px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.border = isDarkMode ? `1px solid ${token.colorBorderSecondary}` : '1px solid #d9d9d9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.border = isDarkMode ? `1px solid ${token.colorBorder}` : '1px solid #e8e8e8';
                    }}
                    actions={[
                      <Button
                        key="vr"
                        type="primary"
                        ghost
                        icon={<PlayCircleOutlined />}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/rooms/${r.id}?vr=1`);
                        }}
                        style={{ 
                          fontWeight: 600,
                          borderRadius: 8,
                        }}
                      >
                        VR 看房
                      </Button>,
                      <Button
                        key="detail"
                        type="link"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(r.id);
                        }}
                        style={{ 
                          fontWeight: 600,
                        }}
                      >
                        查看详情
                      </Button>
                    ]}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      {/* 标题和评分 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Title level={5} style={{ margin: 0, fontSize: 17, flex: 1 }}>{r.name}</Title>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                          <StarFilled style={{ color: '#fadb14', fontSize: 14 }} />
                          <Text strong style={{ fontSize: 14 }}>4.8</Text>
                        </div>
                      </div>
                      
                      <Divider style={{ margin: '4px 0' }} />
                      
                      {/* 价格区域 */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>起价</Text>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <Text style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f', lineHeight: 1 }}>
                              ¥{Number.isNaN(price) ? r.pricePerNight : price.toFixed(0)}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>/ 晚</Text>
                          </div>
                        </div>
                        {discountInfo && discountInfo.rate < 1 && (
                          <div style={{ 
                            background: 'linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%)',
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #ffe58f',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}>
                            <StarFilled style={{ color: '#faad14', fontSize: 14 }} />
                            <Text style={{ fontSize: 13, color: '#d48806', fontWeight: 600 }}>
                              VIP ¥{discountInfo.price.toFixed(0)} ({Math.round(discountInfo.rate * 10 * 10)}折)
                            </Text>
                          </div>
                        )}
                      </div>
                      
                      {/* 房间信息 */}
                      <div style={{ 
                        background: isDarkMode ? '#262626' : '#f5f5f5', 
                        padding: '10px 12px', 
                        borderRadius: 8,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}>
                        <Space size={4}>
                          <HomeOutlined style={{ color: '#1890ff', fontSize: 14 }} />
                          <Text style={{ fontSize: 12, color: '#595959' }}>
                            {areaDisplay != null ? `${areaDisplay}㎡` : '面积未知'}
                          </Text>
                        </Space>
                        <Space size={4}>
                          <UserOutlined style={{ color: '#52c41a', fontSize: 14 }} />
                          <Text style={{ fontSize: 12, color: '#595959' }}>
                            {maxGuests}人
                          </Text>
                        </Space>
                        <Space size={4}>
                          <Text style={{ fontSize: 12, color: '#595959' }}>
                            🛏️ {r.bedType || '标准床'}
                          </Text>
                        </Space>
                      </div>
                      
                      {/* 入住率进度条 */}
                      {total > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>入住率</Text>
                            <Text style={{ fontSize: 12, fontWeight: 600, color: occupancyRate >= 70 ? '#ff4d4f' : '#52c41a' }}>
                              {occupancyRate.toFixed(0)}%
                            </Text>
                          </div>
                          <Progress 
                            percent={occupancyRate} 
                            showInfo={false}
                            strokeColor={{
                              '0%': occupancyRate >= 70 ? '#ff4d4f' : '#52c41a',
                              '100%': occupancyRate >= 70 ? '#ff7875' : '#73d13d',
                            }}
                            size="small"
                          />
                        </div>
                      )}
                      
                      {/* 设施标签 */}
                      {amenities.length > 0 && (
                        <div>
                          <Text style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6, display: 'block' }}>
                            房间设施
                          </Text>
                          <Space size={[6, 6]} wrap>
                            {amenities.slice(0, 4).map((am, idx) => (
                              <Tooltip key={idx} title={am}>
                                <Tag 
                                  icon={amenityIcons[am] || <CheckCircleOutlined />}
                                  color="blue" 
                                  style={{ 
                                    fontSize: 11, 
                                    borderRadius: 6,
                                    padding: '2px 8px',
                                    border: 'none',
                                  }}
                                >
                                  {am}
                                </Tag>
                              </Tooltip>
                            ))}
                            {amenities.length > 4 && (
                              <Tag 
                                color="default" 
                                style={{ 
                                  fontSize: 11,
                                  borderRadius: 6,
                                  padding: '2px 8px',
                                }}
                              >
                                +{amenities.length - 4}
                              </Tag>
                            )}
                          </Space>
                        </div>
                      )}
                    </Space>
                  </Card>
                </Badge.Ribbon>
              </Col>
            );
          })}
        </Row>
      )}
    </Space>
  );
}
