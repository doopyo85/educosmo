class ObservatoryComponent {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.labelRenderer = null; // for text labels
        this.nodes = [];
        this.edgeLines = []; // Store edge objects
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredNode = null;

        // Configuration
        this.options = {
            backgroundColor: 0x000010, // Deep Space Blue
            nodeColor: 0xffffff, // White
            edgeColor: 0xaaaaaa, // Light Grey for visibility
            activeColor: 0xffd700 // Gold (for activation)
        };
    }

    async init() {
        console.log('🔭 Initializing Observatory (Interactive Mode)...');
        if (!this.container) {
            console.error('Observatory container not found');
            return;
        }

        this.setupScene();
        await this.loadGalaxyData();
        this.renderGalaxy();
        this.animate();

        window.addEventListener('resize', () => this.onResize());
        this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
        console.log('🚀 Observatory Launched.');
    }

    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.options.backgroundColor);
        this.scene.fog = new THREE.FogExp2(this.options.backgroundColor, 0.002);

        // Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 1000);
        this.camera.position.set(0, 50, 150); // Closer camera

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        // CSS2D Renderer (Labels)
        if (typeof THREE.CSS2DRenderer !== 'undefined') {
            this.labelRenderer = new THREE.CSS2DRenderer();
            this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.labelRenderer.domElement.style.position = 'absolute';
            this.labelRenderer.domElement.style.top = '0px';
            this.labelRenderer.domElement.style.pointerEvents = 'none'; // allow clicks pass through
            this.container.appendChild(this.labelRenderer.domElement);
        }

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1.5);
        pointLight.position.set(0, 100, 100);
        this.scene.add(pointLight);

        // Controls
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        }
    }

    async loadGalaxyData() {
        try {
            console.log('📡 Fetching Connectome Data...');
            const response = await fetch('/api/connectome-data');
            const result = await response.json();

            if (result.success) {
                this.data = result;
                console.log(`✅ Loaded ${this.data.nodes.length} nodes and ${this.data.edges.length} edges.`);
            } else {
                console.error('Failed to load data:', result.message);
                this.useMockData();
            }
        } catch (error) {
            console.error('API Error:', error);
            this.useMockData();
        }
    }

    useMockData() {
        this.data = {
            nodes: [
                { id: 'mk1', name: "Variable", pos_x: -20, pos_y: 10, pos_z: 0, activation: 0.8 },
                { id: 'mk2', name: "Loop", pos_x: 20, pos_y: 0, pos_z: 0, activation: 0.5 }
            ],
            edges: []
        };
    }

    renderGalaxy() {
        if (!this.data || !this.data.nodes) return;

        // Clear existing
        this.nodes.forEach(n => {
            this.scene.remove(n);
            if (n.labelObject) n.remove(n.labelObject);
        });
        this.edgeLines.forEach(l => this.scene.remove(l));
        this.nodes = [];
        this.edgeLines = [];

        // 1. Smaller Stars
        const geometry = new THREE.SphereGeometry(1.2, 32, 32);

        this.data.nodes.forEach(node => {
            const baseColor = new THREE.Color(this.options.nodeColor);

            // Random phase for twinkling
            node.twinklePhase = Math.random() * Math.PI * 2;
            node.twinkleSpeed = 0.002 + Math.random() * 0.003;

            const material = new THREE.MeshStandardMaterial({
                color: baseColor,
                emissive: 0xffffff,
                emissiveIntensity: 0.5,
                roughness: 0.4,
                metalness: 0.1
            });

            const star = new THREE.Mesh(geometry, material);
            const x = node.pos_x || (Math.random() * 100 - 50);
            const y = node.pos_y || (Math.random() * 100 - 50);
            const z = node.pos_z || (Math.random() * 100 - 50);

            star.position.set(x, y, z);
            star.userData = node;

            // 2. Closer Labels
            if (typeof THREE.CSS2DObject !== 'undefined') {
                const div = document.createElement('div');
                div.className = 'label';
                div.textContent = node.name || node.id;
                div.style.marginTop = '-1.5em';
                div.style.color = 'rgba(255, 255, 255, 0.8)';
                div.style.fontFamily = 'sans-serif';
                div.style.fontSize = '11px'; // Slightly smaller font
                div.style.fontWeight = 'bold';
                div.style.textShadow = '0 0 3px #000';
                div.style.pointerEvents = 'none'; // Essential for raycaster

                const label = new THREE.CSS2DObject(div);
                label.position.set(0, 2.5, 0); // Closer Y offset
                star.add(label);
                star.labelObject = label;
            }

            this.scene.add(star);
            this.nodes.push(star);
        });

        // Use Set to track unique nodes for lookup
        const nodeMap = new Map();
        this.nodes.forEach(n => nodeMap.set(n.userData.id, n));

        // 3. Edges (Hidden by default)
        if (this.data.edges) {
            const lineMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0 // Hidden initially
            });

            this.data.edges.forEach(edge => {
                const source = nodeMap.get(edge.source_node_id);
                const target = nodeMap.get(edge.target_node_id);

                if (source && target) {
                    const points = [];
                    points.push(source.position);
                    points.push(target.position);

                    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(lineGeometry, lineMaterial.clone()); // Clone to control opacity individually

                    line.userData = {
                        from: edge.source_node_id,
                        to: edge.target_node_id
                    };

                    this.scene.add(line);
                    this.edgeLines.push(line);
                }
            });
        }
    }

    onMouseMove(event) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        if (this.labelRenderer) {
            this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = Date.now();

        // 4. Twinkle Effect
        this.nodes.forEach(star => {
            if (star.userData) {
                const phase = star.userData.twinklePhase;
                const speed = star.userData.twinkleSpeed;
                // Sine wave oscillating between 0.3 and 1.5
                const intensity = 0.9 + Math.sin(time * speed + phase) * 0.6;
                star.material.emissiveIntensity = intensity;

                // Slight scale pulse
                const scale = 1.0 + Math.sin(time * speed + phase) * 0.1;
                star.scale.set(scale, scale, scale);
            }
        });

        // 5. Raycasting for Hover Interaction
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.nodes);

        if (intersects.length > 0) {
            const targetStar = intersects[0].object;

            if (this.hoveredNode !== targetStar) {
                this.hoveredNode = targetStar;
                const nodeId = targetStar.userData.id;
                this.container.style.cursor = 'pointer';

                // Highlight connected edges
                this.edgeLines.forEach(line => {
                    if (line.userData.from === nodeId || line.userData.to === nodeId) {
                        line.material.opacity = 0.6; // Visible
                        line.material.color.setHex(0x4fc3f7); // Cyan hint
                    } else {
                        line.material.opacity = 0; // Hidden
                    }
                    line.material.needsUpdate = true;
                });
            }
        } else {
            if (this.hoveredNode) {
                this.hoveredNode = null;
                this.container.style.cursor = 'default';

                // Reset edges
                this.edgeLines.forEach(line => {
                    line.material.opacity = 0; // Hide all
                    line.material.needsUpdate = true;
                });
            }
        }

        // Rotate scene slowly
        this.scene.rotation.y += 0.0003;

        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
        if (this.labelRenderer) {
            this.labelRenderer.render(this.scene, this.camera);
        }
    }
}

window.ObservatoryComponent = ObservatoryComponent;
