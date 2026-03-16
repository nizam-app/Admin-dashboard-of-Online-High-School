import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Clock3, Download, Eye, Info, Mic, Pencil, Play, Users, Video, X } from 'lucide-react';
import Swal from 'sweetalert2';
import {
  approveLiveSession,
  cancelLiveSession,
  createLiveSession,
  rejectLiveSession,
  updateLiveSession,
  updateStudentAttendance,
} from '../api/liveSessionsApi';
import { getGrades, getSubjects, getUsers } from '../../users/api/usersApi';
import { useLiveSessions, useLiveSessionsStats, useSessionAttendance, useSessionDetails } from '../hooks/useLiveSessions';

const metrics = [
  { key: 'todaySessions', label: "Today's Sessions", icon: Video, valueColor: 'text-[#183e95]', iconColor: 'text-[#133f94]' },
  { key: 'liveNow', label: 'Live', icon: Play, valueColor: 'text-[#05914b]', iconColor: 'text-[#1f7a3f]' },
  { key: 'pendingApproval', label: 'Pending Approval', icon: Clock3, valueColor: 'text-[#d18400]', iconColor: 'text-[#c48a1f]' },
  { key: 'avgAttendance', label: 'Avg Attendance', icon: Users, valueColor: 'text-[#183e95]', iconColor: 'text-[#133f94]' },
];

const tabs = [
  { key: 'all', label: 'All Sessions' },
  { key: 'today', label: 'Today' },
  { key: 'pending', label: 'Pending' },
  { key: 'live', label: 'Live' },
];

const PAGE_SIZE = 5;

const getStatusStyles = (status) => {
  const normalizedStatus = String(status || '').toLowerCase();

  if (normalizedStatus.includes('ongoing') || normalizedStatus.includes('live')) {
    return {
      chip: 'bg-[#def6e6] text-[#0a8b45]',
      dot: 'bg-[#e11d48]',
      label: 'Live',
    };
  }

  if (normalizedStatus.includes('completed')) {
    return {
      chip: 'bg-[#eef2f7] text-[#53627c]',
      dot: '',
      label: 'Completed',
    };
  }

  if (normalizedStatus.includes('pending')) {
    return {
      chip: 'bg-[#fff3cc] text-[#a56a00]',
      dot: '',
      label: 'Pending',
    };
  }

  return {
    chip: 'bg-[#e7f0ff] text-[#1d5eff]',
    dot: '',
    label: 'Scheduled',
  };
};

const getActionStyles = (variant, label) => {
  const key = String(variant || label || '').toLowerCase();

  if (key.includes('success') || key.includes('approve')) {
    return 'bg-[#dbf8e7] text-[#0d8f49]';
  }
  if (key.includes('danger') || key.includes('reject') || key.includes('cancel')) {
    return 'bg-[#ffe3e3] text-[#d01414]';
  }
  if (key.includes('primary') || key.includes('join')) {
    return 'bg-[#294697] text-white';
  }

  return 'bg-[#eaf1ff] text-[#2049a4]';
};

const getActionIcon = (label) => {
  const key = String(label || '').toLowerCase();

  if (key.includes('approve')) return Check;
  if (key.includes('reject') || key.includes('cancel')) return X;
  if (key.includes('edit')) return Pencil;
  if (key.includes('track') || key.includes('view')) return Eye;
  return null;
};

const INITIAL_SESSION_FORM = {
  title: '',
  subject: '',
  grade: '',
  teacher: '',
  teacherId: '',
  className: '',
  date: '',
  time: '',
  duration: '',
  meetingLink: '',
};

const LiveSessionsPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionFormValues, setSessionFormValues] = useState(INITIAL_SESSION_FORM);
  const [sessionFormError, setSessionFormError] = useState('');
  const [joinModalSession, setJoinModalSession] = useState(null);
  const [joinEnableCamera, setJoinEnableCamera] = useState(true);
  const [joinEnableMic, setJoinEnableMic] = useState(true);
  const [trackModalSession, setTrackModalSession] = useState(null);
  const { data, isLoading, isError } = useLiveSessionsStats();
  const {
    data: attendanceData,
    isLoading: isAttendanceLoading,
    isError: isAttendanceError,
    refetch: refetchAttendance,
  } = useSessionAttendance(trackModalSession?.id);
  const { data: sessionDetails } = useSessionDetails(trackModalSession?.id);
  const {
    data: sessionsResponse = {
      items: [],
      pagination: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 },
    },
    isLoading: isSessionsLoading,
    isError: isSessionsError,
  } = useLiveSessions({ tab: activeTab, page, limit: PAGE_SIZE });
  const cancelSessionMutation = useMutation({
    mutationFn: cancelLiveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
    },
  });
  const approveSessionMutation = useMutation({
    mutationFn: approveLiveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
    },
  });
  const rejectSessionMutation = useMutation({
    mutationFn: rejectLiveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
    },
  });
  const createSessionMutation = useMutation({
    mutationFn: createLiveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
      closeSessionModal();
    },
  });
  const updateSessionMutation = useMutation({
    mutationFn: ({ id, payload }) => updateLiveSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
      closeSessionModal();
    },
  });
  const updateAttendanceMutation = useMutation({
    mutationFn: ({ sessionId, studentId, status }) =>
      updateStudentAttendance(sessionId, studentId, { status }),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions-attendance', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
    },
  });

  const { data: gradeOptions = [] } = useQuery({
    queryKey: ['live-sessions-form-grades'],
    queryFn: getGrades,
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjectOptions = [] } = useQuery({
    queryKey: ['live-sessions-form-subjects'],
    queryFn: getSubjects,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teacherUsers } = useQuery({
    queryKey: ['live-sessions-form-teachers'],
    queryFn: () => getUsers({ role: 'teacher', status: 'active', page: 1, limit: 100 }),
    staleTime: 60 * 1000,
  });

  const teacherOptions = useMemo(
    () =>
      Array.isArray(teacherUsers?.users)
        ? teacherUsers.users.map((u) => ({
            id: u.id,
            name: u.name || u.fullName || u.username || u.email || 'Teacher',
          }))
        : [],
    [teacherUsers?.users]
  );

  const openSessionModal = (session = null) => {
    setEditingSession(session || null);
    if (session) {
      const rawDate = session.date ?? '';
      const dateOnly =
        typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
          ? rawDate.slice(0, 10)
          : rawDate;
      const rawTime = session.time ?? '';
      const timeOnly =
        typeof rawTime === 'string' && /\d{1,2}:\d{2}/.test(rawTime)
          ? (rawTime.match(/\d{1,2}:\d{2}/)?.[0] ?? rawTime)
          : rawTime;
      setSessionFormValues({
        title: session.title ?? '',
        subject: session.subject ?? '',
        grade: session.grade ?? '',
        teacher: session.teacher ?? '',
        teacherId: session.teacherId ?? '',
        className: session.className ?? '',
        date: dateOnly,
        time: timeOnly,
        duration: session.duration ?? '',
        meetingLink: session.meetingLink ?? '',
      });
    } else {
      setSessionFormValues({ ...INITIAL_SESSION_FORM });
    }
    setSessionFormError('');
    setIsSessionModalOpen(true);
  };

  const closeSessionModal = () => {
    if (createSessionMutation.isPending || updateSessionMutation.isPending) return;
    setIsSessionModalOpen(false);
    setEditingSession(null);
    setSessionFormValues(INITIAL_SESSION_FORM);
    setSessionFormError('');
  };

  const handleSessionFormChange = (key, value) => {
    setSessionFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleTeacherChange = (value) => {
    const selected = teacherOptions.find((t) => String(t.id) === String(value));
    setSessionFormValues((prev) => ({
      ...prev,
      teacherId: value,
      teacher: selected?.name || prev.teacher,
    }));
  };

  const handleSessionSubmit = (event) => {
    event.preventDefault();
    setSessionFormError('');
    if (updateSessionMutation.isPending || createSessionMutation.isPending) return;
    const { title, subject, grade, teacher, teacherId, className, date, time, duration, meetingLink } =
      sessionFormValues;
    if (!String(title || '').trim()) {
      setSessionFormError('Title is required.');
      return;
    }
    if (editingSession?.id) {
      const sessionId = editingSession.id;
      updateSessionMutation.mutate(
        {
          id: sessionId,
          payload: {
            title: title.trim(),
            subject,
            grade,
            teacher,
            teacherId,
            className,
            date,
            time,
            duration,
            meetingLink,
          },
        },
        {
          onSuccess: async () => {
            await Swal.fire({
              title: 'Updated',
              text: 'Live session updated successfully.',
              icon: 'success',
              confirmButtonColor: '#1f3f93',
            });
          },
          onError: (error) => {
            const data = error?.response?.data;
            const message =
              (typeof data?.message === 'string' && data.message) ||
              (Array.isArray(data?.errors) && data.errors[0]?.message) ||
              data?.error ||
              error?.message ||
              'Failed to update session.';
            setSessionFormError(message);
          },
        }
      );
    } else {
      createSessionMutation.mutate(
        {
          title: title.trim(),
          subject,
          grade,
          teacher,
          teacherId,
          className,
          date,
          time,
          duration,
          meetingLink,
        },
        {
          onSuccess: async () => {
            await Swal.fire({
              title: 'Created',
              text: 'Live session created successfully.',
              icon: 'success',
              confirmButtonColor: '#1f3f93',
            });
          },
          onError: (error) => {
            const data = error?.response?.data;
            const message =
              (typeof data?.message === 'string' && data.message) ||
              (Array.isArray(data?.errors) && data.errors[0]?.message) ||
              data?.error ||
              error?.message ||
              'Failed to create session.';
            setSessionFormError(message);
          },
        }
      );
    }
  };

  const stats = useMemo(() => {
    if (!data || typeof data !== 'object') return {};
    const payload = data.data && typeof data.data === 'object' ? data.data : data;

    return {
      todaySessions:
        payload.todaySessions ??
        payload.todaysSessions ??
        payload.today_sessions ??
        payload.todays_sessions ??
        payload.today ??
        payload.today_sessions_count ??
        0,
      liveNow: payload.liveNow ?? payload.live_now ?? payload.live ?? payload.live_sessions ?? 0,
      pendingApproval:
        payload.pendingApproval ?? payload.pending_approval ?? payload.pending ?? payload.pending_sessions ?? 0,
      avgAttendance:
        payload.avgAttendance ?? payload.avg_attendance ?? payload.attendance ?? payload.avg_attendance_rate ?? 0,
    };
  }, [data]);

  const sessionRows = useMemo(
    () => (Array.isArray(sessionsResponse?.items) ? sessionsResponse.items : []),
    [sessionsResponse?.items]
  );

  const pagination = useMemo(
    () =>
      sessionsResponse?.pagination || {
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1,
      },
    [sessionsResponse]
  );

  const trackAttendance = useMemo(() => {
    if (!attendanceData) return { students: [], total: 0, present: 0, absent: 0, attendanceRate: 0 };
    return {
      students: Array.isArray(attendanceData.students) ? attendanceData.students : [],
      total: Number(attendanceData.total ?? 0),
      present: Number(attendanceData.present ?? 0),
      absent: Number(attendanceData.absent ?? 0),
      attendanceRate: Number(attendanceData.attendanceRate ?? 0),
    };
  }, [attendanceData]);

  const trackAttendanceFallback = useMemo(() => {
    if (!trackModalSession) return null;
    const total = Number(trackModalSession.studentCount ?? 0);
    const present = Number(trackModalSession.joinedCount ?? 0);
    const absent = Math.max(0, total - present);
    const attendanceRate = Number(trackModalSession.attendance ?? 0) || (total > 0 ? Math.round((present / total) * 100) : 0);
    const fromDetails = Array.isArray(sessionDetails?.enrolledStudents) ? sessionDetails.enrolledStudents : [];
    const fromSession = Array.isArray(trackModalSession.enrolledStudents) ? trackModalSession.enrolledStudents : [];
    const enrolled = fromDetails.length >= total ? fromDetails : fromSession.length >= total ? fromSession : fromDetails.length ? fromDetails : fromSession;
    const getName = (i) => {
      const e = enrolled[i];
      if (e && (e.name || e.studentName)) return e.name || e.studentName || `Student ${i + 1}`;
      if (typeof e === 'string') return e;
      return `Student ${i + 1}`;
    };
    const students = [];
    for (let i = 0; i < present; i++) {
      students.push({
        id: enrolled[i]?.id ?? `fallback-present-${i}`,
        name: getName(i),
        status: 'Present',
        joinTime: '—',
        participation: null,
      });
    }
    for (let i = 0; i < absent; i++) {
      const idx = present + i;
      students.push({
        id: enrolled[idx]?.id ?? `fallback-absent-${i}`,
        name: getName(idx),
        status: 'Absent',
        joinTime: '—',
        participation: null,
      });
    }
    return { students, total, present, absent, attendanceRate };
  }, [trackModalSession, sessionDetails]);

  const trackDisplay = useMemo(() => {
    if (isAttendanceError && trackAttendanceFallback) return trackAttendanceFallback;
    if (!isAttendanceError && trackAttendance.total === 0 && trackAttendanceFallback?.total > 0) return trackAttendanceFallback;
    return trackAttendance;
  }, [isAttendanceError, trackAttendanceFallback, trackAttendance]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    const totalPages = Number(pagination?.totalPages || 1);
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pagination?.totalPages]);

  const getActionPendingLabel = (actionLabel) => {
    const normalizedLabel = String(actionLabel || '').toLowerCase();
    if (normalizedLabel.includes('approve')) return 'Approving...';
    if (normalizedLabel.includes('reject')) return 'Rejecting...';
    if (normalizedLabel.includes('cancel')) return 'Cancelling...';
    return actionLabel;
  };

  const isActionPending = (actionLabel) => {
    const normalizedLabel = String(actionLabel || '').toLowerCase();
    if (normalizedLabel.includes('approve')) return approveSessionMutation.isPending;
    if (normalizedLabel.includes('reject')) return rejectSessionMutation.isPending;
    if (normalizedLabel.includes('cancel')) return cancelSessionMutation.isPending;
    return false;
  };

  const handleActionClick = async (session, actionLabel) => {
    const normalizedLabel = String(actionLabel || '').toLowerCase();
    if (!session?.id || isActionPending(actionLabel)) return;

    if (normalizedLabel.includes('edit')) {
      openSessionModal(session);
      return;
    }

    if (normalizedLabel.includes('join')) {
      setJoinModalSession(session);
      setJoinEnableCamera(true);
      setJoinEnableMic(true);
      return;
    }

    if (normalizedLabel.includes('track')) {
      setTrackModalSession(session);
      return;
    }

    let config = null;
    let mutation = null;

    if (normalizedLabel.includes('approve')) {
      config = {
        title: 'Approve Session?',
        text: `Approve "${session.title}"?`,
        confirmButtonText: 'Yes, approve',
        cancelButtonText: 'Not now',
        confirmButtonColor: '#0d8f49',
        successTitle: 'Approved',
        successText: 'Live session approved successfully.',
        errorTitle: 'Approve Failed',
        errorText: 'Failed to approve live session.',
      };
      mutation = approveSessionMutation;
    } else if (normalizedLabel.includes('reject')) {
      config = {
        title: 'Reject Session?',
        text: `Reject "${session.title}"?`,
        confirmButtonText: 'Yes, reject',
        cancelButtonText: 'Keep pending',
        confirmButtonColor: '#d01414',
        cancelButtonColor: '#1f3f93',
        successTitle: 'Rejected',
        successText: 'Live session rejected successfully.',
        errorTitle: 'Reject Failed',
        errorText: 'Failed to reject live session.',
        payload: {
          id: session.id,
          reason: 'Rejected by admin',
        },
      };
      mutation = rejectSessionMutation;
    } else if (normalizedLabel.includes('cancel')) {
      config = {
        title: 'Cancel Session?',
        text: `Are you sure you want to cancel "${session.title}"?`,
        confirmButtonText: 'Yes, cancel it',
        cancelButtonText: 'Keep session',
        confirmButtonColor: '#d01414',
        successTitle: 'Cancelled',
        successText: 'Live session cancelled successfully.',
        errorTitle: 'Cancel Failed',
        errorText: 'Failed to cancel live session.',
      };
      mutation = cancelSessionMutation;
    }

    if (!config || !mutation) return;

    if (
      normalizedLabel.includes('approve') ||
      normalizedLabel.includes('cancel') ||
      normalizedLabel.includes('reject')
    ) {
      const result = await Swal.fire({
        title: config.title,
        text: config.text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: config.confirmButtonText,
        cancelButtonText: config.cancelButtonText,
        confirmButtonColor: config.confirmButtonColor,
        cancelButtonColor: '#1f3f93',
      });

      if (!result.isConfirmed) return;
    }

    mutation.mutate(config.payload ?? session.id, {
      onSuccess: async () => {
        await Swal.fire({
          title: config.successTitle,
          text: config.successText,
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || config.errorText;
        await Swal.fire({
          title: config.errorTitle,
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => openSessionModal()}
          className="ml-auto rounded-lg bg-[#1f3f93] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(31,63,147,0.25)] transition hover:bg-[#163f9a]"
        >
          Create Session
        </button>
      </div>

      <div className="rounded-xl border border-[#d9e6ff] bg-white px-3 py-2 shadow-[0_4px_18px_rgba(31,63,147,0.06)]">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-[#163f9a] text-white shadow-[0_6px_18px_rgba(22,63,154,0.18)]'
                  : 'text-[#17367a]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const value = stats[metric.key];

          return (
            <div
              key={metric.key}
              className="rounded-xl border border-[#d6e3fb] bg-white p-4 shadow-[0_6px_18px_rgba(31,63,147,0.06)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#6f84b4]">{metric.label}</p>
                  <p className={`mt-2 text-[40px] font-bold ${metric.valueColor}`}>
                    {isLoading ? '...' : isError ? '--' : `${value ?? 0}${metric.key === 'avgAttendance' ? '%' : ''}`}
                  </p>
                </div>
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eef3ff] ${metric.iconColor}`}
                >
                  <Icon size={16} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {isSessionsLoading ? (
          <div className="rounded-xl border border-dashed border-[#bfd1f3] bg-white p-6 text-center text-sm text-[#6880b0]">
            Loading live sessions list...
          </div>
        ) : isSessionsError ? (
          <div className="rounded-xl border border-dashed border-[#ffccd5] bg-white p-6 text-center text-sm text-[#a82746]">
            Failed to load live sessions list.
          </div>
        ) : sessionRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#bfd1f3] bg-white p-6 text-center text-sm text-[#6f84b4]">
            No live sessions available yet.
          </div>
        ) : (
          sessionRows.map((session, index) => {
            const statusStyles = getStatusStyles(session.status);
            const showAttendance = session.attendance !== null && session.attendance !== undefined;
            const normalizedStatus = String(session.status || '').toLowerCase();
            const isLive = normalizedStatus.includes('ongoing') || normalizedStatus.includes('live');

            return (
              <div
                key={`${session.id}-${index}`}
                className="rounded-[18px] border border-[#d6e3fb] bg-white p-5 shadow-[0_8px_24px_rgba(31,63,147,0.07)]"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[20px] font-semibold text-[#1f3f93]">{session.title}</h3>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles.chip}`}
                      >
                        {statusStyles.dot ? <span className={`h-2.5 w-2.5 rounded-full ${statusStyles.dot}`} /> : null}
                        {statusStyles.label}
                      </span>
                      {session.subject ? (
                        <span className="rounded-full bg-[#eaf1ff] px-3 py-1 text-xs font-semibold text-[#1d5eff]">
                          {session.subject}
                        </span>
                      ) : null}
                      {session.grade ? (
                        <span className="rounded-full bg-[#eaf1ff] px-3 py-1 text-xs font-semibold text-[#1d5eff]">
                          {session.grade}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[#556b97] md:grid-cols-2 xl:grid-cols-4">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#7b8fb8]" />
                        <span>{session.teacher}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-[#7b8fb8]" />
                        <span>{session.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 size={16} className="text-[#7b8fb8]" />
                        <span>
                          {session.time}
                          {session.duration ? ` (${session.duration})` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#7b8fb8]" />
                        <span>
                          {showAttendance && isLive
                            ? `${session.joinedCount}/${session.studentCount} students`
                            : `${session.studentCount} students`}
                        </span>
                      </div>
                    </div>

                    {showAttendance ? (
                      <div className="mt-5">
                        <div className="flex items-center justify-between text-sm font-semibold text-[#556b97]">
                          <span>Attendance</span>
                          <span className="text-[#1f3f93]">{session.attendance}%</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#dfeafe]">
                          <div
                            className="h-full rounded-full bg-[#294697]"
                            style={{ width: `${Math.max(0, Math.min(100, Number(session.attendance) || 0))}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 xl:w-[120px]">
                    {session.actions.length > 0 ? (
                      session.actions.map((action) => {
                        const ActionIcon = getActionIcon(action.label);

                        return (
                          <button
                            key={`${session.id}-${action.label}`}
                            type="button"
                            onClick={() => handleActionClick(session, action.label)}
                            disabled={isActionPending(action.label)}
                            className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] px-4 py-2 text-sm font-semibold ${getActionStyles(
                              action.variant,
                              action.label
                            )} disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {ActionIcon ? <ActionIcon size={16} /> : null}
                            {isActionPending(action.label) ? getActionPendingLabel(action.label) : action.label}
                          </button>
                        );
                      })
                    ) : (
                      <button
                        type="button"
                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] bg-[#eaf1ff] px-4 py-2 text-sm font-semibold text-[#2049a4]"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between rounded-xl border border-[#d6e3fb] bg-white px-4 py-3 text-sm text-[#5f79af]">
          <p>
            Page {pagination.page || page} of {pagination.totalPages || 1} - Total {pagination.total || 0}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1 || isSessionsLoading}
              className="h-9 rounded-md border border-[#d6e3fb] px-3 font-semibold text-[#1f3f93] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(prev + 1, Number(pagination.totalPages || 1)))}
              disabled={page >= Number(pagination.totalPages || 1) || isSessionsLoading}
              className="h-9 rounded-md border border-[#d6e3fb] px-3 font-semibold text-[#1f3f93] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6 shadow-xl">
            <form className="space-y-4" onSubmit={handleSessionSubmit}>
              <div className="flex items-center justify-between">
                <h2 className="text-[24px] font-semibold text-[#1f3f93]">
                  {editingSession ? 'Edit Session' : 'Create Session'}
                </h2>
                <button
                  type="button"
                  onClick={closeSessionModal}
                  disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
                  className="rounded p-1 text-[#6f84b4] hover:bg-[#eef3ff] hover:text-[#1f3f93] disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {sessionFormError && (
                <p className="rounded-lg bg-[#ffe3e3] px-3 py-2 text-sm text-[#d01414]">{sessionFormError}</p>
              )}

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Title *</label>
                <input
                  type="text"
                  value={sessionFormValues.title}
                  onChange={(e) => handleSessionFormChange('title', e.target.value)}
                  placeholder="e.g. Algebra Basics"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <select
                    value={sessionFormValues.subject}
                    onChange={(e) => handleSessionFormChange('subject', e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] bg-white px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select subject</option>
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade</label>
                  <select
                    value={sessionFormValues.grade}
                    onChange={(e) => handleSessionFormChange('grade', e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] bg-white px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select grade</option>
                    {gradeOptions.map((grade) => (
                      <option key={grade.id ?? grade.value ?? grade} value={grade.name ?? grade.label ?? grade}>
                        {grade.name ?? grade.label ?? grade}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Class Name</label>
                <input
                  type="text"
                  value={sessionFormValues.className}
                  onChange={(e) => handleSessionFormChange('className', e.target.value)}
                  placeholder="e.g. Grade 10 - Mathematics A"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Instructor / Teacher</label>
                <select
                  value={sessionFormValues.teacherId}
                  onChange={(e) => handleTeacherChange(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] bg-white px-3 text-sm outline-none focus:border-[#1f3f93]"
                >
                  <option value="">Select teacher</option>
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Date</label>
                  <input
                    type="date"
                    value={sessionFormValues.date}
                    onChange={(e) => handleSessionFormChange('date', e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Time</label>
                  <input
                    type="time"
                    value={sessionFormValues.time}
                    onChange={(e) => handleSessionFormChange('time', e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                    Duration (minutes)
                  </label>
                  <input
                    type="text"
                    value={sessionFormValues.duration}
                    onChange={(e) => handleSessionFormChange('duration', e.target.value)}
                    placeholder="e.g. 60"
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                    Zoom Meeting Link
                  </label>
                  <input
                    type="url"
                    value={sessionFormValues.meetingLink}
                    onChange={(e) => handleSessionFormChange('meetingLink', e.target.value)}
                    placeholder="https://zoom.us/j/..."
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeSessionModal}
                  disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
                  className="h-10 rounded-lg border border-[#d6e3fb] px-4 text-sm font-semibold text-[#1f3f93] hover:bg-[#eef3ff] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
                  className="h-10 rounded-lg bg-[#1f3f93] px-4 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(31,63,147,0.25)] hover:bg-[#163f9a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createSessionMutation.isPending || updateSessionMutation.isPending
                    ? 'Saving...'
                    : editingSession
                      ? 'Update Session'
                      : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {joinModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1d4a]/50 p-4 backdrop-blur-md">
          <div className="w-full max-w-[640px] rounded-2xl border-2 border-[#d6e3fb] bg-white p-6 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.35)] ring-2 ring-[#1f3f93]/10">
            <div className="flex items-center justify-between border-b border-[#e4ecff] pb-4">
              <div>
                <h2 className="text-[22px] font-bold text-[#1f3f93]">Join Live Session</h2>
                <p className="mt-1 text-sm text-[#556b97]">You are about to join the live session.</p>
              </div>
              <button
                type="button"
                onClick={() => setJoinModalSession(null)}
                className="rounded-lg p-2 text-[#6f84b4] hover:bg-[#eef3ff] hover:text-[#1f3f93] focus:outline-none focus:ring-2 focus:ring-[#1f3f93]/30"
              >
                <X size={22} />
              </button>
            </div>

            <div className="mt-5 flex gap-4 rounded-xl border-2 border-[#c7d9f7] bg-[#eef5ff] p-5 shadow-sm">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1f3f93] text-white shadow-md">
                <Video size={28} />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                <p className="text-base font-bold text-[#1f3f93]">{joinModalSession.title}</p>
                <p className="flex items-center gap-1.5 text-[#556b97]">
                  <Users size={14} className="text-[#7b8fb8]" />
                  {joinModalSession.teacher}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[#6f84b4]">
                  <span className="flex items-center gap-1">
                    <CalendarDays size={14} />
                    {joinModalSession.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock3 size={14} />
                    {joinModalSession.time}
                    {joinModalSession.duration ? ` (${joinModalSession.duration})` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#def6e6] px-2.5 py-1 text-xs font-semibold text-[#0a8b45]">
                    <span className="h-2 w-2 rounded-full bg-[#e11d48]" />
                    Live
                  </span>
                  {joinModalSession.subject ? (
                    <span className="rounded-full bg-[#eaf1ff] px-2.5 py-1 text-xs font-semibold text-[#1d5eff]">
                      {joinModalSession.subject}
                    </span>
                  ) : null}
                  {joinModalSession.grade ? (
                    <span className="rounded-full bg-[#eaf1ff] px-2.5 py-1 text-xs font-semibold text-[#1d5eff]">
                      {joinModalSession.grade}
                    </span>
                  ) : null}
                </div>
                <p className="text-[#556b97]">
                  {joinModalSession.joinedCount ?? 0}/{joinModalSession.studentCount ?? 0} present
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <p className="text-[15px] font-bold text-[#1f3f93]">Audio &amp; Video Settings</p>
              <div className="flex flex-col gap-3 rounded-lg border border-[#d6e3fb] bg-[#fafbff] p-4">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg py-1 hover:bg-white/60">
                  <input
                    type="checkbox"
                    checked={joinEnableCamera}
                    onChange={(e) => setJoinEnableCamera(e.target.checked)}
                    className="h-5 w-5 rounded border-[#d6e3fb] text-[#1f3f93] focus:ring-2 focus:ring-[#1f3f93]/30"
                  />
                  <Video size={20} className="text-[#6f84b4]" />
                  <span className="text-sm font-semibold text-[#17367a]">Enable Camera</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg py-1 hover:bg-white/60">
                  <input
                    type="checkbox"
                    checked={joinEnableMic}
                    onChange={(e) => setJoinEnableMic(e.target.checked)}
                    className="h-5 w-5 rounded border-[#d6e3fb] text-[#1f3f93] focus:ring-2 focus:ring-[#1f3f93]/30"
                  />
                  <Mic size={20} className="text-[#6f84b4]" />
                  <span className="text-sm font-semibold text-[#17367a]">Enable Microphone</span>
                </label>
              </div>
            </div>

            <div className="mt-5 flex gap-3 rounded-xl border-2 border-[#fde68a] bg-[#fef9c3] px-4 py-3">
              <Info size={22} className="shrink-0 text-[#1f3f93]" />
              <p className="text-sm font-medium text-[#92400e]">
                You are joining as an <strong>Admin Observer</strong>. You&apos;ll have access to monitor the session,
                view attendance, and manage participants.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-[#e4ecff] pt-5">
              <button
                type="button"
                onClick={() => setJoinModalSession(null)}
                className="h-12 min-w-[100px] rounded-xl border-2 border-[#c7d9f7] bg-white px-5 text-sm font-bold text-[#374151] shadow-sm hover:bg-[#f3f7ff] hover:border-[#1f3f93]/40 focus:outline-none focus:ring-2 focus:ring-[#1f3f93]/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setJoinModalSession(null);
                  Swal.fire({
                    title: 'Joining...',
                    text: 'Redirecting to the live session.',
                    icon: 'info',
                    timer: 1500,
                    showConfirmButton: false,
                    confirmButtonColor: '#1f3f93',
                  });
                }}
                className="flex h-12 min-w-[160px] items-center justify-center gap-2 rounded-xl bg-[#1f3f93] px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(31,63,147,0.4)] hover:bg-[#163f9a] focus:outline-none focus:ring-2 focus:ring-[#1f3f93]/50 focus:ring-offset-2"
              >
                <Video size={18} />
                Join Session Now
              </button>
            </div>
          </div>
        </div>
      )}

      {trackModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1d4a]/50 p-4 backdrop-blur-md">
          <div className="flex max-h-[90vh] w-full max-w-[720px] flex-col rounded-2xl border-2 border-[#d6e3fb] bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.35)] ring-2 ring-[#1f3f93]/10">
            <div className="shrink-0 border-b border-[#e4ecff] px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[22px] font-bold text-[#1f3f93]">{trackModalSession.title}</h2>
                  <p className="mt-1 text-sm text-[#556b97]">
                    {typeof trackModalSession.date === 'string' && trackModalSession.date.length >= 10
                      ? trackModalSession.date.slice(0, 10)
                      : trackModalSession.date}{' '}
                    at {trackModalSession.time ?? '—'} — {trackModalSession.teacher}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTrackModalSession(null)}
                  className="rounded-lg p-2 text-[#6f84b4] hover:bg-[#eef3ff] hover:text-[#1f3f93] focus:outline-none focus:ring-2 focus:ring-[#1f3f93]/30"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {isAttendanceLoading ? (
                <div className="flex items-center justify-center py-12 text-[#6f84b4]">
                  Loading attendance...
                </div>
              ) : (
                <>
                  {isAttendanceError ? (
                    <div className="mb-4 rounded-xl border border-[#fde68a] bg-[#fef9c3] px-4 py-2.5 text-sm text-[#92400e]">
                      Attendance list could not be loaded from the server. Showing summary from session (Total: {trackModalSession.studentCount ?? 0}, Joined: {trackModalSession.joinedCount ?? 0}).
                    </div>
                  ) : null}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border-2 border-[#d6e3fb] bg-[#fafbff] p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#6f84b4]">Total Students</p>
                      <p className="mt-2 text-2xl font-bold text-[#1f3f93]">{trackDisplay.total}</p>
                    </div>
                    <div className="rounded-xl border-2 border-[#b8e6cc] bg-[#dcfce7] p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#0a8b45]">Present</p>
                      <p className="mt-2 text-2xl font-bold text-[#0a8b45]">{trackDisplay.present}</p>
                    </div>
                    <div className="rounded-xl border-2 border-[#fecaca] bg-[#fee2e2] p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#b91c1c]">Absent</p>
                      <p className="mt-2 text-2xl font-bold text-[#b91c1c]">{trackDisplay.absent}</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="mb-2 text-sm font-semibold text-[#556b97]">Attendance Rate</p>
                    <div className="flex items-center gap-3">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#dfeafe]">
                        <div
                          className="h-full rounded-full bg-[#294697] transition-[width]"
                          style={{
                            width: `${Math.max(0, Math.min(100, trackDisplay.attendanceRate))}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-bold text-[#1f3f93]">{trackDisplay.attendanceRate}%</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="mb-3 text-[15px] font-bold text-[#1f3f93]">Student Attendance</p>
                    <div className="overflow-hidden rounded-xl border-2 border-[#d6e3fb]">
                      <div className="max-h-[280px] overflow-y-auto">
                        <table className="w-full min-w-[500px] border-collapse text-left text-sm">
                          <thead className="sticky top-0 bg-[#eef4ff] text-[#1f3f93]">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Student Name</th>
                              <th className="px-4 py-3 font-semibold">Status</th>
                              <th className="px-4 py-3 font-semibold">Join Time</th>
                              <th className="px-4 py-3 font-semibold">Participation</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {trackDisplay.students.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-[#6f84b4]">
                                  No students in this session yet.
                                </td>
                              </tr>
                            ) : (
                              trackDisplay.students.map((row) => {
                                const isFallback = String(row.id).startsWith('fallback-');
                                const isUpdating =
                                  !isFallback &&
                                  updateAttendanceMutation.isPending &&
                                  updateAttendanceMutation.variables?.studentId === row.id;
                                return (
                                  <tr key={row.id} className="border-t border-[#e4ecff] hover:bg-[#f7faff]">
                                    <td className="px-4 py-3 font-medium text-[#17367a]">{row.name}</td>
                                    <td className="px-4 py-3">
                                      {isFallback ? (
                                        <span
                                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                            row.status === 'Present'
                                              ? 'bg-[#dcfce7] text-[#0a8b45]'
                                              : 'bg-[#fee2e2] text-[#b91c1c]'
                                          }`}
                                        >
                                          {row.status}
                                        </span>
                                      ) : (
                                        <>
                                          <select
                                            value={row.status}
                                            onChange={(e) => {
                                              const newStatus = e.target.value;
                                              if (newStatus === row.status) return;
                                              updateAttendanceMutation.mutate({
                                                sessionId: trackModalSession.id,
                                                studentId: row.id,
                                                status: newStatus,
                                              });
                                            }}
                                            disabled={isUpdating}
                                            className={`rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1f3f93]/30 disabled:opacity-60 ${
                                              row.status === 'Present'
                                                ? 'border-[#86efac] bg-[#dcfce7] text-[#0a8b45]'
                                                : 'border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c]'
                                            }`}
                                          >
                                            <option value="Present">Present</option>
                                            <option value="Absent">Absent</option>
                                          </select>
                                          {isUpdating ? (
                                            <span className="ml-2 text-xs text-[#6f84b4]">Updating...</span>
                                          ) : null}
                                        </>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-[#556b97]">{row.joinTime || '—'}</td>
                                    <td className="px-4 py-3">
                                      {row.participation != null ? (
                                        <div className="flex items-center gap-2">
                                          <div className="h-2 w-24 overflow-hidden rounded-full bg-[#dfeafe]">
                                            <div
                                              className="h-full rounded-full bg-[#294697]"
                                              style={{ width: `${row.participation}%` }}
                                            />
                                          </div>
                                          <span className="text-xs font-semibold text-[#1f3f93]">{row.participation}%</span>
                                        </div>
                                      ) : (
                                        <span className="text-[#9ca3af]">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0 border-t border-[#e4ecff] px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTrackModalSession(null)}
                  className="h-11 rounded-xl border-2 border-[#c7d9f7] bg-white px-5 text-sm font-bold text-[#374151] shadow-sm hover:bg-[#f3f7ff] hover:border-[#1f3f93]/40 focus:outline-none focus:ring-2 focus:ring-[#1f3f93]/20"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Swal.fire({
                      title: 'Export Report',
                      text: 'Attendance report will be downloaded.',
                      icon: 'info',
                      timer: 1500,
                      showConfirmButton: false,
                      confirmButtonColor: '#1f3f93',
                    });
                  }}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1f3f93] px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(31,63,147,0.4)] hover:bg-[#163f9a] focus:outline-none focus:ring-2 focus:ring-[#1f3f93]/50 focus:ring-offset-2"
                >
                  <Download size={18} />
                  Export Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveSessionsPage;
