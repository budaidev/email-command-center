/* Boot — mount both scenes into their containers */

const rootA = ReactDOM.createRoot(document.getElementById('scene-a'));
rootA.render(<SceneA />);

const rootB = ReactDOM.createRoot(document.getElementById('scene-b'));
rootB.render(<SceneB />);

const rootC = ReactDOM.createRoot(document.getElementById('scene-c'));
rootC.render(<SceneC />);

/* Scene D is a standalone Pulse page (also embedded in Scene B's rail) */
const SceneDStandalone = () => (
  <div style={{ width: '100%', height: '100%', display: 'flex', background: 'var(--bg)' }}>
    <window.PulseView onBack={() => {}} onOpenInbox={() => {}} />
  </div>
);
const rootD = ReactDOM.createRoot(document.getElementById('scene-d'));
rootD.render(<SceneDStandalone />);
