const BASE = '/api';

// 获取环境变量中的 OSS 基础路径，如果没有则使用默认降级地址
const OSS_BASE = process.env.REACT_APP_OSS_BASE_URL || 'https://hotelhotel.oss-cn-beijing.aliyuncs.com';

// Build full image URL from relative path - 直接使用OSS的图片
export function buildImageUrl(url) {
	if (!url) return '';
	// If already a full URL (http:// or https://), return as is
	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url;
	}
	// 使用环境变量拼接阿里云OSS图片路径
	if (url.startsWith('/images/')) {
		return `${OSS_BASE}${url}`;
	}
	// 如果路径以 images 开头但没有 /，补上
	if (url.startsWith('images/')) {
		return `${OSS_BASE}/${url}`;
	}
	// 其他以 / 开头的路径，假定是相对路径拼接 OSS
	if (url.startsWith('/')) {
		return `${OSS_BASE}${url}`;
	}
	// 否则，假设是相对路径，添加 / 前缀
	return `${OSS_BASE}/${url}`;
}

function getToken() {
	try {
		return localStorage.getItem('auth:token') || '';
	} catch {
		return '';
	}
}

async function parseBody(res) {
	const text = await res.text();
	try { return text ? JSON.parse(text) : null; } catch { return text; }
}

function toBoolean(value) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
	return !!value;
}

function normalizeAmenityList(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.filter(Boolean);
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed.filter(Boolean);
		} catch (e) {
			const urlMatches = value.match(/https?:\/\/[^\s,]+/g);
			if (urlMatches && urlMatches.length) {
				return urlMatches.map((item) => item.trim()).filter(Boolean);
			}
			const parts = value.split(',').map((item) => item.trim()).filter(Boolean);
			if (parts.length) return parts;
		}
	}
	return [];
}

function formatDateTimeInput(value) {
	if (!value) return null;
	if (typeof value === 'string') {
		return value.includes('T') ? value.slice(0, 19) : value;
	}
	if (value instanceof Date && typeof value.toISOString === 'function') {
		return value.toISOString().slice(0, 19);
	}
	if (typeof value === 'object') {
		if (typeof value.format === 'function') {
			return value.format('YYYY-MM-DDTHH:mm:ss');
		}
		if (typeof value.toISOString === 'function') {
			return value.toISOString().slice(0, 19);
		}
	}
	return String(value);
}

function normalizeRoom(room) {
	if (!room || typeof room !== 'object') return room;
	const normalized = { ...room };
	if (normalized.hotel_id != null && normalized.hotelId == null) {
		normalized.hotelId = normalized.hotel_id;
	}
	if (normalized.total_count != null && normalized.totalCount == null) {
		normalized.totalCount = normalized.total_count;
	}
	if (normalized.available_count != null && normalized.availableCount == null) {
		normalized.availableCount = normalized.available_count;
	}
	if (normalized.price_per_night != null && normalized.pricePerNight == null) {
		normalized.pricePerNight = normalized.price_per_night;
	}
	if (normalized.theme_color != null && normalized.themeColor == null) {
		normalized.themeColor = normalized.theme_color;
	}
	if (normalized.area_sqm != null && normalized.areaSqm == null) {
		normalized.areaSqm = normalized.area_sqm;
	}
	if (normalized.max_guests != null && normalized.maxGuests == null) {
		normalized.maxGuests = normalized.max_guests;
	}
	if (normalized.bed_type != null && normalized.bedType == null) {
		normalized.bedType = normalized.bed_type;
	}
	if (normalized.is_active != null && normalized.isActive == null) {
		normalized.isActive = normalized.is_active;
	}
	if (normalized.isActive != null) {
		normalized.isActive = toBoolean(normalized.isActive);
	}
	if (normalized.amenities != null) {
		normalized.amenities = normalizeAmenityList(normalized.amenities);
	}
	if (normalized.areaSqm != null) {
		normalized.areaSqm = Number(normalized.areaSqm);
	}
	if (normalized.maxGuests != null) {
		normalized.maxGuests = Number(normalized.maxGuests);
	}
	if (normalized.totalCount != null) {
		normalized.totalCount = Number(normalized.totalCount);
	}
	if (normalized.availableCount != null) {
		normalized.availableCount = Number(normalized.availableCount);
	}
	if (normalized.pricePerNight != null) {
		const price = Number(normalized.pricePerNight);
		normalized.pricePerNight = Number.isNaN(price) ? normalized.pricePerNight : price;
	}
	if (normalized.themeColor != null) {
		normalized.themeColor = String(normalized.themeColor);
	}
	// Handle images field
	if (normalized.images != null && !Array.isArray(normalized.images)) {
		normalized.images = getImageList(normalized.images);
	}
	if (normalized.images == null) {
		normalized.images = [];
	}
	return normalized;
}

