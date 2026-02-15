import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";

/*
 * Wide shot — the default camera position showing the whole room.
 */
const WIDE_SHOT = {
  position: new THREE.Vector3(0.45, 0.45, 0.45),
  lookAt: new THREE.Vector3(-0.07, 0.12, 0),
};

/* Radius of the idle orbit (distance from lookAt center in the XZ plane) */
const ORBIT_RADIUS = Math.sqrt(
  (WIDE_SHOT.position.x - WIDE_SHOT.lookAt.x) ** 2 +
  (WIDE_SHOT.position.z - WIDE_SHOT.lookAt.z) ** 2
);
const ORBIT_SPEED = 0.15; // radians per second

/*
 * Per-target camera offsets from the target's center.
 * The camera will fly to  target.position + offset  and look at  target.position.
 */
const CAMERA_OFFSETS = {
  writing: new THREE.Vector3(0.15, 0.15, -0.05),
  working: new THREE.Vector3(0.2, 0.2, -0.005),
  gaming: new THREE.Vector3(0.2, 0.1, 0.05),
};

export default function CameraController({ activeTarget, targets }) {
  const { camera } = useThree();
  const lookAtTarget = useRef(WIDE_SHOT.lookAt.clone());
  const tweenRef = useRef(null);
  const orbitAngle = useRef(
    Math.atan2(
      WIDE_SHOT.position.x - WIDE_SHOT.lookAt.x,
      WIDE_SHOT.position.z - WIDE_SHOT.lookAt.z
    )
  );
  const isIdle = useRef(true);

  /* Animate camera whenever the active target changes */
  useEffect(() => {
    // Kill any running animation
    if (tweenRef.current) tweenRef.current.kill();

    let targetPos, targetLookAt;

    if (activeTarget && targets[activeTarget]) {
      isIdle.current = false;
      const t = targets[activeTarget];
      const offset =
        CAMERA_OFFSETS[activeTarget] || new THREE.Vector3(0.4, 0.3, 0.4);
      targetPos = t.position.clone().add(offset);
      targetLookAt = t.position.clone();
    } else {
      // When returning to wide shot, compute position from current orbit angle
      targetPos = new THREE.Vector3(
        WIDE_SHOT.lookAt.x + Math.sin(orbitAngle.current) * ORBIT_RADIUS,
        WIDE_SHOT.position.y,
        WIDE_SHOT.lookAt.z + Math.cos(orbitAngle.current) * ORBIT_RADIUS
      );
      targetLookAt = WIDE_SHOT.lookAt.clone();
    }

    const posObj = {
      px: camera.position.x,
      py: camera.position.y,
      pz: camera.position.z,
      lx: lookAtTarget.current.x,
      ly: lookAtTarget.current.y,
      lz: lookAtTarget.current.z,
    };

    tweenRef.current = gsap.to(posObj, {
      px: targetPos.x,
      py: targetPos.y,
      pz: targetPos.z,
      lx: targetLookAt.x,
      ly: targetLookAt.y,
      lz: targetLookAt.z,
      duration: 1.2,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.position.set(posObj.px, posObj.py, posObj.pz);
        lookAtTarget.current.set(posObj.lx, posObj.ly, posObj.lz);
      },
      onComplete: () => {
        if (!activeTarget) {
          // Sync orbit angle with where the camera ended up
          orbitAngle.current = Math.atan2(
            camera.position.x - WIDE_SHOT.lookAt.x,
            camera.position.z - WIDE_SHOT.lookAt.z
          );
          isIdle.current = true;
        }
      },
    });
  }, [activeTarget, targets, camera]);

  /* Every frame: orbit when idle, always point camera at lookAt target */
  useFrame((_, delta) => {
    if (isIdle.current) {
      orbitAngle.current += ORBIT_SPEED * delta;
      camera.position.x = WIDE_SHOT.lookAt.x + Math.sin(orbitAngle.current) * ORBIT_RADIUS;
      camera.position.z = WIDE_SHOT.lookAt.z + Math.cos(orbitAngle.current) * ORBIT_RADIUS;
    }
    camera.lookAt(lookAtTarget.current);
  });

  return null;
}

export { WIDE_SHOT, CAMERA_OFFSETS };
