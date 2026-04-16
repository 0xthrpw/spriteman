import { Link, useParams } from 'react-router-dom';
import { Topbar } from '../components/Topbar.js';
import { Editor } from '../editor/Editor.js';

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <>
      <Topbar />
      <Editor projectId={id} />
      <div style={{ padding: 8, borderTop: '1px solid var(--border)', fontSize: 12 }}>
        <Link to="/projects">← Back to projects</Link>
      </div>
    </>
  );
}