function normalizeRoomInstance(room) {
	if (!room || typeof room !== 'object') return room;
	const normalized = { ...room };
	if (normalized.room_type_id != null && normalized.roomTypeId == null) {
		normalized.roomTypeId = normalized.room_type_id;
	}
	if (normalized.room_number != null && normalized.roomNumber == null) {
		normalized.roomNumber = normalized.room_number;
	}
	if (normalized.hotel_id != null && normalized.hotelId == null) {
		normalized.hotelId = normalized.hotel_id;
	}
	if (normalized.last_checkout_time != null && normalized.lastCheckoutTime == null) {
		normalized.lastCheckoutTime = normalized.last_checkout_time;
	}
	if (normalized.created_time != null && normalized.createdTime == null) {
		normalized.createdTime = normalized.created_time;
	}
	if (normalized.updated_time != null && normalized.updatedTime == null) {
		normalized.updatedTime = normalized.updated_time;
	}
	if (normalized.booking_id != null && normalized.bookingId == null) {
		normalized.bookingId = normalized.booking_id;
	}
	if (normalized.booking_status != null && normalized.bookingStatus == null) {
		normalized.bookingStatus = normalized.booking_status;
	}
	if (normalized.booking_user_id != null && normalized.bookingUserId == null) {
		normalized.bookingUserId = normalized.booking_user_id;
	}
	if (normalized.booking_guests != null && normalized.bookingGuests == null) {
		normalized.bookingGuests = normalized.booking_guests;
	}
	if (normalized.booking_contact_name != null && normalized.bookingContactName == null) {
		normalized.bookingContactName = normalized.booking_contact_name;
	}
	if (normalized.booking_contact_phone != null && normalized.bookingContactPhone == null) {
		normalized.bookingContactPhone = normalized.booking_contact_phone;
	}
	if (normalized.booking_remark != null && normalized.bookingRemark == null) {
		normalized.bookingRemark = normalized.booking_remark;
	}
	if (normalized.booking_amount != null && normalized.bookingAmount == null) {
		normalized.bookingAmount = normalized.booking_amount;
	}
	if (normalized.checkin_time != null && normalized.checkinTime == null) {
		normalized.checkinTime = normalized.checkin_time;
	}
	if (normalized.checkout_time != null && normalized.checkoutTime == null) {
		normalized.checkoutTime = normalized.checkout_time;
	}
	if (normalized.status != null) {
		const val = Number(normalized.status);
		normalized.status = Number.isNaN(val) ? normalized.status : val;
	}
	if (normalized.floor != null) {
		const val = Number(normalized.floor);
		normalized.floor = Number.isNaN(val) ? normalized.floor : val;
	}
	if (normalized.bookingId != null) {
		const val = Number(normalized.bookingId);
		normalized.bookingId = Number.isNaN(val) ? normalized.bookingId : val;
	}
	if (normalized.bookingUserId != null) {
		const val = Number(normalized.bookingUserId);
		normalized.bookingUserId = Number.isNaN(val) ? normalized.bookingUserId : val;
	}
	if (normalized.bookingGuests != null) {
		const val = Number(normalized.bookingGuests);
		normalized.bookingGuests = Number.isNaN(val) ? normalized.bookingGuests : val;
	}
	if (normalized.bookingAmount != null) {
		const val = Number(normalized.bookingAmount);
		normalized.bookingAmount = Number.isNaN(val) ? normalized.bookingAmount : val;
	}
	if (normalized.bookingStatus != null) {
		normalized.bookingStatus = String(normalized.bookingStatus).toUpperCase();
	}
	return normalized;
}

