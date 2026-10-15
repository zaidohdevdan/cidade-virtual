// apps/web/src/controls/camera-controls.ts
import * as THREE from 'three';
import { MovementInput } from '../avatars/daniel-avatar';

export class CameraControls {
  public camera: THREE.PerspectiveCamera;
  public input: MovementInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };

  public isFirstPerson: boolean = false;
  public cameraAngleY: number = 0; // Ângulo de rotação horizontal (yaw)
  public cameraAngleX: number = 0.25; // Ângulo vertical (pitch)

  private isDragging: boolean = false;
  private prevMouseX: number = 0;
  private prevMouseY: number = 0;

  private currentLookAt = new THREE.Vector3();
  private currentCameraPos = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.setupKeyboardListeners();
    this.setupMouseListeners(domElement);
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = true;
          break;
        case 'KeyC':
          this.isFirstPerson = !this.isFirstPerson;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = false;
          break;
      }
    });
  }

  private setupMouseListeners(domElement: HTMLElement): void {
    domElement.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.prevMouseX;
      const deltaY = e.clientY - this.prevMouseY;

      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;

      const sensitivity = 0.005;
      this.cameraAngleY -= deltaX * sensitivity;
      this.cameraAngleX = THREE.MathUtils.clamp(
        this.cameraAngleX + deltaY * sensitivity,
        -0.2,
        1.1
      );
    });

    // Zoom com scroll
    domElement.addEventListener('wheel', (e) => {
      if (this.isFirstPerson) return;
      this.thirdPersonDistance = THREE.MathUtils.clamp(
        this.thirdPersonDistance + e.deltaY * 0.005,
        2.5,
        14.0
      );
    });
  }

  private thirdPersonDistance = 5.5;

  /**
   * Atualiza a posição da câmera em relação ao avatar
   */
  public update(targetPos: THREE.Vector3, delta: number): void {
    if (this.isFirstPerson) {
      // Primeira pessoa: posição dos olhos do avatar
      const eyePos = targetPos.clone().add(new THREE.Vector3(0, 1.7, 0));
      this.camera.position.copy(eyePos);

      const lookTarget = eyePos.clone().add(
        new THREE.Vector3(
          Math.sin(this.cameraAngleY) * Math.cos(this.cameraAngleX),
          -Math.sin(this.cameraAngleX),
          Math.cos(this.cameraAngleY) * Math.cos(this.cameraAngleX)
        )
      );
      this.camera.lookAt(lookTarget);
    } else {
      // Terceira pessoa: órbita suave atrás do avatar
      const targetLook = targetPos.clone().add(new THREE.Vector3(0, 1.4, 0));
      this.currentLookAt.lerp(targetLook, Math.min(1, delta * 10));

      const offsetX = Math.sin(this.cameraAngleY) * Math.cos(this.cameraAngleX) * this.thirdPersonDistance;
      const offsetY = Math.sin(this.cameraAngleX) * this.thirdPersonDistance;
      const offsetZ = Math.cos(this.cameraAngleY) * Math.cos(this.cameraAngleX) * this.thirdPersonDistance;

      const idealCameraPos = targetPos.clone().add(new THREE.Vector3(offsetX, Math.max(0.5, offsetY), offsetZ));
      this.currentCameraPos.lerp(idealCameraPos, Math.min(1, delta * 8));

      this.camera.position.copy(this.currentCameraPos);
      this.camera.lookAt(this.currentLookAt);
    }
  }
}
