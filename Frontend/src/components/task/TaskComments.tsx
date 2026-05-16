import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TaskComment } from '../../types/TaskComment';
import { User } from '../../types/User';
import { taskCommentService } from '../../services/taskCommentService';
import { userService } from '../../services/userService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import LoadingSpinner from '../common/LoadingSpinner';
import ConfirmDialog from '../common/ConfirmDialog';
import { extractErrorMessage } from '../../utils/errorMessages';
import './TaskComments.css';

interface TaskCommentsProps {
  taskId: number | null;
  /** Modal kapanırken parent'ın anında en son sayıyı görebilmesi için opsiyonel callback */
  onCountChange?: (count: number) => void;
}

const MAX_LENGTH = 5000;
const MENTION_TRIGGER_REGEX = /(?:^|\s)@([A-Za-z0-9._\-çÇğĞıİöÖşŞüÜ]{0,30})$/;

const TaskComments: React.FC<TaskCommentsProps> = ({ taskId, onCountChange }) => {
  const { user } = useAuth();
  const toast = useToast();

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [editingError, setEditingError] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<TaskComment | null>(null);

  const [mentionState, setMentionState] = useState<{ active: boolean; query: string; field: 'create' | 'edit' }>({
    active: false,
    query: '',
    field: 'create',
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editingRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!taskId) {
      setComments([]);
      return;
    }
    loadComments(taskId);
    if (users.length === 0) {
      userService
        .getAllUsers()
        .then(setUsers)
        .catch(() => {
          // Mention listesi yoksa autocomplete'i devre dışı bırakırız.
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);

  const loadComments = async (id: number) => {
    setLoading(true);
    try {
      const data = await taskCommentService.list(id);
      setComments(data);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Yorumlar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  // --- @mention helpers ------------------------------------------------------

  const matchesMention = (input: string): { match: RegExpMatchArray | null; query: string } => {
    const match = input.match(MENTION_TRIGGER_REGEX);
    return { match, query: match?.[1] ?? '' };
  };

  const updateMentionState = (value: string, field: 'create' | 'edit') => {
    const { match, query } = matchesMention(value);
    if (match) {
      setMentionState({ active: true, query, field });
    } else if (mentionState.active) {
      setMentionState({ active: false, query: '', field });
    }
  };

  const filteredMentionUsers = useMemo(() => {
    if (!mentionState.active) return [] as User[];
    const q = mentionState.query.toLowerCase();
    return users
      .filter((u) =>
        q === ''
          ? true
          : u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [users, mentionState]);

  const insertMention = (mentionUser: User) => {
    const isCreate = mentionState.field === 'create';
    const value = isCreate ? draft : editingDraft;
    const newValue = value.replace(MENTION_TRIGGER_REGEX, (full) => {
      const leading = full.startsWith('@') ? '' : full.charAt(0);
      return `${leading}@${mentionUser.username} `;
    });
    if (isCreate) {
      setDraft(newValue);
      setDraftError(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } else {
      setEditingDraft(newValue);
      setEditingError(null);
      requestAnimationFrame(() => editingRef.current?.focus());
    }
    setMentionState({ active: false, query: '', field: mentionState.field });
  };

  // --- Submit --------------------------------------------------------------

  const validate = (value: string): string | null => {
    if (!value || value.trim() === '') return 'Yorum boş olamaz.';
    if (value.length > MAX_LENGTH) return `Yorum ${MAX_LENGTH} karakteri geçemez.`;
    return null;
  };

  const submitDraft = async () => {
    if (!taskId) return;
    const error = validate(draft);
    if (error) {
      setDraftError(error);
      return;
    }
    setSubmitting(true);
    try {
      const created = await taskCommentService.create(taskId, { content: draft.trim() });
      setComments((prev) => [...prev, created]);
      setDraft('');
      setDraftError(null);
      toast.success('Yorum eklendi.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Yorum eklenemedi.'));
    } finally {
      setSubmitting(false);
    }
  };

  const beginEdit = (comment: TaskComment) => {
    setEditingId(comment.id);
    setEditingDraft(comment.content);
    setEditingError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDraft('');
    setEditingError(null);
  };

  const saveEdit = async (commentId: number) => {
    const error = validate(editingDraft);
    if (error) {
      setEditingError(error);
      return;
    }
    try {
      const updated = await taskCommentService.update(commentId, { content: editingDraft.trim() });
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      cancelEdit();
      toast.success('Yorum güncellendi.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Yorum güncellenemedi.'));
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await taskCommentService.delete(deleteCandidate.id);
      setComments((prev) => prev.filter((c) => c.id !== deleteCandidate.id));
      toast.success('Yorum silindi.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Yorum silinemedi.'));
    } finally {
      setDeleteCandidate(null);
    }
  };

  // --- Render --------------------------------------------------------------

  if (!taskId) {
    return (
      <div className="task-comments task-comments--empty-state">
        <p className="task-comments__hint">İşi kaydettikten sonra yorum ekleyebilirsiniz.</p>
      </div>
    );
  }

  return (
    <section className="task-comments" aria-label="İş yorumları">
      <header className="task-comments__header">
        <h3>Yorumlar {comments.length > 0 && <span className="task-comments__count">{comments.length}</span>}</h3>
      </header>

      {loading ? (
        <LoadingSpinner size="sm" showLabel label="Yorumlar yükleniyor..." />
      ) : comments.length === 0 ? (
        <p className="task-comments__empty">Henüz yorum yok. İlk yorumu siz ekleyin.</p>
      ) : (
        <ul className="task-comments__list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isOwn={user?.id === comment.authorId}
              isAdmin={user?.roles?.includes('ADMIN') || false}
              isEditing={editingId === comment.id}
              editingDraft={editingDraft}
              editingError={editingError}
              editingRef={editingRef}
              onBeginEdit={() => beginEdit(comment)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(comment.id)}
              onChangeEdit={(value) => {
                setEditingDraft(value);
                setEditingError(null);
                updateMentionState(value, 'edit');
              }}
              onRequestDelete={() => setDeleteCandidate(comment)}
              renderContent={() => renderContentWithMentions(comment.content)}
              mentionDropdown={
                editingId === comment.id && mentionState.active && mentionState.field === 'edit'
                  ? renderMentionDropdown(filteredMentionUsers, insertMention)
                  : null
              }
            />
          ))}
        </ul>
      )}

      {/*
        Not: Burada <form> KULLANILMAZ — bu bileşen TaskModal'ın <form>'unun
        içine yerleştirildiği için nested form HTML tarafından parent'a
        katlanır ve "Yorum Ekle" butonu task güncelleme submit'ini tetikler.
        Submit'i butonun onClick'i + textarea Ctrl+Enter ile yönetiyoruz.
      */}
      <div className="task-comments__form">
        <label htmlFor="task-comment-draft" className="task-comments__label">
          Yorum ekle
        </label>
        <div className="task-comments__editor">
          <textarea
            id="task-comment-draft"
            ref={textareaRef}
            className={`task-comments__textarea${draftError ? ' is-invalid' : ''}`}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (draftError) setDraftError(null);
              updateMentionState(e.target.value, 'create');
            }}
            onKeyDown={(e) => {
              // Ctrl+Enter veya Cmd+Enter ile gönder
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (!submitting && draft.trim() !== '') {
                  void submitDraft();
                }
              }
            }}
            onBlur={() => setMentionState((s) => ({ ...s, active: false }))}
            placeholder="Yorumunuzu yazın... (@kullaniciadi ile etiketleyebilirsiniz, Ctrl+Enter ile gönder)"
            rows={3}
            aria-invalid={!!draftError}
            aria-describedby={draftError ? 'task-comment-error' : 'task-comment-help'}
            disabled={submitting}
            maxLength={MAX_LENGTH + 200}
          />
          {mentionState.active && mentionState.field === 'create' &&
            renderMentionDropdown(filteredMentionUsers, insertMention)}
        </div>
        <div className="task-comments__form-footer">
          {draftError ? (
            <span id="task-comment-error" className="task-comments__error" role="alert">
              {draftError}
            </span>
          ) : (
            <span id="task-comment-help" className="task-comments__counter">
              {draft.length}/{MAX_LENGTH}
            </span>
          )}
          <button
            type="button"
            className="btn-comment-submit"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void submitDraft();
            }}
            disabled={submitting || draft.trim() === ''}
          >
            {submitting ? 'Gönderiliyor...' : 'Yorum Ekle'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteCandidate}
        title="Yorumu Sil"
        message="Bu yorumu silmek istediğinize emin misiniz?"
        confirmText="Sil"
        cancelText="Vazgeç"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteCandidate(null)}
      />
    </section>
  );
};