function normalizeBooking(booking) {
	if (!booking || typeof booking !== 'object') return booking;
	const normalized = { ...booking };
	if (normalized.room_type_id != null && normalized.roomTypeId == null) {
		normalized.roomTypeId = normalized.room_type_id;
	}
	if (normalized.room_id != null && normalized.roomId == null) {
		normalized.roomId = normalized.room_id;
	}
	if (normalized.hotel_id != null && normalized.hotelId == null) {
		normalized.hotelId = normalized.hotel_id;
	}
	if (normalized.roomTypeId == null && normalized.roomId != null) {
		normalized.roomTypeId = normalized.roomId;
	}
	if (normalized.start_time != null && normalized.startTime == null) {
		normalized.startTime = normalized.start_time;
	}
	if (normalized.end_time != null && normalized.endTime == null) {
		normalized.endTime = normalized.end_time;
	}
	if (normalized.contact_name != null && normalized.contactName == null) {
		normalized.contactName = normalized.contact_name;
	}
	if (normalized.contact_phone != null && normalized.contactPhone == null) {
		normalized.contactPhone = normalized.contact_phone;
	}
	if (normalized.remark == null && normalized.remarks != null) {
		normalized.remark = normalized.remarks;
	}
	if (normalized.created_at != null && normalized.createdAt == null) {
		normalized.createdAt = normalized.created_at;
	}
	if (normalized.updated_at != null && normalized.updatedAt == null) {
		normalized.updatedAt = normalized.updated_at;
	}
	if (normalized.status != null) {
		normalized.status = String(normalized.status).toUpperCase();
	}
	if (normalized.amount != null) {
		const amount = Number(normalized.amount);
		normalized.amount = Number.isNaN(amount) ? normalized.amount : amount;
	}
	if (normalized.guests != null) {
		const guests = Number(normalized.guests);
		normalized.guests = Number.isNaN(guests) ? normalized.guests : guests;
	}
	return normalized;
}

function normalizeHotel(hotel) {
	if (!hotel || typeof hotel !== 'object') return hotel;
	const normalized = { ...hotel };
	if (normalized.hero_image_url != null && normalized.heroImageUrl == null) {
		normalized.heroImageUrl = normalized.hero_image_url;
	}
	if (normalized.gallery_images != null && normalized.galleryImages == null) {
		normalized.galleryImages = normalized.gallery_images;
	}
	if (normalized.star_level != null && normalized.starLevel == null) {
		normalized.starLevel = normalized.star_level;
	}
	if (normalized.created_time != null && normalized.createdTime == null) {
		normalized.createdTime = normalized.created_time;
	}
	if (normalized.updated_time != null && normalized.updatedTime == null) {
		normalized.updatedTime = normalized.updated_time;
	}
	// Build full URL for hero image
	if (normalized.heroImageUrl) {
		normalized.heroImageUrl = buildImageUrl(normalized.heroImageUrl);
	}
	if (normalized.galleryImages != null && !Array.isArray(normalized.galleryImages)) {
		normalized.galleryImages = getImageList(normalized.galleryImages);
	}
	if (normalized.galleryImages == null) {
		normalized.galleryImages = [];
	}
	return normalized;
}

function normalizePageResponse(payload, mapper) {
	if (!payload) return payload;
	if (Array.isArray(payload)) return mapper ? payload.map(mapper) : payload;
	if (payload && Array.isArray(payload.items) && mapper) {
		return { ...payload, items: payload.items.map(mapper) };
	}
	return payload;
}

