import { useState, useCallback, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Outline } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import RoomScene from "./components/RoomScene";
import CameraController from "./components/CameraController";
import Menu from "./components/Menu";

/*
 * Per-target glow colours
 */
const GLOW_COLORS = {
  gaming: { visible: 0xffdd00, hidden: 0x665500 }, // yellow
  working: { visible: 0xc0c0c0, hidden: 0x505050 }, // silver
  writing: { visible: 0x3399ff, hidden: 0x0d2b4d }, // blue
};

const DEFAULT_GLOW = { visible: 0x00ddff, hidden: 0x004466 };

export default function App() {
  const [activeTarget, setActiveTarget] = useState(null);
  const [targets, setTargets] = useState({});
  const [loaded, setLoaded] = useState(false);

  const handleTargetsReady = useCallback((t) => {
    setTargets(t);
    setTimeout(() => setLoaded(true), 300);
  }, []);

  const handleHover = useCallback((key) => setActiveTarget(key), []);
  const handleLeave = useCallback(() => setActiveTarget(null), []);

  /* Build an array of meshes to outline (0 or 1 element) */
  const outlinedMeshes = useMemo(() => {
    if (!activeTarget || !targets[activeTarget]) return [];
    return [targets[activeTarget].mesh];
  }, [activeTarget, targets]);

  /* Pick glow colour based on active target */
  const glowColor = activeTarget
    ? GLOW_COLORS[activeTarget] || DEFAULT_GLOW
    : DEFAULT_GLOW;

  return (
    <>
      {/* Loading screen */}
      <div className={`loading-screen ${loaded ? "loaded" : ""}`}>
        Loading room scan…
      </div>

      {/* 3D Canvas */}
      <div className="canvas-container">
        <Canvas
          camera={{ fov: 55, near: 0.01, far: 100, position: [0.45, 0.45, 0.45] }}
          gl={{ antialias: true, toneMapping: 3 /* ACESFilmicToneMapping */ }}
          dpr={[1, 2]}
        >
          <ambientLight intensity={1.8} />
          <directionalLight position={[3, 5, 2]} intensity={0.8} />

          <Suspense fallback={null}>
            <RoomScene
              activeTarget={activeTarget}
              onTargetsReady={handleTargetsReady}
            />
          </Suspense>

          <CameraController activeTarget={activeTarget} targets={targets} />

          {/* Postprocessing: glow outline on hovered object */}
          <EffectComposer autoClear={false}>
            <Outline
              selection={outlinedMeshes}
              blendFunction={BlendFunction.SCREEN}
              edgeStrength={10}
              pulseSpeed={0.8}
              visibleEdgeColor={glowColor.visible}
              hiddenEdgeColor={glowColor.hidden}
              blur
              xRay={true}
            />
          </EffectComposer>
        </Canvas>
      </div>

      {/* Hint */}
      <div className="hint-note">Hover a menu item to see the effect</div>

      {/* Menu */}
      <Menu
        activeTarget={activeTarget}
        onHover={handleHover}
        onLeave={handleLeave}
      />
    </>
  );
}
