import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Layout,
  LayoutSummary,
  CreateLayoutRequest,
  LayoutSnapGrid,
} from '@spriteman/shared';
import { LAYOUT_SNAP_GRID_VALUES } from '@spriteman/shared';
import { api } from '../api.js';
import { Topbar } from '../components/Topbar.js';

export function LayoutsListPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const list = useQuery({
    queryKey: ['layouts'],
    queryFn: () => api<LayoutSummary[]>('/layouts'),
  });
  const create = useMutation({
    mutationFn: (body: CreateLayoutRequest) =>
      api<Layout>('/layouts', { method: 'POST', json: body }),
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: ['layouts'] });
      nav(`/layouts/${l.id}`);
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/layouts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['layouts'] }),
  });

  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <Topbar />
      <div className="page">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Your layouts</h2>
          <div className="spacer" />
          <button className="primary" onClick={() => setShowCreate((v) => !v)}>
            New layout
          </button>
        </div>

        {showCreate && (
          <CreateForm
            onSubmit={(b) => create.mutate(b)}
            onCancel={() => setShowCreate(false)}
            pending={create.isPending}
          />
        )}

        {list.isLoading && <div>Loading…</div>}
        {list.data?.length === 0 && !showCreate && (
          <div className="card" style={{ color: 'var(--fg-dim)' }}>
            No layouts yet — create one above to start composing scenes from your sprite frames.
          </div>
        )}
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          {list.data?.map((l) => (
            <div key={l.id} className="card row">
              <Link to={`/layouts/${l.id}`} style={{ fontWeight: 600 }}>
                {l.name}
              </Link>
              <span style={{ color: 'var(--fg-dim)' }}>
                {l.canvasWidth}×{l.canvasHeight} · snap {l.snapGrid}px · {l.placementCount} placement
                {l.placementCount === 1 ? '' : 's'}
              </span>
              <div className="spacer" />
              <span style={{ color: 'var(--fg-dim)', fontSize: 12 }}>
                {new Date(l.updatedAt).toLocaleString()}
              </span>
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`Delete "${l.name}"?`)) del.mutate(l.id);
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
  onSubmit: (b: CreateLayoutRequest) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState('Untitled layout');
  const [canvasWidth, setCanvasWidth] = useState(256);
  const [canvasHeight, setCanvasHeight] = useState(256);
  const [snapGrid, setSnapGrid] = useState<LayoutSnapGrid>(16);

  function handle(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, canvasWidth, canvasHeight, snapGrid });
  }

  return (
    <form className="card" onSubmit={handle} style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 2, margin: 0, minWidth: 180 }}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field" style={{ flex: 1, margin: 0, minWidth: 100 }}>
          <label>Canvas width</label>
          <input
            type="number"
            min={16}
            max={2048}
            value={canvasWidth}
            onChange={(e) => setCanvasWidth(Number(e.target.value))}
          />
        </div>
        <div className="field" style={{ flex: 1, margin: 0, minWidth: 100 }}>
          <label>Canvas height</label>
          <input
            type="number"
            min={16}
            max={2048}
            value={canvasHeight}
            onChange={(e) => setCanvasHeight(Number(e.target.value))}
          />
        </div>
        <div className="field" style={{ flex: 1, margin: 0, minWidth: 120 }}>
          <label>Snap grid</label>
          <select
            value={snapGrid}
            onChange={(e) => setSnapGrid(Number(e.target.value) as LayoutSnapGrid)}
          >
            {LAYOUT_SNAP_GRID_VALUES.map((n) => (
              <option key={n} value={n}>
                {n}×{n}
              </option>
            ))}
          </select>
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