async function request(path, { method = 'GET', headers = {}, body, query, auth = true, json = false, redirectOn401 = true } = {}) {
	const url = new URL(BASE + path, window.location.origin);
	if (query) {
		Object.entries(query).forEach(([k, v]) => {
			if (v === undefined || v === null || v === '') return;
			url.searchParams.append(k, String(v));
		});
	}
	const h = { ...headers };
	if (auth) {
		const token = getToken();
		if (token) h['Authorization'] = `Bearer ${token}`;
	}
	if (json && body && !(body instanceof FormData)) {
		h['Content-Type'] = 'application/json';
		body = JSON.stringify(body);
	}
	const res = await fetch(url.toString(), { method, headers: h, body });
	if (!res.ok) {
		const data = await parseBody(res);
		const err = { status: res.status, data };
		if (res.status === 401) {
			err.unauthorized = true;
			if (redirectOn401) {
				try {
					localStorage.removeItem('auth:token');
					localStorage.removeItem('auth:user');
				} catch {}
				if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
					window.location.assign('/login');
				}
			}
		}
		throw err;
	}
	// try parse json, else return text/null
	return parseBody(res);
}

// Auth
export async function loginApi({ username, password }) {
	return request('/auth/login', { method: 'POST', json: true, body: { username, password }, auth: false });
}

export async function registerApi({ username, password, confirmPassword, phone, email }) {
	return request('/auth/register', { method: 'POST', json: true, body: { username, password, confirmPassword, phone, email }, auth: false });
}

export async function meApi() {
	return request('/auth/me', { method: 'GET' });
}

// Rooms
export async function getRooms() {
	// 公共浏览：不要求鉴权，401 不跳转
	const data = await request('/rooms', { auth: false, redirectOn401: false });
	if (!Array.isArray(data)) return [];
	return data
		.map(normalizeRoom)
		.filter((room) => room && typeof room === 'object');
}

export async function getRoomById(id) {
	// 公共浏览
	const data = await request(`/rooms/${id}`, { auth: false, redirectOn401: false });
	const normalized = normalizeRoom(data);
	return normalized && typeof normalized === 'object' ? normalized : null;
}

export async function adjustRoomTotalCount(id, totalCount) {
	return request(`/rooms/${id}/adjust`, { method: 'PUT', query: { totalCount } });
}

export async function importRooms(data) {
	return request('/rooms/import', { method: 'POST', json: true, body: data });
}

// 房间实例管理
export async function getRoomInstancesByType(roomTypeId) {
	return request(`/rooms/room-types/${roomTypeId}/rooms`, { method: 'GET' });
}

export async function createRoomInstance(roomTypeId, data) {
	return request(`/rooms/room-types/${roomTypeId}/rooms`, { 
		method: 'POST', 
		json: true, 
		body: data 
	});
}

export async function updateRoomInstance(roomId, data) {
	return request(`/rooms/rooms/${roomId}`, { 
		method: 'PUT', 
		json: true, 
		body: data 
	});
}

export async function deleteRoomInstance(roomId) {
	return request(`/rooms/rooms/${roomId}`, { method: 'DELETE' });
}

export async function getRoomAvailability(id, { start, end }) {
	// 公共浏览
	const data = await request(`/rooms/${id}/availability`, {
		query: { start: formatDateTimeInput(start), end: formatDateTimeInput(end) },
		auth: false,
		redirectOn401: false
	});
	if (data && typeof data === 'object') {
		const availableCount = Number(data.availableCount);
		return {
			...data,
			available: toBoolean(data.available),
			availableCount: Number.isNaN(availableCount) ? data.availableCount : availableCount
		};
	}
	return data;
}

export async function createBooking({
	roomId,
	userId,
	start,
	end,
	guests,
	contactName,
	contactPhone,
	remark,
	hotelId,
	paymentMethod,
	paymentChannel,
	payNow,
	referenceNo
}) {
	const body = {
		start: formatDateTimeInput(start),
		end: formatDateTimeInput(end),
		userId,
		guests,
		contactName,
		contactPhone,
		remark,
		hotelId,
		paymentMethod,
		paymentChannel,
		payNow,
		referenceNo
	};
	return request(`/rooms/${roomId}/book`, { method: 'POST', json: true, body });
}

