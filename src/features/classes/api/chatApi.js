import { http } from '../../../shared/services/http';

const toId = (value) => {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    if (value.$oid) return String(value.$oid).trim();
    if (value._id) return toId(value._id);
    if (value.id) return toId(value.id);
  }
  return '';
};

const normalizeMessage = (item) => {
  const createdRaw = item?.createdAt;
  let createdAt = null;
  if (typeof createdRaw === 'string') {
    const d = new Date(createdRaw);
    createdAt = Number.isNaN(d.getTime()) ? null : d;
  } else if (createdRaw) {
    const d = new Date(createdRaw);
    createdAt = Number.isNaN(d.getTime()) ? null : d;
  }

  return {
    id: toId(item?.id || item?._id),
    classId: toId(item?.classId),
    senderId: toId(item?.senderId || item?.sender),
    senderName: String(item?.senderName || 'User').trim() || 'User',
    senderRole: String(item?.senderRole || 'student').trim().toLowerCase() || 'student',
    text: String(item?.text || '').trim(),
    createdAt,
  };
};

export const getClassChatRoom = async (classId) => {
  const id = String(classId || '').trim();
  if (!id) throw new Error('classId is required');
  const { data } = await http.get(`/chat/classes/${id}`);
  return data?.data || null;
};

export const getClassChatMessages = async (classId, { limit = 50, before } = {}) => {
  const id = String(classId || '').trim();
  if (!id) throw new Error('classId is required');

  const params = { limit };
  if (before) params.before = before;

  const { data } = await http.get(`/chat/classes/${id}/messages`, { params });
  const list = Array.isArray(data?.data) ? data.data.map(normalizeMessage) : [];
  const meta = data?.meta || {};

  return {
    messages: list,
    hasMore: meta.hasMore === true,
    nextBefore: meta.nextBefore ? String(meta.nextBefore) : null,
  };
};

export const deleteClassChatMessage = async (classId, messageId) => {
  const cid = String(classId || '').trim();
  const mid = String(messageId || '').trim();
  if (!cid || !mid) throw new Error('classId and messageId are required');
  const { data } = await http.delete(`/chat/classes/${cid}/messages/${mid}`);
  return data?.data || { id: mid, classId: cid };
};
