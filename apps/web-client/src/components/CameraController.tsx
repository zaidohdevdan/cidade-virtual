import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraControllerProps {
  playerPosition: THREE.Vector3;
  isFirstPerson: boolean;
  isInsideStore?: boolean;
  onAngleChange: (yaw: number) => void;
  onToggleFirstPerson: () => void;
}

export const CameraController: React.FC<CameraControllerProps> = ({
  playerPosition,
  isFirstPerson,
  isInsideStore = false,
  onAngleChange,
  onToggleFirstPerson,
}) => {
  const { camera, gl } = useThree();

  const angleYRef = useRef<number>(0);
  const angleXRef = useRef<number>(isInsideStore ? 0.12 : 0.55);
  const zoomDistRef = useRef<number>(isInsideStore ? 2.4 : 45);
  const prevInsideStoreRef = useRef<boolean>(isInsideStore);

  const isDraggingRef = useRef<boolean>(false);
  const prevMouseXRef = useRef<number>(0);
  const prevMouseYRef = useRef<number>(0);

  const currentLookAtRef = useRef<THREE.Vector3>(
    isInsideStore
      ? new THREE.Vector3(playerPosition.x, 1.45, playerPosition.z)
      : new THREE.Vector3(8.5, 0.22, 12.0)
  );
  const currentCameraPosRef = useRef<THREE.Vector3>(
    isInsideStore
      ? new THREE.Vector3(playerPosition.x, 1.75, Math.min(4.2, playerPosition.z + 2.4))
      : new THREE.Vector3(8.5, 30, 45)
  );

  // Ajusta FOV e posição imediata ao montar ou alternar entre cidade e interior
  useEffect(() => {
    const perspCamera = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
      ? (camera as THREE.PerspectiveCamera)
      : null;

    if (isInsideStore !== prevInsideStoreRef.current) {
      prevInsideStoreRef.current = isInsideStore;
      if (isInsideStore) {
        zoomDistRef.current = 2.8;
        angleXRef.current = 0.12;
        angleYRef.current = 0; // Câmera atrás do avatar, olhando no sentido -Z para o fundo da loja
        onAngleChange(0);
        currentCameraPosRef.current.set(playerPosition.x, 1.75, Math.min(4.2, playerPosition.z + 2.8));
        currentLookAtRef.current.set(playerPosition.x, 1.45, playerPosition.z);
        if (perspCamera) {
          perspCamera.fov = 70;
          perspCamera.updateProjectionMatrix();
        }
      } else {
        zoomDistRef.current = 42;
        angleXRef.current = 0.55;
        angleYRef.current = 0;
        onAngleChange(0);
        currentLookAtRef.current.set(playerPosition.x, playerPosition.y + 1.2, playerPosition.z);
        currentCameraPosRef.current.set(
          playerPosition.x,
          playerPosition.y + 1.2 + Math.sin(0.55) * 42,
          playerPosition.z + Math.cos(0.55) * 42
        );
        if (perspCamera) {
          perspCamera.fov = 55;
          perspCamera.updateProjectionMatrix();
        }
      }
    } else if (isInsideStore && perspCamera && perspCamera.fov !== 70) {
      perspCamera.fov = 70;
      perspCamera.updateProjectionMatrix();
    }
  }, [isInsideStore, onAngleChange, playerPosition.x, playerPosition.y, playerPosition.z, camera]);

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
      if (isInsideStore) {
        angleXRef.current = Math.max(-0.25, Math.min(0.48, angleXRef.current + dy * 0.004));
      } else {
        angleXRef.current = Math.max(0.1, Math.min(1.4, angleXRef.current + dy * 0.004));
      }

      prevMouseXRef.current = e.clientX;
      prevMouseYRef.current = e.clientY;

      onAngleChange(angleYRef.current);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (isInsideStore) {
        zoomDistRef.current = Math.max(0.8, Math.min(6.5, zoomDistRef.current + e.deltaY * 0.006));
      } else {
        zoomDistRef.current = Math.max(12, Math.min(85, zoomDistRef.current + e.deltaY * 0.04));
      }
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
  }, [gl.domElement, isInsideStore, onAngleChange, onToggleFirstPerson]);

  useFrame((_, delta) => {
    const smoothFactor = Math.min(1, delta * 9);

    if (isFirstPerson) {
      // 1ª Pessoa — posicionada na altura dos olhos do avatar (1.68m)
      const eyeHeight = 1.68;
      const targetPos = new THREE.Vector3(
        playerPosition.x,
        playerPosition.y + eyeHeight,
        playerPosition.z,
      );

      const forwardX = -Math.sin(angleYRef.current);
      const forwardZ = -Math.cos(angleYRef.current);
      const pitchY = Math.tan(angleXRef.current);
      const lookTarget = new THREE.Vector3(
        targetPos.x + forwardX * 10,
        targetPos.y - pitchY * 10,
        targetPos.z + forwardZ * 10,
      );

      currentCameraPosRef.current.lerp(targetPos, smoothFactor * 2.0);
      currentLookAtRef.current.lerp(lookTarget, smoothFactor * 2.0);
    } else if (isInsideStore) {
      // 3ª Pessoa Imersiva de Interior: câmera rente ao ombro, altura 1.55m
      const dist = zoomDistRef.current;
      const targetLook = new THREE.Vector3(
        playerPosition.x,
        playerPosition.y + 1.45,
        playerPosition.z,
      );

      let targetX = targetLook.x + Math.sin(angleYRef.current) * Math.cos(angleXRef.current) * dist;
      let targetY = targetLook.y + Math.sin(angleXRef.current) * dist;
      let targetZ = targetLook.z + Math.cos(angleYRef.current) * Math.cos(angleXRef.current) * dist;

      // Clampa a câmera para que NUNCA saia das paredes da loja ampliada (20m x 13m)
      targetX = Math.max(-9.2, Math.min(9.2, targetX));
      targetY = Math.max(0.6, Math.min(3.8, targetY));
      targetZ = Math.max(-7.8, Math.min(4.2, targetZ));

      const targetPos = new THREE.Vector3(targetX, targetY, targetZ);

      currentCameraPosRef.current.lerp(targetPos, smoothFactor * 1.8);
      currentLookAtRef.current.lerp(targetLook, smoothFactor * 1.8);
    } else {
      // 3ª Pessoa Isométrica de Cidade
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
