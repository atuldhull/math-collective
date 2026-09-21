import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * MonumentGlbHero — the Asymptotes monument, exported from Blender as
 * glTF and drawn live by Three.js.
 *
 * EXPERIMENTAL. Not wired into HeroExperience yet; mount it directly to
 * evaluate whether the look survives the trip out of Blender.
 *
 * What comes across in a .glb: geometry, material colours, metalness,
 * roughness, emissive strength, and the Blender camera.
 *
 * What does NOT, and this is the whole question:
 *   - Cycles/EEVEE lighting. The render's glossy floor reflections, the
 *     neon bloom and the soft falloff are all renderer output, not scene
 *     data. glTF has no way to express them.
 *   - Compositor glare/grading.
 *
 * So the browser has to recreate that look. That is what the lighting
 * rig and the environment map below are for: an emissive material plus
 * a bloom pass is what makes neon read as neon, and a reflective floor
 * needs an environment to reflect.
 */
export default function MonumentGlbHero({ src = "/app/hero/monument.glb" }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05030a);

    const camera = new THREE.PerspectiveCamera(
      35, mount.clientWidth / mount.clientHeight, 0.1, 5000,   // far must clear the 400-unit floor plane
    );
    camera.position.set(0, 1.6, 7);

    // A room environment gives metal something to reflect. Without it,
    // metalness reads as flat grey — the single most common reason a
    // Blender export "looks wrong" in the browser.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envLight = new THREE.Mesh(
      new THREE.SphereGeometry(10, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x2a2140, side: THREE.BackSide }),
    );
    envScene.add(envLight);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;

    scene.add(new THREE.AmbientLight(0x404060, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(3, 6, 4);
    scene.add(key);
    const rimA = new THREE.PointLight(0x4dd8ff, 40, 20);
    rimA.position.set(-4, 2, 2);
    scene.add(rimA);
    const rimB = new THREE.PointLight(0xff5ea8, 40, 20);
    rimB.position.set(4, 2, -1);
    scene.add(rimB);

    let raf = 0;
    let disposed = false;
    const loader = new GLTFLoader();

    loader.load(
      src,
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;

        // Frame whatever came out of Blender, rather than assuming its
        // scale: exported scenes rarely sit where you expect.
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        root.position.sub(centre);
        // Frame on HEIGHT, not the bounding box: the scene includes a
        // 400-unit ground plane, so max(x,y,z) is the floor and framing
        // on it puts the camera in the next postcode.
        const radius = Math.max(size.y, 1);
        camera.position.set(0, radius * 0.35, radius * 2.4);
        camera.lookAt(0, 0, 0);

        scene.add(root);

        const tick = () => {
          root.rotation.y += 0.0015;   // slow turntable, just to see it
          renderer.render(scene, camera);
          raf = requestAnimationFrame(tick);
        };
        tick();
      },
      undefined,
      (err) => console.error("[MonumentGlbHero] load failed", err),
    );

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [src]);

  return <div ref={mountRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />;
}
