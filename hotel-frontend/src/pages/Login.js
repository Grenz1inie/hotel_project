import React from 'react';
import { Card, Form, Input, Button, Typography, Space, Tabs, message, theme } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function Login() {
  const { login, register } = useAuth();
  const [activeKey, setActiveKey] = React.useState('login');
  const [loadingLogin, setLoadingLogin] = React.useState(false);
  const [loadingRegister, setLoadingRegister] = React.useState(false);
  const [isCardHovered, setIsCardHovered] = React.useState(false);
  const navigate = useNavigate();
  const { token: antdToken } = theme.useToken();
  const isDarkMode = antdToken.colorBgBase === '#000000' || antdToken.colorBgBase === '#141414';
  const location = useLocation();
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const redirectAfterSuccess = React.useCallback(() => {
    const from = location.state?.from?.pathname || '/';
    navigate(from, { replace: true });
  }, [location.state, navigate]);

  const onLogin = React.useCallback(async (vals) => {
    setLoadingLogin(true);
    const res = await login(vals.username, vals.password);
    setLoadingLogin(false);
    if (res.ok) {
      redirectAfterSuccess();
    } else {
      navigate('/error', { state: { status: '500', title: '登录失败', subTitle: res.error?.message || '无法连接后端或接口返回错误', backTo: '/login' }, replace: true });
    }
  }, [login, navigate, redirectAfterSuccess]);

  const onRegister = React.useCallback(async (vals) => {
    setLoadingRegister(true);
    const phone = typeof vals.phone === 'string' ? vals.phone.trim() : vals.phone;
    const email = typeof vals.email === 'string' ? vals.email.trim() : vals.email;
    const res = await register({
      username: vals.username,
      password: vals.password,
      confirmPassword: vals.confirmPassword,
      phone,
      email,
    });
    setLoadingRegister(false);
    if (res.ok) {
      redirectAfterSuccess();
    } else {
      message.error(res.error?.message || '注册失败');
    }
  }, [register, redirectAfterSuccess]);

  const tabItems = React.useMemo(() => ([
    {
      key: 'login',
      label: '账号登入',
      children: (
        <Form
          form={loginForm}
          layout="vertical"
          onFinish={onLogin}
          initialValues={{ username: '', password: '' }}
        >
          <Form.Item 
            name="username" 
            label="账号 / 手机号 / 邮箱" 
            rules={[
              { required: true, message: '请输入账号或联系方式' },
              { whitespace: true, message: '账号不能只包含空格' },
              { max: 100, message: '账号长度不能超过100个字符' }
            ]}
          >
            <Input 
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入用户名、手机号或邮箱" 
              autoComplete="username"
              maxLength={100}
              allowClear
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item 
            name="password" 
            label="密码" 
            rules={[
              { required: true, message: '请输入密码' },
              { min: 1, message: '密码不能为空' },
              { max: 255, message: '密码长度不能超过255个字符' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入密码" 
              autoComplete="current-password"
              maxLength={255}
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={loadingLogin}
              size="large"
              style={{
                height: 48,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                border: 'none',
                boxShadow: '0 6px 16px rgba(24, 144, 255, 0.3)',
              }}
            >
              立即登入
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'register',
      label: '快速注册',
      children: (
        <Form
          form={registerForm}
          layout="vertical"
          onFinish={onRegister}
          initialValues={{ username: '', password: '', confirmPassword: '', phone: '', email: '' }}
        >
          <Form.Item 
            name="username" 
            label="用户名（可选）" 
            rules={[
              { whitespace: true, message: '用户名不能只包含空格' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
              { pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, message: '用户名只能包含字母、数字、下划线或中文' }
            ]}
          >
            <Input 
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="留空则默认为手机号" 
              autoComplete="username"
              maxLength={20}
              showCount
              allowClear
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item 
            name="password" 
            label="密码" 
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' },
              { max: 50, message: '密码最多50位' },
              { pattern: /^(?=.*[A-Za-z0-9])[\S]+$/, message: '密码不能只包含空格，需包含字母或数字' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="6-50位，建议包含字母和数字" 
              autoComplete="new-password"
              maxLength={50}
              showCount
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请再次输入密码" 
              autoComplete="new-password"
              maxLength={50}
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item 
            name="phone" 
            label="联系电话" 
            rules={[
              { required: true, message: '请输入联系电话' },
              { 
                pattern: /^(1[3-9]\d{9}|\+?[1-9]\d{1,14})$/, 
                message: '请输入正确的手机号（国内11位或国际号码，如+1234567890）' 
              }
            ]}
          >
            <Input 
              prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入手机号（国内11位或国际号码）" 
              autoComplete="tel"
              maxLength={20}
              allowClear
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item 
            name="email" 
            label="邮箱（可选）" 
            rules={[
              { type: 'email', message: '请输入正确的邮箱地址' },
              { max: 255, message: '邮箱长度不能超过255个字符' },
              { 
                pattern: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 
                message: '邮箱格式不正确' 
              }
            ]}
          >
            <Input 
              prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="example@domain.com（可选）" 
              autoComplete="email"
              maxLength={255}
              allowClear
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={loadingRegister}
              size="large"
              style={{
                height: 48,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                border: 'none',
                boxShadow: '0 6px 16px rgba(82, 196, 26, 0.3)',
              }}
            >
              注册并登录
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ]), [loginForm, registerForm, loadingLogin, loadingRegister, onLogin, onRegister]);

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '75vh',
      background: isDarkMode 
        ? 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url("https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80")'
        : 'linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url("https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      padding: '40px 20px',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: isDarkMode 
          ? 'linear-gradient(135deg, rgba(30, 30, 30, 0.8) 0%, rgba(50, 50, 50, 0.8) 100%)'
          : 'linear-gradient(135deg, rgba(102, 126, 234, 0.6) 0%, rgba(118, 75, 162, 0.6) 100%)',
        backdropFilter: 'blur(2px)',
      }} />
      <Card 
        style={{ 
          width: 480,
          maxWidth: '100%',
          borderRadius: 20,
          boxShadow: isCardHovered 
            ? '0 30px 80px rgba(0, 0, 0, 0.5), 0 12px 32px rgba(0, 0, 0, 0.4)' 
            : '0 20px 60px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          transform: isCardHovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          background: isDarkMode ? antdToken.colorBgContainer : '#fff',
        }}
        bodyStyle={{ padding: 0 }}
        onMouseEnter={() => setIsCardHovered(true)}
        onMouseLeave={() => setIsCardHovered(false)}
      >
        <div style={{
          background: isDarkMode 
            ? 'linear-gradient(135deg, #177ddc 0%, #0958d9 100%)'
            : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          padding: '32px 40px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏨</div>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>欢迎回来</Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 15 }}>
            使用已有账号登入，或快速注册成为会员
          </Text>
        </div>
        <div style={{ padding: '32px 40px', background: isDarkMode ? antdToken.colorBgContainer : '#fff' }}>
          <Tabs
            activeKey={activeKey}
            onChange={setActiveKey}
            items={tabItems}
            destroyInactiveTabPane
            size="large"
            style={{
              fontWeight: 600,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
