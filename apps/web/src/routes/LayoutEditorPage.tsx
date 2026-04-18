import { useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { Layout, Project } from '@spriteman/shared';
import { PixelBuffer } from '@spriteman/pixel';
import { api } from '../api.js';
import { Topbar } from '../components/Topbar.js';
import { SaveBadge } from '../editor/SaveBadge.js';
import { useLayout } from '../layouts/store.js';
import { useLayoutAutosave } from '../layouts/useAutosave.js';
import { useLayoutKeyboard } from '../layouts/useKeyboard.js';
import { ProjectsSidebar } from '../layouts/ProjectsSidebar.js';
import { LayoutCanvas } from '../layouts/LayoutCanvas.js';
import { InspectorPanel } from '../layouts/InspectorPanel.js';
import { ZoomControls } from '../layouts/ZoomControls.js';
import '../layouts/layouts.css';

export function LayoutEditorPage() {
  const { id } = useParams<{ id: string }>();
  const layoutQuery = useQuery({
    queryKey: ['layout', id],
    queryFn: () => api<Layout>(`/layouts/${id}`),
    enabled: !!id,
  });

  const loadLayout = useLayout((s) => s.loadLayout);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!layoutQuery.data) return;
    if (loadedIdRef.current === layoutQuery.data.id) return;
    loadLayout(layoutQuery.data);
    loadedIdRef.current = layoutQuery.data.id;
  }, [layoutQuery.data, loadLayout]);

  const loaded = useLayout((s) => s.layoutId) === layoutQuery.data?.id;

  return (
    <>
      <Topbar />
      <div className="layouts-page">
        {!loaded || layoutQuery.isLoading ? (
          <div className="page">Loading layout…</div>
        ) : layoutQuery.error ? (
          <div className="page">
            Failed to load. <Link to="/layouts">Back to layouts</Link>.
          </div>
        ) : (
          <LayoutEditor />
        )}
      </div>
    </>
  );
}

function LayoutEditor() {
  useLayoutKeyboard();
  const status = useLayoutAutosave();
  const name = useLayout((s) => s.name);
  const placements = useLayout((s) => s.placements);

  // Hydrate referenced projects (and decode referenced frame buffers) for rendering placements.
  const referencedProjectIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of placements) s.add(p.projectId);
    return Array.from(s);
  }, [placements]);

  const projectQueries = useQueries({
    queries: referencedProjectIds.map((projectId) => ({
      queryKey: ['project', projectId],
      queryFn: () => api<Project>(`/projects/${projectId}`),
    })),
  });

  const registerProject = useLayout((s) => s.registerProject);
  const registerBuffer = useLayout((s) => s.registerBuffer);

  useEffect(() => {
    for (const q of projectQueries) {
      if (!q.data) continue;
      const proj = q.data;
      registerProject(proj.id, { width: proj.width, height: proj.height });
      const neededFrameIds = new Set(
        placements.filter((p) => p.projectId === proj.id).map((p) => p.frameId),
      );
      for (const f of proj.frames) {
        if (!neededFrameIds.has(f.id)) continue;
        const layer = f.layers[0];
        if (!layer) continue;
        const existing = useLayout.getState().buffers.get(`${proj.id}:${f.id}`);
        if (existing) continue;
        const buf = PixelBuffer.decode(proj.width, proj.height, layer.pixels);
        registerBuffer(proj.id, f.id, buf);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectQueries.map((q) => q.data?.id ?? '').join('|')]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLElement>(null);

  return (
    <div className="layouts-editor">
      <div className="layouts-editor-topbar">
        <ZoomControls areaRef={canvasAreaRef} />
        <SaveBadge status={status} name={name} />
      </div>
      <div className="layouts-editor-body">
        <ProjectsSidebar canvasRef={canvasRef} />
        <main ref={canvasAreaRef} className="layouts-canvas-area">
          <LayoutCanvas ref={canvasRef} />
        </main>
        <InspectorPanel />
      </div>
    </div>
  );
}
