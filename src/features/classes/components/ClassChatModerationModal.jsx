import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiTrash2, FiX } from 'react-icons/fi';
import Swal from 'sweetalert2';
import {
  deleteClassChatMessage,
  getClassChatMessages,
  getClassChatRoom,
} from '../api/chatApi';

const formatTime = (date) => {
  if (!date) return '';
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const formatDay = (date) => {
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const ClassChatModerationModal = ({ classItem, onClose }) => {
  const queryClient = useQueryClient();
  const classId = String(classItem?.id || '').trim();
  const [before, setBefore] = useState(null);
  const [olderPages, setOlderPages] = useState([]);

  const roomQuery = useQuery({
    queryKey: ['admin-class-chat-room', classId],
    queryFn: () => getClassChatRoom(classId),
    enabled: Boolean(classId),
  });

  const messagesQuery = useQuery({
    queryKey: ['admin-class-chat-messages', classId],
    queryFn: () => getClassChatMessages(classId, { limit: 50 }),
    enabled: Boolean(classId),
  });

  useEffect(() => {
    setBefore(null);
    setOlderPages([]);
  }, [classId]);

  const messages = useMemo(() => {
    const latest = messagesQuery.data?.messages || [];
    const older = olderPages.flatMap((p) => p.messages || []);
    const map = new Map();
    [...older, ...latest].forEach((m) => {
      if (m?.id) map.set(m.id, m);
    });
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.createdAt?.getTime?.() || 0;
      const tb = b.createdAt?.getTime?.() || 0;
      return ta - tb;
    });
  }, [messagesQuery.data, olderPages]);

  const hasMore =
    before === null
      ? messagesQuery.data?.hasMore === true
      : olderPages[olderPages.length - 1]?.hasMore === true;

  const nextBefore =
    before === null
      ? messagesQuery.data?.nextBefore
      : olderPages[olderPages.length - 1]?.nextBefore;

  const deleteMutation = useMutation({
    mutationFn: (messageId) => deleteClassChatMessage(classId, messageId),
    onSuccess: (_data, messageId) => {
      queryClient.setQueryData(['admin-class-chat-messages', classId], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: (prev.messages || []).filter((m) => m.id !== messageId),
        };
      });
      setOlderPages((pages) =>
        pages.map((p) => ({
          ...p,
          messages: (p.messages || []).filter((m) => m.id !== messageId),
        }))
      );
    },
  });

  const loadOlder = async () => {
    if (!nextBefore || !hasMore) return;
    try {
      const page = await getClassChatMessages(classId, {
        limit: 50,
        before: nextBefore,
      });
      setOlderPages((prev) => [...prev, page]);
      setBefore(page.nextBefore);
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Failed to load older messages',
        text: err?.response?.data?.message || err?.message || 'Please try again',
      });
    }
  };

  const handleDelete = async (message) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete message?',
      text: 'This message will be removed for everyone in the class.',
      showCancelButton: true,
      confirmButtonColor: '#e10000',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;

    try {
      await deleteMutation.mutateAsync(message.id);
      await Swal.fire({
        icon: 'success',
        title: 'Message deleted',
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Delete failed',
        text: err?.response?.data?.message || err?.message || 'Please try again',
      });
    }
  };

  const title =
    roomQuery.data?.className ||
    classItem?.className ||
    `${classItem?.subject || 'Class'} ${classItem?.grade || ''}`.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="flex h-[min(720px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-[12px] border border-[#d6e3fb] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#d6e3fb] bg-[#f8fbff] px-4 py-3">
          <div>
            <h2 className="m-0 text-[20px] font-semibold text-[#1f3f93]">Class Chat</h2>
            <p className="m-0 mt-1 text-sm text-[#5f79af]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#1f3f93] hover:bg-[#e8f1ff]"
            title="Close"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-[#e6eeff] px-4 py-2 text-xs text-[#5f79af]">
          <span>Moderation — delete inappropriate messages</span>
          {hasMore && (
            <button
              type="button"
              onClick={loadOlder}
              className="rounded-md border border-[#d6e3fb] px-2 py-1 font-semibold text-[#1f3f93]"
            >
              Load older
            </button>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-[#f3f7fe] px-4 py-4">
          {messagesQuery.isLoading && (
            <p className="text-sm text-[#5f79af]">Loading messages...</p>
          )}
          {messagesQuery.isError && (
            <p className="text-sm text-red-600">
              {messagesQuery.error?.response?.data?.message ||
                'Failed to load chat messages.'}
            </p>
          )}
          {!messagesQuery.isLoading &&
            !messagesQuery.isError &&
            messages.length === 0 && (
              <p className="text-sm text-[#5f79af]">No messages in this class yet.</p>
            )}

          {messages.map((msg) => {
            const roleLabel = msg.senderRole === 'teacher' ? 'Teacher' : 'Student';
            return (
              <div
                key={msg.id}
                className="rounded-[10px] border border-[#d6e3fb] bg-white p-3 shadow-sm"
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate text-sm text-[#17367a]">
                        {msg.senderName}
                      </strong>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          msg.senderRole === 'teacher'
                            ? 'bg-[#e8f1ff] text-[#1f3f93]'
                            : 'bg-[#eef1f6] text-[#5f79af]'
                        }`}
                      >
                        {roleLabel}
                      </span>
                    </div>
                    <p className="m-0 mt-0.5 text-[11px] text-[#6f84b4]">
                      {formatDay(msg.createdAt)} {formatTime(msg.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Delete message"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(msg)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fff3f3] text-[#e10000] disabled:opacity-50"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
                <p className="m-0 whitespace-pre-wrap break-words text-sm text-[#17367a]">
                  {msg.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ClassChatModerationModal;
