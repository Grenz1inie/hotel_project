import React from 'react';
import { Button, Typography, Space, Row, Col, Card, Skeleton, Image, Tag, theme } from 'antd';
import { EnvironmentOutlined, PhoneOutlined, StarFilled, CheckCircleOutlined, ThunderboltOutlined, CoffeeOutlined, CarOutlined } from '@ant-design/icons';
import { getPrimaryHotel, getImageList } from '../services/api';

const { Title, Paragraph, Text } = Typography;

export default function HotelLanding({ onEnterRooms }) {
  const [hotel, setHotel] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const { token } = theme.useToken();
  const isDarkMode = token.colorBgBase === '#000000' || token.colorBgBase === '#141414';

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPrimaryHotel();
      setHotel(data);
    } catch (e) {
      setError(e?.data?.message || '无法加载酒店信息，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const gallery = React.useMemo(() => {
    if (!hotel) return [];
    if (Array.isArray(hotel.galleryImages)) return hotel.galleryImages;
    return getImageList(hotel.galleryImages);
  }, [hotel]);

  const introductionBlocks = React.useMemo(() => {
    const intro = hotel?.introduction || '';
    return intro
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [hotel]);

  const starLevel = React.useMemo(() => {
    const level = Number(hotel?.starLevel);
    if (!Number.isFinite(level) || level <= 0) return null;
    return Array.from({ length: level }).map((_, idx) => idx);
  }, [hotel]);

  const heroStyle = React.useMemo(() => ({
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 420,
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: isDarkMode ? '#0a0a0a' : '#111',
    backgroundImage: hotel?.heroImageUrl ? `url(${hotel.heroImageUrl})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.1)',
  }), [hotel, isDarkMode]);

  return (
    <Space direction="vertical" size={32} style={{ width: '100%' }}>
      <div style={heroStyle}>
        <div style={{
          flex: 1,
          padding: '80px 56px',
          background: 'linear-gradient(135deg, rgba(13, 27, 62, 0.92) 0%, rgba(30, 60, 114, 0.75) 50%, rgba(13, 27, 62, 0.5) 100%)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          {loading && !hotel ? (
            <Skeleton active paragraph={{ rows: 4 }} title={false} style={{ color: '#fff' }} />
          ) : (
            <Space direction="vertical" size={24} style={{ maxWidth: 680 }}>
              <Space size={16} align="center" wrap>
                <Title level={1} style={{ color: '#fff', margin: 0, fontSize: 42, fontWeight: 700, textShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  {hotel?.name || '精选酒店'}
                </Title>
                {starLevel && starLevel.length > 0 && (
                  <Space size={6}>
                    {starLevel.map((idx) => (
                      <StarFilled key={idx} style={{ fontSize: 24, color: '#ffd700', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                    ))}
                  </Space>
                )}
              </Space>
              <Space size={20} align="center">
                <Space size={8}>
                  <EnvironmentOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                  <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 17, fontWeight: 500 }}>
                    {hotel?.city}
                  </Text>
                </Space>
                <Text style={{ color: 'rgba(255,255,255,0.7)' }}>·</Text>
                <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 16 }}>
                  {hotel?.address}
                </Text>
              </Space>
              {introductionBlocks.slice(0, 1).map((block, idx) => (
                <Paragraph key={idx} style={{ 
                  color: '#fff', 
                  fontSize: 19, 
                  lineHeight: 1.8,
                  textShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  marginBottom: 0
                }}>
                  {block}
                </Paragraph>
              ))}
              <Space size={20} wrap>
                <Button 
                  type="primary" 
                  size="large" 
                  onClick={() => onEnterRooms?.()}
                  style={{
                    height: 52,
                    fontSize: 17,
                    fontWeight: 600,
                    borderRadius: 26,
                    padding: '0 36px',
                    background: isDarkMode 
                      ? 'linear-gradient(135deg, #177ddc 0%, #0958d9 100%)'
                      : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    border: 'none',
                    boxShadow: '0 8px 20px rgba(24, 144, 255, 0.4), 0 4px 12px rgba(24, 144, 255, 0.2)',
                  }}
                >
                  立即探索房型
                </Button>
                <Tag 
                  color="gold" 
                  style={{ 
                    fontSize: 16, 
                    padding: '10px 22px',
                    borderRadius: 20,
                    border: 'none',
                    background: 'linear-gradient(135deg, #fadb14 0%, #ffc53d 100%)',
                    color: '#8c5c00',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(250, 219, 20, 0.3)'
                  }}
                >
                  官方直订礼遇 · 更安心
                </Tag>
              </Space>
            </Space>
          )}
        </div>
      </div>

      {error && (
        <Card style={{ 
          borderColor: isDarkMode ? '#a61d24' : '#ff7875', 
          background: isDarkMode ? '#2a1215' : '#fff1f0' 
        }}>
          <Title level={4} style={{ marginTop: 0, color: isDarkMode ? '#ff7875' : '#cf1322' }}>温馨提示</Title>
          <Paragraph style={{ marginBottom: 12, color: isDarkMode ? token.colorTextSecondary : '#76222a' }}>{error}</Paragraph>
          <Button onClick={load}>重新加载</Button>
        </Card>
      )}

      {introductionBlocks.length > 1 && (
        <Card 
          title={<span style={{ fontSize: 20, fontWeight: 600 }}>🏨 酒店亮点</span>} 
          bordered={false} 
          style={{ 
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          }}
          headStyle={{ borderBottom: '2px solid #f0f0f0' }}
        >
          <Space direction="vertical" size={16}>
            {introductionBlocks.slice(1).map((block, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start' }}>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18, marginRight: 12, marginTop: 4 }} />
                <Paragraph style={{ marginBottom: 0, fontSize: 16, lineHeight: 1.8 }}>{block}</Paragraph>
              </div>
            ))}
          </Space>
        </Card>
      )}

      {gallery.length > 0 && (
        <Card 
          title={<span style={{ fontSize: 20, fontWeight: 600 }}>📸 灵感相册</span>} 
          bordered={false} 
          style={{ 
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          }}
          headStyle={{ borderBottom: '2px solid #f0f0f0' }}
        >
          <Row gutter={[20, 20]}>
            {gallery.slice(0, 4).map((src, idx) => (
              <Col xs={24} sm={12} md={12} lg={6} key={idx}>
                <div style={{ 
                  overflow: 'hidden', 
                  borderRadius: 12,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}>
                  <Image
                    src={src}
                    alt={`hotel-gallery-${idx}`}
                    style={{ 
                      borderRadius: 12, 
                      height: 200, 
                      objectFit: 'cover', 
                      width: '100%',
                      transition: 'transform 0.3s ease',
                    }}
                    preview={{
                      mask: '预览图片'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  />
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {hotel && (
        <Row gutter={[20, 20]}>
          <Col xs={24} md={12}>
            <Card 
              bordered={false} 
              style={{ 
                borderRadius: 16, 
                height: '100%',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
                background: 'linear-gradient(135deg, #e6f7ff 0%, #ffffff 100%)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.06)';
              }}
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Space size={12}>
                  <ThunderboltOutlined style={{ fontSize: 28, color: '#1890ff' }} />
                  <Title level={4} style={{ margin: 0, fontSize: 20 }}>尊享体验</Title>
                </Space>
                <Space direction="vertical" size={14}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: isDarkMode ? '#177ddc' : '#1890ff', 
                      marginRight: 12, 
                      marginTop: 8,
                      flexShrink: 0
                    }} />
                    <Text style={{ fontSize: 15, lineHeight: 1.8 }}>全天候健身中心与恒温泳池，随时焕活身心</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: isDarkMode ? '#177ddc' : '#1890ff', 
                      marginRight: 12, 
                      marginTop: 8,
                      flexShrink: 0
                    }} />
                    <Text style={{ fontSize: 15, lineHeight: 1.8 }}>行政酒廊提供定制商务服务与精致茶点</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: isDarkMode ? '#177ddc' : '#1890ff', 
                      marginRight: 12, 
                      marginTop: 8,
                      flexShrink: 0
                    }} />
                    <Text style={{ fontSize: 15, lineHeight: 1.8 }}>智能客房系统，语音操控灯光、温度与窗帘</Text>
                  </div>
                </Space>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card 
              bordered={false} 
              style={{ 
                borderRadius: 16, 
                height: '100%',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
                background: 'linear-gradient(135deg, #fff7e6 0%, #ffffff 100%)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.06)';
              }}
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Space size={12}>
                  <CarOutlined style={{ fontSize: 28, color: '#fa8c16' }} />
                  <Title level={4} style={{ margin: 0, fontSize: 20 }}>便捷配套</Title>
                </Space>
                <Space direction="vertical" size={14}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: isDarkMode ? '#d46b08' : '#fa8c16', 
                      marginRight: 12, 
                      marginTop: 8,
                      flexShrink: 0
                    }} />
                    <Text style={{ fontSize: 15, lineHeight: 1.8 }}>步行5分钟抵达地铁，20分钟直达机场高速</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: isDarkMode ? '#d46b08' : '#fa8c16', 
                      marginRight: 12, 
                      marginTop: 8,
                      flexShrink: 0
                    }} />
                    <Text style={{ fontSize: 15, lineHeight: 1.8 }}>会议中心具备4K投影与一站式会务管家</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: isDarkMode ? '#d46b08' : '#fa8c16', 
                      marginRight: 12, 
                      marginTop: 8,
                      flexShrink: 0
                    }} />
                    <Text style={{ fontSize: 15, lineHeight: 1.8 }}>营养早餐与城市主题下午茶，满足多样口味</Text>
                  </div>
                </Space>
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      <Card 
        bordered={false} 
        style={{ 
          borderRadius: 20, 
          textAlign: 'center', 
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%)',
          border: '2px solid #91d5ff',
          boxShadow: '0 8px 30px rgba(24, 144, 255, 0.15)',
        }}
      >
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <Title level={2} style={{ margin: 0, background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>
            准备好开启旅程了吗？
          </Title>
          <Text style={{ fontSize: 17, color: '#595959' }}>
            立即浏览房型，享受会员专属预定礼遇与限时折扣
          </Text>
          <Button 
            type="primary" 
            size="large" 
            onClick={() => onEnterRooms?.()}
            style={{
              height: 52,
              fontSize: 17,
              fontWeight: 600,
              borderRadius: 26,
              padding: '0 42px',
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              border: 'none',
              boxShadow: '0 8px 20px rgba(24, 144, 255, 0.35)',
            }}
          >
            进入房间列表
          </Button>
        </Space>
      </Card>
    </Space>
  );
}