// --- Helpers --------------------------------------------------------------

const renderMentionDropdown = (results: User[], onPick: (u: User) => void) => {
  if (results.length === 0) {
    return (
      <div className="task-comments__mention-dropdown" role="listbox" aria-label="Bahsedilebilecek kullanıcı yok">
        <div className="task-comments__mention-empty">Kullanıcı bulunamadı</div>
      </div>
    );
  }
  return (
    <ul className="task-comments__mention-dropdown" role="listbox">
      {results.map((u) => (
        <li
          key={u.id}
          role="option"
          aria-selected={false}
          className="task-comments__mention-item"
          onMouseDown={(e) => {
            // onMouseDown: textarea blur'dan önce çalışsın diye.
            e.preventDefault();
            onPick(u);
          }}
        >
          <span className="task-comments__mention-username">@{u.username}</span>
          <span className="task-comments__mention-fullname">{u.fullName}</span>
        </li>
      ))}
    </ul>
  );
};

const renderContentWithMentions = (content: string): React.ReactNode => {
  const pattern = /@([A-Za-z0-9._\-çÇğĞıİöÖşŞüÜ]{1,100})/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index));
    }
    nodes.push(
      <span key={`m-${key++}`} className="task-comments__mention-token">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }
  return nodes;
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const initials = (fullName: string): string => {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
};

