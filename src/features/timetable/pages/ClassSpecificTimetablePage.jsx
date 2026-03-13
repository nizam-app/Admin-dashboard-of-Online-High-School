import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getGradesSections, getSubjectsList, getClasses } from '../../classes/api/classesApi';
import { getUsers } from '../../users/api/usersApi';
import {
  createTimetableEntry,
  getTimetableEntries,
  getTimetableMeta,
} from '../api/timetableApi';

const DAY_OPTIONS = [
  { label: 'Monday', value: 'mon' },
  { label: 'Tuesday', value: 'tue' },
  { label: 'Wednesday', value: 'wed' },
  { label: 'Thursday', value: 'thu' },
  { label: 'Friday', value: 'fri' },
  { label: 'Saturday', value: 'sat' },
  { label: 'Sunday', value: 'sun' },
];

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00'];

const normalizeTime = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const hour = match[1].padStart(2, '0');
  const minute = match[2];
  return `${hour}:${minute}`;
};

const normalizeDayValue = (value) => {
  if (!value) return '';
  const raw = String(value).trim().toLowerCase();
  const map = {
    mon: 'mon',
    monday: 'mon',
    tue: 'tue',
    tues: 'tue',
    tuesday: 'tue',
    wed: 'wed',
    weds: 'wed',
    wednesday: 'wed',
    thu: 'thu',
    thur: 'thu',
    thurs: 'thu',
    thursday: 'thu',
    fri: 'fri',
    friday: 'fri',
  };
  return map[raw] || raw;
};

const buildTimetableGrid = (entries = []) => {
  const bySlot = new Map();
  (entries || []).forEach((entry) => {
    if (!entry?.day || !entry?.startTime) return;
    const day = normalizeDayValue(entry.day);
    const start = normalizeTime(entry.startTime);
    const key = `${day}|${start}`;
    bySlot.set(key, entry);
  });
  return bySlot;
};

