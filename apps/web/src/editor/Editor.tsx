import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Project } from '@spriteman/shared';
import { api } from '../api.js';
import { useEditor } from './store.js';
import { useKeyboardShortcuts } from './useKeyboard.js';
import { CanvasStack } from './CanvasStack.js';
import { Toolbar } from './Toolbar.js';
import { PalettePanel } from './PalettePanel.js';
import { Timeline } from './Timeline.js';
import { SidePanel } from './SidePanel.js';
import { ExportMenu } from './ExportMenu.js';
import { useAutosave } from './useAutosave.js';
import { SaveBadge } from './SaveBadge.js';
import './editor.css';

export function Editor({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<Project>(`/projects/${projectId}`),
  });
  const projectLoaded = useEditor((s) => s.projectId);

  useEffect(() => {
    if (data) useEditor.getState().loadProject(data);
  }, [data]);

  useKeyboardShortcuts();
  const saveStatus = useAutosave();
  const name = useEditor((s) => s.name);
  const setName = useEditor((s) => s.setName);

  if (isLoading) return <div className="page">Loading project…</div>;
  if (error || !data) return <div className="page error">Failed to load project.</div>;
  if (projectLoaded !== data.id) return <div className="page">Loading…</div>;

  return (
    <div className="editor">
      <div className="editor-topbar">
        <Toolbar />
        <SaveBadge status={saveStatus} name={name} onNameChange={setName} />
        <ExportMenu />
      </div>
      <div className="editor-body">
        <PalettePanel />
        <div className="canvas-area">
          <CanvasStack />
        </div>
        <SidePanel />
      </div>
      <Timeline />
    </div>
  );
}
