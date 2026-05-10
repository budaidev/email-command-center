/* Boot — mount both scenes into their containers */

const rootA = ReactDOM.createRoot(document.getElementById('scene-a'));
rootA.render(<SceneA />);

const rootB = ReactDOM.createRoot(document.getElementById('scene-b'));
rootB.render(<SceneB />);

const rootC = ReactDOM.createRoot(document.getElementById('scene-c'));
rootC.render(<SceneC />);
