import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraControllerProps {
  playerPosition: THREE.Vector3;
  isFirstPerson: boolean;
  onAngleChange: (yaw: number) => void;
  onToggleFirstPerson: () => void;
}

export const CameraController: React.FC<CameraControllerProps> = ({
  playerPosition,
  isFirstPerson,
  onAngleChange,
  onToggleFirstPerson,
}) => {
  const { camera, gl } = useThree();

  const angleYRef = useRef<number>(0);
  const angleXRef = useRef<number>(0.55); // Ângulo isométrico ideal para vista aérea da cidade
  const zoomDistRef = useRef<number>(45);

  const isDraggingRef = useRef<boolean>(false);
  const prevMouseXRef = useRef<number>(0);
  const prevMouseYRef = useRef<number>(0);

  const currentLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(8.5, 0.22, 12.0));
  const currentCameraPosRef = useRef<THREE.Vector3>(new THREE.Vector3(8.5, 30, 45));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') {
        onToggleFirstPerson();
      }
    };

    const domElement = gl.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDraggingRef.current = true;
        prevMouseXRef.current = e.clientX;
        prevMouseYRef.current = e.clientY;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseXRef.current;
      const dy = e.clientY - prevMouseYRef.current;

      angleYRef.current -= dx * 0.005;
      angleXRef.current = Math.max(0.1, Math.min(1.4, angleXRef.current + dy * 0.004));

      prevMouseXRef.current = e.clientX;
      prevMouseYRef.current = e.clientY;

      onAngleChange(angleYRef.current);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      zoomDistRef.current = Math.max(10, Math.min(90, zoomDistRef.current + e.deltaY * 0.04));
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    domElement.addEventListener('wheel', handleWheel, { passive: true });
    domElement.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('wheel', handleWheel);
      domElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gl.domElement, onAngleChange, onToggleFirstPerson]);

  useFrame((_, delta) => {
    const smoothFactor = Math.min(1, delta * 8);

    if (isFirstPerson) {
      // 1ª Pessoa — posicionada na cabeça do avatar
      const eyeHeight = 1.68;
      const targetPos = new THREE.Vector3(
        playerPosition.x,
        playerPosition.y + eyeHeight,
        playerPosition.z,
      );

      const forwardX = Math.sin(angleYRef.current);
      const forwardZ = Math.cos(angleYRef.current);
      const lookTarget = new THREE.Vector3(
        targetPos.x + forwardX * 10,
        targetPos.y - Math.sin(angleXRef.current - 0.5) * 6,
        targetPos.z + forwardZ * 10,
      );

      currentCameraPosRef.current.lerp(targetPos, smoothFactor * 1.5);
      currentLookAtRef.current.lerp(lookTarget, smoothFactor * 1.5);
    } else {
      // 3ª Pessoa Isométrica — órbita com distância de zoom ajustável
      const dist = zoomDistRef.current;
      const targetLook = new THREE.Vector3(playerPosition.x, playerPosition.y + 1.2, playerPosition.z);

      const targetX = targetLook.x + Math.sin(angleYRef.current) * Math.cos(angleXRef.current) * dist;
      const targetY = targetLook.y + Math.sin(angleXRef.current) * dist;
      const targetZ = targetLook.z + Math.cos(angleYRef.current) * Math.cos(angleXRef.current) * dist;
      const targetPos = new THREE.Vector3(targetX, targetY, targetZ);

      currentCameraPosRef.current.lerp(targetPos, smoothFactor);
      currentLookAtRef.current.lerp(targetLook, smoothFactor);
    }

    camera.position.copy(currentCameraPosRef.current);
    camera.lookAt(currentLookAtRef.current);
  });

  return null;
};
