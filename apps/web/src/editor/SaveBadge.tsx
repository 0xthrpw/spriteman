type Status = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'offline';

const LABELS: Record<Status, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
  conflict: 'Conflict — newer version on server',
  offline: 'Offline',
};

const COLORS: Record<Status, string> = {
  idle: 'var(--fg-dim)',
  saving: 'var(--fg-dim)',
  saved: '#5dd39e',
  error: 'var(--danger)',
  conflict: 'var(--danger)',
  offline: 'var(--fg-dim)',
};

export function SaveBadge({
  status,
  name,
  onNameChange,
}: {
  status: Status;
  name: string;
  onNameChange?: (name: string) => void;
}) {
  return (
    <div className="save-badge">
      {onNameChange ? (
        <input
          className="project-name-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={120}
          placeholder="Untitled"
          spellCheck={false}
          aria-label="Project name"
        />
      ) : (
        <span style={{ fontWeight: 600 }}>{name}</span>
      )}
      {status !== 'idle' && (
        <span style={{ color: COLORS[status], fontSize: 12 }}>{LABELS[status]}</span>
      )}
    </div>
  );
}
