import * as THREE from 'three';

export class GalaxyBackground {
    constructor(scene) {
        this.scene = scene;
        this.stars = null;
        this.createStarfield();
    }

    createStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 2000;

        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        // Create stars with random positions
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;

            // Position stars in a large sphere around the scene
            const radius = 50 + Math.random() * 30;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);

            // Vary star colors slightly for realism
            const colorChoice = Math.random();
            if (colorChoice > 0.95) {
                // Blue-white stars
                colors[i3] = 0.7 + Math.random() * 0.3;
                colors[i3 + 1] = 0.7 + Math.random() * 0.3;
                colors[i3 + 2] = 1.0;
            } else if (colorChoice > 0.9) {
                // Yellow stars
                colors[i3] = 1.0;
                colors[i3 + 1] = 0.9 + Math.random() * 0.1;
                colors[i3 + 2] = 0.5 + Math.random() * 0.2;
            } else {
                // White stars (majority)
                const brightness = 0.7 + Math.random() * 0.3;
                colors[i3] = brightness;
                colors[i3 + 1] = brightness;
                colors[i3 + 2] = brightness;
            }

            // Vary star sizes
            sizes[i] = 0.1 + Math.random() * 0.5;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const starMaterial = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            opacity: 0.8
        });

        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
    }

    animate(deltaTime, audioData) {
        if (this.stars) {
            this.stars.rotation.y += 0.0001;
            this.stars.rotation.x += 0.00005;

            // Animate stars based on audio data
            const average = audioData.average;
            // Adjust size more noticeably
            this.stars.material.size = 0.2 + average * 1.0; 
            // Adjust opacity more noticeably, clamping between 0.5 and 1.0
            this.stars.material.opacity = Math.min(1.0, 0.5 + average * 0.5); 
            this.stars.material.needsUpdate = true; // Essential for material property changes to apply
        }
    }
}