// Admin booking ops
export async function confirmBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/confirm`, { method: 'PUT' });
	return normalizeBooking(data);
}

export async function checkoutBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/checkout`, { method: 'PUT' });
	return normalizeBooking(data);
}

export async function checkinBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/checkin`, { method: 'PUT' });
	return normalizeBooking(data);
}

export async function rejectBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/reject`, { method: 'PUT' });
	return normalizeBooking(data);
}

export async function deleteBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}`, { method: 'DELETE' });
	return normalizeBooking(data);
}

// User bookings
export async function getBookingsByUser(userId, { page = 1, size = 10, status } = {}) {
	const data = await request(`/users/${userId}/bookings`, { query: { page, size, status } });
	return normalizePageResponse(data, normalizeBooking);
}

export async function cancelBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/cancel`, { method: 'PUT' });
	return normalizeBooking(data);
}

// 用户申请退款
export async function requestRefund(bookingId, reason) {
	const data = await request(`/bookings/${bookingId}/request-refund`, { 
		method: 'PUT',
		query: reason ? { reason } : {}
	});
	return normalizeBooking(data);
}

// 管理员批准退款
export async function approveRefund(bookingId) {
	const data = await request(`/bookings/${bookingId}/approve-refund`, { method: 'PUT' });
	return normalizeBooking(data);
}

// 管理员拒绝退款
export async function rejectRefund(bookingId, reason) {
	const data = await request(`/bookings/${bookingId}/reject-refund`, { 
		method: 'PUT',
		query: reason ? { reason } : {}
	});
	return normalizeBooking(data);
}

export function getImageList(images) {
	if (!images) return [];
	if (Array.isArray(images)) return images.filter(Boolean).map(buildImageUrl);
	if (typeof images !== 'string') return [];
	return images.split(',').map(s => s.trim()).filter(Boolean).map(buildImageUrl);
}

// Admin: list bookings with filters
export async function adminListBookings({ page = 1, size = 10, status, userId, roomTypeId, roomId, hotelId, bookingId, contactPhone, start, end, sortBy } = {}) {
	const query = { page, size, status, userId, roomTypeId, roomId, hotelId, bookingId, contactPhone, start, end, sortBy };
	const data = await request('/bookings', { query });
	const normalized = normalizePageResponse(data, normalizeBooking);
	if (Array.isArray(normalized)) {
		return { items: normalized, page, size, total: normalized.length };
	}
	return normalized;
}

export async function adminListRoomInstances({ hotelId, roomTypeId, status } = {}) {
	const query = { hotelId, roomTypeId, status };
	const data = await request('/rooms/instances', { query });
	if (!Array.isArray(data)) {
		return [];
	}
	return data.map(normalizeRoomInstance).filter(Boolean);
}

export async function fetchRoomOccupancyOverview({ start, end, hotelId, roomTypeId } = {}) {
	const query = {};
	if (start) query.start = start;
	if (end) query.end = end;
	if (hotelId != null) query.hotelId = hotelId;
	if (roomTypeId != null) query.roomTypeId = roomTypeId;
	const data = await request('/rooms/occupancy-overview', { query });
	if (data && typeof data === 'object') {
		const normalized = { ...data };
		if (Array.isArray(normalized.bookings)) {
			normalized.bookings = normalized.bookings.map(normalizeBooking).filter(Boolean);
		}
		if (Array.isArray(normalized.roomInstances)) {
			normalized.roomInstances = normalized.roomInstances.map(normalizeRoomInstance).filter(Boolean);
		}
		return normalized;
	}
	return { bookings: [], roomInstances: [] };
}

export const ROOM_TIMELINE_PAGE_LIMIT = 7;

