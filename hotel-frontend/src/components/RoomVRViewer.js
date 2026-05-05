import React from 'react';
import { Modal, Space, Typography, Alert, Spin } from 'antd';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import 'react-photo-sphere-viewer/dist/index.css';
import { VR_DEFAULT_FALLBACK } from '../services/vr';

const { Text, Title } = Typography;

export default function RoomVRViewer({ open, onClose, entry, roomName }) {
  const [stage, setStage] = React.useState('idle'); // idle | loading | ready | error
  const [currentSrc, setCurrentSrc] = React.useState(null);

  React.useEffect(() => {
    if (!open) {
      setStage('idle');
      setCurrentSrc(null);
      return;
    }
    const primary = entry?.src || null;
    setCurrentSrc(primary);
    setStage(primary ? 'loading' : 'error');
  }, [open, entry]);

  const fallbackSrc = entry?.fallbackSrc || VR_DEFAULT_FALLBACK;

  React.useEffect(() => {
    if (!open || !currentSrc) return;
    let canceled = false;
    setStage('loading');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!canceled) {
        setStage('ready');
      }
    };
    img.onerror = () => {
      if (canceled) return;
      if (fallbackSrc && currentSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      } else {
        setStage('error');
      }
    };
    img.src = currentSrc;
    return () => {
      canceled = true;
    };
  }, [open, currentSrc, fallbackSrc]);

  const handleClose = () => {
    setStage('idle');
    setCurrentSrc(null);
    onClose?.();
  };

  const title = entry?.title || 'VR 预览';

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      centered
      width={960}
      destroyOnClose
      maskClosable
      title={`${roomName || '房间'} · VR 看房`}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Title level={5} style={{ margin: 0 }}>{title}</Title>
          {entry?.attribution && (
            <Text type="secondary">
              影像来源：
              {entry?.sourceUrl ? (
                <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.attribution}</a>
              ) : (
                entry.attribution
              )}
            </Text>
          )}
        </Space>
        <div style={{ width: '100%', minHeight: 280, height: 480, borderRadius: 16, overflow: 'hidden', background: '#000', position: 'relative' }}>
          {stage === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: 2 }}>
              <Space direction="vertical" align="center">
                <Spin tip="VR 素材加载中…" size="large" />
                <Text style={{ color: '#fff' }} type="secondary">若长时间无响应，请检查网络或稍后再试</Text>
              </Space>
            </div>
          )}
          {stage === 'error' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <Alert
                showIcon
                type="error"
                message="VR 素材加载失败"
                description="当前网络无法访问该全景资源，已为您保留图文信息，请稍后重试。"
              />
            </div>
          )}
          {currentSrc && stage !== 'error' && (
            <ReactPhotoSphereViewer
              key={currentSrc}
              src={currentSrc}
              width="100%"
              height="100%"
              littlePlanet={false}
              navbar={['autorotate', 'zoom', 'fullscreen']}
              containerClass="room-vr-viewer"
              onReady={() => setStage('ready')}
            />
          )}
          {!entry?.src && !currentSrc && stage !== 'loading' && (
            <Alert showIcon type="warning" message="暂未找到与该房型匹配的 VR 数据" style={{ margin: 16 }} />
          )}
        </div>
        {stage === 'error' && (
          <Alert
            showIcon
            type="info"
            message="提示"
            description="可尝试刷新页面或稍后再访问，若问题持续，请联系管理员更新 VR 数据源。"
          />
        )}
      </Space>
    </Modal>
  );
}
