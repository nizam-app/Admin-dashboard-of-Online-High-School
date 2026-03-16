import { http } from '../../../shared/services/http';

export const getTimetableEntries = async ({ gradeId, classId } = {}) => {
  const params = {};
  if (gradeId) params.gradeId = gradeId;
  if (classId) params.classId = classId;

  // Backend now exposes a single /admin/timetable endpoint that returns
  // both metadata (teachers/subjects/grades/classes) and timetable entries.
  const response = await http.get('/admin/timetable', { params });
  const payload = response?.data || {};
  const root = payload?.data ?? payload;

  const entries =
    root?.entries ||
    root?.timetable ||
    root?.items ||
    root?.rows ||
    root?.data ||
    [];

  return Array.isArray(entries) ? entries : [];
};

export const createTimetableEntry = async (payload) => {
  const response = await http.post('/admin/timetable/entries', payload);
  const data = response?.data;

  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Create timetable entry failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }

  return data;
};

export const getTimetableMeta = async () => {
  // /admin/timetable returns the full meta object: teachers, subjects,
  // grades, classes, and possibly entries. For meta we just return root.
  const response = await http.get('/admin/timetable');
  const payload = response?.data || {};
  return payload?.data ?? payload;
};
