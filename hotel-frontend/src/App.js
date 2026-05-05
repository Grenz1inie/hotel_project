import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import AntLayout from './components/AntLayout';
import RoomListPage from './pages/RoomList';
import RoomDetailPage from './pages/RoomDetail';
import AdminDemo from './pages/AdminDemo';
import Login from './pages/Login';
import { ProtectedRoute, RoleRoute } from './routes/guards';
import { AuthProvider } from './context/AuthContext';
import ErrorPage from './pages/ErrorPage';
import HotelLanding from './pages/HotelLanding';
import AccountCenter from './pages/AccountCenter';
import MyOrders from './pages/MyOrders';
import ChatBot from "./components/ChatBot";

function RoomListRoute() {
  const navigate = useNavigate();
  return <RoomListPage onOpen={(id) => navigate(`/rooms/${id}`)} />;
}

function RoomDetailRoute() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const search = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialShowVr = search.get('vr') === '1';
  return <RoomDetailPage id={id} onBack={() => navigate('/rooms')} initialShowVr={initialShowVr} />;
}

function HotelLandingRoute() {
  const navigate = useNavigate();
  return <HotelLanding onEnterRooms={() => navigate('/rooms')} />;
}

export default function App() {
  return (
      <BrowserRouter>
        <AuthProvider>
          <AntLayout>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/error" element={<ErrorPage />} />
              <Route path="/" element={<HotelLandingRoute />} />
              <Route path="/rooms" element={<RoomListRoute />} />
              <Route path="/rooms/:id" element={<RoomDetailRoute />} />
              <Route path="/admin" element={<RoleRoute role="ADMIN"><AdminDemo /></RoleRoute>} />
              <Route path="/me/profile" element={<ProtectedRoute><AccountCenter /></ProtectedRoute>} />
              <Route path="/me/orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
            </Routes>
            {/* 全局聊天机器人组件，将在所有页面中显示 */}
            <ChatBot />
          </AntLayout>
        </AuthProvider>
      </BrowserRouter>
  );
}