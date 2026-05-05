import React from 'react';
import {
	Card,
	Space,
	Typography,
	DatePicker,
	Select,
	Segmented,
	Button,
	Spin,
	Tooltip,
	List,
	Modal,
	Table,
	Switch,
	Slider,
	Tabs,
	Tag,
	Empty,
	Alert,
	message,
} from 'antd';
import { UndoOutlined, FilePdfOutlined, RetweetOutlined, WarningOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import JsPDF from 'jspdf';
import debounce from 'lodash.debounce';
import { getRooms, fetchVacancyAnalytics } from '../services/api';

const { Title, Text } = Typography;

const CACHE_STORAGE_KEY = 'vacancy_analytics_cache_v4';
const FILTER_KEY = 'vacancy_recent_filters_v4';
const MAX_RECENT_FILTERS = 10;
const CACHE_MAX_ENTRIES = 24;
const DEFAULT_THRESHOLD_HIGH = 0.85;
const DEFAULT_THRESHOLD_LOW = 0.15;

const COLORS = {
	actual: '#2563eb',
	forecastLine: '#a23b72',
	alertHigh: '#ff4d4f',
	alertLow: '#52c41a',
	event: '#faad14',
	highArea: 'rgba(255,77,79,0.18)',
	lowArea: 'rgba(82,196,26,0.18)',
};

function toFiniteNumber(value, fallback = null) {
	if (value == null || value === '') return fallback;
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function normalizeBreakdownMap(map) {
	if (!map || typeof map !== 'object') return null;
	const result = {};
	Object.entries(map).forEach(([key, val]) => {
		if (val == null) return;
		const parsed = toFiniteNumber(val);
		result[key] = parsed != null ? parsed : val;
	});
	return Object.keys(result).length ? result : null;
}

function formatMetric(value, metric) {
	if (value == null) return '-';
	if (metric === 'vacancyCount') {
		return Number(value).toFixed(2);
	}
	return `${(Number(value) * 100).toFixed(2)}%`;
}

const METRIC_OPTIONS = [
	{ label: '空置率', value: 'vacancyRate' },
	{ label: '空置数量', value: 'vacancyCount' },
	{ label: '预订率', value: 'bookingRate' },
];

const GRANULARITY_OPTIONS = [
	{ label: '按小时', value: 'HOUR' },
	{ label: '按日', value: 'DAY' },
];

const RANGE_PRESETS = [
	{ label: '近7天', value: 'LAST_7_DAYS' },
	{ label: '近30天', value: 'LAST_30_DAYS' },
	{ label: '本月', value: 'THIS_MONTH' },
	{ label: '上月', value: 'LAST_MONTH' },
	{ label: '自定义', value: 'CUSTOM' },
];

const DETAIL_COLUMNS = [
	{
		title: '字段',
		dataIndex: 'label',
		key: 'label',
		width: 140,
		render: (text) => <Text type="secondary">{text}</Text>,
	},
	{
		title: '数值',
		dataIndex: 'value',
		key: 'value',
		render: (val) => (val == null || val === '' ? '-' : val),
	},
];

function resolveRange(preset, customRange, granularity) {
	const now = dayjs();
	const end = granularity === 'HOUR' ? now.endOf('hour') : now.endOf('day');
	switch (preset) {
		case 'LAST_7_DAYS':
			return [end.subtract(6, 'day').startOf('day'), end];
		case 'LAST_30_DAYS':
			return [end.subtract(29, 'day').startOf('day'), end];
		case 'THIS_MONTH':
			return [now.startOf('month'), end];
		case 'LAST_MONTH': {
			const lastMonthStart = now.subtract(1, 'month').startOf('month');
			return [lastMonthStart, lastMonthStart.endOf('month')];
		}
		case 'CUSTOM': {
			if (Array.isArray(customRange) && customRange.length === 2) {
				const [start, finish] = customRange;
				if (start && finish) return [dayjs(start), dayjs(finish)];
			}
			return [null, null];
		}
		default:
			return [end.subtract(29, 'day').startOf('day'), end];
	}
}

function getCacheMap() {
	try {
		const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
		if (!raw) return new Map();
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Map();
		return new Map(parsed);
	} catch (err) {
		console.warn('Failed to read cache', err);
		return new Map();
	}
}

function persistCache(map) {
	try {
		sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(Array.from(map.entries())));
	} catch (err) {
		console.warn('Failed to persist cache', err);
	}
}

function cacheAnalytics(key, payload, isHistorical = false) {
	const map = getCacheMap();
	map.set(key, { 
		payload, 
		timestamp: Date.now(),
		isHistorical // 标记是否为历史数据
	});
	if (map.size > CACHE_MAX_ENTRIES) {
		const ordered = Array.from(map.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
		const trimmed = ordered.slice(ordered.length - CACHE_MAX_ENTRIES);
		persistCache(new Map(trimmed));
		return;
	}
	persistCache(map);
}

function getCachedAnalytics(key, ttl) {
	const map = getCacheMap();
	const cached = map.get(key);
	if (!cached) return null;
	
	// 历史数据缓存时间更长（4小时），实时数据缓存时间短（10分钟）
	const defaultTTL = cached.isHistorical ? 4 * 60 * 60 * 1000 : 10 * 60 * 1000;
	const effectiveTTL = ttl !== undefined ? ttl : defaultTTL;
	
	if (Date.now() - cached.timestamp > effectiveTTL) {
		map.delete(key);
		persistCache(map);
		return null;
	}
	return cached.payload;
}

function readFilterSnapshots() {
	try {
		const raw = localStorage.getItem(FILTER_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch (err) {
		console.warn('Failed to read filters', err);
		return [];
	}
}

function saveFilterSnapshot(snapshot) {
	const existing = readFilterSnapshots();
	const filtered = existing.filter(item => JSON.stringify(item.filters) !== JSON.stringify(snapshot.filters));
	filtered.unshift({ ...snapshot, savedAt: dayjs().toISOString() });
	const trimmed = filtered.slice(0, MAX_RECENT_FILTERS);
	localStorage.setItem(FILTER_KEY, JSON.stringify(trimmed));
}

export default function VacancyAnalyticsPanel() {
	const [rooms, setRooms] = React.useState([]);
	const [loadingRooms, setLoadingRooms] = React.useState(false);
	const [analytics, setAnalytics] = React.useState(null);
	const [loading, setLoading] = React.useState(false);
	const [selectedRooms, setSelectedRooms] = React.useState([]);
	const [metric, setMetric] = React.useState('vacancyRate');
	const [granularity, setGranularity] = React.useState('DAY');
	const [rangePreset, setRangePreset] = React.useState('LAST_30_DAYS');
	const [customRange, setCustomRange] = React.useState(null);
	const [thresholdHigh, setThresholdHigh] = React.useState(DEFAULT_THRESHOLD_HIGH);
	const [thresholdLow, setThresholdLow] = React.useState(DEFAULT_THRESHOLD_LOW);
	const [includeForecast, setIncludeForecast] = React.useState(true);
	const [detailPoint, setDetailPoint] = React.useState(null);
	const [previewThresholds, setPreviewThresholds] = React.useState({ high: DEFAULT_THRESHOLD_HIGH, low: DEFAULT_THRESHOLD_LOW });
	const [recentFilters, setRecentFilters] = React.useState(() => readFilterSnapshots());
	const [lastAppliedFilters, setLastAppliedFilters] = React.useState(null);
	const [error, setError] = React.useState(null);
	const [dataSource, setDataSource] = React.useState(null); // 新增：数据来源标识
	const chartInstanceRef = React.useRef(null);
	const chartViewStateRef = React.useRef(null);
	const debouncedReloadRef = React.useRef(null);
	const pendingFiltersRef = React.useRef(null);

	const chartContainerRef = React.useRef(null);
	const commitPreviewThresholds = React.useMemo(() => debounce((next) => {
		setThresholdHigh(next.high);
		setThresholdLow(next.low);
	}, 500), []);

	React.useEffect(() => () => {
		commitPreviewThresholds.cancel();
	}, [commitPreviewThresholds]);

	React.useEffect(() => {
		const loadRooms = async () => {
			try {
				setLoadingRooms(true);
				const data = await getRooms();
				const normalized = Array.isArray(data) ? data.filter(r => r && r.id != null) : [];
				setRooms(normalized);
				if (normalized.length && selectedRooms.length === 0) {
					// 默认选择"云栖禅意套房"
					const yunqiRoom = normalized.find(r => r.name && r.name.includes('云栖禅意套房'));
					if (yunqiRoom) {
						setSelectedRooms([yunqiRoom.id]);
					} else {
						// 如果找不到"云栖禅意套房"，则默认选择第一个房型
						setSelectedRooms([normalized[0].id]);
					}
				}
			} catch (e) {
				message.error('房型列表加载失败');
			} finally {
				setLoadingRooms(false);
			}
		};
		loadRooms();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadAnalytics = React.useCallback(async (overrides = {}) => {
		const appliedRooms = overrides.selectedRooms ?? selectedRooms;
		const appliedGranularity = overrides.granularity ?? granularity;
		const appliedRangePreset = overrides.rangePreset ?? rangePreset;
		const appliedCustomRange = overrides.customRange ?? customRange;
		const appliedHigh = overrides.thresholdHigh ?? thresholdHigh;
		const appliedLow = overrides.thresholdLow ?? thresholdLow;
		const appliedForecast = overrides.includeForecast ?? includeForecast;
		if (!appliedRooms?.length) return;
		const [rangeStart, rangeEnd] = resolveRange(appliedRangePreset, appliedCustomRange, appliedGranularity);
		if (!rangeStart || !rangeEnd) return;
		const requestPayload = {
			roomTypeIds: appliedRooms,
			start: rangeStart.toISOString(),
			end: rangeEnd.toISOString(),
			granularity: appliedGranularity,
			thresholdHigh: appliedHigh,
			thresholdLow: appliedLow,
			forecastDays: appliedForecast ? undefined : 0,
		};
		const cacheKey = JSON.stringify({ ...requestPayload, includeForecast: appliedForecast });
		const cached = overrides.skipCache ? null : getCachedAnalytics(cacheKey);
		if (cached) {
			setAnalytics(cached);
			setError(null);
			setDataSource('cache'); // 标记为缓存数据
		}
		try {
			setLoading(true);
			pendingFiltersRef.current = cacheKey;
			const payload = await fetchVacancyAnalytics(requestPayload);
			if (pendingFiltersRef.current !== cacheKey) return;
			setAnalytics(payload);
			setError(null);
			
			// 判断数据来源：如果查询的是历史数据，则来自数据库；否则为实时计算
			const now = dayjs();
			const isHistoricalData = rangeEnd.isBefore(now, 'day');
			setDataSource(isHistoricalData ? 'database' : 'realtime');
			
			cacheAnalytics(cacheKey, payload, isHistoricalData);
			const snapshot = {
				filters: {
					selectedRooms: appliedRooms,
					metric,
					granularity: appliedGranularity,
					rangePreset: appliedRangePreset,
					customRange: appliedCustomRange ? appliedCustomRange.map(value => (value ? dayjs(value).toISOString() : null)) : null,
					thresholdHigh: appliedHigh,
					thresholdLow: appliedLow,
					includeForecast: appliedForecast,
				},
				description: `${dayjs(rangeStart).format('MM-DD')}~${dayjs(rangeEnd).format('MM-DD')} · ${appliedRooms.length} 房型`,
			};
			saveFilterSnapshot(snapshot);
			setRecentFilters(readFilterSnapshots());
			setLastAppliedFilters(snapshot.filters);
		} catch (e) {
			const status = e?.status || 500;
			const msg = e?.data?.message || '空置数据加载失败';
			setError({ status, message: msg });
			if (!cached) {
				message.error(`${status}：${msg}`);
			}
		} finally {
			if (pendingFiltersRef.current === cacheKey) {
				setLoading(false);
			}
		}
	}, [customRange, granularity, includeForecast, metric, pendingFiltersRef, rangePreset, selectedRooms, thresholdHigh, thresholdLow]);

	const applyFilters = React.useCallback((filters) => {
		if (!filters) return;
		const high = toFiniteNumber(filters.thresholdHigh, DEFAULT_THRESHOLD_HIGH);
		const low = toFiniteNumber(filters.thresholdLow, DEFAULT_THRESHOLD_LOW);
		setSelectedRooms(filters.selectedRooms || []);
		setMetric(filters.metric || 'vacancyRate');
		setGranularity(filters.granularity || 'DAY');
		setRangePreset(filters.rangePreset || 'LAST_30_DAYS');
		setCustomRange(filters.customRange ? filters.customRange.map(value => (value ? dayjs(value) : null)) : null);
		setThresholdHigh(high);
		setThresholdLow(low);
		setIncludeForecast(filters.includeForecast !== false);
		setPreviewThresholds({ high, low });
		loadAnalytics({
			...filters,
			selectedRooms: filters.selectedRooms || [],
			thresholdHigh: high,
			thresholdLow: low,
			skipCache: true,
		});
	}, [loadAnalytics]);

	const handleUndoFilters = React.useCallback(() => {
		if (!lastAppliedFilters) return;
		applyFilters(lastAppliedFilters);
	}, [applyFilters, lastAppliedFilters]);

	const handleApplySnapshot = React.useCallback((filters) => {
		applyFilters(filters);
	}, [applyFilters]);

	const handleRetry = React.useCallback(() => {
		loadAnalytics({ skipCache: true });
	}, [loadAnalytics]);

	const handlePreviewHighChange = React.useCallback((value) => {
		const normalized = Math.min(100, Math.max(value, (previewThresholds.low * 100) + 5));
		setPreviewThresholds(prev => ({ ...prev, high: normalized / 100 }));
	}, [previewThresholds.low]);

	const handlePreviewHighCommit = React.useCallback((value) => {
		const normalized = Math.min(100, Math.max(value, (previewThresholds.low * 100) + 5)) / 100;
		commitPreviewThresholds({ high: normalized, low: previewThresholds.low });
	}, [commitPreviewThresholds, previewThresholds.low]);

	const handlePreviewLowChange = React.useCallback((value) => {
		const normalized = Math.max(0, Math.min(value, (previewThresholds.high * 100) - 5));
		setPreviewThresholds(prev => ({ ...prev, low: normalized / 100 }));
	}, [previewThresholds.high]);

	const handlePreviewLowCommit = React.useCallback((value) => {
		const normalized = Math.max(0, Math.min(value, (previewThresholds.high * 100) - 5)) / 100;
		commitPreviewThresholds({ high: previewThresholds.high, low: normalized });
	}, [commitPreviewThresholds, previewThresholds.high]);

	const handleDataZoom = React.useCallback(() => {
		if (!chartInstanceRef.current) return;
		const option = chartInstanceRef.current.getOption();
		if (!option?.dataZoom) return;
		chartViewStateRef.current = option.dataZoom.map((zoom, index) => ({
			dataZoomIndex: index,
			start: zoom.start,
			end: zoom.end,
		}));
	}, []);

	const handleChartReady = React.useCallback((instance) => {
		chartInstanceRef.current = instance;
		if (!chartViewStateRef.current?.length) return;
		chartViewStateRef.current.forEach((zoom) => {
			instance.dispatchAction({
				type: 'dataZoom',
				dataZoomIndex: zoom.dataZoomIndex,
				start: zoom.start,
				end: zoom.end,
			});
		});
	}, []);

	const handleExportPdf = React.useCallback(async () => {
		if (!chartContainerRef.current) {
			message.info('暂无内容可导出');
			return;
		}
		const canvas = await html2canvas(chartContainerRef.current, { backgroundColor: '#ffffff', useCORS: true, scale: 2 });
		const imgData = canvas.toDataURL('image/png');
		const pdf = new JsPDF('l', 'pt', 'a4');
		const pageWidth = pdf.internal.pageSize.getWidth();
		const pageHeight = pdf.internal.pageSize.getHeight();
		const ratio = Math.min((pageWidth - 80) / canvas.width, (pageHeight - 160) / canvas.height);
		const imgWidth = canvas.width * ratio;
		const imgHeight = canvas.height * ratio;
		const filtersText = `${dayjs().format('YYYY-MM-DD HH:mm')} · 房型 ${selectedRooms.length || 0} 个 · ${METRIC_OPTIONS.find(m => m.value === metric)?.label ?? ''}`;
		pdf.setFontSize(18);
		pdf.text('酒店空置曲线分析', 40, 48);
		pdf.setFontSize(11);
		pdf.text(filtersText, 40, 68);
		const alertsSummary = analytics?.alerts?.length ? `预警 ${analytics.alerts.length} 条` : '暂无预警';
		pdf.text(alertsSummary, 40, 84);
		pdf.addImage(imgData, 'PNG', 40, 120, imgWidth, imgHeight);
		if (analytics?.alerts?.length) {
			pdf.setFontSize(12);
			pdf.text('关键预警摘要', 40, imgHeight + 160);
			pdf.setFontSize(10);
			analytics.alerts.slice(0, 5).forEach((alert, index) => {
				pdf.text(`${index + 1}. ${alert.roomTypeName} · ${dayjs(alert.start).format('MM-DD HH:mm')} ~ ${dayjs(alert.end).format('MM-DD HH:mm')} · ${alert.reason}`, 40, imgHeight + 180 + (index * 16));
			});
		}
		pdf.save(`vacancy-analytics-${dayjs().format('YYYYMMDD-HHmm')}.pdf`);
	}, [analytics?.alerts, chartContainerRef, metric, selectedRooms.length]);

	React.useEffect(() => {
		debouncedReloadRef.current?.cancel?.();
		debouncedReloadRef.current = debounce(() => {
			loadAnalytics();
		}, 400);
		return () => {
			debouncedReloadRef.current?.cancel?.();
		};
	}, [loadAnalytics]);

	React.useEffect(() => {
		setPreviewThresholds({ high: thresholdHigh, low: thresholdLow });
	}, [thresholdHigh, thresholdLow]);

	React.useEffect(() => {
		if (!selectedRooms.length) return;
		debouncedReloadRef.current?.();
	}, [customRange, granularity, includeForecast, rangePreset, selectedRooms, thresholdHigh, thresholdLow]);

	const computeAvailableRooms = (point) => {
		const vacancy = toFiniteNumber(point?.vacancyCount);
		if (vacancy != null) return vacancy;
		const breakdownValues = Object.values(point?.statusBreakdown || {}).map(toFiniteNumber).filter(v => v != null);
		if (breakdownValues.length) {
			return breakdownValues.reduce((sum, val) => sum + val, 0);
		}
		return null;
	};

	const dataset = React.useMemo(() => {
		if (!analytics?.series?.length) return [];
		const rows = [];
		analytics.series.forEach((series = {}) => {
			const seriesName = series.roomTypeName || (series.roomTypeId != null ? `房型 #${series.roomTypeId}` : '房型');
			const inventorySnapshot = normalizeBreakdownMap(series.inventorySnapshot);
			const totalFromSnapshot = toFiniteNumber(inventorySnapshot?.total);
			const availableFromSnapshot = toFiniteNumber(inventorySnapshot?.available);
			const fallbackTotalRooms = totalFromSnapshot ?? toFiniteNumber(series.totalRooms);
			(series.points || []).forEach((point = {}) => {
				if (!includeForecast && point.forecast) return;
				const ts = dayjs(point.timestamp);
				if (!ts.isValid()) return;
				let vacancyCount = computeAvailableRooms(point);
				if (vacancyCount == null && availableFromSnapshot != null) {
					vacancyCount = availableFromSnapshot;
				}
				const vacancyRate = toFiniteNumber(point.vacancyRate);
				const bookingRate = toFiniteNumber(point.bookingRate);
				if (vacancyCount == null) return;
				const totalRooms = fallbackTotalRooms ?? (vacancyRate != null && vacancyRate > 0
					? vacancyCount / vacancyRate
					: vacancyCount);
				const metricValueMap = { vacancyCount, vacancyRate, bookingRate };
				const value = metricValueMap[metric];
				if (value == null) return;
				if (metric === 'vacancyCount') {
					if (value < 0) return;
					if (toFiniteNumber(totalRooms) != null && value > toFiniteNumber(totalRooms) * 1.05) return;
				} else if (metric === 'vacancyRate' || metric === 'bookingRate') {
					if (value < 0 || value > 1.05) return;
				}
				const normalizedTotalRooms = toFiniteNumber(totalRooms);
				const anomalyReason = [];
				if (vacancyRate != null && (vacancyRate < 0 || vacancyRate > 1)) {
					anomalyReason.push('空置率异常');
				}
				if (vacancyCount < 0) {
					anomalyReason.push('空置数量为负');
				}
				rows.push({
					roomTypeId: series.roomTypeId,
					roomTypeName: seriesName,
					timestamp: ts.toDate(),
					value,
					vacancyCount,
					vacancyRate,
					bookingRate,
					forecast: Boolean(point.forecast),
					sourceBreakdown: normalizeBreakdownMap(point.sourceBreakdown),
					statusBreakdown: normalizeBreakdownMap(point.statusBreakdown),
					averagePrice: toFiniteNumber(point.averagePrice),
					priceStrategy: point.priceStrategy ?? null,
					totalRooms: normalizedTotalRooms,
					anomalyReason: anomalyReason.length ? anomalyReason.join('；') : null,
				});
			});
		});
		const sorted = rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
		const grouped = new Map();
		sorted.forEach(row => {
			const key = row.roomTypeId ?? row.roomTypeName;
			if (!grouped.has(key)) {
				grouped.set(key, []);
			}
			grouped.get(key).push(row);
		});
		grouped.forEach(arr => {
			const valueByDay = new Map();
			arr.forEach((row, index) => {
				const prev = index > 0 ? arr[index - 1] : null;
				if (prev && !row.forecast && !prev.forecast) {
					row.deltaPrev = row.value - prev.value;
					row.prevValue = prev.value;
					row.deltaRatio = prev.value ? row.deltaPrev / prev.value : null;
				} else {
					row.deltaPrev = null;
					row.prevValue = null;
					row.deltaRatio = null;
				}
				if (!row.forecast) {
					const prevDayKey = dayjs(row.timestamp).subtract(1, 'day').startOf('day').valueOf();
					const prevDayValue = valueByDay.get(prevDayKey);
					if (prevDayValue != null) {
						row.deltaPrevDay = row.value - prevDayValue;
						row.deltaPrevDayRatio = prevDayValue ? row.deltaPrevDay / prevDayValue : null;
					} else {
						row.deltaPrevDay = null;
						row.deltaPrevDayRatio = null;
					}
					valueByDay.set(dayjs(row.timestamp).startOf('day').valueOf(), row.value);
				} else {
					row.deltaPrevDay = null;
					row.deltaPrevDayRatio = null;
				}
			});
		});
		return sorted;
	}, [analytics, includeForecast, metric]);

	const inventorySummaries = React.useMemo(() => {
		if (!analytics?.series?.length) return [];
		return analytics.series.map((series = {}) => {
			const name = series.roomTypeName || (series.roomTypeId != null ? `房型 #${series.roomTypeId}` : '房型');
			const snapshot = normalizeBreakdownMap(series.inventorySnapshot) || {};
			const total = toFiniteNumber(snapshot.total ?? series.totalRooms);
			if (total == null) return null;
			const reserved = Math.max(0, toFiniteNumber(snapshot.reserved, 0));
			const occupied = Math.max(0, toFiniteNumber(snapshot.occupied, 0));
			const maintenance = Math.max(0, toFiniteNumber(snapshot.maintenance, 0));
			const locked = Math.max(0, toFiniteNumber(snapshot.locked, 0));
			const availableRaw = toFiniteNumber(snapshot.available);
			const derivedAvailable = total - reserved - occupied - maintenance - locked;
			const available = Math.max(0, Math.min(total, availableRaw != null ? availableRaw : derivedAvailable));
			const vacancyRatio = total > 0 ? available / total : 0;
			return {
				key: series.roomTypeId ?? name,
				roomTypeId: series.roomTypeId,
				name,
				total,
				available,
				reserved,
				occupied,
				maintenance,
				locked,
				vacancyRatio,
			};
		}).filter(Boolean);
	}, [analytics]);

	const alertLines = React.useMemo(() => {
		if (!analytics?.alerts?.length) return [];
		return analytics.alerts.flatMap(alert => {
			const start = dayjs(alert.start);
			const end = dayjs(alert.end);
			if (!start.isValid() || !end.isValid()) return [];
			const color = alert.level === 'HIGH' ? COLORS.alertHigh : COLORS.alertLow;
			const actualPercent = Math.round((toFiniteNumber(alert.actual) ?? 0) * 100);
			const thresholdPercent = Math.round((toFiniteNumber(alert.threshold) ?? 0) * 100);
			return [
				{
					xAxis: start.valueOf(),
					lineStyle: { color, type: 'dashed', width: 1 },
					label: { show: false }, // 不显示标签，只在tooltip中显示
				},
				{
					xAxis: end.valueOf(),
					lineStyle: { color, type: 'dashed', width: 1 },
					label: { show: false }, // 不显示标签，只在tooltip中显示
				},
			];
		});
	}, [analytics]);

	const eventLines = React.useMemo(() => {
		if (!analytics?.events?.length) return [];
		return analytics.events.flatMap(event => {
			const timestamp = dayjs(event.timestamp);
			const endTimestamp = event.endTimestamp ? dayjs(event.endTimestamp) : null;
			
			if (!timestamp.isValid()) return [];
			
			const lines = [];
			
			// 开始标记
			lines.push({
				xAxis: timestamp.valueOf(),
				lineStyle: { color: '#faad14', type: 'dotted', width: 2 },
				label: {
					formatter: `${event.title}\n开始`,
					color: '#faad14',
					rotate: 90,
					fontSize: 11,
					align: 'left',
				},
			});
			
			// 如果有结束时间且不同于开始时间，添加结束标记
			if (endTimestamp && endTimestamp.isValid() && !endTimestamp.isSame(timestamp, 'day')) {
				lines.push({
					xAxis: endTimestamp.valueOf(),
					lineStyle: { color: '#faad14', type: 'dotted', width: 2 },
					label: {
						formatter: `${event.title}\n结束`,
						color: '#faad14',
						rotate: 90,
						fontSize: 11,
						align: 'left',
					},
				});
			}
			
			return lines;
		}).filter(Boolean);
	}, [analytics]);

	const chartStats = React.useMemo(() => {
		if (!dataset.length) return { max: 0, min: 0 };
		let max = Number.NEGATIVE_INFINITY;
		let min = Number.POSITIVE_INFINITY;
		dataset.forEach(row => {
			if (row.value != null) {
				max = Math.max(max, row.value);
				min = Math.min(min, row.value);
			}
		});
		if (!Number.isFinite(max)) max = 0;
		if (!Number.isFinite(min)) min = 0;
		return { max, min };
	}, [dataset]);

	const highlightZones = React.useMemo(() => {
		if (!dataset.length) return { high: [], low: [] };
		const high = [];
		const low = [];
		let currentHigh = null;
		let currentLow = null;
		dataset.filter(row => !row.forecast).forEach(row => {
			const time = row.timestamp.getTime();
			// 只在真正超出阈值时标记（不包括等于）
			if (row.vacancyRate != null && row.vacancyRate > previewThresholds.high) {
				if (!currentHigh) {
					currentHigh = { start: time };
				}
			} else if (currentHigh) {
				high.push([currentHigh.start, time]);
				currentHigh = null;
			}
			if (row.vacancyRate != null && row.vacancyRate < previewThresholds.low) {
				if (!currentLow) {
					currentLow = { start: time };
				}
			} else if (currentLow) {
				low.push([currentLow.start, time]);
				currentLow = null;
			}
		});
		if (currentHigh) {
			high.push([currentHigh.start, dataset[dataset.length - 1].timestamp.getTime()]);
		}
		if (currentLow) {
			low.push([currentLow.start, dataset[dataset.length - 1].timestamp.getTime()]);
		}
		return {
			high: high.map(([start, end]) => ([
				{ xAxis: start, itemStyle: { color: COLORS.highArea } },
				{ xAxis: end },
			])),
			low: low.map(([start, end]) => ([
				{ xAxis: start, itemStyle: { color: COLORS.lowArea } },
				{ xAxis: end },
			])),
		};
	}, [dataset, previewThresholds.high, previewThresholds.low]);

	const chartOption = React.useMemo(() => {
		if (!dataset.length) return null;
		const legendEntries = new Set();
		const seriesMap = new Map();
		dataset.forEach(row => {
			const key = row.roomTypeName || '房型';
			const bucket = row.forecast ? 'forecast' : 'actual';
			if (!seriesMap.has(key)) {
				seriesMap.set(key, { actual: [], forecast: [] });
			}
			const group = seriesMap.get(key);
			const point = {
				value: [row.timestamp.getTime(), row.value],
				rawDatum: row,
			};
			const targetArray = group[bucket];
			if (targetArray.length && targetArray[targetArray.length - 1].value[0] === point.value[0]) {
				targetArray[targetArray.length - 1] = point;
			} else {
				targetArray.push(point);
			}
		});

		const seriesList = [];
		seriesMap.forEach((group, name) => {
			group.actual.sort((a, b) => a.value[0] - b.value[0]);
			group.forecast.sort((a, b) => a.value[0] - b.value[0]);
			if (group.actual.length) {
				// 为每个数据点设置样式：超出阈值的点标记为红色
				const styledData = group.actual.map(point => {
					const vacancyRate = point.rawDatum?.vacancyRate;
					const isOutOfThreshold = vacancyRate != null && 
						(vacancyRate > previewThresholds.high || vacancyRate < previewThresholds.low);
					
					return {
						...point,
						// 超出阈值的点：红色、大尺寸
						itemStyle: isOutOfThreshold ? {
							color: COLORS.alertHigh,
							borderColor: COLORS.alertHigh,
							borderWidth: 2
						} : undefined,
						symbolSize: isOutOfThreshold ? 10 : 6,
					};
				});
				
				seriesList.push({
					name,
					type: 'line',
					smooth: true,
					showSymbol: true,
					symbolSize: 6,
					connectNulls: true,
					emphasis: { focus: 'series' },
					lineStyle: { width: 2 },
					itemStyle: { opacity: 0.95 },
					data: styledData,
				});
				legendEntries.add(name);
			}
			if (group.forecast.length) {
				if (group.actual.length) {
					const lastActual = group.actual[group.actual.length - 1];
					const firstForecast = group.forecast.find(point => !point.__connector);
					if (!firstForecast || firstForecast.value[0] !== lastActual.value[0]) {
						group.forecast.unshift({
							value: [...lastActual.value],
							rawDatum: lastActual.rawDatum,
							__connector: true,
						});
					}
				}
				const forecastSeries = {
					name: `${name}（预测）`,
					type: 'line',
					smooth: true,
					showSymbol: true,
					symbolSize: 6,
					connectNulls: true,
					emphasis: { focus: 'series' },
					lineStyle: { width: 2, type: 'dashed', color: COLORS.forecastLine },
					itemStyle: { opacity: 0.9, color: COLORS.forecastLine },
					data: group.forecast,
				};
				seriesList.push(forecastSeries);
				legendEntries.add(`${name}（预测）`);
			}
		});

		// 只保留事件标记，移除警告线和警告区域
		const markLineData = [...eventLines];
		if (seriesList.length) {
			const [firstSeries, ...rest] = seriesList;
			const enhancedFirst = {
				...firstSeries,
				lineStyle: { ...firstSeries.lineStyle, color: COLORS.actual },
				itemStyle: { ...firstSeries.itemStyle, color: COLORS.actual },
			};
			
			// 添加Y轴阈值线（水平虚线）
			const thresholdLines = [];
			if (metric === 'vacancyRate') {
				// 高阈值线
				thresholdLines.push({
					yAxis: previewThresholds.high,
					lineStyle: { 
						color: COLORS.alertHigh, 
						type: 'dashed', 
						width: 2 
					},
					label: {
						formatter: `高阈值 ${Math.round(previewThresholds.high * 100)}%`,
						position: 'end',
						color: COLORS.alertHigh,
						fontSize: 11
					}
				});
				// 低阈值线
				thresholdLines.push({
					yAxis: previewThresholds.low,
					lineStyle: { 
						color: COLORS.alertLow, 
						type: 'dashed', 
						width: 2 
					},
					label: {
						formatter: `低阈值 ${Math.round(previewThresholds.low * 100)}%`,
						position: 'end',
						color: COLORS.alertLow,
						fontSize: 11
					}
				});
			}
			
			if (markLineData.length || thresholdLines.length) {
				enhancedFirst.markLine = {
					symbol: ['none', 'none'],
					silent: true,
					label: { fontSize: 11, distance: 10 },
					data: [...markLineData, ...thresholdLines],
				};
				if (thresholdLines.length) {
					legendEntries.add('阈值线');
				}
			}
			
			// 移除markArea（红色区域）
			
			if (analytics?.events?.length) {
				// 为每个事件创建标记点（开始和结束）
				const eventMarkers = analytics.events.flatMap(event => {
					const startTime = dayjs(event.timestamp).valueOf();
					const endTime = event.endTimestamp ? dayjs(event.endTimestamp).valueOf() : null;
					const markers = [];
					
					// 开始标记
					markers.push({
						name: `${event.title}（开始）`,
						coord: [startTime, chartStats.max * 0.95],
						value: chartStats.max,
						event,
						symbolSize: endTime && endTime !== startTime ? 38 : 42,
						label: {
							formatter: '🎉',
							color: '#fff',
							fontSize: 16,
						},
					});
					
					// 如果有结束时间且与开始时间不同，添加结束标记
					if (endTime && endTime !== startTime) {
						markers.push({
							name: `${event.title}（结束）`,
							coord: [endTime, chartStats.max * 0.95],
							value: chartStats.max,
							event: { ...event, isEndMarker: true },
							symbolSize: 38,
							label: {
								formatter: '🎊',
								color: '#fff',
								fontSize: 16,
							},
						});
					}
					
					return markers;
				});
				
				enhancedFirst.markPoint = {
					symbol: 'pin',
					symbolSize: 42,
					itemStyle: { color: COLORS.event },
					data: eventMarkers,
				};
				legendEntries.add('关键事件');
			}
			seriesList.splice(0, seriesList.length, enhancedFirst, ...rest);
		}

		const legendFormatter = (name) => {
			if (name.includes('预测')) return `⛅ ${name}`;
			if (name === '关键事件') return '📅 关键事件';
			if (name === '阈值线') return '📏 阈值线';
			return `● ${name}`;
		};

		return {
			grid: { left: 72, right: 48, top: 88, bottom: 96 },
			legend: {
				type: 'scroll',
				top: 16,
				left: 16,
				formatter: legendFormatter,
				data: Array.from(legendEntries),
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'line' },
				formatter: (params = []) => {
					if (!params.length) return '';
					const [first] = params;
					const time = dayjs(first.value?.[0] ?? first.axisValue).format(
						granularity === 'HOUR' ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD',
					);
					const lines = [`<strong>${time}</strong>`];
					
					// 检查当前时间点是否有警告，并使用当前点的实际数据
					const currentTimestamp = first.value?.[0] ?? first.axisValue;
					const currentAlerts = analytics?.alerts?.filter(alert => {
						const start = dayjs(alert.start).valueOf();
						const end = dayjs(alert.end).valueOf();
						return currentTimestamp >= start && currentTimestamp <= end;
					}) || [];
					
					// 显示警告信息（使用当前悬停点的实际空置率）
					if (currentAlerts.length > 0) {
						// 获取当前点的实际空置率数据
						const currentPointData = params.find(item => item?.data?.rawDatum && !item?.data?.__connector);
						const currentVacancyRate = currentPointData?.data?.rawDatum?.vacancyRate;
						
						currentAlerts.forEach(alert => {
							const color = alert.level === 'HIGH' ? COLORS.alertHigh : COLORS.alertLow;
							// 使用当前点的实际空置率，而不是alert中存储的历史值
							const actualPercent = currentVacancyRate != null 
								? Math.round(currentVacancyRate * 100)
								: Math.round((toFiniteNumber(alert.actual) ?? 0) * 100);
							const thresholdPercent = Math.round((toFiniteNumber(alert.threshold) ?? 0) * 100);
							const icon = alert.level === 'HIGH' ? '⚠️' : '🔻';
							
							// 只有当前点确实超出阈值时才显示警告
							const shouldShowAlert = alert.level === 'HIGH' 
								? (currentVacancyRate > alert.threshold)
								: (currentVacancyRate < alert.threshold);
							
							if (shouldShowAlert || currentVacancyRate == null) {
								lines.push(`<span style="color:${color}"><strong>${icon} ${alert.reason}</strong></span>`);
								lines.push(`<span style="color:${color}">实际：${actualPercent}%，阈值：${thresholdPercent}%</span>`);
							}
						});
						lines.push(''); // 空行分隔
					}
					
					const seen = new Set();
					params.forEach(item => {
						const datum = item?.data?.rawDatum;
						if (!datum || item?.data?.__connector) return;
						const key = `${datum.roomTypeName}-${datum.forecast ? 'forecast' : 'actual'}`;
						if (seen.has(key)) return;
						seen.add(key);
						const base = `${datum.roomTypeName}${datum.forecast ? '（预测）' : ''}`;
						const primary = `${base}：${formatMetric(datum[metric], metric)}`;
						const deltas = [];
						if (!datum.forecast && datum.deltaPrev != null) {
							const sign = datum.deltaPrev >= 0 ? '+' : '';
							const formatted = metric === 'vacancyCount'
								? `${sign}${datum.deltaPrev.toFixed(2)}`
								: `${sign}${(datum.deltaPrev * 100).toFixed(2)}%`;
							deltas.push(`环比：${formatted}`);
						}
						if (!datum.forecast && datum.deltaPrevDay != null) {
							const sign = datum.deltaPrevDay >= 0 ? '+' : '';
							const formatted = metric === 'vacancyCount'
								? `${sign}${datum.deltaPrevDay.toFixed(2)}`
								: `${sign}${(datum.deltaPrevDay * 100).toFixed(2)}%`;
							deltas.push(`同比：${formatted}`);
						}
						if (datum.anomalyReason) {
							deltas.push(`<span style="color:#ff4d4f">数据异常：${datum.anomalyReason}</span>`);
						}
						lines.push([primary, ...deltas].join('<br/>'));
					});
					return lines.join('<br/>');
				},
			},
			xAxis: {
				type: 'time',
				axisLabel: {
					formatter: (value) => dayjs(value).format(granularity === 'HOUR' ? 'MM-DD HH:mm' : 'MM-DD'),
				},
				splitLine: { show: false },
			},
			yAxis: {
				type: 'value',
				name: `${METRIC_OPTIONS.find(m => m.value === metric)?.label ?? '数值'}（${metric === 'vacancyCount' ? '间' : '%'}）`,
				nameLocation: 'middle',
				nameGap: 52,
				axisLabel: {
					formatter: (val) => (metric === 'vacancyCount' ? Number(val).toFixed(0) : `${(Number(val) * 100).toFixed(0)}%`),
				},
				splitLine: { show: true },
			},
			dataZoom: [
				{ type: 'inside', throttle: 50 },
				{ type: 'slider', bottom: 32 },
			],
			series: seriesList,
		};
	}, [analytics?.events, chartStats.max, dataset, eventLines, granularity, metric, previewThresholds]);

	React.useEffect(() => {
		if (!chartInstanceRef.current || !chartViewStateRef.current?.length) return;
		chartViewStateRef.current.forEach((zoom) => {
			chartInstanceRef.current.dispatchAction({
				type: 'dataZoom',
				dataZoomIndex: zoom.dataZoomIndex,
				start: zoom.start,
				end: zoom.end,
			});
		});
	}, [chartOption]);

	const handleChartClick = React.useCallback((params) => {
		const datum = params?.data?.rawDatum;
		if (!datum || params?.data?.__connector) return;
		setDetailPoint({
			...datum,
			timestamp: dayjs(datum.timestamp),
		});
	}, []);

	const handleExportCsv = React.useCallback(() => {
		if (!dataset.length) {
			message.info('暂无数据可导出');
			return;
		}
		const headers = ['房型', '时间', '空置数量', '空置率', '预订率', '是否预测'];
		const rows = dataset.map(row => ([
			row.roomTypeName,
			dayjs(row.timestamp).format('YYYY-MM-DD HH:mm'),
			row.vacancyCount,
			row.vacancyRate,
			row.bookingRate,
			row.forecast ? '是' : '否',
		]));
		const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
		const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, `vacancy-${dayjs().format('YYYYMMDD-HHmmss')}.csv`);
	}, [dataset]);

	const handleScreenshot = React.useCallback(async () => {
		if (!chartContainerRef.current) return;
		const canvas = await html2canvas(chartContainerRef.current, { backgroundColor: '#fff', useCORS: true, scale: 2 });
		canvas.toBlob((blob) => {
			if (blob) {
				saveAs(blob, `vacancy-chart-${dayjs().format('YYYYMMDD-HHmmss')}.png`);
			}
		});
	}, []);

	const detailDataSource = React.useMemo(() => {
		if (!detailPoint) return [];
		const vacancyCount = toFiniteNumber(detailPoint.vacancyCount);
		const vacancyRate = toFiniteNumber(detailPoint.vacancyRate);
		const bookingRate = toFiniteNumber(detailPoint.bookingRate);
		const averagePrice = toFiniteNumber(detailPoint.averagePrice);
		return [
			{ key: 'room', label: '房型', value: detailPoint.roomTypeName ?? '-' },
			{ key: 'time', label: '时间', value: detailPoint.timestamp?.format?.('YYYY-MM-DD HH:mm') ?? '-' },
			{ key: 'vacancy', label: '空置数量', value: vacancyCount != null ? vacancyCount.toFixed(2) : '-' },
			{ key: 'vacancyRate', label: '空置率', value: vacancyRate != null ? `${(vacancyRate * 100).toFixed(2)}%` : '-' },
			{ key: 'bookingRate', label: '预订率', value: bookingRate != null ? `${(bookingRate * 100).toFixed(2)}%` : '-' },
			{ key: 'price', label: '平均价格', value: averagePrice != null ? `¥${averagePrice.toFixed(2)}` : '-' },
			{ key: 'strategy', label: '价格策略', value: detailPoint.priceStrategy || '-' },
		];
	}, [detailPoint]);

	const detailStatusData = React.useMemo(() => {
		if (!detailPoint?.statusBreakdown) return [];
		return Object.entries(detailPoint.statusBreakdown).map(([k, v]) => {
			const parsed = toFiniteNumber(v);
			return { key: k, label: `状态-${k}`, value: parsed != null ? parsed : v };
		});
	}, [detailPoint]);

	const detailSourceData = React.useMemo(() => {
		if (!detailPoint?.sourceBreakdown) return [];
		return Object.entries(detailPoint.sourceBreakdown).map(([k, v]) => {
			const parsed = toFiniteNumber(v);
			return { key: k, label: `来源-${k}`, value: parsed != null ? parsed : v };
		});
	}, [detailPoint]);

	const detailTabs = React.useMemo(() => {
		if (!detailPoint) return [];
		const items = [];
		items.push({
			key: 'overview',
			label: '基础数据',
			children: (
				<Table
					columns={DETAIL_COLUMNS}
					pagination={false}
					showHeader={false}
					dataSource={detailDataSource}
					size="small"
				/>
			),
		});
		items.push({
			key: 'source',
			label: '来源分析',
			children: detailSourceData.length ? (
				<Table
					columns={DETAIL_COLUMNS}
					pagination={false}
					showHeader={false}
					dataSource={detailSourceData}
					size="small"
				/>
			) : (
				<Empty description="暂无来源数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
			),
		});
		items.push({
			key: 'status',
			label: '状态拆分',
			children: detailStatusData.length ? (
				<Table
					columns={DETAIL_COLUMNS}
					pagination={false}
					showHeader={false}
					dataSource={detailStatusData}
					size="small"
				/>
			) : (
				<Empty description="暂无状态数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
			),
		});
		return items;
	}, [detailDataSource, detailPoint, detailSourceData, detailStatusData]);

	return (
		<Card title={<Space><Title level={4} style={{ margin: 0 }}>房型空置曲线</Title></Space>}>
			<Space direction="vertical" size={16} style={{ width: '100%' }}>
				<Space wrap>
					<Text strong>时间粒度</Text>
					<Segmented options={GRANULARITY_OPTIONS} value={granularity} onChange={setGranularity} />
					<Text strong>时间范围</Text>
					<Segmented options={RANGE_PRESETS} value={rangePreset} onChange={setRangePreset} />
					{rangePreset === 'CUSTOM' && (
						<DatePicker.RangePicker
							allowClear={false}
							value={customRange}
							showTime={granularity === 'HOUR'}
							onChange={(vals) => setCustomRange(vals)}
						/>
					)}
					<Text strong>房型</Text>
					<Select
						showSearch
						mode="multiple"
						placeholder="选择房型"
						style={{ minWidth: 200 }}
						loading={loadingRooms}
						optionFilterProp="label"
						options={rooms.map(room => ({ label: `${room.name ?? room.type ?? '房型'} (#${room.id})`, value: room.id, group: room.category || undefined }))}
						value={selectedRooms}
						onChange={setSelectedRooms}
					/>
					<Text strong>指标</Text>
					<Segmented options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
				</Space>
				<Space wrap align="center">
					<div style={{ minWidth: 220 }}>
						<Space align="center">
							<Tooltip title="空置率高于该阈值将触发预警">
								<Text>高位阈值</Text>
							</Tooltip>
							<Tag color="red">{Math.round(previewThresholds.high * 100)}%</Tag>
						</Space>
						<Slider
							min={5}
							max={95}
							step={1}
							tipFormatter={(val) => `${val}%`}
							value={Math.round(previewThresholds.high * 100)}
							onChange={handlePreviewHighChange}
							onAfterChange={handlePreviewHighCommit}
						/>
					</div>
					<div style={{ minWidth: 220 }}>
						<Space align="center">
							<Tooltip title="空置率低于该阈值将触发预警">
								<Text>低位阈值</Text>
							</Tooltip>
							<Tag color="blue">{Math.round(previewThresholds.low * 100)}%</Tag>
						</Space>
						<Slider
							min={0}
							max={90}
							step={1}
							tipFormatter={(val) => `${val}%`}
							value={Math.round(previewThresholds.low * 100)}
							onChange={handlePreviewLowChange}
							onAfterChange={handlePreviewLowCommit}
						/>
					</div>
					<Space align="center">
						<Text>包含预测</Text>
						<Switch checked={includeForecast} onChange={setIncludeForecast} />
					</Space>
					{dataSource && (
						<Tooltip 
							title={
								dataSource === 'database' 
									? '历史数据来自数据库预计算，加载速度快' 
									: dataSource === 'realtime' 
										? '实时数据根据当前订单计算，反映最新状态'
										: '数据来自浏览器缓存'
							}
						>
							<Tag 
								color={
									dataSource === 'database' 
										? 'green' 
										: dataSource === 'realtime' 
											? 'blue' 
											: 'default'
								}
								icon={
									dataSource === 'database' 
										? '💾' 
										: dataSource === 'realtime' 
											? '⚡' 
											: '📦'
								}
							>
								{dataSource === 'database' 
									? '数据库' 
									: dataSource === 'realtime' 
										? '实时' 
										: '缓存'}
							</Tag>
						</Tooltip>
					)}
					<Button icon={<UndoOutlined />} onClick={handleUndoFilters} disabled={!lastAppliedFilters}>撤销筛选</Button>
					<Button icon={<RetweetOutlined />} onClick={() => loadAnalytics({ skipCache: true })} disabled={!selectedRooms.length}>
						强制刷新
					</Button>
					<Button type="primary" onClick={() => loadAnalytics()} disabled={!selectedRooms.length}>应用筛选</Button>
					<Button onClick={handleExportCsv}>导出CSV</Button>
					<Button onClick={handleScreenshot}>生成截图</Button>
					<Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>导出PDF</Button>
				</Space>
				{recentFilters.length ? (
					<Card size="small" bodyStyle={{ padding: 12 }} title="最近筛选">
						<Space wrap>
							{recentFilters.map(item => (
								<Tag
									key={`${item.savedAt}-${item.description}`}
									icon={<RetweetOutlined />}
									color={JSON.stringify(item.filters) === JSON.stringify(lastAppliedFilters) ? 'blue' : 'default'}
									onClick={() => handleApplySnapshot(item.filters)}
									style={{ cursor: 'pointer' }}
								>
									{item.description}
								</Tag>
							))}
						</Space>
					</Card>
				) : null}
				{inventorySummaries.length ? (
					<Card size="small" bodyStyle={{ padding: 12 }} title="实时库存概览">
						<Space wrap>
							{inventorySummaries.map(item => {
								const color = item.total === 0
									? 'default'
									: item.vacancyRatio >= thresholdHigh
										? 'red'
										: item.vacancyRatio <= thresholdLow
											? 'green'
											: 'blue';
								const maintenanceText = item.maintenance ? ` · 维护 ${item.maintenance}` : '';
								const lockedText = item.locked ? ` · 关闭 ${item.locked}` : '';
								return (
									<Tag key={item.key} color={color} style={{ marginBottom: 8 }}>
										{item.name} 可售 {item.available}/{item.total} · 在住 {item.occupied} · 待入住 {item.reserved}{maintenanceText}{lockedText}
									</Tag>
								);
							})}
						</Space>
					</Card>
				) : null}
				<div ref={chartContainerRef}>
					<Spin spinning={loading}>
						{error ? (
							<Alert
								type="error"
								showIcon
								icon={<WarningOutlined />}
								message={`数据加载失败 (${error.status})`}
								description={error.message}
								action={<Button size="small" onClick={handleRetry}>重试</Button>}
								style={{ margin: '32px 0' }}
							/>
						) : dataset.length ? (
							<ReactECharts
								style={{ height: 420 }}
								notMerge
								lazyUpdate
								option={chartOption ?? {}}
								onEvents={{ click: handleChartClick, dataZoom: handleDataZoom }}
								onChartReady={handleChartReady}
							/>
						) : (
							<Empty
								description={(
									<Space direction="vertical" size={4}>
										<Text type="secondary">当前条件下暂无数据</Text>
										<Text type="secondary">可以尝试扩大时间范围或选择其他房型</Text>
									</Space>
								)}
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								style={{ padding: '48px 0' }}
							/>
						)}
					</Spin>
				</div>
				{analytics?.alerts?.length ? (
					<Card
						size="small"
						title={
							<Space style={{ width: '100%', justifyContent: 'space-between' }}>
								<Text>阈值预警</Text>
								<Button 
									type="text" 
									size="small" 
									danger
									onClick={() => {
										// 清除预警日志
										setAnalytics(prev => ({
											...prev,
											alerts: []
										}));
										message.success('预警日志已清除');
									}}
								>
									清除日志
								</Button>
							</Space>
						}
						bodyStyle={{ padding: 0 }}
					>
						<div style={{ maxHeight: 240, overflowY: 'auto', padding: '8px 16px' }}>
							<List
								dataSource={[...analytics.alerts].sort((a, b) => {
									// 按开始时间从近到远排序（最新的在上面）
									return new Date(b.start) - new Date(a.start);
								})}
								split={false}
								renderItem={alert => (
									<List.Item style={{ padding: '8px 0' }}>
										<Space direction="vertical" size={0}>
											<Text strong>{alert.roomTypeName}</Text>
											<Text>{dayjs(alert.start).format('YYYY-MM-DD HH:mm')} ~ {dayjs(alert.end).format('YYYY-MM-DD HH:mm')}</Text>
											<Text type={alert.level === 'HIGH' ? 'danger' : 'success'}>
												{alert.reason}（阈值 {Math.round(alert.threshold * 100)}%，实际 {Math.round(alert.actual * 100)}%）
											</Text>
										</Space>
									</List.Item>
								)}
							/>
						</div>
					</Card>
				) : null}
				{analytics?.events?.length ? (
					<Card size="small" title="关键节点标注">
						<List
							dataSource={analytics.events}
							renderItem={event => (
								<List.Item>
									<Space direction="vertical" size={0}>
										<Text strong>{event.title}</Text>
										<Text>{dayjs(event.timestamp).format('YYYY-MM-DD')} · {event.category}</Text>
										<Text type="secondary">{event.description}</Text>
									</Space>
								</List.Item>
							)}
						/>
					</Card>
				) : null}
			</Space>
			<Modal
				open={!!detailPoint}
				title="时间点详情"
				footer={null}
				onCancel={() => setDetailPoint(null)}
				width={640}
			>
				<Tabs items={detailTabs} destroyInactiveTabPane animated={false} defaultActiveKey="overview" />
			</Modal>
		</Card>
	);
}
