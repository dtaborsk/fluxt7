// Car Sensor Visualizer - Main Application
// Uses Three.js for 3D rendering

class CarSensorVisualizer {
    constructor() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        // Ground plane reference
        this.groundPlane = null;
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / (window.innerHeight - 20), 0.1, 1000);
        this.camera.position.set(0, 2, 5);
        
        // Renderer setup
        const canvas = document.getElementById('threeCanvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth - 280, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Texture loader
        this.textureLoader = new THREE.TextureLoader();
        
        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Sensor placement mode
        this.isAddSensorMode = false;
        this.selectedSensorType = 'P';
        
        // Sensor size
        this.sensorSize = 0.2;
        
        // Separate counters for sensor types
        this.sensorCounters = { P: 0, T: 0 };
        
        // Track available indices for reuse when sensors are deleted
        this.availableIndices = { P: [], T: [] };
        
        // Lighting
        this.setupLights();
        
        // Car model
        this.carModel = null;
        this.currentModelPath = null;
        
        // Garage
        this.garageGroup = null;
        this.showGarage = true;
        
        // Create ground plane
        this.createGround();
        
        // Create skybox
        this.createSkybox();
        
        // Create garage
        this.createGarage();
        
        // Set initial garage visibility
        this.updateGarageVisibility();
        
        // Load default model (changed to Honda Civic Type R)
        this.loadModel('models/Honda+civic+type+R.glb');
        
        // Sensors
        this.sensors = [];
        this.sensorObjects = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Data
        this.csvData = null;
        this.currentTimeIndex = 0;
        this.timestamps = [];
        this.sensorColumns = [];
        this.pressureSensors = [];
        this.temperatureSensors = [];
        
        // Color scales
        this.ambientPressure = 0;
        this.maxPressure = 1;
        this.minPressure = 0;
        
        // UI elements
        this.timeSlider = document.getElementById('timeSlider');
        this.timeLabel = document.getElementById('timeLabel');
        this.sensorCount = document.getElementById('sensorCount');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.sensorToggles = document.getElementById('sensorToggles');
        this.csvFileInput = document.getElementById('csvFile');
        this.showPressure = document.getElementById('showPressure');
        this.showTemperature = document.getElementById('showTemperature');
        this.toggleAddSensorBtn = document.getElementById('toggleAddSensor');
        this.sensorTypeSelect = document.getElementById('sensorTypeSelect');
        this.modeInfo = document.getElementById('modeInfo');
        this.sensorSizeSlider = document.getElementById('sensorSizeSlider');
        this.sensorSizeLabel = document.getElementById('sensorSizeLabel');
        this.showGarageCheckbox = document.getElementById('showGarage');
        
        // Initialize sensor size label
        this.sensorSizeLabel.textContent = `Size: ${this.sensorSize.toFixed(1)}`;
        
        // Event listeners
        this.setupEventListeners();
        
        // Animation loop
        this.animate();
        
        // Create sample data
        this.createSampleData();
    }
    
    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);
        
        // Hemisphere light for natural outdoor lighting
        const hemiLight = new THREE.HemisphereLight(0xffccaa, 0x1a1a1a, 0.6);
        this.scene.add(hemiLight);
    }
    
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d2d2d,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.groundPlane = ground;
    }
    
    createGarage() {
        // Create a garage group
        this.garageGroup = new THREE.Group();
        this.scene.add(this.garageGroup);
        
        // Garage dimensions - large enough to fit any car model
        const width = 30;  // Doubled from 15
        const depth = 30;  // Doubled from 15
        const height = 8;
        const wallThickness = 0.2;
        
        // Load PBR textures for walls and floor
        const wallTextures = this.loadWhiteStuccoTextures();
        const concreteTextures = this.loadConcreteTextures();
        
        // Create white stucco wall material - only visible from inside (front side)
        const wallMaterial = new THREE.MeshStandardMaterial({
            map: wallTextures.diffuseMap,
            normalMap: wallTextures.normalMap,
            roughnessMap: wallTextures.roughnessMap,
            aoMap: wallTextures.aoMap,
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.FrontSide  // Only render front side (visible from inside, invisible from outside)
        });
        
        // Create concrete floor material with PBR maps
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: concreteTextures.diffuseMap,
            normalMap: concreteTextures.normalMap,
            roughnessMap: concreteTextures.roughnessMap,
            aoMap: concreteTextures.aoMap,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        
        // Create floor (replaces the ground plane inside garage)
        const floorGeometry = new THREE.PlaneGeometry(width, depth);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.garageGroup.add(floor);
        
        // Create back wall - faces towards positive Z (towards the car)
        const backWallGeometry = new THREE.PlaneGeometry(width, height);
        const backWallMaterial = wallMaterial.clone();
        backWallMaterial.side = THREE.BackSide;  // Back wall needs BackSide to render correctly
        const backWall = new THREE.Mesh(backWallGeometry, backWallMaterial);
        backWall.rotation.y = Math.PI;
        backWall.position.set(0, height / 2, -depth / 2);
        backWall.receiveShadow = true;
        this.garageGroup.add(backWall);
        
        // Create left wall - faces towards positive X (towards the car)
        const leftWallGeometry = new THREE.PlaneGeometry(depth, height);
        const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-width / 2, height / 2, 0);
        leftWall.receiveShadow = true;
        this.garageGroup.add(leftWall);
        
        // Create right wall - faces towards negative X (towards the car)
        const rightWallGeometry = new THREE.PlaneGeometry(depth, height);
        const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(width / 2, height / 2, 0);
        rightWall.receiveShadow = true;
        this.garageGroup.add(rightWall);
        
        // Create front wall with opening (optional - can be left open)
        // For now, leave the front open for better viewing
        
        // Create ceiling - faces downward (towards negative Y)
        const ceilingGeometry = new THREE.PlaneGeometry(width, depth);
        const ceiling = new THREE.Mesh(ceilingGeometry, wallMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = height;
        ceiling.receiveShadow = true;
        this.garageGroup.add(ceiling);
        
        // Add subtle edge lighting to walls
        this.addGarageLighting();
    }
    
    loadWhiteStuccoTextures() {
        // Load all white stucco PBR texture maps
        const basePath = 'textures/white_stucco_02';
        const diffuseMap = this.textureLoader.load(`${basePath}_diff_1k.png`);
        const normalMap = this.textureLoader.load(`${basePath}_nor_gl_1k.png`);
        const roughnessMap = this.textureLoader.load(`${basePath}_rough_1k.png`);
        const aoMap = this.textureLoader.load(`${basePath}_ao_1k.png`);
        
        // Configure textures
        [diffuseMap, normalMap, roughnessMap, aoMap].forEach(texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 4);
        });
        
        return { diffuseMap, normalMap, roughnessMap, aoMap };
    }
    
    loadBrickTextures() {
        // Load all brick PBR texture maps
        const basePath = 'textures/red_brick';
        const diffuseMap = this.textureLoader.load(`${basePath}_diff_1k.png`);
        const normalMap = this.textureLoader.load(`${basePath}_nor_gl_1k.png`);
        const roughnessMap = this.textureLoader.load(`${basePath}_rough_1k.png`);
        const aoMap = this.textureLoader.load(`${basePath}_ao_1k.png`);
        
        // Configure textures
        [diffuseMap, normalMap, roughnessMap, aoMap].forEach(texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 4);
        });
        
        return { diffuseMap, normalMap, roughnessMap, aoMap };
    }
    
    loadConcreteTextures() {
        // Load all concrete PBR texture maps
        const basePath = 'textures/concrete_floor_worn_001';
        const diffuseMap = this.textureLoader.load(`${basePath}_diff_1k.png`);
        const normalMap = this.textureLoader.load(`${basePath}_nor_gl_1k.png`);
        const roughnessMap = this.textureLoader.load(`${basePath}_rough_1k.png`);
        const aoMap = this.textureLoader.load(`${basePath}_ao_1k.png`);
        
        // Configure textures
        [diffuseMap, normalMap, roughnessMap, aoMap].forEach(texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 4);
        });
        
        return { diffuseMap, normalMap, roughnessMap, aoMap };
    }
    
    createSkybox() {
        // Create a large cube for the skybox
        const skyboxGeometry = new THREE.SphereGeometry(500, 60, 60);
        
        // Create a gradient sky texture
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Create a gradient from light blue at top to darker blue at bottom
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#1a759f');
        gradient.addColorStop(0.5, '#4a90b8');
        gradient.addColorStop(1, '#0a2e4a');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some subtle clouds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height * 0.6;
            const width = Math.random() * 400 + 100;
            const height = Math.random() * 80 + 20;
            ctx.beginPath();
            ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        
        const skyboxMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });
        
        const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
        skybox.position.set(0, 0, 0);
        this.scene.add(skybox);
        
        return skybox;
    }
    
    addGarageLighting() {
        // Add ceiling lights - simple point lights to simulate garage lighting
        const lightIntensity = 0.1;
        const lightColor = 0xfff5eb; // Warm white
        
        // Add 4 ceiling lights
        const lightPositions = [
            [-4, 7, -4],
            [4, 7, -4],
            [-4, 7, 4],
            [4, 7, 4]
        ];
        
        lightPositions.forEach(pos => {
            const light = new THREE.PointLight(lightColor, lightIntensity);
            light.position.set(pos[0], pos[1], pos[2]);
            light.castShadow = true;
            light.shadow.mapSize.width = 512;
            light.shadow.mapSize.height = 512;
            this.garageGroup.add(light);
            
            // Add a small light fixture visual
            const lightFixtureGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.3, 8);
            const lightFixtureMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
            const lightFixture = new THREE.Mesh(lightFixtureGeometry, lightFixtureMaterial);
            lightFixture.position.set(pos[0], pos[1] - 0.15, pos[2]);
            this.garageGroup.add(lightFixture);
        });
    }
    
    updateGarageVisibility() {
        if (this.garageGroup) {
            this.garageGroup.visible = this.showGarage;
        }
        // Hide ground plane when garage is visible
        if (this.groundPlane) {
            this.groundPlane.visible = !this.showGarage;
        }
    }
    
    loadModel(modelPath) {
        // Remove existing model if present
        if (this.carModel) {
            this.scene.remove(this.carModel);
            this.carModel = null;
        }
        
        // Update current model path
        this.currentModelPath = modelPath;
        
        // Use GLTFLoader (handles both .glb and .gltf)
        const loader = new THREE.GLTFLoader();
        
        // Set crossOrigin to anonymous to handle CORS properly
        loader.setCrossOrigin('anonymous');
        
        loader.load(
            modelPath,
            (gltf) => {
                // Position and scale the model
                const model = gltf.scene;
                
                // Center and scale the model
                model.position.set(0, 0, 0);
                model.scale.set(1, 1, 1);
                
                // Raise Honda Civic Type R specifically as it clips into ground
                if (modelPath.includes('Honda+civic+type+R')) {
                    model.position.y = 1.0;
                }
                
                // Enable shadows for all meshes
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.carModel = model;
                this.scene.add(model);
                
                // Log and adjust camera
                console.log(`Model loaded: ${modelPath}`);
                
                // Fit camera to model
                this.fitCameraToModel(model);
            },
            (xhr) => {
                // Progress callback
                console.log(`Loading model: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
            },
            (error) => {
                console.error('Error loading model:', error);
                console.error('\n=== CORS / FILE LOADING FIX ===');
                console.error('To load models locally, you need to use a web server.');
                console.error('\nOption 1: Python (if installed):');
                console.error('  cd /home/eddy/projekty/Stribog/webapp/src');
                console.error('  python -m http.server 8000');
                console.error('  Then open: http://localhost:8000');
                console.error('\nOption 2: Node.js http-server:');
                console.error('  npm install -g http-server');
                console.error('  cd /home/eddy/projekty/Stribog/webapp/src');
                console.error('  http-server');
                console.error('  Then open: http://localhost:8080');
                console.error('\nOption 3: Chromium with --disable-web-security (temporary):');
                console.error('  chromium --disable-web-security --user-data-dir=/tmp/chrome-test');
                console.error('  (NOT RECOMMENDED for regular browsing)');
                
                // Try to create a simple placeholder car as fallback
                this.createPlaceholderCar();
            }
        );
    }
    
    fitCameraToModel(model) {
        // Create a bounding box for the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Calculate the distance needed to see the entire model
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let distance = maxDim / Math.sin(fov / 2);
        
        // Add some padding
        distance *= 1.5;
        
        // Position camera
        this.camera.position.set(
            center.x,
            center.y + maxDim * 0.5,
            center.z + distance
        );
        
        // Look at the center
        this.controls.target.copy(center);
        this.camera.lookAt(center);
        this.controls.update();
    }
    
    createPlaceholderCar() {
        // Create a simple placeholder car when models fail to load
        const carGroup = new THREE.Group();
        
        // Car body
        const bodyGeometry = new THREE.BoxGeometry(4, 1.5, 2);
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x444444,
            flatShading: true
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1;
        body.castShadow = true;
        body.receiveShadow = true;
        carGroup.add(body);
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x1a1a1a,
            flatShading: true
        });
        
        const wheelPositions = [
            [-1.5, 0.5, 1],
            [1.5, 0.5, 1],
            [-1.5, 0.5, -1],
            [1.5, 0.5, -1]
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos[0], pos[1], pos[2]);
            wheel.rotation.x = Math.PI / 2;
            wheel.castShadow = true;
            carGroup.add(wheel);
        });
        
        this.carModel = carGroup;
        this.scene.add(carGroup);
        
        // Reset camera
        this.camera.position.set(0, 2, 5);
        this.controls.target.set(0, 0, 0);
        this.camera.lookAt(0, 0, 0);
        this.controls.update();
        
        console.warn('Created placeholder car - models could not be loaded due to CORS.');
        
        // Show help message in UI
        if (this.modeInfo) {
            this.modeInfo.innerHTML = 
                '<span style="color: #ff6b35; font-weight: bold;">CORS Error:</span> ' +
                'Run a local server to load models. <a href="#" onclick="alert(\'Option 1 (Python):\\n  cd /home/eddy/projekty/Stribog/webapp/src\\n  python -m http.server 8000\\n  Open: http://localhost:8000\\n\\nOption 2 (Node.js):\\n  npm install -g http-server\\n  cd /home/eddy/projekty/Stribog/webapp/src\\n  http-server\\n  Open: http://localhost:8080\')" style="color: #ff8c5a;">Click for help</a>';
        }
    }
    
    setupEventListeners() {
        // Mouse click for sensor placement
        this.renderer.domElement.addEventListener('click', (event) => {
            this.handleClick(event);
        }, false);
        
        // Time slider
        this.timeSlider.addEventListener('input', (event) => {
            this.currentTimeIndex = parseInt(event.target.value);
            this.updateSensorColors();
            this.updateTimeDisplay();
        });
        
        // Sensor size slider
        this.sensorSizeSlider.addEventListener('input', (event) => {
            this.sensorSize = parseFloat(event.target.value);
            this.sensorSizeLabel.textContent = `Size: ${this.sensorSize.toFixed(1)}`;
            this.updateSensorSizes();
        });
        
        // CSV file upload
        this.csvFileInput.addEventListener('change', (event) => {
            this.loadCSVFile(event.target.files[0]);
        });
        
        // Sensor type toggles
        this.showPressure.addEventListener('change', () => this.updateSensorVisibility());
        this.showTemperature.addEventListener('change', () => this.updateSensorVisibility());
        
        // Garage toggle
        this.showGarageCheckbox.addEventListener('change', () => {
            this.showGarage = this.showGarageCheckbox.checked;
            this.updateGarageVisibility();
        });
        
        // Add sensor mode toggle
        this.toggleAddSensorBtn.addEventListener('click', () => {
            this.toggleAddSensorMode();
        });
        
        // Sensor type selection
        document.querySelectorAll('input[name="sensorType"]').forEach(radio => {
            radio.addEventListener('change', (event) => {
                this.selectedSensorType = event.target.value;
                if (this.isAddSensorMode) {
                    this.modeInfo.textContent = `Click on the car to add a ${this.selectedSensorType === 'P' ? 'pressure' : 'temperature'} sensor.`;
                }
            });
        });
        
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Model selection
        document.getElementById('modelSelect').addEventListener('change', (event) => {
            this.loadModel(event.target.value);
        });
    }
    
    toggleAddSensorMode() {
        this.isAddSensorMode = !this.isAddSensorMode;
        this.toggleAddSensorBtn.classList.toggle('active', this.isAddSensorMode);
        this.sensorTypeSelect.classList.toggle('hidden', !this.isAddSensorMode);
        this.toggleAddSensorBtn.textContent = this.isAddSensorMode ? 'Cancel' : 'Add Sensor Mode';
        this.modeInfo.textContent = this.isAddSensorMode 
            ? `Click on the car to add a ${this.selectedSensorType === 'P' ? 'pressure' : 'temperature'} sensor.`
            : 'Click "Add Sensor Mode" then click on the car to place a sensor.';
    }
    
    handleClick(event) {
        // Only add sensors if in add mode
        if (!this.isAddSensorMode) return;
        
        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Check for intersection with the car model
        if (!this.carModel) return;
        
        // For GLTF models, we need to check all descendant meshes
        const allMeshes = [];
        this.carModel.traverse((child) => {
            if (child.isMesh) {
                allMeshes.push(child);
            }
        });
        
        const intersects = this.raycaster.intersectObjects(allMeshes);
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const position = intersect.point;
            
            // Create a new sensor with selected type
            this.createSensor(position, this.selectedSensorType);
        }
    }
    
    createSensor(position, sensorType = 'P') {
        // Create sensor object with per-type numbering
        const type = sensorType.toUpperCase();
        
        // Get next available index for this type
        let sensorIndex;
        if (this.availableIndices[type] && this.availableIndices[type].length > 0) {
            // Reuse a deleted index
            sensorIndex = this.availableIndices[type].shift();
        } else {
            // Use next counter
            this.sensorCounters[type] = (this.sensorCounters[type] || 0) + 1;
            sensorIndex = this.sensorCounters[type];
        }
        
        const sensorIndexStr = String(sensorIndex).padStart(2, '0');
        const sensorId = `sensor_${type}_${sensorIndexStr}`;
        const sensorName = `${type}_${sensorIndexStr}`;
        
        const sensor = {
            id: sensorId,
            name: sensorName,
            type: type,
            position: position.clone(),
            value: 0,
            visible: true,
            object: null
        };
        
        // Create visual representation
        const sensorObject = this.createSensorObject(sensor);
        sensor.object = sensorObject;
        this.scene.add(sensorObject);
        
        this.sensors.push(sensor);
        this.sensorObjects.push(sensorObject);
        
        // Update UI
        this.updateSensorCount();
        this.updateSensorToggles();
        this.updateSensorVisibility();
        
        console.log(`Created sensor ${sensorName} at position (${position.x}, ${position.y}, ${position.z})`);
    }
    
    createSensorObject(sensor) {
        const group = new THREE.Group();
        group.position.copy(sensor.position);
        
        // Main sensor sphere with gradient transparency
        // Create with size 1, then scale it
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = this.createGradientSphereMaterial(sensor.type);
        const sphere = new THREE.Mesh(geometry, material);
        sphere.scale.setScalar(this.sensorSize);
        group.add(sphere);
        
        // Store reference to sphere for size updates
        group.userData.sphere = sphere;
        
        // Sensor stem (to show attachment point)
        const stemGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
        const stemMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.y = -0.15;
        stem.rotation.x = Math.PI / 2;
        group.add(stem);
        
        // Label (text sprite)
        const label = this.createTextLabel(sensor.name);
        label.position.y = 0.4;
        group.add(label);
        
        return group;
    }
    
    createGradientSphereMaterial(sensorType) {
        // Create a canvas with radial gradient texture
        // This gives proper 2D gradient that looks volumetric on the sphere
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        
        // Create radial gradient from center
        const gradient = context.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        
        // Base color for sensor type
        const baseColor = sensorType === 'P' ? '#ff8c5a' : '#ff6b35';
        
        // Gradient: opaque at center, transparent at edges
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(0.7, baseColor);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        const texture = new THREE.CanvasTexture(canvas);
        
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        // Store reference for color updates
        material.userData.baseColor = baseColor;
        material.userData.canvas = canvas;
        material.userData.context = context;
        material.userData.gradient = gradient;
        
        return material;
    }
    
    createTextLabel(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = '12px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.5, 0.2, 1);
        
        return sprite;
    }
    
    updateSensorColors() {
        if (!this.csvData || this.timestamps.length === 0) {
            return;
        }
        
        const currentTime = this.timestamps[this.currentTimeIndex];
        const currentRow = this.csvData.find(row => row.timestamp === currentTime);
        
        if (!currentRow) return;
        
        this.sensors.forEach(sensor => {
            const sensorData = currentRow[sensor.name];
            if (sensorData === undefined) return;
            
            sensor.value = parseFloat(sensorData);
            
            let color;
            if (sensor.type === 'P') {
                color = this.getPressureColor(sensor.value);
            } else if (sensor.type === 'T') {
                color = this.getTemperatureColor(sensor.value);
            } else {
                color = 0xffffff;
            }
            
            // Update sensor sphere color
            if (sensor.object && sensor.object.userData.sphere) {
                const sphere = sensor.object.userData.sphere;
                const material = sphere.material;
                
                // Handle canvas texture material
                if (material.userData.canvas && material.userData.context) {
                    this.updateGradientTexture(material, color, sensor.type);
                } else if (material.userData.colorUniform) {
                    // Shader material
                    material.userData.colorUniform.value.setHex(color);
                } else if (material.color) {
                    // Basic material
                    material.color.setHex(color);
                }
            }
        });
        
        this.updateTimeDisplay();
    }
    
    getPressureColor(value) {
        // Pressure scale:
        // - Below ambient: blue (deeper as value decreases)
        // - At ambient: white
        // - Above ambient: red (deeper as value increases)
        
        if (this.ambientPressure === undefined || this.maxPressure === this.minPressure) {
            return 0xffffff; // Default to white if no data
        }
        
        const diff = value - this.ambientPressure;
        const maxDiff = Math.max(
            Math.abs(this.maxPressure - this.ambientPressure),
            Math.abs(this.minPressure - this.ambientPressure)
        );
        
        if (maxDiff === 0) {
            return 0xffffff;
        }
        
        const normalized = diff / maxDiff;
        
        if (normalized >= 0) {
            // Above ambient: white to red
            const intensity = Math.min(normalized, 1);
            const r = Math.floor(255 * (0.5 + intensity * 0.5));
            const g = Math.floor(255 * (1 - intensity));
            const b = Math.floor(255 * (1 - intensity));
            return (r << 16) | (g << 8) | b;
        } else {
            // Below ambient: white to blue
            const intensity = Math.min(-normalized, 1);
            const r = Math.floor(255 * (1 - intensity));
            const g = Math.floor(255 * (1 - intensity));
            const b = Math.floor(255 * (0.5 + intensity * 0.5));
            return (r << 16) | (g << 8) | b;
        }
    }
    
    getTemperatureColor(value) {
        // Temperature scale with specific color points:
        // 0°C = blue (0, 0, 255)
        // 25°C = white (255, 255, 255)
        // 100°C = red (255, 0, 0)
        // 150°C+ = black (0, 0, 0)
        // Linear interpolation between points
        
        let r, g, b;
        
        if (value <= 0) {
            // Blue
            r = 0; g = 0; b = 255;
        } else if (value <= 25) {
            // Blue to white
            const t = value / 25;
            r = Math.floor(255 * t);
            g = Math.floor(255 * t);
            b = 255;
        } else if (value <= 100) {
            // White to red
            const t = (value - 25) / 75;
            r = 255;
            g = Math.floor(255 * (1 - t));
            b = Math.floor(255 * (1 - t));
        } else if (value <= 150) {
            // Red to black
            const t = (value - 100) / 50;
            r = Math.floor(255 * (1 - t));
            g = 0;
            b = 0;
        } else {
            // Black
            r = 0; g = 0; b = 0;
        }
        
        return (r << 16) | (g << 8) | b;
    }
    
    updateTimeDisplay() {
        if (this.timestamps.length > 0 && this.currentTimeIndex < this.timestamps.length) {
            this.timeLabel.textContent = `Time: ${this.currentTimeIndex + 1} / ${this.timestamps.length}`;
            this.currentTimeDisplay.textContent = `Current time: ${this.timestamps[this.currentTimeIndex]}`;
        }
    }
    
    updateSensorCount() {
        this.sensorCount.textContent = `Sensors: ${this.sensors.length}`;
    }
    
    updateSensorSizes() {
        this.sensors.forEach(sensor => {
            if (sensor.object && sensor.object.userData.sphere) {
                const sphere = sensor.object.userData.sphere;
                sphere.scale.setScalar(this.sensorSize);
            }
        });
    }
    
    updateGradientTexture(material, colorHex, sensorType) {
        // Update the canvas texture with new color
        const canvas = material.userData.canvas;
        const context = material.userData.context;
        const baseColor = `#${colorHex.toString(16).padStart(6, '0')}`;
        
        // Clear and redraw gradient
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        const gradient = context.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(0.7, baseColor);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Update the texture
        material.map.needsUpdate = true;
        
        // Store new base color
        material.userData.baseColor = baseColor;
    }
    
    updateSensorToggles() {
        this.sensorToggles.innerHTML = '';
        
        // Sort sensors by name (P_01, P_02, T_01, etc.)
        const sortedSensors = [...this.sensors].sort((a, b) => a.name.localeCompare(b.name));
        
        sortedSensors.forEach(sensor => {
            const div = document.createElement('div');
            div.className = 'sensor-toggle';
            div.dataset.sensorId = sensor.id;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = sensor.visible;
            checkbox.addEventListener('change', () => {
                sensor.visible = checkbox.checked;
                if (sensor.object) {
                    sensor.object.visible = checkbox.checked;
                }
                this.updateSensorVisibility();
            });
            
            const colorDiv = document.createElement('div');
            colorDiv.className = 'sensor-color';
            colorDiv.style.backgroundColor = sensor.type === 'P' ? '#ff8c5a' : '#ff6b35';
            
            const label = document.createElement('label');
            label.textContent = sensor.name;
            label.prepend(colorDiv);
            
            const trashIcon = document.createElement('span');
            trashIcon.className = 'trash-icon';
            trashIcon.innerHTML = '&#10005;';
            trashIcon.title = 'Delete sensor';
            trashIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteSensor(sensor);
            });
            
            div.appendChild(checkbox);
            div.appendChild(label);
            div.appendChild(trashIcon);
            this.sensorToggles.appendChild(div);
        });
    }
    
    updateSensorVisibility() {
        const showP = this.showPressure.checked;
        const showT = this.showTemperature.checked;
        
        this.sensors.forEach(sensor => {
            const typeVisible = (sensor.type === 'P' && showP) || (sensor.type === 'T' && showT);
            const shouldBeVisible = typeVisible && sensor.visible;
            
            if (sensor.object) {
                sensor.object.visible = shouldBeVisible;
            }
        });
    }
    
    deleteSensor(sensor) {
        // Extract index from sensor name (e.g., "P_01" -> 1)
        const parts = sensor.name.split('_');
        if (parts.length === 2) {
            const type = parts[0];
            const index = parseInt(parts[1]);
            if (!isNaN(index)) {
                // Add index back to available pool
                if (!this.availableIndices[type]) {
                    this.availableIndices[type] = [];
                }
                this.availableIndices[type].push(index);
                // Sort to reuse smallest indices first
                this.availableIndices[type].sort((a, b) => a - b);
            }
        }
        
        // Remove from sensors array
        const index = this.sensors.indexOf(sensor);
        if (index > -1) {
            this.sensors.splice(index, 1);
        }
        
        // Remove from scene
        if (sensor.object && sensor.object.parent) {
            sensor.object.parent.remove(sensor.object);
        }
        
        // Remove from sensorObjects array
        const objIndex = this.sensorObjects.indexOf(sensor.object);
        if (objIndex > -1) {
            this.sensorObjects.splice(objIndex, 1);
        }
        
        // Update UI
        this.updateSensorCount();
        this.updateSensorToggles();
        
        console.log(`Deleted sensor ${sensor.name}`);
    }
    
    onWindowResize() {
        const width = window.innerWidth - 280;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    loadCSVFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            this.parseCSV(event.target.result);
        };
        reader.readAsText(file);
    }
    
    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            console.error('Invalid CSV format');
            return;
        }
        
        // Parse header
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Parse data rows
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            
            for (let j = 0; j < headers.length && j < values.length; j++) {
                row[headers[j]] = values[j];
            }
            
            data.push(row);
        }
        
        // Process data
        this.processCSVData(data, headers);
    }
    
    processCSVData(data, headers) {
        // Extract timestamps
        this.timestamps = data.map(row => row[headers[0]]).filter(ts => ts);
        
        // Extract sensor columns (skip first column which is timestamp and second which is speed)
        this.sensorColumns = headers.slice(2).filter(col => col.startsWith('P_') || col.startsWith('T_'));
        
        // Separate pressure and temperature sensors
        this.pressureSensors = this.sensorColumns.filter(col => col.startsWith('P_'));
        this.temperatureSensors = this.sensorColumns.filter(col => col.startsWith('T_'));
        
        // Calculate ambient pressure (min pressure when speed < 1 km/h)
        this.calculateAmbientPressure(data);
        
        // Calculate max pressure across all sensors and timestamps
        this.calculatePressureRange(data);
        
        // Store data
        this.csvData = data;
        
        // Update slider
        this.timeSlider.min = 0;
        this.timeSlider.max = this.timestamps.length - 1;
        this.timeSlider.value = 0;
        this.currentTimeIndex = 0;
        
        // Update UI
        this.updateTimeDisplay();
        this.updateSensorColors();
        
        console.log('CSV data loaded successfully');
        console.log(`Timestamps: ${this.timestamps.length}`);
        console.log(`Pressure sensors: ${this.pressureSensors.join(', ')}`);
        console.log(`Temperature sensors: ${this.temperatureSensors.join(', ')}`);
        console.log(`Ambient pressure: ${this.ambientPressure}`);
        console.log(`Pressure range: ${this.minPressure} to ${this.maxPressure}`);
    }
    
    calculateAmbientPressure(data) {
        // Find all rows where speed < 1 km/h
        const speedColumn = Object.keys(data[0])[1]; // Second column is speed
        const lowSpeedRows = data.filter(row => {
            const speed = parseFloat(row[speedColumn]);
            return !isNaN(speed) && speed < 1;
        });
        
        if (lowSpeedRows.length === 0) {
            // Default fallback
            this.ambientPressure = 100;
            return;
        }
        
        // Collect all pressure values from low speed rows
        const pressureValues = [];
        this.pressureSensors.forEach(sensor => {
            lowSpeedRows.forEach(row => {
                const value = parseFloat(row[sensor]);
                if (!isNaN(value)) {
                    pressureValues.push(value);
                }
            });
        });
        
        if (pressureValues.length > 0) {
            this.ambientPressure = Math.min(...pressureValues);
        } else {
            this.ambientPressure = 100; // Default
        }
    }
    
    calculatePressureRange(data) {
        const pressureValues = [];
        
        this.pressureSensors.forEach(sensor => {
            data.forEach(row => {
                const value = parseFloat(row[sensor]);
                if (!isNaN(value)) {
                    pressureValues.push(value);
                }
            });
        });
        
        if (pressureValues.length > 0) {
            this.minPressure = Math.min(...pressureValues);
            this.maxPressure = Math.max(...pressureValues);
        } else {
            this.minPressure = 0;
            this.maxPressure = 100;
        }
    }
    
    createSampleData() {
        // Create sample CSV data for demonstration
        const headers = ['timestamp', 'speed_kmh', 'P_01', 'P_02', 'P_03', 'T_01', 'T_02', 'T_03'];
        const data = [];
        
        const baseTime = new Date('2024-01-01T10:00:00Z');
        
        for (let i = 0; i < 100; i++) {
            const time = new Date(baseTime.getTime() + i * 1000); // 1 second intervals
            const timestamp = time.toISOString();
            const speed = i < 10 ? 0 : (i < 20 ? 5 : (i < 30 ? 20 : (i < 40 ? 50 : (i < 50 ? 80 : (i < 60 ? 100 : (i < 70 ? 50 : (i < 80 ? 20 : (i < 90 ? 5 : 0))))))));
            
            // Pressure values (ambient around 100, max around 200)
            const p1 = 100 + Math.sin(i * 0.1) * 50 + (speed > 0 ? speed * 0.5 : 0);
            const p2 = 100 + Math.cos(i * 0.1) * 40 + (speed > 0 ? speed * 0.3 : 0);
            const p3 = 100 + Math.sin(i * 0.2) * 30 + (speed > 0 ? speed * 0.4 : 0);
            
            // Temperature values (0C to 150C)
            const t1 = 20 + Math.sin(i * 0.1) * 40 + (speed > 0 ? speed * 0.2 : 0);
            const t2 = 30 + Math.cos(i * 0.1) * 30 + (speed > 0 ? speed * 0.15 : 0);
            const t3 = 25 + Math.sin(i * 0.2) * 25 + (speed > 0 ? speed * 0.25 : 0);
            
            data.push({
                timestamp,
                speed_kmh: speed.toFixed(1),
                P_01: p1.toFixed(2),
                P_02: p2.toFixed(2),
                P_03: p3.toFixed(2),
                T_01: t1.toFixed(1),
                T_02: t2.toFixed(1),
                T_03: t3.toFixed(1)
            });
        }
        
        this.processCSVData(data, headers);
        
        // Save sample data to file for reference
        this.saveSampleCSV(data, headers);
    }
    
    saveSampleCSV(data, headers) {
        let csv = headers.join(',') + '\n';
        data.forEach(row => {
            csv += headers.map(h => row[h]).join(',') + '\n';
        });
        
        // Create download link (for user reference)
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample_sensor_data.csv';
        a.style.display = 'none';
        document.body.appendChild(a);
        // Don't trigger download automatically
        URL.revokeObjectURL(url);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CarSensorVisualizer();
});
