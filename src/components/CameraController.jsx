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

/* Spherical orbit parameters (around the lookAt center) */
const ORBIT_RADIUS = Math.sqrt(
  (WIDE_SHOT.position.x - WIDE_SHOT.lookAt.x) ** 2 +
  (WIDE_SHOT.position.z - WIDE_SHOT.lookAt.z) ** 2
);
/* Default polar angle (vertical — measured from the Y axis) */
const DEFAULT_PHI = Math.acos(
  (WIDE_SHOT.position.y - WIDE_SHOT.lookAt.y) /
    WIDE_SHOT.position.distanceTo(WIDE_SHOT.lookAt)
);
/* Default azimuth angle (horizontal) */
const DEFAULT_THETA = Math.atan2(
  WIDE_SHOT.position.x - WIDE_SHOT.lookAt.x,
  WIDE_SHOT.position.z - WIDE_SHOT.lookAt.z
);

const ORBIT_SPEED = 0.15; // auto-orbit radians/sec
const DRAG_SENSITIVITY_X = 0.004; // horizontal radians per pixel
const DRAG_SENSITIVITY_Y = 0.003; // vertical radians per pixel
const PHI_MIN = 0.3; // clamp: don't go directly above
const PHI_MAX = Math.PI / 2 - 0.05; // clamp: don't go below horizon
const DRAG_RETURN_DELAY = 2000; // ms before smooth return to default

/*
 * Per-target camera offsets from the target's center.
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
  const returnTweenRef = useRef(null);

  /* Spherical angles for orbit */
  const theta = useRef(DEFAULT_THETA); // horizontal
  const phi = useRef(DEFAULT_PHI); // vertical

  const isIdle = useRef(true);
  const isDragging = useRef(false);
  const autoOrbit = useRef(true);
  const lastPointerX = useRef(0);
  const lastPointerY = useRef(0);
  const resumeTimer = useRef(null);

  /* Helper: compute camera position from spherical coords */
  const sphericalToPosition = useCallback((th, ph) => {
    const r = WIDE_SHOT.position.distanceTo(WIDE_SHOT.lookAt);
    return new THREE.Vector3(
      WIDE_SHOT.lookAt.x + r * Math.sin(ph) * Math.sin(th),
      WIDE_SHOT.lookAt.y + r * Math.cos(ph),
      WIDE_SHOT.lookAt.z + r * Math.sin(ph) * Math.cos(th)
    );
  }, []);

  /* ---- Pointer / touch handlers ---- */
  const getClientXY = (e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    return [x, y];
  };

  const onPointerDown = useCallback((e) => {
    if (!isIdle.current) return;
    isDragging.current = true;
    const [x, y] = getClientXY(e);
    lastPointerX.current = x;
    lastPointerY.current = y;
    autoOrbit.current = false;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    if (returnTweenRef.current) returnTweenRef.current.kill();
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current || !isIdle.current) return;
    const [x, y] = getClientXY(e);
    const dx = x - lastPointerX.current;
    const dy = y - lastPointerY.current;

    theta.current -= dx * DRAG_SENSITIVITY_X;
    phi.current = Math.max(PHI_MIN, Math.min(PHI_MAX, phi.current + dy * DRAG_SENSITIVITY_Y));

    lastPointerX.current = x;
    lastPointerY.current = y;
  }, []);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // After delay, smoothly animate back to default angles then resume auto-orbit
    resumeTimer.current = setTimeout(() => {
      // Normalize current theta relative to default to find shortest return path
      const anglesObj = { th: theta.current, ph: phi.current };

      // Find the closest equivalent of DEFAULT_THETA to the current theta
      let targetTheta = DEFAULT_THETA;
      while (targetTheta - anglesObj.th > Math.PI) targetTheta -= Math.PI * 2;
      while (targetTheta - anglesObj.th < -Math.PI) targetTheta += Math.PI * 2;

      if (returnTweenRef.current) returnTweenRef.current.kill();
      returnTweenRef.current = gsap.to(anglesObj, {
        th: targetTheta,
        ph: DEFAULT_PHI,
        duration: 1.0,
        ease: "power2.inOut",
        onUpdate: () => {
          theta.current = anglesObj.th;
          phi.current = anglesObj.ph;
        },
        onComplete: () => {
          theta.current = DEFAULT_THETA;
          autoOrbit.current = true;
        },
      });
    }, DRAG_RETURN_DELAY);
  }, []);

  /* Attach / detach listeners on the canvas */
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
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
      if (returnTweenRef.current) returnTweenRef.current.kill();
    };
  }, [gl, onPointerDown, onPointerMove, onPointerUp]);

  /* Animate camera whenever the active target changes */
  useEffect(() => {
    if (tweenRef.current) tweenRef.current.kill();
    if (returnTweenRef.current) returnTweenRef.current.kill();
    if (resumeTimer.current) clearTimeout(resumeTimer.current);

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
      const pos = sphericalToPosition(theta.current, phi.current);
      targetPos = pos;
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
          theta.current = DEFAULT_THETA;
          phi.current = DEFAULT_PHI;
          isIdle.current = true;
          autoOrbit.current = true;
        }
      },
    });
  }, [activeTarget, targets, camera, sphericalToPosition]);

  /* Every frame: update camera from spherical coords when idle */
  useFrame((_, delta) => {
    if (isIdle.current && autoOrbit.current && !isDragging.current) {
      theta.current += ORBIT_SPEED * delta;
    }
    if (isIdle.current) {
      const pos = sphericalToPosition(theta.current, phi.current);
      camera.position.copy(pos);
    }
    camera.lookAt(lookAtTarget.current);
  });

  return null;
}

export { WIDE_SHOT, CAMERA_OFFSETS };
