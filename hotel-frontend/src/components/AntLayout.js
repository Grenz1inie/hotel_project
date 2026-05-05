import React from 'react';
import { Layout, Menu, Breadcrumb, ConfigProvider, theme, Dropdown, Space, Typography, FloatButton, message } from 'antd';
import { HomeOutlined, AppstoreOutlined, UserOutlined, MoonOutlined, SunOutlined, UnorderedListOutlined, DownOutlined, DashboardOutlined, ShoppingOutlined, HomeOutlined as RoomOutlined, BarChartOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWalletSummary } from '../services/api';

const { Header, Content, Footer } = Layout;

export default function AntLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [wallet, setWallet] = React.useState(null);
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('hotel-admin-theme');
    return stored === 'dark';
  });
  const isAuthPage = location.pathname === '/login' || location.pathname === '/error';
  const selected = React.useMemo(() => {
    if (isAuthPage) return [];
    if (location.pathname.startsWith('/admin')) return ['admin'];
    if (location.pathname.startsWith('/me/profile')) return ['profile'];
    if (location.pathname.startsWith('/me/orders')) return ['orders'];
    if (location.pathname === '/' || location.pathname === '') return ['home'];
    if (location.pathname.startsWith('/rooms')) return ['rooms'];
    return ['home'];
  }, [location.pathname, isAuthPage]);

  React.useEffect(() => {
    if (!user) {
      setWallet(null);
      return;
    }
    
    const loadWallet = async () => {
      try {
        const data = await getWalletSummary(5);
        setWallet(data);
      } catch (err) {
        console.warn('获取钱包信息失败', err);
      }
    };
    
    // 首次加载
    loadWallet();
    
    // 监听页面可见性变化，页面重新可见时刷新钱包和用户信息（包括VIP等级）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadWallet();
        // 刷新用户信息以获取最新的VIP等级
        if (refreshUser) {
          refreshUser();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshUser]);

  const walletBalanceText = wallet?.balance != null ? Number(wallet.balance).toFixed(2) : null;

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('hotel-admin-theme', isDarkMode ? 'dark' : 'light');
    document.body.dataset.theme = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  const themeConfig = React.useMemo(() => ({
    algorithm: isDarkMode ? [theme.darkAlgorithm] : [theme.defaultAlgorithm],
  }), [isDarkMode]);

  const handleThemeToggle = React.useCallback(() => {
    setIsDarkMode((prev) => !prev);
    message.success(`已切换为${!isDarkMode ? '夜间' : '日间'}模式`);
  }, [isDarkMode]);

  const handleGoProfile = React.useCallback(() => {
    navigate('/me/profile');
  }, [navigate]);

  const crumbs = React.useMemo(() => {
    const base = [{ key: 'home', title: <Link to="/">首页</Link> }];
    const path = location.pathname;

    if (path === '/') {
      return base;
    }

    if (path === '/rooms') {
      return [
        ...base,
        { key: 'rooms', title: <Link to="/rooms">房间列表</Link> }
      ];
    }

    if (path === '/login') {
      return [
        ...base,
        { key: 'login', title: <Link to="/login">登入/注册</Link> },
      ];
    }

    if (path === '/error') {
      return [
        ...base,
        { key: 'error', title: <Link to="/error">错误</Link> },
      ];
    }

    if (path.startsWith('/rooms/')) {
      return [
        ...base,
        { key: 'rooms', title: <Link to="/rooms">房间列表</Link> },
        { key: 'room-detail', title: <Link to={path}>房间详情</Link> },
      ];
    }

    if (path.startsWith('/me/profile')) {
      return [
        ...base,
        { key: 'profile', title: <Link to="/me/profile">个人中心</Link> },
      ];
    }

    if (path.startsWith('/me/orders')) {
      // 只有普通用户才显示"我的订单"面包屑
      if (user?.role !== 'ADMIN') {
        return [
          ...base,
          { key: 'orders', title: <Link to="/me/orders">我的订单</Link> },
        ];
      }
      return base;
    }

    if (path.startsWith('/admin')) {
      return [
        ...base,
        { key: 'admin', title: <Link to="/admin">管理控制台</Link> },
      ];
    }

    return base;
  }, [location.pathname]);

  const { token } = theme.useToken();

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout style={{ minHeight: '100vh', background: isDarkMode ? '#141414' : '#f0f2f5' }}>
        <Header style={{ 
          display: 'flex', 
          alignItems: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          width: '100%',
          background: isDarkMode ? '#141414' : '#001529'
        }}>
          <div style={{ color: '#fff', fontWeight: 700, marginRight: 24 }}>Hotel</div>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={selected}
            overflowedIndicator={null}
            style={{ flex: 1, minWidth: 0 }}
            items={(() => {
              if (isAuthPage) return [];
              const items = [];
              items.push({ key: 'home', icon: <HomeOutlined />, label: <Link to="/">酒店概览</Link> });
              items.push({ key: 'rooms', icon: <AppstoreOutlined />, label: <Link to="/rooms">房间预订</Link> });
              if (user) {
                items.push({ key: 'profile', icon: <UserOutlined />, label: <Link to="/me/profile">个人中心</Link> });
                // 只有普通用户显示"我的订单"，管理员不显示
                if (user.role !== 'ADMIN') {
                  items.push({ key: 'orders', icon: <UnorderedListOutlined />, label: <Link to="/me/orders">我的订单</Link> });
                }
              }
              if (user?.role === 'ADMIN') {
                items.push({
                  key: 'admin',
                  icon: <AppstoreOutlined />,
                  label: (
                    <span 
                      style={{ color: '#fff', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin');
                      }}
                    >
                      管理
                    </span>
                  ),
                  children: [
                    {
                      key: 'admin-orders',
                      icon: <ShoppingOutlined />,
                      label: '订单管理',
                      onClick: () => {
                        navigate('/admin');
                        setTimeout(() => {
                          const ordersCard = document.querySelector('div[class*="Card"]:has(form)');
                          if (ordersCard) {
                            ordersCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }
                    },
                    {
                      key: 'admin-rooms',
                      icon: <RoomOutlined />,
                      label: '房间状态概览',
                      onClick: () => {
                        navigate('/admin');
                        setTimeout(() => {
                          const roomCard = document.querySelector('[id^="roomType-"]');
                          if (roomCard) {
                            roomCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }
                    },
                    {
                      key: 'admin-analytics',
                      icon: <BarChartOutlined />,
                      label: '空置曲线分析',
                      onClick: () => {
                        navigate('/admin');
                        setTimeout(() => {
                          // 更精确的选择器：查找包含"房型空置曲线"或"空置曲线"的标题
                          const allHeadings = document.querySelectorAll('h4, h3, h2');
                          let analyticsPanel = null;
                          for (const heading of allHeadings) {
                            if (heading.textContent.includes('房型空置曲线') || heading.textContent.includes('空置曲线')) {
                              analyticsPanel = heading;
                              break;
                            }
                          }
                          if (analyticsPanel) {
                            const card = analyticsPanel.closest('div[class*="ant-card"]') || analyticsPanel.closest('[class*="Card"]');
                            if (card) {
                              card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            } else {
                              analyticsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }
                        }, 200);
                      }
                    },
                    {
                      key: 'admin-room-types',
                      icon: <AppstoreOutlined />,
                      label: '房型管理',
                      onClick: () => {
                        navigate('/admin');
                        setTimeout(() => {
                          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        }, 100);
                      }
                    }
                  ]
                });
              }
              return items;
            })()}
          />
          <div style={{ marginLeft: 'auto', color: '#fff' }}>
            {user ? (
              <Dropdown
                menu={{
                  items: [
                    { key: 'role', disabled: true, label: `角色：${user.role}` },
                    { key: 'vip', disabled: true, label: `VIP：${user.vipLevel ?? 0}` },
                    { key: 'balance', disabled: true, label: `余额：${walletBalanceText != null ? `¥${walletBalanceText}` : '加载中…'}` },
                    { key: 'profile', label: '个人中心', onClick: () => navigate('/me/profile') },
                    // 只有普通用户显示"我的订单"
                    ...(user.role !== 'ADMIN' ? [{ key: 'orders', label: '我的订单', onClick: () => navigate('/me/orders') }] : []),
                    { key: 'logout', label: '退出登录', onClick: () => { logout(); navigate('/login'); } },
                  ]
                }}
              >
                <Space style={{ cursor: 'pointer' }}>
                  <Typography.Text style={{ color: '#fff' }}>{user.username}</Typography.Text>
                </Space>
              </Dropdown>
            ) : (
              <Link to="/login" style={{ color: '#fff' }}>登入/注册</Link>
            )}
          </div>
        </Header>
        <Content style={{ padding: '16px 32px', marginTop: '64px' }}>
          <Breadcrumb items={crumbs} />
          <div
            style={{
              background: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#fff',
              padding: 24,
              borderRadius: 8,
              marginTop: 12,
              boxShadow: isDarkMode ? '0 6px 16px rgba(0,0,0,0.45)' : '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>Hotel ©{new Date().getFullYear()} Created with Ant Design</Footer>
        <FloatButton.Group shape="circle" style={{ right: 32, bottom: 32 }}>
          <FloatButton
            icon={<UserOutlined />}
            tooltip={<span>个人中心</span>}
            onClick={handleGoProfile}
          />
          <FloatButton
            icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
            tooltip={<span>{isDarkMode ? '切换到日间模式' : '切换到夜间模式'}</span>}
            onClick={handleThemeToggle}
          />
          <FloatButton.BackTop visibilityHeight={0} tooltip={<span>返回顶部</span>} />
        </FloatButton.Group>
      </Layout>
    </ConfigProvider>
  );
}
