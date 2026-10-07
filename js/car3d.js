/* Carro 3D controlado por scroll — Three.js (carregado sob demanda) */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export function createCar(canvas, modelUrl, onReady) {
  // fallback: sem WebGL
  let gl;
  try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch (e) {}
  if (!gl) return null;

  const low = matchMedia("(max-width: 768px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);

  // luzes: uma varre a carroceria (reflexo), outra de recorte laranja
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const sweep = new THREE.SpotLight(0xffffff, 60, 20, 0.5, 0.8, 1.5); sweep.position.set(-5, 3, 3); scene.add(sweep, sweep.target);
  const rim = new THREE.DirectionalLight(0xff6a13, 1.6); rim.position.set(4, 2, -5); scene.add(rim);
  const top = new THREE.DirectionalLight(0xdfe6ee, 1.2); top.position.set(0, 6, 2); scene.add(top);

  // piso escuro + sombra suave
  const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: 0x08090a, metalness: 0.6, roughness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.18; scene.add(floor);
  const sc = document.createElement("canvas"); sc.width = sc.height = 128;
  const sx = sc.getContext("2d"), g = sx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,.85)"); g.addColorStop(1, "rgba(0,0,0,0)"); sx.fillStyle = g; sx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 3.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.17; scene.add(shadow);

  const car = new THREE.Group(); scene.add(car);
  let progress = 0, smooth = 0, active = false, raf = 0, disposed = false, loaded = false;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; };
  if (!low) addEventListener("pointermove", onMove, { passive: true });

  new GLTFLoader().load(modelUrl, (gltf) => {
    if (disposed) return;
    const m = gltf.scene;
    const sphere = new THREE.Box3().setFromObject(m).getBoundingSphere(new THREE.Sphere());
    const s = sphere.radius > 0 ? 2.6 / sphere.radius : 1;
    m.scale.setScalar(s); m.position.sub(sphere.center.multiplyScalar(s));
    m.traverse((o) => {
      if (!o.isMesh) return;
      const upgrade = (b) => new THREE.MeshPhysicalMaterial({ color: b.color ? b.color.clone() : 0x202124, metalness: 0.78, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.6 });
      const old = o.material; o.material = Array.isArray(old) ? old.map(upgrade) : upgrade(old);
      (Array.isArray(old) ? old : [old]).forEach((x) => x.dispose());
    });
    car.add(m); loaded = true; onReady?.(); render();
  }, undefined, (err) => console.error("Erro ao carregar car.glb:", err));

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 48 : 36; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  // Câmera guiada por scroll: Forma → Superfície → Reflexo → Acabamento
  const keys = [
    { rot: -0.9, dist: 8.2, h: 1.6, look: 0.0 },   // forma
    { rot: 0.3, dist: 5.2, h: 0.9, look: -0.1 },   // superfície (aproxima)
    { rot: 1.6, dist: 3.6, h: 0.35, look: -0.25 }, // reflexo (perto, lateral)
    { rot: 2.45, dist: 6.4, h: 1.2, look: 0.0 },   // acabamento (pose final)
  ];
  function frame() {
    smooth += (progress - smooth) * 0.085;
    const f = smooth * 3, i = Math.min(2, Math.floor(f)), t = ease(f - i), a = keys[i], b = keys[i + 1];
    const wide = camera.aspect < 0.8 ? 1.35 : 1;
    const rot = lerp(a.rot, b.rot, t) + mouse.sx * 0.15, dist = lerp(a.dist, b.dist, t) * wide, h = lerp(a.h, b.h, t) - mouse.sy * 0.1;
    camera.position.set(Math.sin(rot) * dist, h, Math.cos(rot) * dist);
    camera.lookAt(0, lerp(a.look, b.look, t), 0);
    // reflexo percorre a carroceria
    const ang = smooth * Math.PI * 2.2 - 1.2;
    sweep.position.set(Math.sin(ang) * 6, 2.5 + Math.cos(smooth * 6) * 0.8, Math.cos(ang) * 6);
    sweep.intensity = 30 + 50 * Math.sin(Math.min(1, smooth * 1.05) * Math.PI);
    renderer.toneMappingExposure = 0.95 + 0.25 * smooth;
    mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
  }
  function render() {
    raf = 0;
    if (disposed || !active && loaded && Math.abs(progress - smooth) < 0.0005) return;
    frame(); renderer.render(scene, camera);
    // continua apenas enquanto ativo e visível
    if (active) raf = requestAnimationFrame(render);
  }

  return {
    setProgress(p) { progress = p; if (!raf) raf = requestAnimationFrame(render); },
    setActive(v) { active = v; if (v && !raf) raf = requestAnimationFrame(render); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("pointermove", onMove);
      scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry?.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose(); });
      });
      shadowTex.dispose(); envTex.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
