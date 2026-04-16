import { Link } from 'react-router-dom';
import { useLogout, useMe } from '../auth/useAuth.js';

export function Topbar() {
  const me = useMe();
  const logout = useLogout();
  return (
    <header className="topbar">
      <h1>🖼️ Spriteman</h1>
      <Link to="/projects">Projects</Link>
      <Link to="/palettes">Palettes</Link>
      <div className="spacer" />
      {me.data && (
        <>
          <span style={{ color: 'var(--fg-dim)' }}>{me.data.email}</span>
          <button onClick={() => logout.mutate()}>Sign out</button>
        </>
      )}
    </header>
  );
}
