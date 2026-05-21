import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene, count, isMobile) {
        this.scene = scene;
        this.count = count;
        this.isMobile = isMobile;
        this.particles = [];
        this.particleSystem = null;
        this.rgbValues = { r: 1, g: 1, b: 1 }; // Default RGB, can be controlled externally

        // Create initial particle system (always audio-based now)
        this.createParticleSystem(count);
    }

    setRGBValues(r, g, b) {
        this.rgbValues.r = r;
        this.rgbValues.g = g;
        this.rgbValues.b = b;
        // When RGB values are changed, update particle colors immediately
        if (this.particleSystem) {
            const colorAttribute = this.particleSystem.geometry.attributes.color;
            for (let i = 0; i < this.particles.length; i++) {
                const i3 = i * 3;
                const baseColor = this.particles[i].baseColor || new THREE.Color(1, 1, 1); // Use a base color for the particle

                colorAttribute.array[i3] = baseColor.r * this.rgbValues.r;
                colorAttribute.array[i3 + 1] = baseColor.g * this.rgbValues.g;
                colorAttribute.array[i3 + 2] = baseColor.b * this.rgbValues.b;
            }
            colorAttribute.needsUpdate = true;
        }
    }

    createParticleSystem(count) {
        // Remove existing particle system if it exists
        if (this.particleSystem) {
            this.scene.remove(this.particleSystem);
        }

        this.particles = [];
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        // Default audio arrangement: sphere
        for (let i = 0; i < count; i++) {
            const radius = 2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            // Store original base colors
            const baseColor = new THREE.Color(this.rgbValues.r, this.rgbValues.g, this.rgbValues.b);
            colors[i * 3] = baseColor.r * this.rgbValues.r;
            colors[i * 3 + 1] = baseColor.g * this.rgbValues.g;
            colors[i * 3 + 2] = baseColor.b * this.rgbValues.b;

            sizes[i] = this.isMobile ? 0.2 : 0.15; // Increased base size for better visibility

            this.particles.push({
                originalPosition: new THREE.Vector3(
                    positions[i * 3],
                    positions[i * 3 + 1],
                    positions[i * 3 + 2]
                ),
                targetPosition: new THREE.Vector3(
                    positions[i * 3],
                    positions[i * 3 + 1],
                    positions[i * 3 + 2]
                ),
                baseColor: baseColor, // Store base color for dynamic updates
                size: sizes[i]
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: this.isMobile ? 0.2 : 0.15,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
    }

    updateWithAudio(audioData) {
        if (!this.particleSystem) return;

        const dataArray = audioData.data;
        const average = audioData.average;

        const positionAttribute = this.particleSystem.geometry.attributes.position;
        const colorAttribute = this.particleSystem.geometry.attributes.color;
        const sizeAttribute = this.particleSystem.geometry.attributes.size;

        for (let i = 0; i < this.particles.length; i++) {
            const i3 = i * 3;
            const particle = this.particles[i];

            const frequencyBand = i % (dataArray.length - 1);
            const frequencyValue = dataArray[frequencyBand] / 255;

            // Create more dynamic movement based on frequencies
            const pulseStrength = 1 + frequencyValue * 30; // Increased from 20
            const timeOffset = performance.now() * 0.001;

            const angle = (timeOffset * 0.5) + (i * 0.01);
            const radiusMultiplier = 0.1 + frequencyValue * 5; // Increased from 3

            const xOffset = Math.sin(angle * 2.0 + frequencyBand * 0.05) * radiusMultiplier;
            const yOffset = Math.cos(angle * 1.7 + frequencyBand * 0.05) * radiusMultiplier;
            const zOffset = Math.sin(angle * 1.3 + timeOffset) * radiusMultiplier;

            particle.targetPosition.copy(particle.originalPosition).multiplyScalar(pulseStrength);

            particle.targetPosition.x += xOffset * (1 + frequencyValue * 2);
            particle.targetPosition.y += yOffset * (1 + frequencyValue * 2);
            particle.targetPosition.z += zOffset * (1 + frequencyValue * 2);

            if (frequencyBand < 10) {
                const bassPower = dataArray[frequencyBand] / 255;
                particle.targetPosition.multiplyScalar(1 + bassPower * 1.5); // Increased bass effect
            }

            // Interpolate current position towards target
            positionAttribute.array[i3] += (particle.targetPosition.x - positionAttribute.array[i3]) * 0.25;
            positionAttribute.array[i3 + 1] += (particle.targetPosition.y - positionAttribute.array[i3 + 1]) * 0.25;
            positionAttribute.array[i3 + 2] += (particle.targetPosition.z - positionAttribute.array[i3 + 2]) * 0.25;

            // Enhanced color effects based on frequency and current RGB values
            const h = ((i / this.particles.length) + average * 2) % 1;
            const s = 0.6 + frequencyValue * 0.4;
            const l = 0.4 + frequencyValue * 0.6;

            const color = new THREE.Color().setHSL(h, s, l);
            // Apply the RGB slider values
            colorAttribute.array[i3] = color.r * this.rgbValues.r;
            colorAttribute.array[i3 + 1] = color.g * this.rgbValues.g;
            colorAttribute.array[i3 + 2] = color.b * this.rgbValues.b;

            // Update size based on frequency with more variation
            sizeAttribute.array[i] = particle.size * (1 + frequencyValue * 30); // Increased from 20
        }

        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
        sizeAttribute.needsUpdate = true;
    }

    rotate(avgFrequency) {
        if (!this.particleSystem) return;

        // More pronounced rotation based on average frequency
        if (avgFrequency > 0) {
            this.particleSystem.rotation.y += 0.002 + avgFrequency * 0.02; // Increased multiplier
            this.particleSystem.rotation.x += 0.001 + avgFrequency * 0.01; // Increased multiplier
            this.particleSystem.rotation.z += 0.0005 + avgFrequency * 0.005; // Increased multiplier
        } else {
            // Subtle rotation when paused
            this.particleSystem.rotation.y += 0.001;
            this.particleSystem.rotation.x += 0.0005;
        }
    }
}