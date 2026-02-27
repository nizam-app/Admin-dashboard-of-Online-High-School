import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { FiEdit2, FiTrash2, FiUserPlus, FiUserX } from 'react-icons/fi';
import { createUser, getGrades, getSubjects } from '../api/usersApi';
import { useUserStats } from '../hooks/useUserStats';
import { useUsers } from '../hooks/useUsers';

const cards = [
  { key: 'totalStudents', label: 'Total Students', valueClass: 'text-[#1f3f93]' },
  { key: 'totalTeachers', label: 'Total Teachers', valueClass: 'text-[#1f3f93]' },
  { key: 'activeUsers', label: 'Active Users', valueClass: 'text-[#00a04f]' },
  { key: 'inactiveUsers', label: 'Inactive Users', valueClass: 'text-[#e10000]' },
];
const DEFAULT_SUBJECTS = ['Math', 'Physics', 'Chemistry', 'SVT', 'French', 'Arabic', 'English'];

const formatValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return Number(value).toLocaleString();
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().split('T')[0];
};

const renderAssignedClasses = (classes) => {
  if (!Array.isArray(classes) || classes.length === 0) {
    return <span className="text-xs text-[#7b91be]">N/A</span>;
  }

  const first = classes[0];
  const extra = classes.length - 1;

  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded-md border border-[#c8daf8] bg-[#eef4ff] px-2 py-0.5 text-xs text-[#1f4ca8]">
        {first}
      </span>
      {extra > 0 && (
        <span className="rounded-md border border-[#c8daf8] bg-[#eef4ff] px-2 py-0.5 text-xs text-[#1f4ca8]">
          +{extra}
        </span>
      )}
    </div>
  );
};

