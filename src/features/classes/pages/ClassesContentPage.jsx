import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { getGrades, getUsers } from '../../users/api/usersApi';
import {
  createClass,
  createGrade,
  createSubject,
  deleteGrade,
  deleteSubject,
  deleteClass,
  getClasses,
  getSubjectsList,
  updateClass,
} from '../api/classesApi';

const TAB_OPTIONS = ['Classes', 'Content Library', 'Assignments'];
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const classKey = (grade, subject) => `${normalizeText(grade)}__${normalizeText(subject)}`;
const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());

const ClassesContentPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Classes');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isAddGradeOpen, setIsAddGradeOpen] = useState(false);
  const [classActionError, setClassActionError] = useState('');
  const [editingClass, setEditingClass] = useState(null);
  const [createValues, setCreateValues] = useState({
    subject: '',
    grade: '',
  });
  const [editValues, setEditValues] = useState({
    subject: '',
    grade: '',
  });
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newGradeLabel, setNewGradeLabel] = useState('');

  const {
    data: classesFromApi = [],
    isLoading: isClassesLoading,
    isError: isClassesError,
  } = useQuery({
    queryKey: ['classes-content-classes'],
    queryFn: getClasses,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const { data: gradesFromApi = [], isLoading: isGradesLoading } = useQuery({
    queryKey: ['class-grades-options'],
    queryFn: getGrades,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: subjectsFromApi = [], isLoading: isSubjectsLoading } = useQuery({
    queryKey: ['class-subjects-options'],
    queryFn: getSubjectsList,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const createClassMutation = useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      setClassActionError('');
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to create class');
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: () => {
      setClassActionError('');
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to delete class');
    },
  });

  const updateClassMutation = useMutation({
    mutationFn: ({ classId, payload }) => updateClass(classId, payload),
    onSuccess: () => {
      setClassActionError('');
      setIsEditOpen(false);
      setEditingClass(null);
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to update class');
    },
  });

  const createSubjectMutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => {
      setClassActionError('');
      setIsAddSubjectOpen(false);
      setNewSubjectName('');
      queryClient.invalidateQueries({ queryKey: ['class-subjects-options'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to create subject');
    },
  });

  const createGradeMutation = useMutation({
    mutationFn: createGrade,
    onSuccess: () => {
      setClassActionError('');
      setIsAddGradeOpen(false);
      setNewGradeLabel('');
      queryClient.invalidateQueries({ queryKey: ['class-grades-options'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to create grade');
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => {
      setClassActionError('');
      queryClient.invalidateQueries({ queryKey: ['class-subjects-options'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to delete subject');
    },
  });

  const deleteGradeMutation = useMutation({
    mutationFn: deleteGrade,
    onSuccess: () => {
      setClassActionError('');
      queryClient.invalidateQueries({ queryKey: ['class-grades-options'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to delete grade');
    },
  });

  const { data: usersForCount } = useQuery({
    queryKey: ['classes-content-student-counts'],
    queryFn: () =>
      getUsers({
        role: 'student',
        status: '',
        search: '',
        page: 1,
        limit: 1000,
      }),
    staleTime: 30 * 1000,
    retry: 1,
  });

  const gradeOptions = useMemo(
    () =>
      (gradesFromApi || [])
        .map((grade) => ({
          id: String(grade?.id || ''),
          label: String(grade?.level || grade?.name || '').trim(),
        }))
        .filter((grade) => grade.id && grade.label),
    [gradesFromApi]
  );

  const subjectOptions = useMemo(() => {
    const fromApi = (subjectsFromApi || [])
      .map((subject) =>
        typeof subject === 'string' ? String(subject).trim() : String(subject?.name || '').trim()
      )
      .filter(Boolean);
    const fromClasses = (classesFromApi || [])
      .map((item) => String(item?.subject || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...fromApi, ...fromClasses]));
  }, [subjectsFromApi, classesFromApi]);

  const classes = useMemo(
    () => (Array.isArray(classesFromApi) ? classesFromApi : []),
    [classesFromApi]
  );

  const studentCountByClass = useMemo(() => {
    const map = new Map();
    const students = usersForCount?.users || [];

    students.forEach((student) => {
      const assigned = Array.isArray(student?.assignedClasses) ? student.assignedClasses : [];
      assigned.forEach((entry) => {
        const text = String(entry || '').trim();
        if (!text || text.startsWith('+')) return;
        const [grade, subject] = text.split('-').map((part) => String(part || '').trim());
        if (!grade || !subject) return;
        const key = classKey(grade, subject);
        map.set(key, (map.get(key) || 0) + 1);
      });
    });

    return map;
  }, [usersForCount?.users]);

  useEffect(() => {
    if (!createValues.subject && subjectOptions.length > 0) {
      setCreateValues((prev) => ({ ...prev, subject: subjectOptions[0] }));
    }
  }, [createValues.subject, subjectOptions]);

  useEffect(() => {
    if (!createValues.grade && gradeOptions.length > 0) {
      setCreateValues((prev) => ({ ...prev, grade: gradeOptions[0].id }));
    }
  }, [createValues.grade, gradeOptions]);

  const handleCreateClass = (event) => {
    event.preventDefault();
    const subject = String(createValues.subject || '').trim();
    const gradeId = String(createValues.grade || '').trim();
    const selectedGrade = gradeOptions.find((item) => item.id === gradeId);
    if (!subject || !selectedGrade) return;

    const payload = {
      subject,
      gradeId,
      gradeLevel: selectedGrade.label,
    };

    createClassMutation.mutate(payload, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Created',
          text: 'Class created successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to create class';
        await Swal.fire({
          title: 'Create Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const openEditModal = (item) => {
    const matchedGrade =
      gradeOptions.find((grade) => normalizeText(grade.label) === normalizeText(item.grade)) || null;
    const matchedSubject =
      subjectOptions.find((subject) => normalizeText(subject) === normalizeText(item.subject)) || '';

    setEditingClass(item);
    setEditValues({
      subject: matchedSubject || item.subject || '',
      grade: matchedGrade?.id || '',
    });
    setIsEditOpen(true);
  };

  const handleUpdateClass = (event) => {
    event.preventDefault();
    if (!editingClass) return;

    const subject = String(editValues.subject || '').trim();
    const gradeId = String(editValues.grade || '').trim();
    const selectedGrade = gradeOptions.find((item) => item.id === gradeId);
    if (!subject || !selectedGrade) return;

    const payload = {
      subject,
      gradeId,
      gradeLevel: selectedGrade.label,
    };

    updateClassMutation.mutate(
      { classId: editingClass.deleteId || editingClass.id, payload },
      {
        onSuccess: async () => {
          await Swal.fire({
            title: 'Updated',
            text: 'Class updated successfully.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
        onError: async (error) => {
          const status = error?.response?.status;
          const message = error?.response?.data?.message || error?.message || 'Failed to update class';
          await Swal.fire({
            title: 'Update Failed',
            text: status ? `(${status}) ${message}` : message,
            icon: 'error',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  const handleDeleteClass = async (item) => {
    const deleteId = String(item?.deleteId || item?.id || '').trim();

    if (!isMongoId(deleteId)) {
      await Swal.fire({
        title: 'Delete Failed',
        text: `Class id is invalid: "${deleteId || 'missing'}". Backend must return _id.`,
        icon: 'error',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete Class?',
      text: `Are you sure you want to delete "${item.subject} ${item.grade}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });

    if (!result.isConfirmed) return;

    deleteClassMutation.mutate(deleteId, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'Class deleted successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to delete class';
        await Swal.fire({
          title: 'Delete Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const handleCreateSubject = (event) => {
    event.preventDefault();
    const subjectName = String(newSubjectName || '').trim();
    if (!subjectName) return;

    createSubjectMutation.mutate(
      {
        name: subjectName,
        subject: subjectName,
      },
      {
        onSuccess: async () => {
          await Swal.fire({
            title: 'Created',
            text: 'Subject created successfully.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
        onError: async (error) => {
          const status = error?.response?.status;
          const message = error?.response?.data?.message || error?.message || 'Failed to create subject';
          await Swal.fire({
            title: 'Create Failed',
            text: status ? `(${status}) ${message}` : message,
            icon: 'error',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  const handleCreateGrade = (event) => {
    event.preventDefault();
    const gradeLabel = String(newGradeLabel || '').trim();
    if (!gradeLabel) return;

    createGradeMutation.mutate(
      {
        label: gradeLabel,
        name: gradeLabel,
        gradeLevel: gradeLabel,
      },
      {
        onSuccess: async () => {
          await Swal.fire({
            title: 'Created',
            text: 'Grade created successfully.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
        onError: async (error) => {
          const status = error?.response?.status;
          const message = error?.response?.data?.message || error?.message || 'Failed to create grade';
          await Swal.fire({
            title: 'Create Failed',
            text: status ? `(${status}) ${message}` : message,
            icon: 'error',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  const handleDeleteSubject = async (subjectItem) => {
    if (!subjectItem?.deletable) {
      await Swal.fire({
        title: 'Delete Not Available',
        text: 'This subject is missing backend id.',
        icon: 'info',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete Subject?',
      text: `Are you sure you want to delete "${subjectItem.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });
    if (!result.isConfirmed) return;

    deleteSubjectMutation.mutate(subjectItem.id, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'Subject deleted successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to delete subject';
        await Swal.fire({
          title: 'Delete Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const handleDeleteGrade = async (gradeItem) => {
    const gradeId = String(gradeItem?.id || '').trim();
    if (!gradeId) {
      await Swal.fire({
        title: 'Delete Not Available',
        text: 'This grade is missing backend id.',
        icon: 'info',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete Grade?',
      text: `Are you sure you want to delete "${gradeItem.label}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });
    if (!result.isConfirmed) return;

    deleteGradeMutation.mutate(gradeId, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'Grade deleted successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to delete grade';
        await Swal.fire({
          title: 'Delete Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="w-full max-w-[430px] rounded-[10px] border border-[#d6e3fb] bg-white p-1">
        <div className="grid grid-cols-3 gap-1">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-10 rounded-md text-sm font-semibold ${
                activeTab === tab ? 'bg-[#1f3f93] text-white' : 'text-[#17367a]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1f3f93] px-5 font-semibold leading-none text-white"
        >
          <FiPlus size={16} />
          Create Class
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {classActionError && (
          <div className="rounded-[10px] border border-[#f5d0d0] bg-[#fff5f5] p-3 text-sm text-red-600 xl:col-span-3">
            {classActionError}
          </div>
        )}
        {isClassesLoading && (
          <div className="rounded-[10px] border border-[#d6e3fb] bg-white p-4 text-sm text-[#5f79af]">
            Loading classes...
          </div>
        )}
        {!isClassesLoading && isClassesError && (
          <div className="rounded-[10px] border border-[#f5d0d0] bg-[#fff5f5] p-4 text-sm text-red-600">
            Failed to load classes from backend.
          </div>
        )}
        {!isClassesLoading && !isClassesError && classes.length === 0 && (
          <div className="rounded-[10px] border border-[#d6e3fb] bg-white p-4 text-sm text-[#5f79af]">
            No classes found.
          </div>
        )}

        {classes.map((item) => {
          const backendCount = Number(item.students || 0);
          const fallbackCount = Number(studentCountByClass.get(classKey(item.grade, item.subject)) || 0);
          const displayStudents = backendCount > 0 ? backendCount : fallbackCount;
          return (
          <article
            key={item.id}
            className="rounded-[10px] border border-[#d6e3fb] bg-white p-4 text-[#17367a]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-[20px] font-semibold leading-none text-[#1f3f93]">
                  {item.subject} {item.grade}
                </h3>
                <p className="mt-2 text-sm text-[#5f79af]">{item.grade}</p>
              </div>
              <span className="rounded-full bg-[#1f3f93] px-3 py-1 text-xs font-semibold text-white">
                {item.subject}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#5f79af]">Students</span>
                <strong>{displayStudents}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5f79af]">Teacher</span>
                <strong>{item.teacherAssigned ? '\u2713' : 'Not assigned'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5f79af]">Lessons</span>
                <strong>{item.lessons}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5f79af]">Assignments</span>
                <strong>{item.assignments}</strong>
              </div>
            </div>

            <div className="mt-4 border-t border-[#e2ecff] pt-3">
              <p className="mb-2 text-sm text-[#5f79af]">Assigned Teacher:</p>
              <span className="rounded-md border border-[#c8daf8] bg-[#eef4ff] px-2 py-1 text-xs text-[#1f4ca8]">
                {item.teacher}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#e2ecff] pt-3">
              <button
                type="button"
                onClick={() => openEditModal(item)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#eef4ff] text-[#4d91ff]"
              >
                <FiEdit2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteClass(item)}
                disabled={deleteClassMutation.isPending}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#fff3f3] text-[#e10000]"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          </article>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[30px] font-semibold text-[#1f3f93]">Subjects</h3>
            <button
              type="button"
              onClick={() => setIsAddSubjectOpen(true)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#1f3f93]"
            >
              <FiPlus size={14} />
              Add Subject
            </button>
          </div>
          <div className="space-y-2">
            {subjectsFromApi.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center justify-between rounded-md border border-[#d6e3fb] bg-[#f8fbff] px-3 py-2 text-[#17367a]"
              >
                <span>{subject.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteSubject(subject)}
                  disabled={deleteSubjectMutation.isPending}
                  className="text-[#e10000] disabled:opacity-50"
                  title="Delete subject"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
            {subjectsFromApi.length === 0 && (
              <p className="text-sm text-[#6f84b4]">No subjects available.</p>
            )}
          </div>
        </section>

        <section className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[30px] font-semibold text-[#1f3f93]">Grade Levels</h3>
            <button
              type="button"
              onClick={() => setIsAddGradeOpen(true)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#1f3f93]"
            >
              <FiPlus size={14} />
              Add Grade
            </button>
          </div>
          <div className="space-y-2">
            {gradeOptions.map((grade) => (
              <div
                key={grade.id}
                className="flex items-center justify-between rounded-md border border-[#d6e3fb] bg-[#f8fbff] px-3 py-2 text-[#17367a]"
              >
                <span>{grade.label}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteGrade(grade)}
                  disabled={deleteGradeMutation.isPending}
                  className="text-[#e10000] disabled:opacity-50"
                  title="Delete grade"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
            {gradeOptions.length === 0 && (
              <p className="text-sm text-[#6f84b4]">No grades available.</p>
            )}
          </div>
        </section>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[760px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleCreateClass}>
              <h2 className="text-[24px] font-semibold text-[#1f3f93]">Create New Class</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <select
                    value={createValues.subject}
                    onChange={(event) =>
                      setCreateValues((prev) => ({ ...prev, subject: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isSubjectsLoading || subjectOptions.length === 0}
                  >
                    {subjectOptions.length === 0 && <option value="">No subjects available</option>}
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
                    value={createValues.grade}
                    onChange={(event) =>
                      setCreateValues((prev) => ({ ...prev, grade: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isGradesLoading || gradeOptions.length === 0}
                  >
                    {gradeOptions.length === 0 && <option value="">No grades available</option>}
                    {gradeOptions.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_180px]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    subjectOptions.length === 0 ||
                    gradeOptions.length === 0 ||
                    createClassMutation.isPending
                  }
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createClassMutation.isPending ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOpen && editingClass && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[760px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleUpdateClass}>
              <h2 className="text-[24px] font-semibold text-[#1f3f93]">Edit Class</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <select
                    value={editValues.subject}
                    onChange={(event) =>
                      setEditValues((prev) => ({ ...prev, subject: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isSubjectsLoading || subjectOptions.length === 0}
                  >
                    {subjectOptions.length === 0 && <option value="">No subjects available</option>}
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
                    value={editValues.grade}
                    onChange={(event) =>
                      setEditValues((prev) => ({ ...prev, grade: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isGradesLoading || gradeOptions.length === 0}
                  >
                    {gradeOptions.length === 0 && <option value="">No grades available</option>}
                    {gradeOptions.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_180px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setEditingClass(null);
                  }}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    subjectOptions.length === 0 ||
                    gradeOptions.length === 0 ||
                    updateClassMutation.isPending
                  }
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {updateClassMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddSubjectOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleCreateSubject}>
              <h2 className="text-[24px] font-semibold text-[#1f3f93]">Add Subject</h2>
              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject Name</label>
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(event) => setNewSubjectName(event.target.value)}
                  placeholder="e.g. Mathematics"
                  className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_180px]">
                <button
                  type="button"
                  onClick={() => setIsAddSubjectOpen(false)}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubjectMutation.isPending || !newSubjectName.trim()}
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createSubjectMutation.isPending ? 'Creating...' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddGradeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleCreateGrade}>
              <h2 className="text-[24px] font-semibold text-[#1f3f93]">Add Grade</h2>
              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade Label</label>
                <input
                  type="text"
                  value={newGradeLabel}
                  onChange={(event) => setNewGradeLabel(event.target.value)}
                  placeholder="e.g. 8th"
                  className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_180px]">
                <button
                  type="button"
                  onClick={() => setIsAddGradeOpen(false)}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGradeMutation.isPending || !newGradeLabel.trim()}
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createGradeMutation.isPending ? 'Creating...' : 'Add Grade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default ClassesContentPage;
