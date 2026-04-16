import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project, ProjectSummary, CreateProjectRequest } from '@spriteman/shared';
import { api } from '../api.js';
import { Topbar } from '../components/Topbar.js';

export function ProjectsListPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const list = useQuery({
    queryKey: ['projects'],
    queryFn: () => api<ProjectSummary[]>('/projects'),
  });
  const create = useMutation({
    mutationFn: (body: CreateProjectRequest) =>
      api<Project>('/projects', { method: 'POST', json: body }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      nav(`/projects/${p.id}`);
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <Topbar />
      <div className="page">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Your projects</h2>
          <div className="spacer" />
          <button className="primary" onClick={() => setShowCreate((v) => !v)}>
            New project
          </button>
        </div>

        {showCreate && <CreateForm onSubmit={(b) => create.mutate(b)} onCancel={() => setShowCreate(false)} pending={create.isPending} />}

        {list.isLoading && <div>Loading…</div>}
        {list.data?.length === 0 && !showCreate && (
          <div className="card" style={{ color: 'var(--fg-dim)' }}>
            No projects yet — create one above.
          </div>
        )}
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          {list.data?.map((p) => (
            <div key={p.id} className="card row">
              <Link to={`/projects/${p.id}`} style={{ fontWeight: 600 }}>
                {p.name}
              </Link>
              <span style={{ color: 'var(--fg-dim)' }}>
                {p.width}×{p.height} · {p.frameCount} frame{p.frameCount === 1 ? '' : 's'} · {p.fps}fps
              </span>
              <div className="spacer" />
              <span style={{ color: 'var(--fg-dim)', fontSize: 12 }}>
                {new Date(p.updatedAt).toLocaleString()}
              </span>
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`Delete "${p.name}"?`)) del.mutate(p.id);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CreateForm({
  onSubmit,
  onCancel,
  pending,
}: {
  onSubmit: (b: CreateProjectRequest) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState('Untitled sprite');
  const [size, setSize] = useState(32);
  const [fps, setFps] = useState(12);

  function handle(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, width: size, height: size, fps });
  }

  return (
    <form className="card" onSubmit={handle} style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 16, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 2, margin: 0 }}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field" style={{ flex: 1, margin: 0 }}>
          <label>Grid size</label>
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[8, 16, 24, 32, 48, 64, 96, 128].map((n) => (
              <option key={n} value={n}>
                {n}×{n}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1, margin: 0 }}>
          <label>FPS</label>
          <input
            type="number"
            min={1}
            max={60}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
          />
        </div>
        <button className="primary" type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
