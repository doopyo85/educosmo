class ObservatoryComponent {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.labelRenderer = null; // for text labels
        this.nodes = [];
        this.edges = [];

        // Configuration
        this.options = {
            backgroundColor: 0x000010, // Deep Space Blue
            nodeColor: 0xffffff, // White
            edgeColor: 0xaaaaaa, // Light Grey for visibility
            activeColor: 0xffd700 // Gold (for activation)
        };
    }

    async init() {
        console.log('🔭 Initializing Observatory...');
        if (!this.container) {
            console.error('Observatory container not found');
            return;
        }

        this.setupScene();
        await this.loadGalaxyData();
        this.renderGalaxy();
        this.animate();

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
        } else {
            console.warn('CSS2DRenderer not found. Labels will be disabled.');
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
                { id: 'mock1', name: "Variable", pos_x: -20, pos_y: 10, pos_z: 0, activation: 0.8 },
                { id: 'mock2', name: "Loop", pos_x: 20, pos_y: 0, pos_z: 0, activation: 0.5 }
            ],
            edges: [
                { source_node_id: 'mock1', target_node_id: 'mock2', strength: 0.5 }
            ]
        };
    }

    renderGalaxy() {
        if (!this.data || !this.data.nodes) return;

        // Clear existing
        this.nodes.forEach(n => {
            this.scene.remove(n);
            if (n.labelObject) this.scene.remove(n.labelObject);
        });
        this.nodes = [];

        // Remove old edges if any (basic clean up for re-render support)
        // ... implementation simplified for init usage

        const geometry = new THREE.SphereGeometry(3, 32, 32);

        this.data.nodes.forEach(node => {
            // White glowing star style
            const baseColor = new THREE.Color(this.options.nodeColor);

            // Emissive intensity based on activation
            const intensity = 0.5 + (node.activation || 0) * 1.5;

            const material = new THREE.MeshStandardMaterial({
                color: baseColor,
                emissive: 0xffffff,
                emissiveIntensity: intensity,
                roughness: 0.4,
                metalness: 0.1
            });

            const star = new THREE.Mesh(geometry, material);
            const x = node.pos_x || (Math.random() * 100 - 50);
            const y = node.pos_y || (Math.random() * 100 - 50);
            const z = node.pos_z || (Math.random() * 100 - 50);

            star.position.set(x, y, z);
            star.userData = node;

            // Add Text Label using CSS2D
            if (typeof THREE.CSS2DObject !== 'undefined') {
                const div = document.createElement('div');
                div.className = 'label';
                div.textContent = node.name || node.id;
                div.style.marginTop = '-2em'; // Move label above star
                div.style.color = 'rgba(255, 255, 255, 0.9)';
                div.style.fontFamily = 'sans-serif';
                div.style.fontSize = '12px';
                div.style.fontWeight = 'bold';
                div.style.textShadow = '0 0 4px #000';
                div.style.pointerEvents = 'none';

                const label = new THREE.CSS2DObject(div);
                label.position.set(0, 4, 0);
                star.add(label);
            }

            this.scene.add(star);
            this.nodes.push(star);
        });

        // Use Set to track unique nodes for lookup
        const nodeMap = new Map();
        this.nodes.forEach(n => nodeMap.set(n.userData.id, n));

        // Render Edges
        if (this.data.edges) {
            const lineMaterial = new THREE.LineBasicMaterial({
                color: this.options.edgeColor,
                transparent: true,
                opacity: 0.4
            });

            this.data.edges.forEach(edge => {
                const source = nodeMap.get(edge.source_node_id);
                const target = nodeMap.get(edge.target_node_id);

                if (source && target) {
                    const points = [];
                    points.push(source.position);
                    points.push(target.position);

                    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(lineGeometry, lineMaterial);
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
        if (this.labelRenderer) {
            this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.scene.rotation.y += 0.0002; // Very slow rotation
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
        if (this.labelRenderer) {
            this.labelRenderer.render(this.scene, this.camera);
        }
    }
}

window.ObservatoryComponent = ObservatoryComponent;
