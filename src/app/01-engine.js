    /* ═══ 00-engine — nguyên pattern World Kit ═══ */
    const container = document.getElementById('scene');
    const W = () => container.clientWidth, Hv = () => container.clientHeight;
    const clock = new THREE.Clock();
    const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xE2D6C0, 300, 1000);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000); camera.zoom = 1.0; camera.layers.enable(1);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a0, 0.72));
    scene.add(new THREE.AmbientLight(0xffffff, 0.36));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.85);
    sun.position.set(90, 140, 55); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;            // hết sọc chéo "shadow acne" trên mặt sân khi zoom gần
    const sc = sun.shadow.camera; sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160; sc.near = 1; sc.far = 480;
    scene.add(sun);

