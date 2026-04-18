import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Project, ProjectSummary } from '@spriteman/shared';
import { PixelBuffer } from '@spriteman/pixel';
import { api } from '../api.js';
import { useLayout, bufferKey } from './store.js';

export function ProjectsSidebar() {
  const projects = useQuery({
    queryKey: ['projects'],
    queryFn: () => api<ProjectSummary[]>('/projects'),
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const activeStamp = useLayout((s) => s.activeStamp);

  return (
    <aside className="layouts-sidebar">
      <div className="layouts-sidebar-header">Projects</div>
      <div className="layouts-sidebar-hint">
        {activeStamp
          ? 'Click the canvas to stamp. Esc clears.'
          : 'Click a frame to use as a stamp.'}
      </div>
      {projects.isLoading && <div className="layouts-sidebar-empty">Loading…</div>}
      {projects.data?.length === 0 && (
        <div className="layouts-sidebar-empty">
          No projects yet — create one from the Projects page to stamp frames from it.
        </div>
      )}
      {projects.data?.map((p) => (
        <ProjectSection
          key={p.id}
          summary={p}
          expanded={expanded === p.id}
          onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
        />
      ))}
    </aside>
  );
}

function ProjectSection({
  summary,
  expanded,
  onToggle,
}: {
  summary: ProjectSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const project = useQuery({
    queryKey: ['project', summary.id],
    queryFn: () => api<Project>(`/projects/${summary.id}`),
    enabled: expanded,
  });

  const registerProject = useLayout((s) => s.registerProject);
  const registerBuffer = useLayout((s) => s.registerBuffer);

  useEffect(() => {
    if (!project.data) return;
    registerProject(project.data.id, {
      width: project.data.width,
      height: project.data.height,
    });
    for (const f of project.data.frames) {
      const layer = f.layers[0];
      if (!layer) continue;
      const buf = PixelBuffer.decode(project.data.width, project.data.height, layer.pixels);
      registerBuffer(project.data.id, f.id, buf);
    }
  }, [project.data, registerProject, registerBuffer]);

  return (
    <div className="layouts-project-section">
      <button className="layouts-project-row" onClick={onToggle}>
        <span className="layouts-caret">{expanded ? '▾' : '▸'}</span>
        <span className="layouts-project-name">{summary.name}</span>
        <span className="layouts-project-meta">
          {summary.width}×{summary.height} · {summary.frameCount}
        </span>
      </button>
      {expanded && (
        <div className="layouts-frames-grid">
          {project.isLoading && (
            <span style={{ color: 'var(--fg-dim)', fontSize: 12, padding: 4 }}>Loading frames…</span>
          )}
          {project.data?.frames.map((f, i) => (
            <StampThumb
              key={f.id}
              projectId={project.data!.id}
              frameId={f.id}
              index={i}
              width={project.data!.width}
              height={project.data!.height}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StampThumb({
  projectId,
  frameId,
  index,
  width,
  height,
}: {
  projectId: string;
  frameId: string;
  index: number;
  width: number;
  height: number;
}) {
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const bufferRev = useLayout((s) => s.bufferRev);
  const activeStamp = useLayout((s) => s.activeStamp);
  const toggleActiveStamp = useLayout((s) => s.toggleActiveStamp);

  useEffect(() => {
    const c = thumbRef.current;
    if (!c) return;
    const buf = useLayout.getState().buffers.get(bufferKey(projectId, frameId));
    if (!buf) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(buf.toImageData(), 0, 0);
  }, [bufferRev, projectId, frameId, width, height]);

  const isActive =
    activeStamp?.projectId === projectId && activeStamp?.frameId === frameId;

  return (
    <button
      className={isActive ? 'layouts-frame-thumb active' : 'layouts-frame-thumb'}
      title={`Frame ${index + 1}`}
      onClick={() => toggleActiveStamp({ projectId, frameId })}
    >
      <canvas ref={thumbRef} style={{ imageRendering: 'pixelated', width: 48, height: 48 }} />
      <span>{index + 1}</span>
    </button>
  );
}
