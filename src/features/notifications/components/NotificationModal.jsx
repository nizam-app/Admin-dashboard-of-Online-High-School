import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Megaphone, Users, UserSquare2, BookOpen, GraduationCap, Globe, X } from 'lucide-react';
import { getClasses, getGradesSections } from '../../classes/api/classesApi';

const typeOptions = [
  { id: 'push', label: 'Push Notification', helper: 'Instant mobile alerts', icon: Bell, tag: 'Push' },
  { id: 'announcement', label: 'In-App Announcement', helper: 'Dashboard banner', icon: Megaphone, tag: 'Announcements' },
];

const audienceOptions = [
  { id: 'students', label: 'All Students', helper: '2,847 recipients', icon: Users },
  { id: 'teachers', label: 'All Teachers', helper: '143 recipients', icon: UserSquare2 },
  { id: 'class', label: 'Specific Class', helper: '~30 recipients', icon: BookOpen },
  { id: 'grade', label: 'Specific Grade', helper: '~200 recipients', icon: GraduationCap },
  { id: 'everyone', label: 'Everyone', helper: '3,200 recipients', icon: Globe },
];

const parseRecipients = (helper) => {
  const digits = helper.replace(/[^0-9]/g, '');
  return digits ? Number(digits).toLocaleString() : '0';
};

