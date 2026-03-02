import { http } from '../../../shared/services/http';

const pick = (source, keys, fallback = null) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeClassItem = (item, index) => {
  const rawId = pick(item, ['_id', 'id', 'classId', 'class_id'], null);
  const normalizedId =
    typeof rawId === 'string'
      ? rawId
      : rawId && typeof rawId === 'object' && rawId.$oid
        ? String(rawId.$oid)
        : null;

  const studentsRaw = pick(item, ['students', 'studentIds'], []);
  const teacherRaw = pick(item, ['teacher', 'assignedTeacher'], null);

  const teacherName =
    (typeof teacherRaw === 'object' && pick(teacherRaw, ['name', 'fullName'], null)) ||
    (typeof teacherRaw === 'string' ? teacherRaw : null) ||
    pick(item, ['teacherName'], null) ||
    null;

  const studentsCount = Array.isArray(studentsRaw)
    ? studentsRaw.length
    : toNumber(
        pick(item, ['studentsCount', 'studentCount', 'totalStudents'], studentsRaw),
        0
      );

  return {
    id: normalizedId || `class-${index}`,
    deleteId: normalizedId,
    subject: String(pick(item, ['subject', 'subjectName', 'title'], 'N/A')),
    grade: String(pick(item, ['gradeLevel', 'grade', 'classGrade'], 'N/A')),
    students: studentsCount,
    lessons: toNumber(pick(item, ['lessonsCount', 'lessonCount', 'totalLessons'], 0), 0),
    assignments: toNumber(
      pick(item, ['assignmentsCount', 'assignmentCount', 'totalAssignments'], 0),
      0
    ),
    teacher: teacherName || 'Not assigned',
    teacherAssigned: Boolean(teacherName),
  };
};

const extractClassList = (root) => {
  if (Array.isArray(root)) return root;

  const direct = pick(root, ['classes', 'items', 'results', 'data', 'rows'], null);
  if (Array.isArray(direct)) return direct;

  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['docs', 'items', 'results', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }

  return [];
};

export const getClasses = async () => {
  let response;
  try {
    response = await http.get('/admin/classes');
  } catch (error) {
    if (error?.response?.status === 404) {
      response = await http.get('/classes');
    } else {
      throw error;
    }
  }

  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  const list = extractClassList(root);
  return list.map(normalizeClassItem);
};

export const createClass = async (payload) => {
  const response = await http.post('/admin/classes', payload);
  const data = response?.data;

  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Create class failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }

  return data;
};

export const updateClass = async (classId, payload) => {
  const id = String(classId || '').trim();
  const response = await http.patch(`/admin/classes/${encodeURIComponent(id)}`, payload);
  const data = response?.data;

  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Update class failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }

  return data;
};

export const deleteClass = async (classId) => {
  const id = String(classId || '').trim();
  const encodedId = encodeURIComponent(id);

  const ensureSuccess = (response) => {
    const data = response?.data;
    if (data && typeof data === 'object') {
      const successFlag = data.success ?? data.ok;
      if (successFlag === false) {
        const err = new Error(data.message || 'Delete failed');
        err.response = { data, status: response?.status };
        throw err;
      }
    }
    return data;
  };

  const attempts = [
    () => http.delete(`/admin/classes/${encodedId}?hardDelete=true`, { data: {} }),
    () => http.delete(`/classes/${encodedId}`, { data: {} }),
    () => http.post(`/admin/classes/${encodedId}/delete`, {}),
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      const response = await attempt();
      return ensureSuccess(response);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

export const createSubject = async (payload) => {
  const response = await http.post('/subjects', payload);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Create subject failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const createGrade = async (payload) => {
  const response = await http.post('/grades', payload);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Create grade failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

const normalizeSubjectItem = (item, index) => {
  const rawId = pick(item, ['_id', 'id', 'subjectId', 'subject_id'], null);
  const id =
    typeof rawId === 'string'
      ? rawId
      : rawId && typeof rawId === 'object' && rawId.$oid
        ? String(rawId.$oid)
        : null;

  const name = String(
    pick(item, ['name', 'subject', 'subjectName', 'title', 'label'], '')
  ).trim();

  if (!name) return null;
  return { id: id || `subject-${index}`, name, deletable: Boolean(id) };
};

const extractSubjectList = (root) => {
  if (Array.isArray(root)) return root;
  const direct = pick(root, ['subjects', 'items', 'results', 'data', 'rows'], null);
  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['docs', 'items', 'results', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }
  return [];
};

export const getSubjectsList = async () => {
  const response = await http.get('/subjects');
  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  const list = extractSubjectList(root);
  return list.map(normalizeSubjectItem).filter(Boolean);
};

export const deleteSubject = async (subjectId) => {
  const id = String(subjectId || '').trim();
  const response = await http.delete(`/subjects/${encodeURIComponent(id)}`);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Delete subject failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const deleteGrade = async (gradeId) => {
  const id = String(gradeId || '').trim();
  const response = await http.delete(`/grades/${encodeURIComponent(id)}`);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Delete grade failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

const normalizeLessonItem = (item, index) => ({
  id: pick(item, ['_id', 'id'], `lesson-${index}`),
  title: String(pick(item, ['title', 'name'], 'Untitled')),
  description: String(pick(item, ['description', 'details'], '')),
  contentType: String(pick(item, ['contentType', 'type'], 'text')).toLowerCase(),
  gradeLevel: String(pick(item, ['gradeLevel', 'grade'], '')),
  subject: String(pick(item, ['subject', 'subjectName'], '')),
  classId: pick(item, ['classId', 'class', 'class_id'], null),
  fileUrl: pick(item, ['fileUrl', 'url', 'assetUrl'], null),
  createdAt: pick(item, ['createdAt', 'created_at'], null),
});

const extractLessonList = (root) => {
  if (Array.isArray(root)) return root;
  const direct = pick(root, ['lessons', 'items', 'results', 'data', 'rows'], null);
  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['docs', 'items', 'results', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }
  return [];
};

export const getLessons = async (params = {}) => {
  let response;
  try {
    response = await http.get('/lesson', { params });
  } catch (error) {
    if (error?.response?.status === 404) {
      response = await http.get('/lessons', { params });
    } else {
      throw error;
    }
  }
  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  const list = extractLessonList(root);
  return list.map(normalizeLessonItem);
};

export const uploadLesson = async (payload) => {
  const endpoints = ['/lesson', '/lessons'];
  const makeFormData = () => {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (key === 'file' || key === 'files') return;
      if (value instanceof File) return;
      if (Array.isArray(value)) return;
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
        return;
      }
      formData.append(key, String(value));
    });

    const files = Array.isArray(payload?.files)
      ? payload.files.filter((f) => f instanceof File)
      : payload?.file instanceof File
        ? [payload.file]
        : [];
    for (const file of files) {
      formData.append('files', file);
    }
    return formData;
  };

  let response;
  let lastError;

  for (const endpoint of endpoints) {
    try {
      response = await http.post(endpoint, makeFormData(), {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      if (status === 404) continue;
      throw error;
    }
  }

  if (!response && lastError) {
    throw lastError;
  }

  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Upload lesson failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};
