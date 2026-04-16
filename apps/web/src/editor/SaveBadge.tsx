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

export function SaveBadge({ status, name }: { status: Status; name: string }) {
  return (
    <div className="save-badge">
      <span style={{ fontWeight: 600 }}>{name}</span>
      {status !== 'idle' && (
        <span style={{ color: COLORS[status], fontSize: 12 }}>{LABELS[status]}</span>
      )}
    </div>
  );
}
