import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Project, ProjectSummary } from '@spriteman/shared';
import { PixelBuffer } from '@spriteman/pixel';
import { api } from '../api.js';
import { useLayout, bufferKey, snapToGrid } from './store.js';

export function ProjectsSidebar({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const projects = useQuery({
    queryKey: ['projects'],
    queryFn: () => api<ProjectSummary[]>('/projects'),
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <aside className="layouts-sidebar">
      <div className="layouts-sidebar-header">Projects</div>
      {projects.isLoading && <div className="layouts-sidebar-empty">Loading…</div>}
      {projects.data?.length === 0 && (
        <div className="layouts-sidebar-empty">
          No projects yet — create one from the Projects page to drag frames from it.
        </div>
      )}
      {projects.data?.map((p) => (
        <ProjectSection
          key={p.id}
          summary={p}
          expanded={expanded === p.id}
          onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
          canvasRef={canvasRef}
        />
      ))}
    </aside>
  );
}

function ProjectSection({
  summary,
  expanded,
  onToggle,
  canvasRef,
}: {
  summary: ProjectSummary;
  expanded: boolean;
  onToggle: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
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
            <DraggableFrameThumb
              key={f.id}
              projectId={project.data!.id}
              frameId={f.id}
              index={i}
              width={project.data!.width}
              height={project.data!.height}
              canvasRef={canvasRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraggableFrameThumb({
  projectId,
  frameId,
  index,
  width,
  height,
  canvasRef,
}: {
  projectId: string;
  frameId: string;
  index: number;
  width: number;
  height: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const bufferRev = useLayout((s) => s.bufferRev);
  const addPlacement = useLayout((s) => s.addPlacement);
  const snapGrid = useLayout((s) => s.snapGrid);

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

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    ghost: HTMLElement | null;
  } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      ghost: null,
    };
  }

  function ensureGhost(): HTMLElement {
    const d = dragRef.current!;
    if (d.ghost) return d.ghost;
    const buf = useLayout.getState().buffers.get(bufferKey(projectId, frameId));
    const ghost = document.createElement('div');
    ghost.className = 'layouts-drag-ghost';
    ghost.style.width = `${width}px`;
    ghost.style.height = `${height}px`;
    if (buf) {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      c.getContext('2d')!.putImageData(buf.toImageData(), 0, 0);
      ghost.appendChild(c);
    }
    document.body.appendChild(ghost);
    d.ghost = ghost;
    return ghost;
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.active) {
      if (Math.abs(e.clientX - d.startX) < 5 && Math.abs(e.clientY - d.startY) < 5) return;
      d.active = true;
    }
    const ghost = ensureGhost();
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const active = d.active;
    if (d.ghost) {
      d.ghost.remove();
    }
    dragRef.current = null;
    if (!active) return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      return;
    }
    // Map from on-screen (zoomed) coords back to internal canvas pixel space.
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const cx = Math.round((e.clientX - rect.left) * scaleX);
    const cy = Math.round((e.clientY - rect.top) * scaleY);
    // Anchor on the frame's center so the drop feels natural, then snap.
    const anchoredX = cx - Math.floor(width / 2);
    const anchoredY = cy - Math.floor(height / 2);
    addPlacement({
      projectId,
      frameId,
      x: snapToGrid(anchoredX, snapGrid),
      y: snapToGrid(anchoredY, snapGrid),
    });
  }

  function onPointerCancel(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.ghost) d.ghost.remove();
    dragRef.current = null;
  }

  return (
    <button
      className="layouts-frame-thumb"
      title={`Frame ${index + 1}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
    >
      <canvas ref={thumbRef} style={{ imageRendering: 'pixelated', width: 48, height: 48 }} />
      <span>{index + 1}</span>
    </button>
  );
}