const getInitials = (name) => {
  if (!name || name === 'N/A') return 'NA';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const normalizeValue = (value) => String(value || '').trim();

const UserManagementPage = () => {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [formRole, setFormRole] = useState('student');
  const [formValues, setFormValues] = useState({
    fullName: '',
    phone: '',
    grade: '',
    subject: '',
    pin: '',
    confirmPin: '',
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryParams = useMemo(
    () => ({
      role: roleFilter === 'all' ? '' : roleFilter,
      status: '',
      search,
      page,
      limit: 10,
    }),
    [roleFilter, search, page]
  );

  const { data, isLoading, isError } = useUserStats();
  const {
    data: usersData,
    isLoading: isUsersLoading,
    isError: isUsersError,
  } = useUsers(queryParams);

  const users = usersData?.users || [];
  const totalPages = Number(usersData?.totalPages || 1);
  const { data: gradesFromApi = [] } = useQuery({
    queryKey: ['grades-options'],
    queryFn: getGrades,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const { data: subjectsFromApi = [] } = useQuery({
    queryKey: ['subjects-options'],
    queryFn: getSubjects,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const gradeOptions = useMemo(() => {
    const fromApi = [...(usersData?.gradeOptions || []), ...gradesFromApi].filter(
      (item) => item?.id && item?.name
    );
    const fromUsers = users
      .map((user) => {
        const id = normalizeValue(user.gradeId || '');
        const name = normalizeValue(user.grade || '');
        if (!id || !name) return null;
        return { id, name };
      })
      .filter(Boolean);

    const merged = [...fromApi, ...fromUsers];
    const unique = new Map();
    merged.forEach((item) => {
      if (!unique.has(item.id)) unique.set(item.id, item);
    });
    return Array.from(unique.values());
  }, [users, usersData?.gradeOptions, gradesFromApi]);

  const subjectOptions = useMemo(() => {
    const fromApi = [...(usersData?.subjectOptions || []), ...subjectsFromApi]
      .map(normalizeValue)
      .filter(Boolean);
    const derivedSubjects = users
      .flatMap((user) => {
        const fromProfile = normalizeValue(user.subject);
        const fromClasses = (user.assignedClasses || []).map((item) => normalizeValue(item).split('-')[1]?.trim());
        return [fromProfile, ...fromClasses];
      })
      .filter(Boolean);

    const all = new Set([...DEFAULT_SUBJECTS, ...fromApi, ...derivedSubjects]);
    return Array.from(all).filter(Boolean);
  }, [users, usersData?.subjectOptions, subjectsFromApi]);

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setIsAddUserOpen(false);
      setFormValues({
        fullName: '',
        phone: '',
        grade: '',
        subject: '',
        pin: '',
        confirmPin: '',
      });
      setFormError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-stats'] });
      queryClient.invalidateQueries({ queryKey: ['grades-options'] });
      queryClient.invalidateQueries({ queryKey: ['subjects-options'] });
    },
    onError: (error) => {
      setFormError(error?.response?.data?.message || 'Failed to create user');
    },
  });

  const handleFormChange = (key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const openAddUser = () => {
    const defaultGradeId = normalizeValue(gradeOptions[0]?.id || '');
    setIsAddUserOpen(true);
    setFormRole('student');
    setFormValues({
      fullName: '',
      phone: '',
      grade: defaultGradeId,
      subject: '',
      pin: '',
      confirmPin: '',
    });
    setFormError('');
  };

  const closeAddUser = () => {
    if (createUserMutation.isPending) return;
    setIsAddUserOpen(false);
    setFormError('');
  };

  useEffect(() => {
    if (!isAddUserOpen) return;
    if (formRole !== 'student') return;
    if (normalizeValue(formValues.grade)) return;
    const fallback = normalizeValue(gradeOptions[0]?.id || '');
    if (!fallback) return;
    setFormValues((prev) => ({ ...prev, grade: fallback }));
  }, [isAddUserOpen, formRole, formValues.grade, gradeOptions]);

  const handleCreateUser = (event) => {
    event.preventDefault();
    setFormError('');

    const fullName = normalizeValue(formValues.fullName);
    const phone = normalizeValue(formValues.phone);
    const selectedGradeId = normalizeValue(formValues.grade);
    const subject = normalizeValue(formValues.subject);
    const pin = normalizeValue(formValues.pin);
    const confirmPin = normalizeValue(formValues.confirmPin);

    if (!fullName || !phone || !pin || !confirmPin) {
      setFormError('Please fill all required fields');
      return;
    }

    if (!/^[234]\d{7}$/.test(phone)) {
      setFormError('Phone must be 8 digits and start with 2, 3, or 4');
      return;
    }

    if (pin !== confirmPin) {
      setFormError('PIN and Confirm PIN do not match');
      return;
    }

    let selectedGrade = null;
    if (formRole === 'student') {
      const fallbackGrade = gradeOptions[0] || null;
      selectedGrade =
        gradeOptions.find((item) => String(item.id) === selectedGradeId) || fallbackGrade;

      if (!selectedGrade?.id) {
        setFormError('Invalid gradeId. Please load grades from backend and select one.');
        return;
      }
    }

    if (formRole === 'teacher' && !subject) {
      setFormError('Subject is required for teachers');
      return;
    }

    const gradeName = normalizeValue(selectedGrade?.name || '');
    const gradeId = normalizeValue(selectedGrade?.id || '');
    const backendGradeLevel = normalizeValue(selectedGrade?.level || '');
    const normalizedRole = formRole.toLowerCase();
    const roleLabel = normalizedRole === 'student' ? 'Student' : 'Teacher';

    const payload = {
      role: normalizedRole,
      userType: normalizedRole,
      roleName: roleLabel,
      name: fullName,
      fullName,
      phone,
      pin,
      password: pin,
      confirmPin,
      ...(formRole === 'student'
        ? {
            grade: gradeName,
            gradeName,
            gradeId,
            ...(backendGradeLevel
              ? { gradeLevel: backendGradeLevel, gradeNumber: backendGradeLevel }
              : {}),
            grades: [gradeId],
            classGrade: gradeId,
            classGrades: [gradeId],
            assignedGrade: gradeId,
            assignedGrades: [gradeId],
            assignedClass: gradeId,
            assignedClasses: [gradeId],
            assignedClassesPayload: [{ _id: gradeId, name: gradeName }],
          }
        : {}),
      ...(formRole === 'teacher'
        ? {
            subject,
            mainSubject: subject,
            subjects: [subject],
          }
        : {}),
    };

    createUserMutation.mutate(payload);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[10px] border border-[#d6e3fb] bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-[520px]">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa3cf]"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search users..."
            className="h-11 w-full rounded-lg border border-[#d6e3fb] bg-[#f8fbff] pl-10 pr-3 text-sm text-[#17367a] outline-none focus:border-[#1f3f93]"
          />
        </label>

        <div className="flex items-center gap-2">
          <div className="inline-flex h-11 items-center rounded-[10px] border border-[#d6e3fb] bg-[#f8fbff] p-1">
            {[
              { label: 'All', value: 'all' },
              { label: 'Students', value: 'student' },
              { label: 'Teachers', value: 'teacher' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setRoleFilter(tab.value);
                  setPage(1);
                }}
                className={`h-9 rounded-md px-4 text-sm font-semibold ${
                  roleFilter === tab.value ? 'bg-[#1f3f93] text-white' : 'text-[#1f3f93]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openAddUser}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1f3f93] px-4 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.key} className="rounded-[10px] border border-[#d6e3fb] bg-white px-4 py-4">
            <p className="mb-1 text-[13px] text-[#5f79af]">{card.label}</p>
            <h3 className={`text-[40px] font-bold leading-none ${card.valueClass}`}>
              {isLoading ? '...' : formatValue(data?.[card.key])}
            </h3>
            {isError && <p className="mt-2 text-xs text-red-600">Failed to load stats</p>}
          </article>
        ))}
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[#d6e3fb] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#eef4ff] text-left text-[13px] font-semibold text-[#1f3f93]">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Assigned Classes</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Join Date</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isUsersLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-[#7b91be]">
                    Loading users...
                  </td>
                </tr>
              )}

              {!isUsersLoading && isUsersError && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-red-600">
                    Failed to load users
                  </td>
                </tr>
              )}

              {!isUsersLoading && !isUsersError && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-[#7b91be]">
                    No users found
                  </td>
                </tr>
              )}

              {!isUsersLoading &&
                !isUsersError &&
                users.map((user) => {
                  const statusText = String(user.status || '').toLowerCase();
                  const isActive = statusText === 'active';
                  const emailOrPhone = user.email && user.email !== 'N/A' ? user.email : user.phone;
                  return (
                    <tr key={user.id} className="border-t border-[#e2ecff] text-[#17367a]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1f3f93] text-sm font-semibold text-white">
                            {getInitials(user.name)}
                          </span>
                          <span className="font-semibold text-[16px] leading-none text-[#1f3f93]">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#4f6695]">{emailOrPhone}</td>
                      <td className="px-5 py-4">{user.role}</td>
                      <td className="px-5 py-4">{renderAssignedClasses(user.assignedClasses)}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            isActive ? 'bg-[#d7f2e3] text-[#067e3d]' : 'bg-[#fde2e2] text-[#c92020]'
                          }`}
                        >
                          {user.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-4">{formatDate(user.joinDate)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <button type="button" className="text-[#1f4ca8]" title="Add">
                            <FiUserPlus size={16} />
                          </button>
                          <button type="button" className="text-[#4d91ff]" title="Edit">
                            <FiEdit2 size={16} />
                          </button>
                          <button type="button" className="text-[#f0a115]" title="Role">
                            <FiUserX size={16} />
                          </button>
                          <button type="button" className="text-[#e10000]" title="Delete">
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#e2ecff] px-4 py-3">
          <p className="text-xs text-[#6f84b4]">
            Page {usersData?.page || page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-md border border-[#d6e3fb] px-3 py-1.5 text-xs font-semibold text-[#1f3f93] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-[#d6e3fb] px-3 py-1.5 text-xs font-semibold text-[#1f3f93] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[460px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleCreateUser}>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    checked={formRole === 'student'}
                    onChange={() => setFormRole('student')}
                  />
                  <span className="text-lg font-semibold text-[#1f3f93]">Student</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    checked={formRole === 'teacher'}
                    onChange={() => setFormRole('teacher')}
                  />
                  <span className="text-lg font-semibold text-[#1f3f93]">Teacher</span>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Full Name</label>
                <input
                  type="text"
                  value={formValues.fullName}
                  onChange={(event) => handleFormChange('fullName', event.target.value)}
                  placeholder="Enter your full name"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Phone Number</label>
                <input
                  type="text"
                  value={formValues.phone}
                  onChange={(event) => handleFormChange('phone', event.target.value)}
                  placeholder="Enter your phone number"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              {formRole === 'student' && (
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade</label>
                  <select
                    value={formValues.grade}
                    onChange={(event) => handleFormChange('grade', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select a grade</option>
                    {gradeOptions.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formRole === 'teacher' && (
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <input
                    type="text"
                    list="subject-options"
                    value={formValues.subject}
                    onChange={(event) => handleFormChange('subject', event.target.value)}
                    placeholder="e.g., Mathematics"
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                  <datalist id="subject-options">
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject} />
                    ))}
                  </datalist>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">PIN</label>
                <input
                  type="password"
                  value={formValues.pin}
                  onChange={(event) => handleFormChange('pin', event.target.value)}
                  placeholder="Enter a PIN"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Confirm PIN</label>
                <input
                  type="password"
                  value={formValues.confirmPin}
                  onChange={(event) => handleFormChange('confirmPin', event.target.value)}
                  placeholder="Re-enter the PIN"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeAddUser}
                  className="h-12 flex-1 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  <FiUserPlus size={18} />
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default UserManagementPage;
