import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Scene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            console.error(`Container with id '${containerId}' not found`);
            return;
        }

        // Set up scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.camera.position.z = 5;

        // Store initial camera position
        this.initialCameraPosition = this.camera.position.clone();
        this.initialCameraTarget = new THREE.Vector3(0, 0, 0);

        // Default zoom speed
        this.zoomSpeed = 0.8;

        // Set up renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x000000, 1);
        this.container.appendChild(this.renderer.domElement);

        // Add OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Add keyboard zoom controls only for standalone visualizer
        if (containerId === 'visualizer') {
            this.setupKeyboardZoomControls();
        }

        // Add fog for depth effect
        this.scene.fog = new THREE.FogExp2(0x000000, 0.003);

        // Add lights
        this.addLights();
    }

    addLights() {
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 1, 1);
        this.scene.add(directionalLight);
    }

    startAnimation(updateCallback) {
        const animate = (time) => {
            requestAnimationFrame(animate);

            // Check if container is still visible/part of the DOM
             if (!this.container || !this.container.offsetWidth || !this.container.offsetHeight) {
                 // Stop animating if container is hidden or removed
                 return;
             }

            if (updateCallback) {
                updateCallback(time);
            }

            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };

        animate(0);
    }

    onResize() {
         if (!this.container) return; // Ensure container still exists
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    setCamera(position, lookAt) {
        this.camera.position.copy(position);
        if (lookAt) {
            this.camera.lookAt(lookAt);
        }
    }

    resetCamera() {
        this.camera.position.copy(this.initialCameraPosition);
        this.controls.target.copy(this.initialCameraTarget);
        this.controls.update();
    }

    setupKeyboardZoomControls() {
        document.addEventListener('keydown', (event) => {
            // Check if the event target is NOT inside the color-controls
             if (event.target.closest('.color-controls')) {
                 return; // Ignore keyboard input if focus is within the color controls
             }

            // Zoom in with "+" key (also equals key without shift)
            if (event.key === '+' || event.key === '=') {
                this.zoomCamera(0.8); // Zoom in by moving camera closer
            }
            // Zoom out with "-" key
            else if (event.key === '-' || event.key === '_') {
                this.zoomCamera(1.2); // Zoom out by moving camera farther
            }
        });
    }

    zoomCamera(factor) {
        // Get direction from camera to target
        const direction = new THREE.Vector3();
        direction.subVectors(this.camera.position, this.controls.target);

        // Scale the distance by the zoom factor, adjusted by zoom speed
        const adjustedFactor = factor > 1 ?
            1 + ((factor - 1) * this.zoomSpeed) :
            1 - ((1 - factor) * this.zoomSpeed);
        direction.multiplyScalar(adjustedFactor);

        // Set new camera position
        this.camera.position.copy(this.controls.target).add(direction);
    }

    setZoomSpeed(speed) {
        this.zoomSpeed = speed;
    }
}