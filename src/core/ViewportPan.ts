import Phaser from "phaser";

const WHEEL_SENS = 0.85;

function paddingFor(scene: Phaser.Scene): number {
  const w = scene.scale.width;
  const h = scene.scale.height;
  return Math.max(220, Math.round(Math.min(w, h) * 0.55));
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
  let dragPanActive = false;
  let dragPanPointerId = -1;
  let dragStartX = 0;
  let dragStartY = 0;
  let lastDragX = 0;
  let lastDragY = 0;

  let domTouchPan = false;
  let domTouchY = 0;

  const getTouchCenter = (ev: TouchEvent): { x: number; y: number } | null => {
    if (ev.touches.length <= 0) return null;
    if (ev.touches.length === 1) {
      const t = ev.touches[0];
      if (!t) return null;
      return { x: t.clientX, y: t.clientY };
    }
    const t1 = ev.touches[0];
    const t2 = ev.touches[1];
    if (!t1 || !t2) return null;
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  };

  const panBy = (dx: number, dy: number): void => {
    cam.setScroll(cam.scrollX - dx, cam.scrollY - dy);
    clampScroll(scene, cam);
  };

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
    if (p1?.isDown && p2?.isDown) {
      midPan = true;
      lastMidX = (p1.worldX + p2.worldX) / 2;
      lastMidY = (p1.worldY + p2.worldY) / 2;
      dragPanActive = false;
      dragPanPointerId = -1;
      return;
    }
    dragPanActive = false;
    dragPanPointerId = pointer.id;
    dragStartX = pointer.x;
    dragStartY = pointer.y;
    lastDragX = pointer.x;
    lastDragY = pointer.y;
  };

  const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    const p1 = scene.input.pointer1;
    const p2 = scene.input.pointer2;
    if (midPan && p1?.isDown && p2?.isDown) {
      const mx = (p1.worldX + p2.worldX) / 2;
      const my = (p1.worldY + p2.worldY) / 2;
      panBy(mx - lastMidX, my - lastMidY);
      lastMidX = mx;
      lastMidY = my;
      return;
    }
    const mouse = scene.input.mousePointer;
    if (midMousePan && mouse.middleButtonDown()) {
      panBy(mouse.x - lastPointerX, mouse.y - lastPointerY);
      lastPointerX = mouse.x;
      lastPointerY = mouse.y;
      return;
    }
    if (dragPanPointerId !== pointer.id || !pointer.isDown) {
      return;
    }
    if (!dragPanActive) {
      const moved = Math.hypot(pointer.x - dragStartX, pointer.y - dragStartY);
      if (moved < 8) {
        return;
      }
      dragPanActive = true;
    }
    const pe = pointer.event as PointerEvent | undefined;
    const isTouchPointer = pe?.pointerType === "touch";
    const dx = isTouchPointer ? 0 : pointer.x - lastDragX;
    const dy = pointer.y - lastDragY;
    panBy(dx, dy);
    lastDragX = pointer.x;
    lastDragY = pointer.y;
  };

  const resetDragPan = (): void => {
    dragPanActive = false;
    dragPanPointerId = -1;
  };

  const onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.middleButtonDown()) {
      midMousePan = false;
    }
    const p1 = scene.input.pointer1;
    const p2 = scene.input.pointer2;
    if (!p1?.isDown || !p2?.isDown) {
      midPan = false;
    }
    if (dragPanPointerId === pointer.id || !pointer.isDown) {
      resetDragPan();
    }
  };

  const onDomTouchStart = (ev: TouchEvent): void => {
    const center = getTouchCenter(ev);
    if (!center) return;
    domTouchPan = true;
    domTouchY = center.y;
    ev.preventDefault();
  };

  const onDomTouchMove = (ev: TouchEvent): void => {
    if (!domTouchPan) return;
    const center = getTouchCenter(ev);
    if (!center) return;
    panBy(0, center.y - domTouchY);
    domTouchY = center.y;
    ev.preventDefault();
  };

  const onDomTouchEnd = (ev: TouchEvent): void => {
    const center = getTouchCenter(ev);
    if (!center) {
      domTouchPan = false;
      return;
    }
    domTouchY = center.y;
  };

  const canvas = scene.game.canvas as HTMLCanvasElement | null;
  if (canvas) {
    canvas.addEventListener("touchstart", onDomTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onDomTouchMove, { passive: false });
    canvas.addEventListener("touchend", onDomTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onDomTouchEnd, { passive: false });
  }

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
    if (canvas) {
      canvas.removeEventListener("touchstart", onDomTouchStart);
      canvas.removeEventListener("touchmove", onDomTouchMove);
      canvas.removeEventListener("touchend", onDomTouchEnd);
      canvas.removeEventListener("touchcancel", onDomTouchEnd);
    }
    domTouchPan = false;
    resetDragPan();
    cam.setScroll(0, 0);
  });
}
