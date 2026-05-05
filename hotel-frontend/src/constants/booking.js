export const BOOKING_STATUS_META = {
  PENDING: { label: '待审核', color: 'gold' },
  PENDING_CONFIRMATION: { label: '待确认', color: 'orange' },
  PENDING_PAYMENT: { label: '待到店支付', color: 'volcano' },
  CONFIRMED: { label: '已确认', color: 'green' },
  CHECKED_IN: { label: '已入住', color: 'cyan' },
  CHECKED_OUT: { label: '已退房', color: 'blue' },
  CANCELLED: { label: '已取消', color: 'default' },
  REFUND_REQUESTED: { label: '退款申请中', color: 'magenta' },
  REFUNDED: { label: '已退款', color: 'purple' },
};

export const PAYMENT_STATUS_LABELS = {
  UNPAID: '未支付',
  PAID: '已支付',
  PARTIAL_REFUND: '部分退款',
  REFUNDED: '已退款',
  WAIVED: '已免单',
};

export const PAYMENT_METHOD_LABELS = {
  WALLET: '钱包支付',
  ONLINE: '在线支付',
  ARRIVAL: '到店支付',
  DIRECT: '线下支付',
  POS: '线下支付',
  ADMIN: '管理员代订',
};

export const PAYMENT_CHANNEL_ICONS = {
  WECHAT: '微信支付',
  ALIPAY: '支付宝',
  PAYPAL: 'PayPal',
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  UNIONPAY: '银联',
  ARRIVAL: '到店支付',
  WALLET: '钱包余额',
  ONLINE: '在线支付',
  ADMIN: '管理员代订',
};

export function getBookingStatusMeta(status) {
  if (!status) return { label: '未知', color: 'default' };
  const key = String(status).toUpperCase();
  return BOOKING_STATUS_META[key] || { label: key, color: 'default' };
}

export function getPaymentStatusLabel(status) {
  if (!status) return '未知';
  const key = String(status).toUpperCase();
  return PAYMENT_STATUS_LABELS[key] || key;
}

export function getPaymentMethodLabel(method) {
  if (!method) return '其他';
  const key = String(method).toUpperCase();
  return PAYMENT_METHOD_LABELS[key] || key;
}
