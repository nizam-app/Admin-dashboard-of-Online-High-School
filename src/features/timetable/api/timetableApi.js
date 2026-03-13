import { http } from '../../../shared/services/http';

export const getTimetableEntries = async ({ gradeId, classId } = {}) => {
  const params = {};
  if (gradeId) params.gradeId = gradeId;
  if (classId) params.classId = classId;

  const response = await http.get('/admin/timetable/entries', { params });
  const payload = response?.data || {};
  const data = payload?.data ?? payload;

  return Array.isArray(data) ? data : [];
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
  const response = await http.get('/admin/timetable/meta');
  const payload = response?.data || {};
  return payload?.data ?? payload;
};
