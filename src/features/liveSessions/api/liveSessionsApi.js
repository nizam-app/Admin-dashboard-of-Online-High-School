import { http } from '../../../shared/services/http';

const pick = (source, keys, fallback = null) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDisplayText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || fallback;
  }
  if (typeof value === 'object') {
    const nested =
      pick(value, ['name', 'fullName', 'teacherName', 'instructorName', 'username', 'email'], '') || '';
    const text = String(nested).trim();
    return text || fallback;
  }
  return fallback;
};

const normalizeStatus = (value) => {
  const status = String(value || 'Scheduled').trim();
  return status || 'Scheduled';
};

const normalizeActions = (value, status) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return { label: item, variant: '' };
        if (!item || typeof item !== 'object') return null;
        const label = pick(item, ['label', 'name', 'title', 'action'], '');
        const variant = pick(item, ['variant', 'type', 'intent'], '');
        return label ? { label: String(label), variant: String(variant || '') } : null;
      })
      .filter(Boolean);
  }

  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus.includes('pending')) {
    return [
      { label: 'Approve', variant: 'success' },
      { label: 'Reject', variant: 'danger' },
    ];
  }
  if (normalizedStatus.includes('ongoing') || normalizedStatus.includes('live')) {
    return [
      { label: 'Join', variant: 'primary' },
      { label: 'Track', variant: 'secondary' },
    ];
  }
  return [
    { label: 'Edit', variant: 'secondary' },
    { label: 'Cancel', variant: 'danger' },
  ];
};

const normalizeSession = (session, index) => {
  const status = normalizeStatus(pick(session, ['status', 'state'], 'Scheduled'));
  const attendanceRaw = pick(session, ['attendance', 'attendanceRate', 'attendance_rate'], null);
  const attendance =
    attendanceRaw === null || attendanceRaw === undefined ? null : toNumber(attendanceRaw, null);
  const studentCount = toNumber(
    pick(session, ['studentCount', 'students', 'totalStudents', 'student_count'], 0),
    0
  );
  const joinedCount = toNumber(
    pick(session, ['joinedCount', 'attendedStudents', 'presentStudents', 'joined_count'], studentCount),
    studentCount
  );

  return {
    id: String(pick(session, ['id', '_id'], `session-${index}`)),
    title: toDisplayText(pick(session, ['title', 'name'], 'Untitled Session'), 'Untitled Session'),
    status,
    subject: toDisplayText(pick(session, ['subject', 'topic', 'category'], ''), ''),
    grade: toDisplayText(pick(session, ['grade', 'gradeLevel', 'className', 'class'], ''), ''),
    teacher: toDisplayText(pick(session, ['teacher', 'teacherName', 'instructor', 'host'], 'Teacher'), 'Teacher'),
    date: toDisplayText(pick(session, ['date', 'scheduledDate', 'sessionDate'], '-'), '-'),
    time: toDisplayText(pick(session, ['time', 'scheduledTime', 'startTime'], '-'), '-'),
    duration: toDisplayText(pick(session, ['duration', 'durationLabel', 'length'], ''), ''),
    studentCount,
    joinedCount,
    attendance,
    actions: normalizeActions(pick(session, ['actions', 'buttons'], null), status),
  };
};

const extractList = (root) => {
  if (Array.isArray(root)) return root;

  const direct = pick(root, ['sessions', 'items', 'results', 'docs', 'rows', 'data'], null);
  if (Array.isArray(direct)) return direct;

  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['sessions', 'items', 'results', 'docs', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }

  return [];
};

const extractPagination = (payload, root, page, limit, count) => {
  const nestedSessions = pick(root, ['sessions'], null);
  const pagingRoot =
    pick(payload, ['pagination', 'meta'], null) ||
    pick(root, ['pagination', 'meta'], null) ||
    pick(nestedSessions, ['pagination', 'meta'], null) ||
    {};

  const total = toNumber(
    pick(pagingRoot, ['total', 'totalItems', 'count'], null) ??
      pick(payload, ['total', 'count'], null) ??
      pick(root, ['total', 'count'], null),
    count
  );
  const currentPage = toNumber(
    pick(pagingRoot, ['page', 'currentPage'], null) ??
      pick(payload, ['page', 'currentPage'], null) ??
      pick(root, ['page', 'currentPage'], null),
    page
  );
  const perPage = toNumber(
    pick(pagingRoot, ['limit', 'perPage'], null) ??
      pick(payload, ['limit', 'perPage'], null) ??
      pick(root, ['limit', 'perPage'], null),
    limit
  );
  const totalPages = toNumber(
    pick(pagingRoot, ['totalPages', 'pages', 'lastPage'], null) ??
      pick(payload, ['totalPages', 'pages'], null) ??
      pick(root, ['totalPages', 'pages'], null),
    Math.max(1, Math.ceil((total || count || 0) / Math.max(perPage || limit || 1, 1)))
  );

  return {
    total,
    page: currentPage,
    limit: perPage,
    totalPages: totalPages > 0 ? totalPages : 1,
  };
};

export const getLiveSessionsStats = async () => {
  const response = await http.get('/admin/live-sessions/stats');
  const payload = response.data;
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

export const getLiveSessions = async ({ tab = 'all', page = 1, limit = 5 } = {}) => {
  const response = await http.get('/admin/live-sessions', {
    params: {
      tab,
      page,
      limit,
    },
  });

  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  const items = extractList(root).map(normalizeSession);
  const pagination = extractPagination(payload, root, page, limit, items.length);

  return {
    items,
    pagination,
  };
};

export const cancelLiveSession = async (id) => {
  const encodedId = encodeURIComponent(String(id || '').trim());
  const response = await http.delete(`/admin/live-sessions/${encodedId}`, { data: {} });
  return response?.data;
};

export const approveLiveSession = async (id) => {
  const encodedId = encodeURIComponent(String(id || '').trim());
  const response = await http.patch(`/admin/live-sessions/${encodedId}/approve`, {});
  return response?.data;
};

export const rejectLiveSession = async ({ id, reason }) => {
  const encodedId = encodeURIComponent(String(id || '').trim());
  const response = await http.patch(`/admin/live-sessions/${encodedId}/reject`, {
    reason: String(reason || 'Rejected by admin').trim(),
  });
  return response?.data;
};
