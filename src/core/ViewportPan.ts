import Phaser from "phaser";

const WHEEL_SENS = 0.85;

function paddingFor(scene: Phaser.Scene): number {
  const w = scene.scale.width;
  const h = scene.scale.height;
  return Math.max(96, Math.round(Math.min(w, h) * 0.22));
}

function applyBounds(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera): void {
  const pad = paddingFor(scene);
  const w = scene.scale.width;
  const h = scene.scale.height;
  cam.setBounds(-pad, -pad, w + pad * 2, h + pad * 2);
  clampScroll(scene, cam);
}

function clampScroll(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera): void {
  const b = cam.getBounds();
  const maxX = b.x + b.width - cam.width;
  const maxY = b.y + b.height - cam.height;
  cam.setScroll(
    Phaser.Math.Clamp(cam.scrollX, b.x, Math.max(b.x, maxX)),
    Phaser.Math.Clamp(cam.scrollY, b.y, Math.max(b.y, maxY))
  );
}

/**
 * Permite desplazar la cámara cuando el contenido supera el área útil:
 * - Rueda del ratón (Shift + rueda = horizontal)
 * - Dos dedos en pantalla (media de los dos punteros)
 * - Botón central + arrastre (escritorio)
 */
export function installViewportPan(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  applyBounds(scene, cam);

  const onResize = (): void => {
    applyBounds(scene, cam);
  };
  scene.scale.on("resize", onResize);

  let midPan = false;
  let lastMidX = 0;
  let lastMidY = 0;

  let midMousePan = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const onWheel = (
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number
  ): void => {
    const ev = pointer.event as WheelEvent | undefined;
    const shift = ev?.shiftKey === true;
    const dx = shift ? deltaY + deltaX : deltaX;
    const dy = shift ? 0 : deltaY;
    cam.setScroll(
      cam.scrollX - dx * WHEEL_SENS * 0.35,
      cam.scrollY - dy * WHEEL_SENS * 0.35
    );
    clampScroll(scene, cam);
  };

  const onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.middleButtonDown()) {
      midMousePan = true;
      lastPointerX = pointer.x;
      lastPointerY = pointer.y;
    }
    const p1 = scene.input.pointer1;
    const p2 = scene.input.pointer2;
    if (p1.isDown && p2.isDown) {
      midPan = true;
      lastMidX = (p1.worldX + p2.worldX) / 2;
      lastMidY = (p1.worldY + p2.worldY) / 2;
    }
  };

  const onPointerMove = (): void => {
    const p1 = scene.input.pointer1;
    const p2 = scene.input.pointer2;
    if (midPan && p1.isDown && p2.isDown) {
      const mx = (p1.worldX + p2.worldX) / 2;
      const my = (p1.worldY + p2.worldY) / 2;
      cam.setScroll(cam.scrollX - (mx - lastMidX), cam.scrollY - (my - lastMidY));
      lastMidX = mx;
      lastMidY = my;
      clampScroll(scene, cam);
      return;
    }
    const mouse = scene.input.mousePointer;
    if (midMousePan && mouse.middleButtonDown()) {
      cam.setScroll(cam.scrollX - (mouse.x - lastPointerX), cam.scrollY - (mouse.y - lastPointerY));
      lastPointerX = mouse.x;
      lastPointerY = mouse.y;
      clampScroll(scene, cam);
    }
  };

  const onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.middleButtonDown()) {
      midMousePan = false;
    }
    const p1 = scene.input.pointer1;
    const p2 = scene.input.pointer2;
    if (!p1.isDown || !p2.isDown) {
      midPan = false;
    }
  };

  scene.input.on(Phaser.Input.Events.POINTER_WHEEL, onWheel);
  scene.input.on(Phaser.Input.Events.POINTER_DOWN, onPointerDown);
  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onPointerMove);
  scene.input.on(Phaser.Input.Events.POINTER_UP, onPointerUp);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off("resize", onResize);
    scene.input.off(Phaser.Input.Events.POINTER_WHEEL, onWheel);
    scene.input.off(Phaser.Input.Events.POINTER_DOWN, onPointerDown);
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onPointerMove);
    scene.input.off(Phaser.Input.Events.POINTER_UP, onPointerUp);
    cam.setScroll(0, 0);
  });
}
