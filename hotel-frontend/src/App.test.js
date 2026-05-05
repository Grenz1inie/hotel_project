import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { __setAuthState } from './context/AuthContext';

// Mock ChatBot 组件，避免真实网络请求和副作用
jest.mock('./components/ChatBot', () => ({
  __esModule: true,
  default: () => <div data-testid="chatbot-mock">ChatBot Mock</div>,
}));

jest.mock('./context/AuthContext', () => {
  const React = require('react');
  const createState = () => ({
    user: null,
    token: '',
    isAuthed: false,
    role: undefined,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
  });
  let state = createState();
  const useAuth = () => state;
  return {
    __esModule: true,
    AuthProvider: ({ children }) => <React.Fragment>{children}</React.Fragment>,
    useAuth,
    __setAuthState: (overrides = {}) => {
      state = { ...createState(), ...overrides };
      return state;
    },
  };
});

jest.mock('./components/AntLayout', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout-mock">{children}</div>,
}));

jest.mock('./pages/RoomList', () => ({
  __esModule: true,
  default: () => <h1>房间列表</h1>,
}));

jest.mock('./pages/HotelLanding', () => ({
  __esModule: true,
  default: ({ onEnterRooms }) => (
      <div>
        <h1>酒店概览</h1>
        <button type="button" onClick={onEnterRooms}>进入房间列表</button>
      </div>
  ),
}));

jest.mock('./pages/AdminDemo', () => ({
  __esModule: true,
  default: () => <h1>管理面板</h1>,
}));

jest.mock('./pages/Login', () => ({
  __esModule: true,
  default: () => <h1>登入/注册页</h1>,
}));

jest.mock('./pages/UserDashboard', () => ({
  __esModule: true,
  default: () => <h1>我的订单</h1>,
}));

// 可选：如果 MyOrders 组件被使用，也建议 mock
jest.mock('./pages/MyOrders', () => ({
  __esModule: true,
  default: () => <h1>我的订单</h1>,
}));

beforeEach(() => {
  __setAuthState();
  window.history.pushState({}, '', '/');
});

test('首页展示酒店概览标题', () => {
  render(<App />);
  expect(screen.getByText('酒店概览')).toBeInTheDocument();
});

test('点击进入房间列表按钮后展示房间列表页', () => {
  render(<App />);
  fireEvent.click(screen.getByText('进入房间列表'));
  expect(screen.getByText('房间列表')).toBeInTheDocument();
});

test('未登录访问 /admin 被引导至登入/注册页', () => {
  window.history.pushState({}, '', '/admin');
  render(<App />);
  expect(screen.getByText('登入/注册页')).toBeInTheDocument();
});

test('普通用户访问 /admin 会被重定向回首页', async () => {
  __setAuthState({
    isAuthed: true,
    role: 'USER',
    user: { id: 2, username: 'user', role: 'USER' },
    login: jest.fn(),
    logout: jest.fn(),
  });
  window.history.pushState({}, '', '/admin');
  render(<App />);
  await waitFor(() => expect(screen.getByText('酒店概览')).toBeInTheDocument());
});

test('管理员访问 /admin 能看到管理面板', () => {
  __setAuthState({
    isAuthed: true,
    role: 'ADMIN',
    user: { id: 1, username: 'admin', role: 'ADMIN' },
    login: jest.fn(),
    logout: jest.fn(),
  });
  window.history.pushState({}, '', '/admin');
  render(<App />);
  expect(screen.getByText('管理面板')).toBeInTheDocument();
});