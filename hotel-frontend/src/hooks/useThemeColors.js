import { theme } from 'antd';

/**
 * 自定义Hook: 获取主题感知的颜色
 * 根据当前主题(明/暗)返回适配的颜色值
 */
export const useThemeColors = () => {
  const { token } = theme.useToken();
  
  return {
    // 基础颜色
    colorBgContainer: token.colorBgContainer,
    colorBgElevated: token.colorBgElevated,
    colorBgLayout: token.colorBgLayout,
    colorText: token.colorText,
    colorTextSecondary: token.colorTextSecondary,
    colorTextTertiary: token.colorTextTertiary,
    colorTextQuaternary: token.colorTextQuaternary,
    colorBorder: token.colorBorder,
    colorBorderSecondary: token.colorBorderSecondary,
    
    // 品牌色
    colorPrimary: token.colorPrimary,
    colorSuccess: token.colorSuccess,
    colorWarning: token.colorWarning,
    colorError: token.colorError,
    colorInfo: token.colorInfo,
    
    // 自定义渐变背景 - 根据主题动态调整
    getGradientBg: (isDark) => {
      if (isDark) {
        return 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)';
      }
      return 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)';
    },
    
    // 半透明背景 - 根据主题动态调整
    getOverlayBg: (isDark, opacity = 0.1) => {
      if (isDark) {
        return `rgba(255, 255, 255, ${opacity})`;
      }
      return `rgba(255, 255, 255, ${opacity})`;
    },
    
    // 卡片背景 - 根据主题动态调整
    getCardBg: (isDark) => {
      return isDark ? token.colorBgContainer : '#fff';
    },
    
    // 灰色背景 - 根据主题动态调整
    getGreyBg: (isDark) => {
      return isDark ? '#262626' : '#fafafa';
    },
    
    // 文本颜色 (用于在渐变背景上显示)
    getOverlayText: (isDark) => {
      return '#fff'; // 渐变背景上统一使用白色文字
    },
    
    // 获取当前是否为暗色模式
    isDarkMode: token.colorBgBase === '#000000' || token.colorBgBase === '#141414',
  };
};
