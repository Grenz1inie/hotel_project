import React from 'react';
import {
	Card,
	Space,
	Typography,
	InputNumber,
	Button,
	message,
	Row,
	Col,
	Table,
	Tag,
	Form,
	DatePicker,
	Select,
	Spin,
	Dropdown,
	Input,
	Modal,
	Descriptions,
	Empty,
	Progress,
	Tooltip,
	Badge,
	theme,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { getRooms, confirmBooking, checkoutBooking, adminListBookings, checkinBooking, rejectBooking, deleteBooking, adminListRoomInstances, approveRefund, rejectRefund, getRoomInstancesByType, createRoomInstance, updateRoomInstance, deleteRoomInstance, importRooms } from '../services/api';
import VacancyAnalyticsPanel from '../components/VacancyAnalyticsPanel';
import dayjs from 'dayjs';
import { DownOutlined, ApartmentOutlined, RightOutlined, CompassOutlined } from '@ant-design/icons';
import './AdminDemo.css';
import { BOOKING_STATUS_META, getBookingStatusMeta, getPaymentStatusLabel, getPaymentMethodLabel } from '../constants/booking';
import { getRoomStatusMeta } from '../constants/room';
import RoomTimelineModal from '../components/RoomTimelineModal';

const { Title, Text } = Typography;

const EMPTY_ORDERS = { items: [], page: 1, size: 10, total: 0 };

const SECTION_TITLE_STYLE = {
	fontSize: 18,
	fontWeight: 600,
	lineHeight: '24px',
	display: 'inline-flex',
	alignItems: 'center',
	gap: 8,
};

const DEFAULT_THEME_COLOR = '#2F54EB';

function resolveOccupancyStroke(ratio) {
	const clamped = Math.min(Math.max(Number(ratio) || 0, 0), 1);
	const startColor = '#4CAF50';
	const midColor = '#FFC107';
	const endColor = '#FF4D4F';
	if (clamped <= 0.5) {
		const progress = clamped / 0.5;
		return {
			'0%': startColor,
			'100%': interpolateColor(startColor, midColor, progress),
		};
	}
	const progress = (clamped - 0.5) / 0.5;
	return {
		'0%': midColor,
		'100%': interpolateColor(midColor, endColor, progress),
	};
}

function interpolateColor(from, to, progress) {
	const start = parseInt(from.replace('#', ''), 16);
	const end = parseInt(to.replace('#', ''), 16);
	const sr = (start >> 16) & 255;
	const sg = (start >> 8) & 255;
	const sb = start & 255;
	const er = (end >> 16) & 255;
	const eg = (end >> 8) & 255;
	const eb = end & 255;
	const r = Math.round(sr + (er - sr) * progress);
	const g = Math.round(sg + (eg - sg) * progress);
	const b = Math.round(sb + (eb - sb) * progress);
	return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgba(hex, alpha = 1) {
	if (!hex) {
		return `rgba(47, 84, 235, ${alpha})`;
	}
	const normalized = String(hex).trim();
	const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
	if (!match) {
		return `rgba(47, 84, 235, ${alpha})`;
	}
	const intVal = parseInt(match[1], 16);
	const r = (intVal >> 16) & 255;
	const g = (intVal >> 8) & 255;
	const b = intVal & 255;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function AdminDemo() {
	const { token } = theme.useToken();
	const isDarkMode = token.colorBgBase === '#000000' || token.colorBgBase === '#141414';
	const [rooms, setRooms] = React.useState([]);
	const [loading, setLoading] = React.useState(false);
	const [orders, setOrders] = React.useState(() => ({ ...EMPTY_ORDERS }));
	const [ordersLoading, setOrdersLoading] = React.useState(false);
	const [orderFilters, setOrderFilters] = React.useState({});
	const [orderSortBy, setOrderSortBy] = React.useState('status'); // 'status' 或 'time'
	const [roomInstances, setRoomInstances] = React.useState([]);
	const [roomInstancesLoading, setRoomInstancesLoading] = React.useState(false);
	const [selectedRoom, setSelectedRoom] = React.useState(null);
	const [timelineRoomType, setTimelineRoomType] = React.useState(null);
	// 房间实例管理相关状态
	const [selectedRoomType, setSelectedRoomType] = React.useState(null);
	const [roomTypeInstances, setRoomTypeInstances] = React.useState([]);
	const [roomManageVisible, setRoomManageVisible] = React.useState(false);
	const [roomManageLoading, setRoomManageLoading] = React.useState(false);
	const [roomForm] = Form.useForm();
	// 订单详情Modal
	const [selectedOrder, setSelectedOrder] = React.useState(null);
	const [orderDetailVisible, setOrderDetailVisible] = React.useState(false);
	const navigate = useNavigate();

	const load = React.useCallback(async () => {
		try {
			setLoading(true);
			const data = await getRooms();
			setRooms(Array.isArray(data) ? data : []);
		} catch (e) {
			navigate('/error', { state: { status: '500', title: '加载失败', subTitle: '无法连接后端', backTo: '/' }, replace: true });
		} finally {
			setLoading(false);
		}
	}, [navigate]);

	React.useEffect(() => { load(); }, [load]);

	const statusPriority = React.useMemo(() => ({
		PENDING: 1,
		PENDING_CONFIRMATION: 2,
		PENDING_PAYMENT: 3,
		CONFIRMED: 4,
		CHECKED_IN: 5,
		CHECKED_OUT: 6,
		CANCELLED: 7,
		REFUNDED: 8,
	}), []);

	const resolveStatusPriority = React.useCallback((rawStatus) => {
		if (!rawStatus) return 99;
		const key = typeof rawStatus === 'string' ? rawStatus.trim().toUpperCase() : rawStatus;
		return statusPriority[key] ?? 99;
	}, [statusPriority]);

	const statusOptions = React.useMemo(() => Object.entries(BOOKING_STATUS_META)
		.sort(([a], [b]) => resolveStatusPriority(a) - resolveStatusPriority(b))
		.map(([value, meta]) => ({ label: meta.label, value })), [resolveStatusPriority]);

	const loadOrders = React.useCallback(async ({ page: overridePage, size: overrideSize, filters, sortBy } = {}) => {
		try {
			setOrdersLoading(true);
			const effectiveFilters = filters !== undefined ? filters : orderFilters;
			const effectiveSortBy = sortBy !== undefined ? sortBy : orderSortBy;
			const query = {
				...effectiveFilters,
				page: overridePage ?? orders.page,
				size: overrideSize ?? orders.size,
				sortBy: effectiveSortBy,
			};
			const res = await adminListBookings(query);
			let next;
			if (!res) {
				next = { ...EMPTY_ORDERS, page: query.page, size: query.size };
			} else if (Array.isArray(res)) {
				next = {
					...EMPTY_ORDERS,
					items: res, // 后端已排序，前端不再排序
					total: res.length,
					page: query.page,
					size: query.size,
				};
			} else {
				const items = Array.isArray(res.items) ? res.items : [];
				next = {
					...EMPTY_ORDERS,
					...res,
					items: items, // 后端已排序，前端不再排序
					page: res.page ?? query.page,
					size: res.size ?? query.size,
				};
			}
			setOrders(next);
		} catch (e) {
			const msg = e?.data?.message || '订单加载失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '加载订单失败', subTitle: msg, backTo: '/admin' }, replace: true });
		} finally {
			setOrdersLoading(false);
		}
	}, [orderFilters, orderSortBy, navigate, orders.page, orders.size]);

	const loadRoomInstances = React.useCallback(async (params = {}) => {
		try {
			setRoomInstancesLoading(true);
			const data = await adminListRoomInstances(params);
			if (Array.isArray(data)) {
				setRoomInstances(data);
			} else if (Array.isArray(data?.items)) {
				setRoomInstances(data.items);
			} else {
				setRoomInstances([]);
			}
		} catch (e) {
			const msg = e?.data?.message || '房间状态加载失败';
			message.error(msg);
			setRoomInstances([]);
		} finally {
			setRoomInstancesLoading(false);
		}
	}, []);

	React.useEffect(() => {
		loadOrders();
	}, [loadOrders]);

	React.useEffect(() => {
		loadRoomInstances();
	}, [loadRoomInstances]);

	// ================== 导出房型 ==================
	const handleExportRooms = () => {
		const dataStr = JSON.stringify(rooms, null, 2);
		const blob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'rooms_export.json';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		message.success('导出成功');
	};

	// ================== 导入房型 ==================
	const handleImportRooms = (e) => {
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async (event) => {
			try {
				const json = JSON.parse(event.target.result);
				// 核心修复点：处理前后端数据格式不一致的问题
				const processedData = json.map(room => ({
					...room,
					// 1. 还原前端数组为后端需要的逗号分隔字符串
					images: Array.isArray(room.images) ? room.images.join(',') : room.images,
					amenities: Array.isArray(room.amenities) ? room.amenities.join(',') : room.amenities,
					// 2. 将前端的 boolean (true/false) 转回后端需要的 Integer (1/0)
					isActive: typeof room.isActive === 'boolean' ? (room.isActive ? 1 : 0) : room.isActive
				}));

				await importRooms(processedData);
				message.success('导入成功');
				load(); // 刷新房型数据
			} catch (error) {
				message.error('导入失败：' + (error?.data?.message || '文件解析或网络错误'));
			}
		};
		reader.readAsText(file);
		e.target.value = null; // 重置 input 以支持重复上传相同文件
	};

	const roomTypeMap = React.useMemo(() => {
		const map = new Map();
		rooms.forEach((room) => {
			if (room?.id != null) {
				map.set(room.id, room);
			}
		});
		return map;
	}, [rooms]);

	// 房间实例Map - 用于通过房间ID查找房间信息
	const roomInstanceMap = React.useMemo(() => {
		const map = new Map();
		roomInstances.forEach((room) => {
			if (room?.id != null) {
				map.set(room.id, room);
			}
		});
		return map;
	}, [roomInstances]);

	const groupedRooms = React.useMemo(() => {
		const groups = [];
		rooms.forEach((roomType) => {
			const bucket = roomInstances.filter((ri) => ri.roomTypeId === roomType.id);
			if (bucket.length) {
				groups.push({ roomType, rooms: bucket });
			}
		});
		const fallback = new Map();
		roomInstances.forEach((ri) => {
			if (!roomTypeMap.has(ri.roomTypeId)) {
				if (!fallback.has(ri.roomTypeId)) {
					fallback.set(ri.roomTypeId, []);
				}
				fallback.get(ri.roomTypeId).push(ri);
			}
		});
		fallback.forEach((list, key) => {
			groups.push({ roomType: { id: key, name: `房型 #${key}`, hotelId: list[0]?.hotelId }, rooms: list });
		});
		return groups;
	}, [rooms, roomInstances, roomTypeMap]);

	const doConfirm = async (id) => {
		try {
			const res = await confirmBooking(id);
			if (!res) {
				message.error('确认失败');
			} else {
				message.success('已确认');
				loadOrders();
				loadRoomInstances();
			}
		} catch (e) {
			const msg = e?.data?.message || '确认失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '确认失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doCheckout = async (id) => {
		try {
			const res = await checkoutBooking(id);
			if (!res) {
				message.error('退房失败');
			} else {
				message.success('已退房');
				loadOrders();
				loadRoomInstances();
			}
		} catch (e) {
			const msg = e?.data?.message || '退房失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '退房失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doCheckin = async (id) => {
		try {
			const res = await checkinBooking(id);
			if (!res) {
				message.error('入住失败');
			} else {
				message.success('已标记入住');
				loadOrders();
				loadRoomInstances();
			}
		} catch (e) {
			const msg = e?.data?.message || '入住失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '入住失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doReject = async (id) => {
		try {
			const res = await rejectBooking(id);
			if (!res) {
				message.error('拒绝失败');
			} else {
				message.success('已拒绝');
				loadOrders();
				loadRoomInstances();
			}
		} catch (e) {
			const msg = e?.data?.message || '拒绝失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '拒绝失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doApproveRefund = async (id) => {
		try {
			const res = await approveRefund(id);
			if (!res) {
				message.error('批准退款失败');
			} else {
				message.success('退款已批准');
				loadOrders();
				loadRoomInstances();
			}
		} catch (e) {
			const msg = e?.data?.message || '批准退款失败';
			message.error(msg);
		}
	};

	const doRejectRefund = async (id) => {
		Modal.confirm({
			title: '拒绝退款申请',
			content: (
				<div>
					<p>确定要拒绝此退款申请吗？</p>
					<textarea
						id="reject-refund-reason"
						placeholder="请说明拒绝原因（可选）"
						style={{ width: '100%', minHeight: 80, marginTop: 8, padding: 8 }}
					/>
				</div>
			),
			okText: '确认拒绝',
			cancelText: '取消',
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					const reason = document.getElementById('reject-refund-reason')?.value || '';
					const res = await rejectRefund(id, reason);
					if (!res) {
						message.error('拒绝退款失败');
					} else {
						message.success('已拒绝退款申请');
						loadOrders();
						loadRoomInstances();
					}
				} catch (e) {
					const msg = e?.data?.message || '拒绝退款失败';
					message.error(msg);
				}
			}
		});
	};

	const doDelete = async (id) => {
		try {
			const res = await deleteBooking(id);
			if (!res) {
				message.error('删除失败');
			} else {
				message.success('已删除');
				loadOrders();
				loadRoomInstances();
			}
		} catch (e) {
			const msg = e?.data?.message || '删除失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '删除失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	// 房间实例管理函数
	const openRoomManage = async (roomType) => {
		setSelectedRoomType(roomType);
		setRoomManageVisible(true);
		setRoomManageLoading(true);
		try {
			const data = await getRoomInstancesByType(roomType.id);
			setRoomTypeInstances(Array.isArray(data) ? data : []);
		} catch (e) {
			message.error(e?.data?.message || '加载房间列表失败');
			setRoomTypeInstances([]);
		} finally {
			setRoomManageLoading(false);
		}
	};

	const closeRoomManage = () => {
		setRoomManageVisible(false);
		setSelectedRoomType(null);
		setRoomTypeInstances([]);
		roomForm.resetFields();
	};

	const handleAddRoom = () => {
		roomForm.resetFields();
		roomForm.setFieldsValue({ status: 1 }); // 默认空房状态
		Modal.confirm({
			title: `添加新房间 - ${selectedRoomType?.name}`,
			width: 480,
			content: (
				<Form form={roomForm} layout="vertical" style={{ marginTop: 16 }}>
					<Form.Item label="房间号" name="roomNumber" rules={[{ required: true, message: '请输入房间号' }]}>
						<Input placeholder="例如：101" />
					</Form.Item>
					<Form.Item label="楼层" name="floor" rules={[{ required: true, message: '请输入楼层' }]}>
						<InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="例如：1" />
					</Form.Item>
					<Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
						<Select>
							<Select.Option value={1}>空房</Select.Option>
							<Select.Option value={4}>待打扫</Select.Option>
							<Select.Option value={5}>维修中</Select.Option>
							<Select.Option value={0}>锁定</Select.Option>
						</Select>
					</Form.Item>
				</Form>
			),
			onOk: async () => {
				try {
					const values = await roomForm.validateFields();
					await createRoomInstance(selectedRoomType.id, values);
					message.success('添加成功');
					// 刷新列表
					const data = await getRoomInstancesByType(selectedRoomType.id);
					setRoomTypeInstances(Array.isArray(data) ? data : []);
					load();
					loadRoomInstances();
				} catch (e) {
					if (e.errorFields) return Promise.reject();
					message.error(e?.data?.message || '添加失败');
					throw e;
				}
			}
		});
	};

	const handleEditRoom = (room) => {
		roomForm.setFieldsValue({
			roomNumber: room.roomNumber,
			floor: room.floor,
			status: room.status
		});
		Modal.confirm({
			title: `编辑房间 - ${room.roomNumber}`,
			width: 480,
			content: (
				<Form form={roomForm} layout="vertical" style={{ marginTop: 16 }}>
					<Form.Item label="房间号" name="roomNumber" rules={[{ required: true, message: '请输入房间号' }]}>
						<Input placeholder="例如：101" />
					</Form.Item>
					<Form.Item label="楼层" name="floor" rules={[{ required: true, message: '请输入楼层' }]}>
						<InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="例如：1" />
					</Form.Item>
					<Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
						<Select>
							<Select.Option value={1}>空房</Select.Option>
							<Select.Option value={4}>待打扫</Select.Option>
							<Select.Option value={5}>维修中</Select.Option>
							<Select.Option value={0}>锁定</Select.Option>
						</Select>
					</Form.Item>
					<div style={{ marginTop: 8, padding: 8, background: isDarkMode ? '#262626' : '#f0f0f0', borderRadius: 4 }}>
						<Text type="secondary" style={{ fontSize: 12 }}>
							提示：已预订、已入住状态由系统通过订单自动管理
						</Text>
					</div>
				</Form>
			),
			onOk: async () => {
				try {
					const values = await roomForm.validateFields();
					await updateRoomInstance(room.id, values);
					message.success('修改成功');
					// 刷新列表
					const data = await getRoomInstancesByType(selectedRoomType.id);
					setRoomTypeInstances(Array.isArray(data) ? data : []);
					load();
					loadRoomInstances();
				} catch (e) {
					if (e.errorFields) return Promise.reject();
					message.error(e?.data?.message || '修改失败');
					throw e;
				}
			}
		});
	};

	const handleDeleteRoom = (room) => {
		Modal.confirm({
			title: '确认删除',
			content: `确定要删除房间 ${room.roomNumber} 吗？此操作不可恢复。`,
			okText: '确定删除',
			cancelText: '取消',
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					await deleteRoomInstance(room.id);
					message.success('删除成功');
					// 刷新列表
					const data = await getRoomInstancesByType(selectedRoomType.id);
					setRoomTypeInstances(Array.isArray(data) ? data : []);
					load();
					loadRoomInstances();
				} catch (e) {
					message.error(e?.data?.message || '删除失败');
					throw e;
				}
			}
		});
	};

	// 打开订单详情
	const openOrderDetail = (order) => {
		setSelectedOrder(order);
		setOrderDetailVisible(true);
	};

	// 关闭订单详情
	const closeOrderDetail = () => {
		setSelectedOrder(null);
		setOrderDetailVisible(false);
	};

	const orderColumns = [
		{
			title: '操作',
			key: 'actions',
			width: 150,
			fixed: 'left',
			render: (_, record) => {
				const actionItems = [];

				// PENDING: 待审核 - 可以确认或拒绝
				if (record.status === 'PENDING') {
					actionItems.push({ key: 'confirm', label: '确认订单' });
					actionItems.push({ key: 'reject', label: '拒���订单' });
				}

				// PENDING_CONFIRMATION: 待确认(已支付) - 可以确认入住或拒绝
				if (record.status === 'PENDING_CONFIRMATION') {
					actionItems.push({ key: 'confirm', label: '确认入住' });
					actionItems.push({ key: 'reject', label: '拒绝订单' });
				}

				// PENDING_PAYMENT: 待到店支付 - 可以确认或取消
				if (record.status === 'PENDING_PAYMENT') {
					actionItems.push({ key: 'confirm', label: '确认订单' });
					actionItems.push({ key: 'reject', label: '取消订单' });
				}

				// CONFIRMED: 已确认 - 可以办理入住、办理退房
				if (record.status === 'CONFIRMED') {
					actionItems.push({ key: 'checkin', label: '办理入住' });
					actionItems.push({ key: 'checkout', label: '办理退房' });
				}

				// CHECKED_IN: 已入住 - 只能办理退房
				if (record.status === 'CHECKED_IN') {
					actionItems.push({ key: 'checkout', label: '办理退房' });
				}

				// REFUND_REQUESTED: 退款申请中 - 可以批准或拒绝退款
				if (record.status === 'REFUND_REQUESTED') {
					actionItems.push({ key: 'approve-refund', label: '批准退款' });
					actionItems.push({ key: 'reject-refund', label: '拒绝退款', danger: true });
				}

				// 所有状态都可以删除（除了已入住的订单）
				if (record.status !== 'CHECKED_IN') {
					if (actionItems.length) {
						actionItems.push({ type: 'divider' });
					}
					actionItems.push({ key: 'delete', label: '删除订单', danger: true });
				}

				const handleMenuClick = ({ key }) => {
					switch (key) {
						case 'confirm':
							doConfirm(record.id);
							break;
						case 'reject':
							doReject(record.id);
							break;
						case 'checkin':
							doCheckin(record.id);
							break;
						case 'checkout':
							doCheckout(record.id);
							break;
						case 'approve-refund':
							doApproveRefund(record.id);
							break;
						case 'reject-refund':
							doRejectRefund(record.id);
							break;
						case 'delete':
							Modal.confirm({
								title: `确认删除订单 #${record.id}?`,
								content: '删除后无法恢复，请确认已经处理相关善后。',
								okText: '删除',
								cancelText: '取消',
								okType: 'danger',
								onOk: () => doDelete(record.id),
							});
							break;
						default:
							break;
					}
				};
				return (
					<Space size="small">
						<Button type="link" size="small" onClick={() => openOrderDetail(record)}>
							详情
						</Button>
						<Dropdown menu={{ items: actionItems, onClick: handleMenuClick }}>
							<Button type="link" size="small">
								操作 <DownOutlined />
							</Button>
						</Dropdown>
					</Space>
				);
			},
		},
		{
			title: '订单ID',
			dataIndex: 'id',
			key: 'id',
			width: 100,
			fixed: 'left',
		},
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			width: 120,
			sorter: (a, b) => resolveStatusPriority(a?.status) - resolveStatusPriority(b?.status),
			defaultSortOrder: 'ascend',
			render: s => {
				const meta = getBookingStatusMeta(s);
				return <Tag color={meta.color}>{meta.label}</Tag>;
			}
		},
		{
			title: '入住时间',
			dataIndex: 'startTime',
			key: 'startTime',
			width: 160,
			render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
		},
		{
			title: '离店时间',
			dataIndex: 'endTime',
			key: 'endTime',
			width: 160,
			render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
		},
		{
			title: '金额',
			dataIndex: 'amount',
			key: 'amount',
			width: 120,
			render: v => {
				if (v == null) return '-';
				const num = Number(v);
				return Number.isNaN(num) ? v : `¥${num.toFixed(2)}`;
			}
		},
		{
			title: '联系人',
			dataIndex: 'contactName',
			key: 'contactName',
			width: 120,
			render: v => v || '—'
		},
		{
			title: '联系电话',
			dataIndex: 'contactPhone',
			key: 'contactPhone',
			width: 140,
			render: v => v || '—'
		},
		{
			title: '订单创建时间',
			dataIndex: 'createdAt',
			key: 'createdAt',
			width: 160,
			render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
		},
	];

	return (
		<Space direction="vertical" size={16} style={{ width: '100%' }}>
			<Title level={3} style={{ margin: 0 }}>管理控制台</Title>
			<Card title="订单管理">
				<Form
					layout="inline"
					onFinish={(vals) => {
						const { status, userId, roomTypeId, hotelId, bookingId, contactPhone, range } = vals;
						const filters = {};
						if (status) filters.status = status;
						if (userId) filters.userId = userId;
						if (roomTypeId) filters.roomTypeId = roomTypeId;
						if (hotelId) filters.hotelId = hotelId;
						if (bookingId) filters.bookingId = bookingId;
						if (contactPhone) filters.contactPhone = contactPhone;
						if (range?.[0] && range?.[1]) {
							filters.start = range[0].toISOString();
							filters.end = range[1].toISOString();
						}
						setOrderFilters(filters);
						setOrders(o => ({ ...o, page: 1 }));
						loadOrders({ page: 1, filters });
					}}
				>
					<Form.Item label="订单ID" name="bookingId">
						<InputNumber min={1} placeholder="精确查询" />
					</Form.Item>
					<Form.Item label="状态" name="status">
						<Select
							allowClear
							style={{ width: 180 }}
							options={statusOptions}
						/>
					</Form.Item>
					<Form.Item label="用户ID" name="userId">
						<InputNumber min={1} />
					</Form.Item>
					<Form.Item label="房型ID" name="roomTypeId">
						<InputNumber min={1} />
					</Form.Item>
					<Form.Item label="酒店ID" name="hotelId">
						<InputNumber min={1} />
					</Form.Item>
					<Form.Item label="联系电话" name="contactPhone">
						<Input placeholder="支持模糊匹配" allowClear />
					</Form.Item>
					<Form.Item label="时间范围" name="range">
						<DatePicker.RangePicker showTime />
					</Form.Item>
					<Form.Item>
						<Space>
							<Button type="primary" htmlType="submit">查询</Button>
							<Button onClick={() => {
								setOrderFilters({});
								setOrders(o => ({ ...o, page: 1 }));
								loadOrders({ page: 1, filters: {} });
							}}>重置</Button>
						</Space>
					</Form.Item>
				</Form>

				{/* 排序按钮 */}
				<div style={{ marginTop: 16, marginBottom: 12 }}>
					<Space>
						<Button
							type={orderSortBy === 'time' ? 'primary' : 'default'}
							onClick={() => {
								setOrderSortBy('time');
								loadOrders({ sortBy: 'time', page: 1 });
							}}
						>
							查看最新订单
						</Button>
						<Button
							type={orderSortBy === 'status' ? 'primary' : 'default'}
							onClick={() => {
								setOrderSortBy('status');
								loadOrders({ sortBy: 'status', page: 1 });
							}}
						>
							查看分组订单
						</Button>
					</Space>
				</div>

				<Table
					rowKey="id"
					loading={ordersLoading}
					dataSource={orders.items}
					columns={orderColumns}
					style={{ marginTop: 0 }}
					scroll={{ x: 1200 }}
					pagination={{
						current: orders.page,
						pageSize: orders.size,
						total: orders.total,
						showSizeChanger: true,
						showTotal: (total) => `共 ${total} 条订单`,
						onChange: (p, s) => {
							setOrders(o => ({ ...o, page: p, size: s }));
							loadOrders({ page: p, size: s });
						}
					}}
				/>
			</Card>
			<Card
				title={<span style={SECTION_TITLE_STYLE}>房间状态概览</span>}
				extra={
					<Button type="link" onClick={() => loadRoomInstances()} loading={roomInstancesLoading}>
						刷新
					</Button>
				}
			>
				{groupedRooms.length > 0 ? (
					<div className="room-type-nav">
						<Badge count={groupedRooms.length} offset={[-5, 5]} showZero>
							<Dropdown
								menu={{
									items: groupedRooms.map(({ roomType }) => ({
										key: roomType.id,
										label: (
											<button
												type="button"
												className="room-type-nav__item"
												onClick={() => {
													const el = document.getElementById(`roomType-${roomType.id}`);
													if (el) {
														el.scrollIntoView({ behavior: 'smooth', block: 'start' });
													}
												}}
											>
												📍 {roomType.name || `房型 #${roomType.id}`}
											</button>
										),
									}))
								}}
							>
								<Button
									className="room-type-nav__trigger"
									type="primary"
									size="large"
									icon={<CompassOutlined />}
								>
									🏨 房型快速导航
								</Button>
							</Dropdown>
						</Badge>
						<Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
							💡 点击快速跳转到指定房型
						</Text>
					</div>
				) : null}
				{roomInstancesLoading ? (
					<div style={{ textAlign: 'center', padding: '24px 0' }}><Spin /></div>
				) : groupedRooms.length === 0 ? (
					<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无房间数据" />
				) : (
					<div className="room-type-list">
						{groupedRooms.map(({ roomType, rooms: typeRooms }) => {
							const total = typeRooms.length;
							const available = typeRooms.filter((item) => Number(item.status) === 1).length;
							const fallbackRoomType = roomTypeMap.get(roomType.id) ?? roomType;
							const accentColor = fallbackRoomType.themeColor || DEFAULT_THEME_COLOR;
							const occupancyRatio = total ? (total - available) / total : 0;
							const occupancyRate = Math.round(occupancyRatio * 100);
							const availabilityRate = total ? Math.max(0, 100 - occupancyRate) : 0;
							const statusSummary = typeRooms.reduce((acc, item) => {
								const rawKey = item?.status ?? 'UNKNOWN';
								const numeric = Number(rawKey);
								const key = Number.isFinite(numeric) ? numeric : String(rawKey);
								if (!acc.has(key)) {
									acc.set(key, { count: 0, meta: getRoomStatusMeta(item?.status) });
								}
								const summary = acc.get(key);
								summary.count += 1;
								return acc;
							}, new Map());
							const statusEntries = Array.from(statusSummary.entries()).sort((a, b) => {
								const [keyA] = a;
								const [keyB] = b;
								const numA = Number(keyA);
								const numB = Number(keyB);
								const isNumA = Number.isFinite(numA);
								const isNumB = Number.isFinite(numB);
								if (isNumA && isNumB) return numA - numB;
								if (isNumA) return -1;
								if (isNumB) return 1;
								return String(keyA).localeCompare(String(keyB));
							});
							return (
								<Card
									className="room-type-panel"
									size="small"
									key={roomType.id}
									headStyle={{ borderBottom: 'none', padding: '16px 20px' }}
									bodyStyle={{ padding: 20 }}
									style={{ '--room-type-accent': accentColor }}
									id={`roomType-${roomType.id}`}
									title={
										<div className="room-type-panel__title">
											<div className="room-type-panel__title-text">
												<Text strong className="room-type-panel__name">{fallbackRoomType.name || roomType.name || `房型 #${roomType.id}`}</Text>
												{fallbackRoomType.type ? <span className="room-type-panel__type-tag">{fallbackRoomType.type}</span> : null}
												<Text type="secondary" className="room-type-panel__subtitle">#{roomType.id}</Text>
											</div>
											<div className="room-type-panel__title-actions">
												<div className="room-type-panel__metrics">
													<div className="room-type-panel__metric room-type-panel__metric--progress">
														<Tooltip title={`已使用 ${total - available} / ${total}`}>
															<Progress
																type="dashboard"
																percent={occupancyRate}
																size={76}
																strokeColor={resolveOccupancyStroke(occupancyRatio)}
																trailColor="rgba(0,0,0,0.08)"
															/>
														</Tooltip>
														<Text type="secondary" className="progress-label">入住率</Text>
													</div>
													<div className="room-type-panel__metric-list">
														<div className="room-type-panel__metric-item">
															<span className="room-type-panel__metric-label">总房间</span>
															<span className="room-type-panel__metric-value">{total}</span>
														</div>
														<div className="room-type-panel__metric-item">
															<span className="room-type-panel__metric-label">空房</span>
															<span className="room-type-panel__metric-value room-type-panel__metric-value--available">{available}</span>
														</div>
														<div className="room-type-panel__metric-item">
															<span className="room-type-panel__metric-label">空房率</span>
															<span className="room-type-panel__metric-value">{availabilityRate}%</span>
														</div>
													</div>
												</div>
												<Button
													type="primary"
													size="small"
													className="room-type-panel__timeline-button"
													onClick={() => {
														const resolved = {
															...fallbackRoomType,
															id: fallbackRoomType.id ?? roomType.id,
															hotelId: fallbackRoomType.hotelId ?? roomType.hotelId ?? (typeRooms[0]?.hotelId),
															name: fallbackRoomType.name || roomType.name || `房型 #${roomType.id}`,
															type: fallbackRoomType.type || roomType.type,
															themeColor: accentColor,
														};
														setTimelineRoomType(resolved);
													}}
												>
													查看入住规划
												</Button>
											</div>
										</div>
									}
								>
									{statusEntries.length ? (
										<div className="room-type-panel__status-chips">
											{statusEntries.map(([key, summary]) => (
												<div
													key={`status-${key}`}
													className="room-type-panel__status-chip"
													style={{ '--status-accent': summary.meta.color }}
												>
													<span className="room-type-panel__status-dot" style={{ backgroundColor: summary.meta.color }} />
													{summary.meta.label} · {summary.count} 间
												</div>
											))}
										</div>
									) : null}
									<div className="room-instance-grid">
										{typeRooms.map((room) => {
											const roomMeta = getRoomStatusMeta(room?.status);
											const key = room.id ?? `${room.roomTypeId}-${room.roomNumber}`;
											const baseColor = roomMeta.color || accentColor;
											const roomTypeName = fallbackRoomType.name || roomType.name || `房型 #${roomType.id}`;
											const checkinText = room.checkinTime ? dayjs(room.checkinTime).format('MM-DD HH:mm') : '暂无安排';
											const checkoutText = room.checkoutTime ? dayjs(room.checkoutTime).format('MM-DD HH:mm') : '暂无安排';
											const bookingMeta = room.bookingStatus ? getBookingStatusMeta(room.bookingStatus) : null;
											return (
												<button
													type="button"
													key={key}
													onClick={() => setSelectedRoom(room)}
													className="room-instance-card"
													style={{
														background: isDarkMode
															? `linear-gradient(135deg, ${hexToRgba(baseColor, 0.22)} 0%, rgba(20, 20, 20, 0.94) 80%)`
															: `linear-gradient(135deg, ${hexToRgba(baseColor, 0.22)} 0%, rgba(255, 255, 255, 0.94) 80%)`,
														borderColor: hexToRgba(baseColor, 0.24),
														boxShadow: `0 18px 32px ${hexToRgba(baseColor, 0.16)}`,
													}}
												>
													<div className="room-instance-card__header">
														<Space size={8} wrap align="center">
															<span className="room-instance-card__number">房间 {room.roomNumber || room.id}</span>
															{room.floor != null ? (
																<span className="room-instance-card__chip room-instance-card__chip--muted">
																	<ApartmentOutlined />
																	{room.floor}F
																</span>
															) : null}
														</Space>
														<Tag className="room-instance-card__status" color={roomMeta.color}>{roomMeta.label}</Tag>
													</div>
													<div className="room-instance-card__body">
														<div className="room-instance-card__info-list">
															<div className="room-instance-card__info-item">
																<span className="room-instance-card__info-label">房型</span>
																<span className="room-instance-card__info-value" title={roomTypeName}>{roomTypeName}</span>
															</div>
															<div className="room-instance-card__info-item">
																<span className="room-instance-card__info-label">入住状态</span>
																{bookingMeta ? (
																	<Tag color={bookingMeta.color} className="room-instance-card__booking-tag">{bookingMeta.label}</Tag>
																) : (
																	<span className="room-instance-card__info-value">暂无入住</span>
																)}
															</div>
															<div className="room-instance-card__info-item">
																<span className="room-instance-card__info-label">入住时间</span>
																<span className="room-instance-card__info-value">{checkinText}</span>
															</div>
															<div className="room-instance-card__info-item">
																<span className="room-instance-card__info-label">离店时间</span>
																<span className="room-instance-card__info-value">{checkoutText}</span>
															</div>
														</div>
													</div>
													<div className="room-instance-card__footer">
														<Text type="secondary" className="room-instance-card__hint">点击查看详情</Text>
														<RightOutlined className="room-instance-card__icon" />
													</div>
												</button>
											);
										})}
									</div>
								</Card>
							);
						})}
					</div>
				)}
			</Card>
			<VacancyAnalyticsPanel />
			<Card
				title="房型库存管理"
				style={{ marginTop: 16 }}
				extra={
					<Space>
						<Button onClick={handleExportRooms}>导出房型</Button>
						<Button type="primary" onClick={() => document.getElementById('import-rooms-upload').click()}>
							导入房型
						</Button>
						<input
							type="file"
							id="import-rooms-upload"
							accept=".json"
							style={{ display: 'none' }}
							onChange={handleImportRooms}
						/>
					</Space>
				}
			>
				<Row gutter={[16, 16]}>
					{rooms.map(r => (
						<Col xs={24} sm={12} md={8} lg={6} key={r.id}>
							<Card
								loading={loading}
								hoverable
								onClick={() => openRoomManage(r)}
								style={{ cursor: 'pointer' }}
							>
								<Space direction="vertical" style={{ width: '100%' }}>
									<Title level={5} style={{ margin: 0 }}>{r.name}</Title>
									<Text type="secondary">{r.type}</Text>
									<div style={{ marginTop: 8 }}>
										<Text>总房间数：{r.totalCount}</Text>
										<br />
										<Text>可用数：{r.availableCount}</Text>
									</div>
									<Button type="primary" block style={{ marginTop: 8 }}>
										管理房间
									</Button>
								</Space>
							</Card>
						</Col>
					))}
				</Row>
			</Card>

			{/* 房间实例管理弹窗 */}
			<Modal
				open={roomManageVisible}
				title={selectedRoomType ? `房间管理 - ${selectedRoomType.name}` : '房间管理'}
				onCancel={closeRoomManage}
				width={900}
				footer={[
					<Button key="close" onClick={closeRoomManage}>
						关闭
					</Button>,
				]}
			>
				<Space direction="vertical" style={{ width: '100%' }} size="large">
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<Text>当前房型共有 {roomTypeInstances.length} 个房间</Text>
						<Button type="primary" onClick={handleAddRoom}>
							添加新房间
						</Button>
					</div>
					<Table
						loading={roomManageLoading}
						dataSource={roomTypeInstances}
						rowKey="id"
						pagination={false}
						scroll={{ y: 400 }}
						columns={[
							{
								title: '房间号',
								dataIndex: 'roomNumber',
								key: 'roomNumber',
								sorter: (a, b) => {
									const numA = parseInt(a.roomNumber) || 0;
									const numB = parseInt(b.roomNumber) || 0;
									return numA - numB;
								}
							},
							{
								title: '楼层',
								dataIndex: 'floor',
								key: 'floor',
								sorter: (a, b) => (a.floor || 0) - (b.floor || 0),
								render: (floor) => floor ? `${floor}F` : '-'
							},
							{
								title: '状态',
								dataIndex: 'status',
								key: 'status',
								render: (status) => {
									const meta = getRoomStatusMeta(status);
									return <Tag color={meta.color}>{meta.label}</Tag>;
								},
								filters: [
									{ text: '空房', value: 1 },
									{ text: '已预订', value: 2 },
									{ text: '已入住', value: 3 },
									{ text: '待打扫', value: 4 },
									{ text: '维修中', value: 5 },
									{ text: '锁定', value: 0 },
								],
								onFilter: (value, record) => record.status === value,
							},
							{
								title: '操作',
								key: 'actions',
								width: 150,
								render: (_, record) => (
									<Space>
										<Button
											size="small"
											type="link"
											onClick={(e) => {
												e.stopPropagation();
												handleEditRoom(record);
											}}
										>
											编辑
										</Button>
										<Button
											size="small"
											type="link"
											danger
											onClick={(e) => {
												e.stopPropagation();
												handleDeleteRoom(record);
											}}
										>
											删除
										</Button>
									</Space>
								)
							}
						]}
					/>
				</Space>
			</Modal>

			<Modal
				open={!!selectedRoom}
				title={selectedRoom ? `房间 ${selectedRoom.roomNumber || selectedRoom.id}` : '房间详情'}
				onCancel={() => setSelectedRoom(null)}
				footer={[
					<Button key="close" onClick={() => setSelectedRoom(null)}>
						关闭
					</Button>,
				]}
			>
				{selectedRoom ? (() => {
					const bookingMeta = selectedRoom.bookingStatus ? getBookingStatusMeta(selectedRoom.bookingStatus) : null;
					const bookingAmount = selectedRoom.bookingAmount != null ? Number(selectedRoom.bookingAmount) : null;
					const amountText = bookingAmount != null && !Number.isNaN(bookingAmount) ? `¥${bookingAmount.toFixed(2)}` : selectedRoom.bookingAmount ?? '—';
					return (
						<Descriptions column={1} size="small" bordered>
							<Descriptions.Item label="房型">
								{roomTypeMap.get(selectedRoom.roomTypeId)?.name || `房型 #${selectedRoom.roomTypeId}`}
							</Descriptions.Item>
							<Descriptions.Item label="房间号">{selectedRoom.roomNumber || selectedRoom.id}</Descriptions.Item>
							<Descriptions.Item label="状态">
								{(() => {
									const meta = getRoomStatusMeta(selectedRoom.status);
									return (
										<Space size={8} wrap>
											<Tag color={meta.color}>{meta.label}</Tag>
											<Text type="secondary">{meta.description}</Text>
										</Space>
									);
								})()}
							</Descriptions.Item>
							{bookingMeta ? (
								<Descriptions.Item label="入住状态">
									<Tag color={bookingMeta.color}>{bookingMeta.label}</Tag>
								</Descriptions.Item>
							) : null}
							{selectedRoom.bookingId != null ? (
								<Descriptions.Item label="当前订单ID">#{selectedRoom.bookingId}</Descriptions.Item>
							) : null}
							<Descriptions.Item label="楼层">{selectedRoom.floor != null ? `${selectedRoom.floor}F` : '未知'}</Descriptions.Item>
							<Descriptions.Item label="入住时间">{selectedRoom.checkinTime ? dayjs(selectedRoom.checkinTime).format('YYYY-MM-DD HH:mm') : '暂无入住安排'}</Descriptions.Item>
							<Descriptions.Item label="离店时间">{selectedRoom.checkoutTime ? dayjs(selectedRoom.checkoutTime).format('YYYY-MM-DD HH:mm') : '暂无离店安排'}</Descriptions.Item>
							<Descriptions.Item label="入住人">
								{selectedRoom.bookingContactName ? (
									<Space size={8} wrap>
										<Text>{selectedRoom.bookingContactName}</Text>
										{selectedRoom.bookingGuests != null ? <Text type="secondary">{selectedRoom.bookingGuests} 人</Text> : null}
									</Space>
								) : '暂无入住人'}
							</Descriptions.Item>
							<Descriptions.Item label="联系电话">{selectedRoom.bookingContactPhone || '暂无联系电话'}</Descriptions.Item>
							<Descriptions.Item label="订单金额">{amountText}</Descriptions.Item>
							{selectedRoom.bookingRemark ? (
								<Descriptions.Item label="备注">{selectedRoom.bookingRemark}</Descriptions.Item>
							) : null}
							<Descriptions.Item label="最后退房时间">{selectedRoom.lastCheckoutTime ? dayjs(selectedRoom.lastCheckoutTime).format('YYYY-MM-DD HH:mm') : '暂无记录'}</Descriptions.Item>
							<Descriptions.Item label="创建时间">{selectedRoom.createdTime ? dayjs(selectedRoom.createdTime).format('YYYY-MM-DD HH:mm') : '未知'}</Descriptions.Item>
							<Descriptions.Item label="更新时间">{selectedRoom.updatedTime ? dayjs(selectedRoom.updatedTime).format('YYYY-MM-DD HH:mm') : '未知'}</Descriptions.Item>
						</Descriptions>
					);
				})() : null}
			</Modal>

			{/* 订单详情Modal */}
			<Modal
				open={orderDetailVisible}
				title={selectedOrder ? `订单详情 - #${selectedOrder.id}` : '订单详情'}
				onCancel={closeOrderDetail}
				width={800}
				footer={[
					<Button key="close" onClick={closeOrderDetail}>
						关闭
					</Button>,
				]}
			>
				{selectedOrder ? (() => {
					// 获取关联的名称信息
					const roomType = roomTypeMap.get(selectedOrder.roomTypeId);
					const roomInstance = roomInstanceMap.get(selectedOrder.roomId);

					return (
						<Descriptions column={2} bordered size="small">
							<Descriptions.Item label="订单ID" span={2}>
								<Text strong>#{selectedOrder.id}</Text>
							</Descriptions.Item>
							<Descriptions.Item label="订单状态" span={2}>
								{(() => {
									const meta = getBookingStatusMeta(selectedOrder.status);
									return (
										<Space>
											<Tag color={meta.color}>{meta.label}</Tag>
											<Text type="secondary">{meta.description}</Text>
										</Space>
									);
								})()}
							</Descriptions.Item>
							<Descriptions.Item label="用户" span={2}>
								<Space>
									<Text>用户ID: {selectedOrder.userId || '—'}</Text>
									{selectedOrder.contactName && (
										<Text type="secondary">({selectedOrder.contactName})</Text>
									)}
								</Space>
							</Descriptions.Item>
							<Descriptions.Item label="酒店" span={2}>
								<Text>酒店ID: {selectedOrder.hotelId || '—'}</Text>
							</Descriptions.Item>
							<Descriptions.Item label="房型" span={2}>
								<Space direction="vertical" size={0}>
									<Text>房型ID: {selectedOrder.roomTypeId || '—'}</Text>
									{roomType && (
										<Text type="secondary">
											{roomType.name} · {roomType.type}
										</Text>
									)}
								</Space>
							</Descriptions.Item>
							<Descriptions.Item label="房间" span={2}>
								<Space direction="vertical" size={0}>
									<Text>房间ID: {selectedOrder.roomId || '—'}</Text>
									{roomInstance && (
										<Text type="secondary">
											房间号: {roomInstance.roomNumber}
											{roomInstance.floor && ` (${roomInstance.floor}F)`}
										</Text>
									)}
								</Space>
							</Descriptions.Item>
							<Descriptions.Item label="入住时间" span={2}>
								{selectedOrder.startTime ? dayjs(selectedOrder.startTime).format('YYYY-MM-DD HH:mm') : '—'}
							</Descriptions.Item>
							<Descriptions.Item label="离店时间" span={2}>
								{selectedOrder.endTime ? dayjs(selectedOrder.endTime).format('YYYY-MM-DD HH:mm') : '—'}
							</Descriptions.Item>
							<Descriptions.Item label="入住人数">
								{selectedOrder.guests != null ? `${selectedOrder.guests} 人` : '—'}
							</Descriptions.Item>
							<Descriptions.Item label="订单金额">
								{(() => {
									if (selectedOrder.amount == null) return '—';
									const num = Number(selectedOrder.amount);
									return Number.isNaN(num) ? selectedOrder.amount : `¥${num.toFixed(2)}`;
								})()}
							</Descriptions.Item>
							<Descriptions.Item label="联系人姓名" span={2}>
								{selectedOrder.contactName || '—'}
							</Descriptions.Item>
							<Descriptions.Item label="联系电话" span={2}>
								{selectedOrder.contactPhone || '—'}
							</Descriptions.Item>
							<Descriptions.Item label="支付状态" span={2}>
								<Space>
									<Text>{getPaymentStatusLabel(selectedOrder.paymentStatus)}</Text>
									{selectedOrder.paymentMethod && (
										<Text type="secondary">({getPaymentMethodLabel(selectedOrder.paymentMethod)})</Text>
									)}
								</Space>
							</Descriptions.Item>
							{selectedOrder.remark && (
								<Descriptions.Item label="备注" span={2}>
									{selectedOrder.remark}
								</Descriptions.Item>
							)}
							<Descriptions.Item label="创建时间" span={2}>
								{selectedOrder.createdAt ? dayjs(selectedOrder.createdAt).format('YYYY-MM-DD HH:mm:ss') : '—'}
							</Descriptions.Item>
							<Descriptions.Item label="更新时间" span={2}>
								{selectedOrder.updatedAt ? dayjs(selectedOrder.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '—'}
							</Descriptions.Item>
						</Descriptions>
					);
				})() : null}
			</Modal>

			<RoomTimelineModal
				open={!!timelineRoomType}
				roomType={timelineRoomType}
				onClose={() => setTimelineRoomType(null)}
			/>
		</Space>
	);
}
