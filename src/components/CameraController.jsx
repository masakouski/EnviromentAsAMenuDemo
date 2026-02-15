import { useRef, useEffect, useCallback } from "react";
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
const DRAG_SENSITIVITY = 0.004; // radians per pixel dragged
const DRAG_RESUME_DELAY = 2000; // ms of inactivity before auto-orbit resumes

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
  const { camera, gl } = useThree();
  const lookAtTarget = useRef(WIDE_SHOT.lookAt.clone());
  const tweenRef = useRef(null);
  const orbitAngle = useRef(
    Math.atan2(
      WIDE_SHOT.position.x - WIDE_SHOT.lookAt.x,
      WIDE_SHOT.position.z - WIDE_SHOT.lookAt.z
    )
  );
  const isIdle = useRef(true);

  /* Drag state */
  const isDragging = useRef(false);
  const lastPointerX = useRef(0);
  const autoOrbit = useRef(true);
  const resumeTimer = useRef(null);

  /* ---- Pointer / touch handlers ---- */
  const onPointerDown = useCallback((e) => {
    if (!isIdle.current) return;
    isDragging.current = true;
    lastPointerX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    autoOrbit.current = false;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current || !isIdle.current) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const dx = clientX - lastPointerX.current;
    orbitAngle.current -= dx * DRAG_SENSITIVITY;
    lastPointerX.current = clientX;
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    // Resume auto-orbit after a delay
    resumeTimer.current = setTimeout(() => {
      autoOrbit.current = true;
    }, DRAG_RESUME_DELAY);
  }, []);

  /* Attach / detach listeners on the canvas */
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
    // Touch support
    canvas.addEventListener("touchstart", onPointerDown, { passive: true });
    canvas.addEventListener("touchmove", onPointerMove, { passive: true });
    canvas.addEventListener("touchend", onPointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
      canvas.removeEventListener("touchstart", onPointerDown);
      canvas.removeEventListener("touchmove", onPointerMove);
      canvas.removeEventListener("touchend", onPointerUp);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [gl, onPointerDown, onPointerMove, onPointerUp]);

  /* Animate camera whenever the active target changes */
  useEffect(() => {
    // Kill any running animation
    if (tweenRef.current) tweenRef.current.kill();

    let targetPos, targetLookAt;

    if (activeTarget && targets[activeTarget]) {
      isIdle.current = false;
      autoOrbit.current = false;
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
          autoOrbit.current = true;
        }
      },
    });
  }, [activeTarget, targets, camera]);

  /* Every frame: orbit when idle (auto or dragged), always point camera at lookAt target */
  useFrame((_, delta) => {
    if (isIdle.current && autoOrbit.current && !isDragging.current) {
      orbitAngle.current += ORBIT_SPEED * delta;
    }
    if (isIdle.current) {
      camera.position.x = WIDE_SHOT.lookAt.x + Math.sin(orbitAngle.current) * ORBIT_RADIUS;
      camera.position.z = WIDE_SHOT.lookAt.z + Math.cos(orbitAngle.current) * ORBIT_RADIUS;
    }
    camera.lookAt(lookAtTarget.current);
  });

  return null;
}

export { WIDE_SHOT, CAMERA_OFFSETS };