const NotificationModal = ({ isOpen, onClose, onCreate }) => {
  const [selectedType, setSelectedType] = useState(typeOptions[0]);
  const [selectedAudience, setSelectedAudience] = useState(audienceOptions[0]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('Normal');

  const { data: classesResponse, isLoading: isClassesLoading } = useQuery({
    queryKey: ['notification-classes'],
    queryFn: () => getClasses({ page: 1, limit: 200, status: 'active' }),
  });

  const { data: gradesResponse = [], isLoading: isGradesLoading } = useQuery({
    queryKey: ['notification-grades'],
    queryFn: getGradesSections,
  });

  const classOptions = useMemo(() => {
    const items = Array.isArray(classesResponse?.items) ? classesResponse.items : [];
    return items.map((item) => ({
      id: item.id,
      label: item.className || 'Untitled Class',
      students: item.students || 0,
    }));
  }, [classesResponse?.items]);

  const gradeOptions = useMemo(() => {
    const items = Array.isArray(gradesResponse) ? gradesResponse : [];
    return items.map((item) => ({
      id: item.id,
      label: item.label,
      classCount: item.classCount || 0,
    }));
  }, [gradesResponse]);

  const selectedClass = classOptions.find((item) => item.id === selectedClassId) || null;
  const selectedGrade = gradeOptions.find((item) => item.id === selectedGradeId) || null;

  const recipients = useMemo(() => {
    if (selectedAudience.id === 'class' && selectedClass?.students) {
      return Number(selectedClass.students).toLocaleString();
    }
    return parseRecipients(selectedAudience.helper);
  }, [selectedAudience, selectedClass]);

  const handleSubmit = (action) => {
    if (!onCreate) return;
    const Icon = selectedType.icon;

    const targetLabel =
      selectedAudience.id === 'class' && selectedClass
        ? `Class: ${selectedClass.label}`
        : selectedAudience.id === 'grade' && selectedGrade
          ? `Grade: ${selectedGrade.label}`
          : selectedAudience.label;

    onCreate({
      action,
      title: title.trim(),
      message: message.trim(),
      typeTag: selectedType.tag,
      targetLabel,
      recipients,
      priorityTag: priority === 'High Priority' ? 'High Priority' : null,
      icon: <Icon size={20} />,
    });
    setTitle('');
    setMessage('');
    setPriority('Normal');
    setSelectedType(typeOptions[0]);
    setSelectedAudience(audienceOptions[0]);
    setSelectedClassId('');
    setSelectedGradeId('');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b2f5b]/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-[18px] bg-white p-6 shadow-[0_30px_60px_rgba(18,45,99,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-[22px] font-semibold text-[#1f3f93]">Create New Notification</h3>
            <p className="m-0 mt-1 text-sm text-[#6f84b4]">Craft a message for your school community.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d6e3fb] p-2 text-[#6f84b4]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5">
          <p className="m-0 text-sm font-semibold text-[#1f3f93]">Notification Type</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {typeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = selectedType.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedType(option)}
                  className={`flex w-full items-start gap-3 rounded-[12px] border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-[#1f3f93] bg-[#1f3f93] text-white'
                      : 'border-[#d6e3fb] bg-white text-[#1f3f93]'
                  }`}
                >
                  <span
                    className={`mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full ${
                      isActive ? 'bg-white/15 text-white' : 'bg-[#e9f0ff] text-[#1f3f93]'
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className={`block text-xs ${isActive ? 'text-white/80' : 'text-[#6f84b4]'}`}>
                      {option.helper}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold text-[#1f3f93]">Title</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g., Important Announcement"
            className="mt-2 w-full rounded-[12px] border border-[#d6e3fb] px-4 py-2.5 text-sm text-[#1f3f93] placeholder:text-[#9aaad1] focus:border-[#1f3f93] focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold text-[#1f3f93]">Message</label>
          <textarea
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your message here..."
            className="mt-2 w-full rounded-[12px] border border-[#d6e3fb] px-4 py-2.5 text-sm text-[#1f3f93] placeholder:text-[#9aaad1] focus:border-[#1f3f93] focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <p className="m-0 text-sm font-semibold text-[#1f3f93]">Target Audience</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {audienceOptions.map((option) => {
              const Icon = option.icon;
              const isActive = selectedAudience.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedAudience(option);
                    if (option.id !== 'class') setSelectedClassId('');
                    if (option.id !== 'grade') setSelectedGradeId('');
                  }}
                  className={`flex items-start gap-3 rounded-[12px] border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-[#1f3f93] bg-[#1f3f93] text-white'
                      : 'border-[#d6e3fb] bg-white text-[#1f3f93]'
                  }`}
                >
                  <span
                    className={`mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full ${
                      isActive ? 'bg-white/15 text-white' : 'bg-[#e9f0ff] text-[#1f3f93]'
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className={`block text-xs ${isActive ? 'text-white/80' : 'text-[#6f84b4]'}`}>
                      {option.helper}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedAudience.id === 'class' && (
            <div className="mt-3">
              <label className="text-sm font-semibold text-[#1f3f93]">Select Class</label>
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                className="mt-2 w-full rounded-[12px] border border-[#d6e3fb] px-4 py-2.5 text-sm text-[#1f3f93]"
              >
                <option value="">{isClassesLoading ? 'Loading classes...' : 'Choose a class'}</option>
                {classOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedAudience.id === 'grade' && (
            <div className="mt-3">
              <label className="text-sm font-semibold text-[#1f3f93]">Select Grade</label>
              <select
                value={selectedGradeId}
                onChange={(event) => setSelectedGradeId(event.target.value)}
                className="mt-2 w-full rounded-[12px] border border-[#d6e3fb] px-4 py-2.5 text-sm text-[#1f3f93]"
              >
                <option value="">{isGradesLoading ? 'Loading grades...' : 'Choose a grade'}</option>
                {gradeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold text-[#1f3f93]">Priority</label>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="mt-2 w-full rounded-[12px] border border-[#d6e3fb] px-4 py-2.5 text-sm text-[#1f3f93] focus:border-[#1f3f93] focus:outline-none"
          >
            <option>Normal</option>
            <option>High Priority</option>
          </select>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => handleSubmit('sent')}
            className="rounded-[12px] bg-[#1f3f93] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Send Now
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('scheduled')}
            className="rounded-[12px] border border-[#d6e3fb] bg-[#f4f7ff] px-4 py-2.5 text-sm font-semibold text-[#1f3f93]"
          >
            Schedule
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('draft')}
            className="rounded-[12px] border border-[#d6e3fb] bg-white px-4 py-2.5 text-sm font-semibold text-[#1f3f93]"
          >
            Save Draft
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-[12px] border border-[#d6e3fb] bg-[#f6f8ff] px-4 py-2.5 text-sm font-semibold text-[#6f84b4]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default NotificationModal;