// --- CommentItem ----------------------------------------------------------

interface CommentItemProps {
  comment: TaskComment;
  isOwn: boolean;
  isAdmin: boolean;
  isEditing: boolean;
  editingDraft: string;
  editingError: string | null;
  editingRef: React.RefObject<HTMLTextAreaElement>;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onChangeEdit: (value: string) => void;
  onRequestDelete: () => void;
  renderContent: () => React.ReactNode;
  mentionDropdown: React.ReactNode;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  isOwn,
  isAdmin,
  isEditing,
  editingDraft,
  editingError,
  editingRef,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onChangeEdit,
  onRequestDelete,
  renderContent,
  mentionDropdown,
}) => {
  return (
    <li className="task-comments__item">
      <div className="task-comments__avatar" aria-hidden="true">
        {initials(comment.authorFullName)}
      </div>
      <div className="task-comments__bubble">
        <div className="task-comments__meta">
          <span className="task-comments__author">{comment.authorFullName}</span>
          <span className="task-comments__author-username">@{comment.authorUsername}</span>
          <span className="task-comments__time" title={comment.createdAt}>
            {formatDate(comment.createdAt)}
          </span>
          {comment.isEdited && <span className="task-comments__edited">(düzenlendi)</span>}
        </div>

        {isEditing ? (
          <div className="task-comments__edit-area">
            <textarea
              ref={editingRef}
              className={`task-comments__textarea${editingError ? ' is-invalid' : ''}`}
              value={editingDraft}
              onChange={(e) => onChangeEdit(e.target.value)}
              rows={3}
              aria-invalid={!!editingError}
              aria-describedby={editingError ? `comment-${comment.id}-error` : undefined}
            />
            {mentionDropdown}
            {editingError && (
              <span id={`comment-${comment.id}-error`} className="task-comments__error" role="alert">
                {editingError}
              </span>
            )}
            <div className="task-comments__edit-actions">
              <button type="button" className="btn-comment-cancel" onClick={onCancelEdit}>
                İptal
              </button>
              <button type="button" className="btn-comment-submit" onClick={onSaveEdit}>
                Kaydet
              </button>
            </div>
          </div>
        ) : (
          <div className="task-comments__content">{renderContent()}</div>
        )}

        {!isEditing && (isOwn || isAdmin) && (
          <div className="task-comments__actions">
            {isOwn && (
              <button
                type="button"
                className="task-comments__action-btn"
                onClick={onBeginEdit}
                aria-label="Yorumu düzenle"
              >
                Düzenle
              </button>
            )}
            <button
              type="button"
              className="task-comments__action-btn task-comments__action-btn--danger"
              onClick={onRequestDelete}
              aria-label="Yorumu sil"
            >
              Sil
            </button>
          </div>
        )}
      </div>
    </li>
  );
};

export default TaskComments;