export async function getRoomOccupancyTimeline(roomTypeId, { start, end, page = 1, size = ROOM_TIMELINE_PAGE_LIMIT, hotelId } = {}) {
	if (!roomTypeId) return null;
	const normalizedPage = Math.max(1, Number.isFinite(Number(page)) ? Number(page) : 1);
	const normalizedSize = Math.min(ROOM_TIMELINE_PAGE_LIMIT, Math.max(1, Number.isFinite(Number(size)) ? Number(size) : ROOM_TIMELINE_PAGE_LIMIT));
	const query = {
		page: normalizedPage,
		size: normalizedSize,
	};
	if (!start) {
		throw new Error('必须提供开始时间');
	}
	query.start = formatDateTimeInput(start);
	if (end) query.end = formatDateTimeInput(end);
	if (hotelId != null) query.hotelId = hotelId;
	const data = await request(`/rooms/${roomTypeId}/timeline`, { query });
	if (!data || typeof data !== 'object') {
		return data;
	}
	const normalized = { ...data };
	if (Array.isArray(normalized.items)) {
		normalized.items = normalized.items.map((item) => ({
			...item,
			bookings: Array.isArray(item.bookings) ? item.bookings.map(normalizeBooking) : [],
		}));
	}
	return normalized;
}

/**
 * 查询指定房型某日的预订时段（公开接口，无需登录）。
 * 仅返回 { roomTypeId, date, totalRooms, periods: [{startTime, endTime}] }，
 * 不含任何客户敏感信息。
 *
 * @param {number} roomTypeId  房型 ID
 * @param {dayjs|string} date  查询日期（默认今天）
 * @param {number} [hotelId]   可选酒店 ID
 */
export async function getRoomDayAvailability(roomTypeId, date, hotelId) {
	if (!roomTypeId) return null;
	const query = {};
	if (date) {
		// 统一序列化为 YYYY-MM-DD
		const d = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
		query.date = d;
	}
	if (hotelId != null) query.hotelId = hotelId;
	return request(`/rooms/${roomTypeId}/day-availability`, { query });
}

export async function getBookingDetail(id) {
	const data = await request(`/bookings/${id}`);
	return normalizeBooking(data);
}

export async function rescheduleBooking(id, { start, end }) {
	const data = await request(`/bookings/${id}/reschedule`, { method: 'PUT', query: { start, end } });
	return normalizeBooking(data);
}

export async function fetchVacancyAnalytics({ roomTypeIds = [], start, end, granularity, thresholdHigh, thresholdLow, forecastDays } = {}) {
	const query = {};
	if (Array.isArray(roomTypeIds) && roomTypeIds.length) {
		query.roomTypeIds = roomTypeIds.join(',');
	}
	if (start) query.start = start;
	if (end) query.end = end;
	if (granularity) query.granularity = granularity;
	if (thresholdHigh != null) query.thresholdHigh = thresholdHigh;
	if (thresholdLow != null) query.thresholdLow = thresholdLow;
	if (forecastDays != null) query.forecastDays = forecastDays;
	return request('/analytics/vacancy', { query });
}

// Hotel info
export async function getPrimaryHotel() {
	const data = await request('/hotel/primary', { auth: false, redirectOn401: false });
	return normalizeHotel(data);
}

export async function getHotelById(id) {
	const data = await request(`/hotel/${id}`, { auth: false, redirectOn401: false });
	return normalizeHotel(data);
}

// Wallet & profile
export async function getWalletSummary(limit = 10) {
	return request('/wallet/me', { query: { limit } });
}

export async function rechargeWallet({ amount, channel, referenceNo, remark }) {
	return request('/wallet/recharge', { method: 'POST', json: true, body: { amount, channel, referenceNo, remark } });
}

export async function getMyProfile() {
	return request('/users/me/profile', { method: 'GET' });
}

export async function updateMyProfile(payload) {
	return request('/users/me/profile', { method: 'PUT', json: true, body: payload });
}

export async function checkVipUpgrade() {
	return request('/users/me/check-vip-upgrade', { method: 'POST' });
}

export async function getVipPricingSnapshot() {
	return request('/pricing/vip', { method: 'GET', auth: false, redirectOn401: false });
}

export async function getRoomVipRates(roomTypeId) {
	return request(`/pricing/vip/rooms/${roomTypeId}`, { method: 'GET', auth: false, redirectOn401: false });

}