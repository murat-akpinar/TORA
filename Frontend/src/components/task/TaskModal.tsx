import React, { useState, useEffect, useMemo } from 'react';
import { LuChevronDown, LuChevronRight, LuList } from 'react-icons/lu';
import { Task, CreateTaskRequest, CreateSubtaskRequest, TaskStatus, Priority, UpdateTaskStatusRequest, TaskChain } from '../../types/Task';
import TagInput, { TagOption } from '../common/TagInput';
import { Team } from '../../types/Team';
import { User } from '../../types/User';
import { taskService } from '../../services/taskService';
import { teamService } from '../../services/teamService';
import { userService } from '../../services/userService';
import { projectService } from '../../services/projectService';
import { Project } from '../../types/Project';
import { getStatusLabel } from '../../utils/statusColors';
import ConfirmDialog from '../common/ConfirmDialog';
import { useToast } from '../common/Toast';
import { extractErrorMessage } from '../../utils/errorMessages';
import { validateDateOrder } from '../../utils/formValidation';
import MultiSelectAssignees from '../common/MultiSelectAssignees';
import TaskComments from './TaskComments';
import { useAuth } from '../../hooks/useAuth';
import './TaskModal.css';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (savedTask: Task) => void;
  onDelete?: (taskId: number) => Promise<void>;
  task?: Task | null;
  defaultTeamId?: number;
  defaultProjectId?: number;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  task,
  defaultTeamId,
  defaultProjectId,
  defaultStartDate,
  defaultEndDate,
}) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; teamId?: string; endDate?: string }>({});
  const [subtasksSectionOpen, setSubtasksSectionOpen] = useState(false);
  const [chainsSectionOpen, setChainsSectionOpen] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<TagOption[]>([]);
  const toast = useToast();

  const isAdmin = Boolean(user?.roles?.includes('ADMIN'));
  const isBirimAmiri = Boolean(user?.roles?.includes('BIRIM_AMIRI'));
  const canDelete = !task || isAdmin || isBirimAmiri || task.createdById === user?.id;
  const canEdit = !task || isAdmin || isBirimAmiri ||
    task.createdById === user?.id ||
    (task.assigneeIds?.includes(user?.id ?? -1)) ||
    (task.projectManagerId != null && task.projectManagerId === user?.id);

  /** Yönetici dışında birim seçtirmeyelim: tek birim veya takvimden gelen birim */
  /** Düzenlemede çok birimli kullanıcıda birim değiştirilebilir; tek birim veya yeni iş+takvim birimi seçiliyse gizle */
  const hideTeamSelect = Boolean(
    user &&
      !isAdmin &&
      (user.teamIds?.length === 1 ||
        (!task && !!defaultTeamId && defaultTeamId > 0))
  );

  const [formData, setFormData] = useState<CreateTaskRequest>({
    title: '',
    content: '',
    startDate: defaultStartDate || new Date().toISOString().split('T')[0],
    endDate: defaultEndDate || new Date().toISOString().split('T')[0],
    status: TaskStatus.OPEN,
    priority: Priority.NORMAL,
    teamId: defaultTeamId || 0,
    projectId: undefined,
    assigneeIds: [],
    subtasks: [],
    chains: [],
  });

  /** Verilen birimin üyeleri (ADMIN hariç) — zincir hedef birimi için */
  const usersForTeam = (teamId?: number) =>
    users.filter(
      (u) => !u.roles?.includes('ADMIN') && (!teamId || (u.teamIds && u.teamIds.includes(teamId)))
    );

  /** Ana "Atanan Kişiler" ile aynı: seçili birimin üyeleri, ADMIN hariç */
  const teamAssignableUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          !u.roles?.includes('ADMIN') &&
          (!formData.teamId || (u.teamIds && u.teamIds.includes(formData.teamId)))
      ),
    [users, formData.teamId]
  );

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (task) {
        setFormData({
          title: task.title,
          content: task.content || '',
          startDate: task.startDate,
          endDate: task.endDate,
          status: task.status,
          priority: task.priority || Priority.NORMAL,
          teamId: task.teamId,
          projectId: task.projectId,
          assigneeIds: task.assigneeIds || [],
          subtasks: task.subtasks?.map(s => ({
            title: s.title,
            content: s.content || '',
            startDate: s.startDate || '',
            endDate: s.endDate || '',
            assigneeId: s.assigneeId,
          })) || [],
          chains: task.chains?.map(c => ({
            id: c.id,
            title: c.title,
            content: c.content || '',
            targetTeamId: c.targetTeamId,
            targetProjectId: c.targetProjectId,
            priority: c.priority,
            durationDays: c.durationDays,
            assigneeIds: c.assigneeIds || [],
          })) || [],
        });
        setSelectedLabels(
          (task.labels || []).map((l) => ({ id: l.id, name: l.name, color: l.color }))
        );
        setSubtasksSectionOpen((task.subtasks?.length ?? 0) > 0);
        setChainsSectionOpen((task.chains?.length ?? 0) > 0);
      } else {
        let newTeamId = 0;
        if (defaultTeamId && defaultTeamId > 0) {
          newTeamId = defaultTeamId;
        } else if (!isAdmin && user?.teamIds?.length) {
          newTeamId = user.teamIds[0];
        }
        setFormData({
          title: '',
          content: '',
          startDate: defaultStartDate || new Date().toISOString().split('T')[0],
          endDate: defaultEndDate || new Date().toISOString().split('T')[0],
          status: TaskStatus.OPEN,
          priority: Priority.NORMAL,
          teamId: newTeamId,
          projectId: defaultProjectId,
          assigneeIds: [],
          subtasks: [],
          chains: [],
        });
        setSelectedLabels([]);
        setSubtasksSectionOpen(false);
        setChainsSectionOpen(false);
      }
    }
  }, [isOpen, task, defaultTeamId, defaultProjectId, defaultStartDate, defaultEndDate, user, isAdmin]);

  const loadData = async () => {
    try {
      const [teamsData, usersData, projectsData] = await Promise.all([
        teamService.getAllTeams(),
        userService.getAllUsers(),
        projectService.getAllProjects(),
      ]);
      setTeams(teamsData);
      setUsers(usersData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const buildRequest = (): CreateTaskRequest => ({
    ...formData,
    labelIds: selectedLabels.filter((t) => t.id).map((t) => t.id as number),
    newLabelNames: selectedLabels.filter((t) => !t.id).map((t) => t.name),
    chains: (formData.chains || []).filter((c) => c.title && c.title.trim()),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: { title?: string; teamId?: string; endDate?: string } = {};
    if (!formData.title || !formData.title.trim()) {
      nextErrors.title = 'Başlık zorunludur';
    }
    if (!formData.teamId) {
      nextErrors.teamId = 'Birim seçimi zorunludur';
    }
    const dateError = validateDateOrder(formData.startDate, formData.endDate);
    if (dateError) {
      nextErrors.endDate = dateError;
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.warning('Lütfen işaretli alanları kontrol edin.');
      return;
    }

    try {
      setLoading(true);
      let savedTask: Task;
      if (task) {
        const assigneeIdsEqual = JSON.stringify((task.assigneeIds || []).sort()) === JSON.stringify((formData.assigneeIds || []).sort());

        const subtasksEqual = (task.subtasks || []).length === (formData.subtasks || []).length &&
          (task.subtasks || []).every((st, idx) => {
            const newSt = (formData.subtasks || [])[idx];
            return st.title === newSt?.title && st.content === newSt?.content;
          });

        const chainsEqual = (task.chains || []).length === (formData.chains || []).length &&
          (task.chains || []).every((c, idx) => {
            const nc = (formData.chains || [])[idx];
            return c.title === nc?.title && c.targetTeamId === nc?.targetTeamId
              && c.durationDays === nc?.durationDays;
          });

        const existingLabelIds = (task.labels || []).map((l) => l.id).sort((a, b) => a - b);
        const selectedLabelIds = selectedLabels.filter((t) => t.id).map((t) => t.id as number).sort((a, b) => a - b);
        const labelsEqual =
          JSON.stringify(existingLabelIds) === JSON.stringify(selectedLabelIds) &&
          selectedLabels.filter((t) => !t.id).length === 0;

        const onlyStatusChanged = task.status !== formData.status &&
          task.title === formData.title &&
          (task.content || '') === (formData.content || '') &&
          task.startDate === formData.startDate &&
          task.endDate === formData.endDate &&
          (task.priority || Priority.NORMAL) === (formData.priority || Priority.NORMAL) &&
          task.teamId === formData.teamId &&
          task.projectId === formData.projectId &&
          assigneeIdsEqual &&
          subtasksEqual &&
          chainsEqual &&
          labelsEqual;

        if (onlyStatusChanged) {
          const statusUpdate: UpdateTaskStatusRequest = {
            status: formData.status!,
            changeReason: 'Status updated from task modal'
          };
          savedTask = await taskService.updateTaskStatus(task.id, statusUpdate);
        } else {
          savedTask = await taskService.updateTask(task.id, buildRequest());
        }
        toast.success('İş güncellendi.');
        onSave(savedTask);
        // Modal stays open so user can keep editing
      } else {
        savedTask = await taskService.createTask(buildRequest());
        toast.success('İş oluşturuldu.');
        onSave(savedTask);
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to save task:', error);
      toast.error(extractErrorMessage(error, 'İş kaydedilemedi.'));
    } finally {
      setLoading(false);
    }
  };

  const addSubtask = () => {
    setSubtasksSectionOpen(true);
    setFormData({
      ...formData,
      subtasks: [...(formData.subtasks || []), {
        title: '',
        content: '',
        startDate: formData.startDate,
        endDate: formData.endDate,
      }],
    });
  };

  const removeSubtask = (index: number) => {
    const newSubtasks = [...(formData.subtasks || [])];
    newSubtasks.splice(index, 1);
    setFormData({ ...formData, subtasks: newSubtasks });
  };

  const updateSubtask = (index: number, field: keyof CreateSubtaskRequest, value: string | number | undefined) => {
    const newSubtasks = [...(formData.subtasks || [])];
    newSubtasks[index] = { ...newSubtasks[index], [field]: value };
    setFormData({ ...formData, subtasks: newSubtasks });
  };

  const addChain = () => {
    setChainsSectionOpen(true);
    setFormData({
      ...formData,
      chains: [...(formData.chains || []), {
        title: '',
        targetTeamId: formData.teamId || (teams[0]?.id ?? 0),
        durationDays: 1,
        priority: Priority.NORMAL,
        assigneeIds: [],
      }],
    });
  };

  const removeChain = (index: number) => {
    const newChains = [...(formData.chains || [])];
    newChains.splice(index, 1);
    setFormData({ ...formData, chains: newChains });
  };

  const updateChain = (index: number, patch: Partial<TaskChain>) => {
    const newChains = [...(formData.chains || [])];
    newChains[index] = { ...newChains[index], ...patch };
    setFormData({ ...formData, chains: newChains });
  };

  if (!isOpen) return null;

  return (
    <div className="task-modal modal-overlay" onClick={onClose}>
      <div className="task-modal-content modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {task ? 'İş Düzenle' : 'Yeni İş Oluştur'}
            {task?.code && (
              <span style={{
                marginLeft: '10px', fontSize: '13px', fontFamily: 'monospace',
                padding: '2px 8px', borderRadius: '6px',
                background: 'var(--ctp-surface0, #313244)', color: 'var(--ctp-subtext0, #a6adc8)',
                verticalAlign: 'middle',
              }}>{task.code}</span>
            )}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          {task && !canEdit && (
            <div className="task-modal-readonly-notice">
              Bu işi düzenleme yetkiniz yok. Yalnızca oluşturduğunuz veya size atanan işleri güncelleyebilirsiniz.
            </div>
          )}
          {task?.spawnedFromTaskId && (
            <div className="task-modal-readonly-notice">
              🔗 Bu iş, #{task.spawnedFromTaskId}{task.spawnedFromTitle ? ` «${task.spawnedFromTitle}»` : ''} tamamlanınca otomatik oluştu.
            </div>
          )}
          <div className="form-group">
            <label htmlFor="task-title">Başlık *</label>
            <input
              id="task-title"
              type="text"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                if (fieldErrors.title) {
                  setFieldErrors({ ...fieldErrors, title: undefined });
                }
              }}
              required
              disabled={!canEdit}
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? 'task-title-error' : undefined}
              className={fieldErrors.title ? 'is-invalid' : ''}
            />
            {fieldErrors.title && (
              <span id="task-title-error" className="field-error" role="alert">
                {fieldErrors.title}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>İçerik</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              disabled={!canEdit}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Başlangıç Tarihi *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
                disabled={!canEdit}
              />
            </div>

            <div className="form-group">
              <label htmlFor="task-end-date">Bitiş Tarihi *</label>
              <input
                id="task-end-date"
                type="date"
                value={formData.endDate}
                onChange={(e) => {
                  setFormData({ ...formData, endDate: e.target.value });
                  if (fieldErrors.endDate) {
                    setFieldErrors({ ...fieldErrors, endDate: undefined });
                  }
                }}
                required
                disabled={!canEdit}
                aria-invalid={!!fieldErrors.endDate}
                aria-describedby={fieldErrors.endDate ? 'task-end-date-error' : undefined}
                className={fieldErrors.endDate ? 'is-invalid' : ''}
              />
              {fieldErrors.endDate && (
                <span id="task-end-date-error" className="field-error" role="alert">
                  {fieldErrors.endDate}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              {hideTeamSelect && formData.teamId > 0 ? (
                <>
                  <label>Birim</label>
                  <div className="task-modal-team-readonly" id="task-team-readonly">
                    {teams.find((t) => t.id === formData.teamId)?.name ||
                      task?.teamName ||
                      `Birim #${formData.teamId}`}
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor="task-team">Birim *</label>
                  <select
                    id="task-team"
                    value={formData.teamId}
                    onChange={(e) => {
                      const newTeamId = parseInt(e.target.value);
                      setFormData({ ...formData, teamId: newTeamId, projectId: undefined });
                      if (fieldErrors.teamId && newTeamId) {
                        setFieldErrors({ ...fieldErrors, teamId: undefined });
                      }
                    }}
                    required
                    disabled={!canEdit}
                    aria-invalid={!!fieldErrors.teamId}
                    aria-describedby={fieldErrors.teamId ? 'task-team-error' : undefined}
                    className={fieldErrors.teamId ? 'is-invalid' : ''}
                  >
                    <option value={0}>Birim Seçin</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.teamId && (
                    <span id="task-team-error" className="field-error" role="alert">
                      {fieldErrors.teamId}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="form-group">
              <label>Proje</label>
              <select
                value={formData.projectId || ''}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value ? parseInt(e.target.value) : undefined })}
                disabled={!canEdit}
              >
                <option value="">Proje Seçin (Opsiyonel)</option>
                {projects
                  .filter(project =>
                    (formData.teamId && project.teamIds.includes(formData.teamId)) ||
                    (formData.projectId && project.id === formData.projectId)
                  )
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Durum</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                disabled={!canEdit}
              >
                {Object.values(TaskStatus).map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Etiketler</label>
              <TagInput
                teamId={formData.teamId}
                selected={selectedLabels}
                onChange={setSelectedLabels}
                disabled={!formData.teamId || !canEdit}
                placeholder={formData.teamId ? 'Etiket ara veya oluştur...' : 'Önce birim seçin'}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Önem</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                disabled={!canEdit}
              >
                <option value={Priority.NORMAL}>Normal</option>
                <option value={Priority.HIGH}>Yüksek</option>
                <option value={Priority.URGENT}>Acil</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '8px' }}>
            <label htmlFor="task-assignees-trigger">Atanan Kişiler</label>
            <MultiSelectAssignees
              users={users.filter(
                (u) =>
                  !u.roles?.includes('ADMIN') &&
                  (!formData.teamId || (u.teamIds && u.teamIds.includes(formData.teamId)))
              )}
              selectedIds={formData.assigneeIds || []}
              onChange={(ids) => setFormData({ ...formData, assigneeIds: ids })}
              placeholder={
                formData.teamId ? 'Atanan kişi seçin' : 'Önce bir birim seçin'
              }
              ariaLabel="Atanan kişiler"
              disabled={!formData.teamId || !canEdit}
            />
          </div>

          {task && (
            <TaskComments taskId={task.id} />
          )}

          <div className={`task-modal-subtasks-panel ${subtasksSectionOpen ? 'is-open' : ''}`}>
            <div className="task-modal-subtasks-toolbar">
              <button
                type="button"
                className="task-modal-subtasks-toggle"
                onClick={() => setSubtasksSectionOpen((o) => !o)}
                aria-expanded={subtasksSectionOpen}
                aria-controls="task-modal-subtasks-body"
                id="task-modal-subtasks-heading"
              >
                <span className="task-modal-subtasks-chevron" aria-hidden>
                  {subtasksSectionOpen ? <LuChevronDown size={18} /> : <LuChevronRight size={18} />}
                </span>
                <LuList size={18} className="task-modal-subtasks-list-icon" aria-hidden />
                <span className="task-modal-subtasks-title">Alt işler</span>
                {(formData.subtasks?.length ?? 0) > 0 && (
                  <span className="task-modal-subtasks-count">{formData.subtasks?.length}</span>
                )}
              </button>
              <button type="button" onClick={addSubtask} className="btn-add-subtask" disabled={!canEdit}>
                Alt İş Ekle
              </button>
            </div>
            <div
              id="task-modal-subtasks-body"
              className="task-modal-subtasks-body"
              role="region"
              aria-labelledby="task-modal-subtasks-heading"
              aria-hidden={!subtasksSectionOpen}
            >
              <div className="subtasks-container task-modal-subtasks-inner">
                {(formData.subtasks?.length ?? 0) === 0 ? (
                  <p className="task-modal-subtasks-empty">Henüz alt iş yok. Eklemek için yukarıdaki düğmeyi kullanın.</p>
                ) : (
                  formData.subtasks?.map((subtask, index) => (
                    <div key={index} className="subtask-item">
                      <input
                        type="text"
                        placeholder="Alt iş başlığı"
                        value={subtask.title}
                        onChange={(e) => updateSubtask(index, 'title', e.target.value)}
                        disabled={!canEdit}
                      />
                      <textarea
                        placeholder="Alt iş içeriği (opsiyonel)"
                        value={subtask.content || ''}
                        onChange={(e) => updateSubtask(index, 'content', e.target.value)}
                        rows={2}
                        disabled={!canEdit}
                      />
                      <div className="form-row" style={{ marginTop: '8px' }}>
                        <div className="form-group" style={{ marginBottom: '0' }}>
                          <label style={{ fontSize: '12px', marginBottom: '3px' }}>Başlangıç Tarihi</label>
                          <input
                            type="date"
                            value={subtask.startDate || ''}
                            onChange={(e) => updateSubtask(index, 'startDate', e.target.value)}
                            disabled={!canEdit}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: '0' }}>
                          <label style={{ fontSize: '12px', marginBottom: '3px' }}>Bitiş Tarihi</label>
                          <input
                            type="date"
                            value={subtask.endDate || ''}
                            onChange={(e) => updateSubtask(index, 'endDate', e.target.value)}
                            disabled={!canEdit}
                          />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginTop: '8px', marginBottom: '0' }}>
                        <label style={{ fontSize: '12px', marginBottom: '3px' }}>Atanan Kişi</label>
                        <select
                          value={subtask.assigneeId || ''}
                          onChange={(e) => updateSubtask(index, 'assigneeId', e.target.value ? parseInt(e.target.value) : undefined)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '14px' }}
                          disabled={!formData.teamId || !canEdit}
                        >
                          <option value="">
                            {!formData.teamId ? 'Önce birim seçin' : 'Atanan kişi seçin'}
                          </option>
                          {teamAssignableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSubtask(index)}
                        className="btn-remove-subtask"
                        disabled={!canEdit}
                      >
                        Sil
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className={`task-modal-subtasks-panel ${chainsSectionOpen ? 'is-open' : ''}`}>
            <div className="task-modal-subtasks-toolbar">
              <button
                type="button"
                className="task-modal-subtasks-toggle"
                onClick={() => setChainsSectionOpen((o) => !o)}
                aria-expanded={chainsSectionOpen}
                aria-controls="task-modal-chains-body"
                id="task-modal-chains-heading"
              >
                <span className="task-modal-subtasks-chevron" aria-hidden>
                  {chainsSectionOpen ? <LuChevronDown size={18} /> : <LuChevronRight size={18} />}
                </span>
                <LuList size={18} className="task-modal-subtasks-list-icon" aria-hidden />
                <span className="task-modal-subtasks-title">Tamamlanınca açılacak işler</span>
                {(formData.chains?.length ?? 0) > 0 && (
                  <span className="task-modal-subtasks-count">{formData.chains?.length}</span>
                )}
              </button>
              <button type="button" onClick={addChain} className="btn-add-subtask" disabled={!canEdit}>
                İş Ekle
              </button>
            </div>
            <div
              id="task-modal-chains-body"
              className="task-modal-subtasks-body"
              role="region"
              aria-labelledby="task-modal-chains-heading"
              aria-hidden={!chainsSectionOpen}
            >
              <div className="subtasks-container task-modal-subtasks-inner">
                {(formData.chains?.length ?? 0) === 0 ? (
                  <p className="task-modal-subtasks-empty">
                    Bu iş "Tamamlandı" olunca otomatik açılacak takip işleri. Farklı birime de düşebilir.
                  </p>
                ) : (
                  formData.chains?.map((chain, index) => (
                    <div key={index} className="subtask-item">
                      <input
                        type="text"
                        placeholder="Takip işi başlığı"
                        value={chain.title}
                        onChange={(e) => updateChain(index, { title: e.target.value })}
                        disabled={!canEdit}
                      />
                      <div className="form-row" style={{ marginTop: '8px' }}>
                        <div className="form-group" style={{ marginBottom: '0' }}>
                          <label style={{ fontSize: '12px', marginBottom: '3px' }}>Hedef Birim</label>
                          <select
                            value={chain.targetTeamId || ''}
                            onChange={(e) => updateChain(index, { targetTeamId: parseInt(e.target.value), assigneeIds: [] })}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '14px' }}
                            disabled={!canEdit}
                          >
                            <option value="">Birim seçin</option>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: '0' }}>
                          <label style={{ fontSize: '12px', marginBottom: '3px' }}>Süre (gün)</label>
                          <input
                            type="number"
                            min={0}
                            value={chain.durationDays ?? 0}
                            onChange={(e) => updateChain(index, { durationDays: e.target.value ? parseInt(e.target.value) : 0 })}
                            disabled={!canEdit}
                          />
                        </div>
                      </div>
                      <div className="form-row" style={{ marginTop: '8px' }}>
                        <div className="form-group" style={{ marginBottom: '0' }}>
                          <label style={{ fontSize: '12px', marginBottom: '3px' }}>Öncelik</label>
                          <select
                            value={chain.priority || Priority.NORMAL}
                            onChange={(e) => updateChain(index, { priority: e.target.value as Priority })}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '14px' }}
                            disabled={!canEdit}
                          >
                            <option value={Priority.NORMAL}>Normal</option>
                            <option value={Priority.HIGH}>Yüksek</option>
                            <option value={Priority.URGENT}>Acil</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: '0' }}>
                          <label style={{ fontSize: '12px', marginBottom: '3px' }}>Atananlar (hedef birim)</label>
                          <select
                            multiple
                            value={(chain.assigneeIds || []).map(String)}
                            onChange={(e) => updateChain(index, { assigneeIds: Array.from(e.target.selectedOptions).map((o) => parseInt(o.value)) })}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '14px', minHeight: '56px' }}
                            disabled={!canEdit || !chain.targetTeamId}
                          >
                            {usersForTeam(chain.targetTeamId).map((u) => (
                              <option key={u.id} value={u.id}>{u.fullName}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <textarea
                        placeholder="Açıklama (opsiyonel)"
                        value={chain.content || ''}
                        onChange={(e) => updateChain(index, { content: e.target.value })}
                        rows={2}
                        style={{ marginTop: '8px' }}
                        disabled={!canEdit}
                      />
                      <button
                        type="button"
                        onClick={() => removeChain(index)}
                        className="btn-remove-subtask"
                        disabled={!canEdit}
                      >
                        Sil
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            {task && onDelete && canDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-delete"
                style={{
                  backgroundColor: 'var(--ctp-red, #f38ba8)',
                  color: 'var(--ctp-base, #1e1e2e)',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  marginRight: 'auto',
                }}
              >
                Sil
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-cancel">
              İptal
            </button>
            {canEdit && (
              <button type="submit" className="btn-save" disabled={loading}>
                {loading ? 'Kaydediliyor...' : task ? 'Güncelle' : 'Oluştur'}
              </button>
            )}
          </div>
        </form>
      </div>

      {task && onDelete && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="İş Sil"
          message={`"${task.title}" işi kalıcı olarak silinecek. Bu işlemi geri alamazsınız.`}
          confirmText="Sil"
          cancelText="Vazgeç"
          variant="danger"
          onConfirm={async () => {
            setShowDeleteConfirm(false);
            try {
              await onDelete(task.id);
            } catch (error) {
              console.error('Failed to delete task:', error);
            }
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

export default TaskModal;

