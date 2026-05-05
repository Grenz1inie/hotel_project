import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ErrorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const status = state.status || 'error';
  const title = state.title || '出错了';
  const subTitle = state.subTitle || state.message || '请稍后重试';
  const backTo = state.backTo || '/login';

  return (
    <Result
      status={status}
      title={title}
      subTitle={subTitle}
      extra={<Button type="primary" onClick={() => navigate(backTo, { replace: true })}>返回</Button>}
    />
  );
}
