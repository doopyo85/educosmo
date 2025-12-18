class ObservatoryComponent {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.nodes = [];
        this.edges = [];

        // Configuration
        this.options = {
            backgroundColor: 0x000010, // Deep Space Blue
            nodeColor: 0x4fc3f7, // Light Blue
            edgeColor: 0x1e3a8a, // Dark Blue
            activeColor: 0xffd700 // Gold (for activation)
        };
    }

    async init() {
        console.log('🔭 Initializing Observatory...');
        if (!this.container) {
            console.error('Observatory container not found');
            return;
        }

        // 1. Setup Three.js Scene
        this.setupScene();

        // 2. Fetch Data (CT Nodes & Edges)
        await this.loadGalaxyData();

        // 3. Render Elements
        this.renderGalaxy();

        // 4. Start Animation Loop
        this.animate();

        // 5. Handle Resize
        window.addEventListener('resize', () => this.onResize());

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
        this.camera.position.set(0, 50, 200);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(100, 100, 100);
        this.scene.add(pointLight);

        // Controls (OrbitControls must be loaded globally or imported)
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
            }
        } catch (error) {
            console.error('API Error:', error);
            // Fallback Mock Data
            this.data = {
                nodes: [
                    { id: 1, name: "Variable (Mock)", position_x: 0, position_y: 0, position_z: 0, activation: 0.5 }
                ],
                edges: []
            };
        }
    }

    renderGalaxy() {
        if (!this.data || !this.data.nodes) return;

        // Clear existing
        this.nodes.forEach(n => this.scene.remove(n));
        this.nodes = [];

        // Geometries
        const geometry = new THREE.SphereGeometry(2, 32, 32);

        this.data.nodes.forEach(node => {
            // Determine Color based on Activation
            // dim blue (0.1) -> bright gold (1.0)
            const baseColor = new THREE.Color(this.options.nodeColor);
            const activeColor = new THREE.Color(this.options.activeColor);
            const finalColor = baseColor.lerp(activeColor, node.activation || 0);

            const material = new THREE.MeshStandardMaterial({
                color: finalColor,
                emissive: finalColor,
                emissiveIntensity: (node.activation || 0) * 2 // Glow effect
            });

            const star = new THREE.Mesh(geometry, material);
            // Use DB positions (default to random if null)
            const x = node.position_x || (Math.random() * 100 - 50);
            const y = node.position_y || (Math.random() * 100 - 50);
            const z = node.position_z || (Math.random() * 100 - 50);

            star.position.set(x, y, z);
            star.userData = node; // Store full node data

            this.scene.add(star);
            this.nodes.push(star);
        });

        // Render Edges (Lines)
        if (this.data.edges) {
            const lineMaterial = new THREE.LineBasicMaterial({
                color: this.options.edgeColor,
                transparent: true,
                opacity: 0.2
            });

            this.data.edges.forEach(edge => {
                const source = this.data.nodes.find(n => n.id === edge.from);
                const target = this.data.nodes.find(n => n.id === edge.to);

                if (source && target) {
                    const points = [];
                    // Handle missing positions safely
                    const sX = source.position_x || 0, sY = source.position_y || 0, sZ = source.position_z || 0;
                    const tX = target.position_x || 0, tY = target.position_y || 0, tZ = target.position_z || 0;

                    points.push(new THREE.Vector3(sX, sY, sZ));
                    points.push(new THREE.Vector3(tX, tY, tZ));

                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, lineMaterial);
                    this.scene.add(line);
                }
            });
        }
    }

    onResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Gentle rotation
        this.scene.rotation.y += 0.0005;

        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Expose globally
window.ObservatoryComponent = ObservatoryComponent;