const ClassSpecificTimetablePage = () => {
  const queryClient = useQueryClient();
  const [selectedGradeId, setSelectedGradeId] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [formValues, setFormValues] = useState({
    classId: '',
    gradeId: '',
    subjectId: '',
    teacherId: '',
    day: 'mon',
    startTime: '08:00',
    endTime: '09:00',
  });

  const gradesQuery = useQuery({
    queryKey: ['grades-sections'],
    queryFn: getGradesSections,
    staleTime: 5 * 60 * 1000,
  });

  const subjectsQuery = useQuery({
    queryKey: ['subjects-list'],
    queryFn: getSubjectsList,
    staleTime: 5 * 60 * 1000,
  });

  const teachersQuery = useQuery({
    queryKey: ['users', 'teachers'],
    queryFn: () => getUsers({ role: 'teacher', limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const classesQuery = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => getClasses({ page: 1, limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  });

  const selectedGrade = useMemo(() => {
    const grades = gradesQuery.data || [];
    return grades.find((g) => g.id === selectedGradeId) || grades[0] || null;
  }, [gradesQuery.data, selectedGradeId]);

  const gradeTabs = useMemo(() => {
    const grades = gradesQuery.data || [];
    if (grades.length) return grades;
    return [
      { id: '4th', label: '4th' },
      { id: '5th', label: '5th' },
      { id: '6th', label: '6th' },
      { id: '7th', label: '7th' },
    ];
  }, [gradesQuery.data]);

  // Auto-select a grade tab when data becomes available.
  useEffect(() => {
    if (!selectedGradeId && gradeTabs.length > 0) {
      setSelectedGradeId(gradeTabs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeTabs.length]);

  const gradeLabel = selectedGrade?.label || (gradeTabs[0] && gradeTabs[0].label) || 'Grade';

  const classOptions = useMemo(() => {
    const classes = classesQuery.data?.items || [];
    if (!selectedGradeId) return classes;
    return classes.filter((c) => String(c.gradeId) === String(selectedGradeId) || String(c.grade) === String(gradeLabel));
  }, [classesQuery.data, selectedGradeId, gradeLabel]);

  const timetableEntriesQuery = useQuery({
    queryKey: ['timetable-entries', selectedGradeId, selectedClassId],
    queryFn: () =>
      getTimetableEntries({ gradeId: selectedGradeId, classId: selectedClassId }).catch(() => []),
    enabled: Boolean(selectedGradeId),
    staleTime: 30 * 1000,
  });

  const timetableMetaQuery = useQuery({
    queryKey: ['timetable-meta'],
    queryFn: () => getTimetableMeta().catch(() => ({})),
    staleTime: 5 * 60 * 1000,
  });

  const timetableEntries = timetableEntriesQuery.data || [];
  const timetableMeta = timetableMetaQuery.data || {};

  const subjectMap = useMemo(() => {
    const subjects = subjectsQuery.data || [];
    const metaSubjects = timetableMeta?.subjects || [];

    const fromSubjects = subjects.reduce((acc, sub) => {
      if (sub?.id) acc[String(sub.id)] = sub.name || sub.label || '';
      return acc;
    }, {});

    const fromMeta = (Array.isArray(metaSubjects) ? metaSubjects : []).reduce((acc, sub) => {
      if (!sub) return acc;
      const id = String(sub.id || sub._id || sub.subjectId || sub.subject_id || '').trim();
      const name = String(sub.name || sub.label || sub.subject || sub.title || '').trim();
      if (id) acc[id] = name;
      return acc;
    }, {});

    return { ...fromSubjects, ...fromMeta };
  }, [subjectsQuery.data, timetableMeta]);

  const teacherMap = useMemo(() => {
    const users = teachersQuery.data?.users || [];
    const metaTeachers = timetableMeta?.teachers || [];

    const fromUsers = users.reduce((acc, teacher) => {
      if (teacher?.id) acc[String(teacher.id)] = teacher.name || teacher.fullName || '';
      return acc;
    }, {});

    const fromMeta = (Array.isArray(metaTeachers) ? metaTeachers : []).reduce((acc, teacher) => {
      if (!teacher) return acc;
      const id = String(teacher.id || teacher._id || teacher.teacherId || teacher.teacher_id || '').trim();
      const name = String(teacher.name || teacher.fullName || teacher.label || '').trim();
      if (id) acc[id] = name;
      return acc;
    }, {});

    return { ...fromUsers, ...fromMeta };
  }, [teachersQuery.data, timetableMeta]);

  const enrichedEntries = useMemo(() => {
    const resolveNameFromObject = (raw) => {
      if (!raw) return '';
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'object') {
        return (
          String(raw.name || raw.title || raw.label || raw.subject || raw.teacher || '') ||
          ''
        );
      }
      return String(raw);
    };

    const resolveSubjectName = (entry) => {
      const rawSubject =
        resolveNameFromObject(entry?.subject) ||
        resolveNameFromObject(entry?.subjectName) ||
        resolveNameFromObject(entry?.subject_name);

      const subjectId =
        entry?.subjectId || entry?.subject_id || entry?.subject?.id || entry?.subjectName?.id;

      return (
        String(rawSubject || '') ||
        subjectMap[String(subjectId)] ||
        ''
      );
    };

    const resolveTeacherName = (entry) => {
      const rawTeacher =
        resolveNameFromObject(entry?.teacher) ||
        resolveNameFromObject(entry?.teacherName) ||
        resolveNameFromObject(entry?.teacher_name);

      const teacherId =
        entry?.teacherId || entry?.teacher_id || entry?.teacher?.id || entry?.teacherName?.id;

      return (
        String(rawTeacher || '') ||
        teacherMap[String(teacherId)] ||
        ''
      );
    };

    return timetableEntries.map((entry) => ({
      ...entry,
      subjectName: resolveSubjectName(entry),
      teacherName: resolveTeacherName(entry),
    }));
  }, [timetableEntries, subjectMap, teacherMap]);

  const gridMap = useMemo(() => buildTimetableGrid(enrichedEntries), [enrichedEntries]);

  const createEntryMutation = useMutation({
    mutationFn: (payload) => createTimetableEntry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-entries', selectedGradeId, selectedClassId]);
      setIsCreateOpen(false);
    },
  });

  const openCreateModal = (day, startTime) => {
    setFormError('');
    setFormValues((current) => ({
      ...current,
      gradeId: selectedGradeId || current.gradeId || '',
      classId: selectedClassId || current.classId || '',
      day,
      startTime,
      endTime: startTime ? `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, '0')}:00` : '09:00',
    }));
    setIsCreateOpen(true);
  };

  const closeModal = () => {
    setIsCreateOpen(false);
    setFormError('');
  };

  const handleFormChange = (key, value) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const { classId, gradeId, subjectId, teacherId, day, startTime, endTime } = formValues;
    if (!classId || !gradeId || !subjectId || !teacherId || !day || !startTime || !endTime) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      await createEntryMutation.mutateAsync({
        type: 'class',
        classId,
        gradeId,
        subjectId,
        teacherId,
        day,
        startTime,
        endTime,
      });
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Failed to save schedule entry.';
      setFormError(message);
      // eslint-disable-next-line no-console
      console.error('Timetable create error', err);
    }
  };

  const selectedClass = classOptions.find((c) => c.id === selectedClassId) || null;

  return (
    <div className="rounded-[10px] border border-[#d6e3fb] bg-white p-5">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#17367a]">Class-Specific Timetable</h2>
        <p className="mt-1 text-sm text-[#6f84b4]">
          Create and manage timetables for individual class groups.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {gradeTabs.map((grade) => {
            const isActive = grade.id === (selectedGradeId || gradeTabs[0]?.id);
            return (
              <button
                key={grade.id}
                type="button"
                onClick={() => {
                  setSelectedGradeId(grade.id);
                  setSelectedClassId(null);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-[#1f3f93] text-white shadow-[0_4px_10px_rgba(31,63,147,0.25)]'
                    : 'border border-[#d6e3fb] bg-white text-[#17367a] hover:border-[#1f3f93] hover:text-[#1f3f93]'
                }`}
              >
                {grade.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 rounded-[10px] border border-[#e4ecff] bg-[#f7f9ff] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-[#17367a]">Class</label>
              <select
                value={selectedClassId || ''}
                onChange={(event) => setSelectedClassId(event.target.value)}
                className="h-10 rounded-lg border border-[#d6e3fb] bg-white px-3 text-sm outline-none focus:border-[#1f3f93]"
              >
                <option value="">Select class</option>
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.className || cls.grade || cls.subject || cls.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-[#6f84b4]">
              Select a slot to add a new schedule entry.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse">
              <thead className="bg-[#eef4ff] text-left text-[13px] font-semibold text-[#1f3f93]">
                <tr>
                  <th className="w-24 px-4 py-3">Time</th>
                  {DAY_OPTIONS.map((day) => (
                    <th key={day.value} className="px-4 py-3">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time) => (
                  <tr key={time} className="border-t border-[#e2ecff]">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-[#1f3f93]">
                      {time}
                    </td>
                    {DAY_OPTIONS.map((day) => {
                      const key = `${day.value}|${time}`;
                      const entry = gridMap.get(key);
                      const isDisabled = !selectedClassId;
                      return (
                        <td key={key} className="px-3 py-3">
                          {entry ? (
                            <div className="rounded-lg border border-[#d6e3ff] bg-white p-2 text-sm">
                              <div className="font-semibold text-[#1f3f93]">
                                {entry.subject || entry.subjectName || 'Class'}
                              </div>
                              <div className="text-xs text-[#6f84b4]">
                                {entry.teacherName || entry.teacher || ''}
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => openCreateModal(day.value, time)}
                              className={`group flex h-14 w-full items-center justify-center rounded-lg border border-dashed px-1 text-sm text-[#6f84b4] transition ${
                                isDisabled
                                  ? 'cursor-not-allowed bg-[#f3f7fe] opacity-60'
                                  : 'hover:border-[#1f3f93] hover:text-[#1f3f93]'
                              }`}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="flex items-center justify-between">
                <h2 className="text-[24px] font-semibold text-[#1f3f93]">Add Schedule Entry</h2>
                <button type="button" onClick={closeModal} className="text-[#6f84b4] hover:text-[#1f3f93]">
                  <X size={18} />
                </button>
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade *</label>
                  <select
                    value={formValues.gradeId}
                    onChange={(event) => handleFormChange('gradeId', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select grade</option>
                    {gradeTabs.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Class *</label>
                  <select
                    value={formValues.classId}
                    onChange={(event) => handleFormChange('classId', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select class</option>
                    {classOptions.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.className || cls.grade || cls.subject || cls.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject *</label>
                  <select
                    value={formValues.subjectId}
                    onChange={(event) => handleFormChange('subjectId', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select subject</option>
                    {subjectsQuery.data?.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Teacher *</label>
                  <select
                    value={formValues.teacherId}
                    onChange={(event) => handleFormChange('teacherId', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select teacher</option>
                    {(teachersQuery.data?.users || []).map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Day *</label>
                  <select
                    value={formValues.day}
                    onChange={(event) => handleFormChange('day', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    {DAY_OPTIONS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Start Time *</label>
                  <input
                    type="time"
                    value={formValues.startTime}
                    onChange={(event) => handleFormChange('startTime', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">End Time *</label>
                  <input
                    type="time"
                    value={formValues.endTime}
                    onChange={(event) => handleFormChange('endTime', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="submit"
                    disabled={createEntryMutation.isLoading}
                    className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1f3f93] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {createEntryMutation.isLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassSpecificTimetablePage;
