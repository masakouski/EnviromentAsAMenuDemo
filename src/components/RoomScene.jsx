import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Maps a menu key to the node name inside the .glb
 * (note: the gaming proxy has a typo "taget" — matching the actual export)
 */
const TARGET_NODE_NAMES = {
  writing: "target_writing",
  working: "target_working",
  gaming: "taget_gaming",
};

export default function RoomScene({ activeTarget, onTargetsReady }) {
  const { scene } = useGLTF("/assets/roomWithProxyCubes.glb");
  const targetsRef = useRef({});

  useEffect(() => {
    const targets = {};

    scene.traverse((child) => {
      if (child.isMesh) {
        // Find target proxy meshes and hide them visually
        for (const [key, nodeName] of Object.entries(TARGET_NODE_NAMES)) {
          if (child.name === nodeName || child.parent?.name === nodeName) {
            // Make proxy invisible but keep it in the scene graph
            child.material = new THREE.MeshBasicMaterial({
              transparent: true,
              opacity: 0,
              depthWrite: false,
            });
            // Store reference along with its world position
            const pos = new THREE.Vector3();
            child.getWorldPosition(pos);
            targets[key] = { mesh: child, position: pos };
          }
        }
      }
    });

    targetsRef.current = targets;

    if (onTargetsReady) {
      onTargetsReady(targets);
    }
  }, [scene, onTargetsReady]);

  /* Highlighted mesh (for the Outline effect) */
  const highlightedMesh = useMemo(() => {
    if (!activeTarget || !targetsRef.current[activeTarget]) return null;
    return targetsRef.current[activeTarget].mesh;
  }, [activeTarget]);

  return (
    <>
      <primitive object={scene} />
    </>
  );
}

export { TARGET_NODE_NAMES };
