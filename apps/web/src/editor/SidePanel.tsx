import { useState } from 'react';
import { AnimationPreview } from './AnimationPreview.js';
import { TilingPreview } from './TilingPreview.js';

type Tab = 'preview' | 'tiling';

export function SidePanel() {
  const [tab, setTab] = useState<Tab>('preview');
  return (
    <div className="side-panel">
      <div className="side-tabs">
        <button className={tab === 'preview' ? 'tool active' : 'tool'} onClick={() => setTab('preview')}>
          Preview
        </button>
        <button className={tab === 'tiling' ? 'tool active' : 'tool'} onClick={() => setTab('tiling')}>
          Tiling
        </button>
      </div>
      <div className="side-body">
        {tab === 'preview' ? <AnimationPreview /> : <TilingPreview />}
      </div>
    </div>
  );
}
