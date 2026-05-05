export const ROOM_STATUS_META = {
	0: {
		label: '锁定',
		color: '#8c8c8c',
		bgColor: '#fafafa',
		description: '房间已锁定，不可用',
	},
	1: {
		label: '空房',
		color: '#389e0d',
		bgColor: '#f6ffed',
		description: '房间可立即使用',
	},
	2: {
		label: '已预订',
		color: '#fa8c16',
		bgColor: '#fff7e6',
		description: '已有预订，等待入住',
	},
	3: {
		label: '已入住',
		color: '#722ed1',
		bgColor: '#f9f0ff',
		description: '住客在住，暂不可用',
	},
	4: {
		label: '待打扫',
		color: '#d48806',
		bgColor: '#fffbe6',
		description: '清洁中，稍后可用',
	},
	5: {
		label: '维修中',
		color: '#a8071a',
		bgColor: '#fff1f0',
		description: '维护中，暂不可用',
	},
};

export function getRoomStatusMeta(status) {
	if (status == null) return { label: '未知', color: '#595959', bgColor: '#fafafa', description: '状态未追踪' };
	const key = Number(status);
	return ROOM_STATUS_META[key] || { label: `状态 ${status}`, color: '#595959', bgColor: '#fafafa', description: '状态未识别' };
}
