import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Palette, CreatePaletteRequest } from '@spriteman/shared';
import { BUILT_IN_PALETTES } from '@spriteman/shared';
import { api } from '../api.js';
import { Topbar } from '../components/Topbar.js';

export function PalettesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['palettes'], queryFn: () => api<Palette[]>('/palettes') });
  const create = useMutation({
    mutationFn: (body: CreatePaletteRequest) =>
      api<Palette>('/palettes', { method: 'POST', json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['palettes'] }),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CreatePaletteRequest }) =>
      api<Palette>(`/palettes/${id}`, { method: 'PUT', json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['palettes'] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/palettes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['palettes'] }),
  });

  const [showNew, setShowNew] = useState(false);

  return (
    <>
      <Topbar />
      <div className="page">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Palettes</h2>
          <div className="spacer" />
          <button className="primary" onClick={() => setShowNew((v) => !v)}>
            New palette
          </button>
        </div>

        {showNew && (
          <NewPaletteForm
            onCreate={(b) => {
              create.mutate(b, {
                onSuccess: () => setShowNew(false),
              });
            }}
            pending={create.isPending}
          />
        )}

        <h3 style={{ marginTop: 24 }}>Your palettes</h3>
        {list.isLoading && <div>Loading…</div>}
        {list.data?.filter((p) => p.userId !== null).length === 0 && (
          <div className="card" style={{ color: 'var(--fg-dim)' }}>
            No custom palettes yet.
          </div>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          {list.data?.filter((p) => p.userId !== null).map((p) => (
            <PaletteCard
              key={p.id}
              palette={p}
              onSave={(body) => update.mutate({ id: p.id, body })}
              onDelete={() => {
                if (confirm(`Delete "${p.name}"?`)) del.mutate(p.id);
              }}
            />
          ))}
        </div>

        <h3 style={{ marginTop: 24 }}>Built-in presets</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {BUILT_IN_PALETTES.map((p) => (
            <div key={p.name} className="card row">
              <span style={{ fontWeight: 600, width: 160 }}>{p.name}</span>
              <SwatchRow colors={p.colors} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SwatchRow({ colors }: { colors: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {colors.map((c, i) => (
        <span
          key={`${c}-${i}`}
          title={c}
          style={{ width: 18, height: 18, borderRadius: 3, background: c, border: '1px solid var(--border)' }}
        />
      ))}
    </div>
  );
}

function NewPaletteForm({ onCreate, pending }: { onCreate: (b: CreatePaletteRequest) => void; pending: boolean }) {
  const [name, setName] = useState('My palette');
  const [colors, setColors] = useState<string[]>(['#000000ff', '#ffffffff']);

  return (
    <div className="card">
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Colors</label>
        <ColorListEditor colors={colors} onChange={setColors} />
      </div>
      <button
        className="primary"
        onClick={() => onCreate({ name, colors: colors as CreatePaletteRequest['colors'] })}
        disabled={pending || colors.length === 0}
      >
        {pending ? 'Creating…' : 'Create'}
      </button>
    </div>
  );
}

function PaletteCard({
  palette,
  onSave,
  onDelete,
}: {
  palette: Palette;
  onSave: (b: CreatePaletteRequest) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(palette.name);
  const [colors, setColors] = useState<string[]>(palette.colors);

  if (!editing) {
    return (
      <div className="card row">
        <span style={{ fontWeight: 600, width: 160 }}>{palette.name}</span>
        <SwatchRow colors={palette.colors} />
        <div className="spacer" />
        <button onClick={() => setEditing(true)}>Edit</button>
        <button className="danger" onClick={onDelete}>Delete</button>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <ColorListEditor colors={colors} onChange={setColors} />
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="primary"
          onClick={() => {
            onSave({ name, colors: colors as CreatePaletteRequest['colors'] });
            setEditing(false);
          }}
        >
          Save
        </button>
        <button onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

function ColorListEditor({ colors, onChange }: { colors: string[]; onChange: (c: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {colors.map((c, i) => (
        <label key={i} style={{ display: 'inline-flex', position: 'relative', margin: 0 }}>
          <input
            type="color"
            value={c.slice(0, 7)}
            onChange={(e) => {
              const next = [...colors];
              next[i] = e.target.value + 'ff';
              onChange(next);
            }}
            style={{ width: 28, height: 28, padding: 0, border: '1px solid var(--border)', background: c }}
          />
          <button
            type="button"
            onClick={() => onChange(colors.filter((_, j) => j !== i))}
            title="Remove"
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 14,
              height: 14,
              padding: 0,
              fontSize: 10,
              lineHeight: '12px',
            }}
          >
            ×
          </button>
        </label>
      ))}
      <button
        type="button"
        onClick={() => onChange([...colors, '#888888ff'])}
        style={{ width: 28, height: 28, padding: 0 }}
        title="Add color"
      >
        +
      </button>
    </div>
  );
}
