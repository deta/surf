/**
 * Predefined Surflet code examples for onboarding and demonstrations
 */

/**
 * Moon Landing Timeline Surflet code
 */
export const predefinedSurfletCode = `\`\`\`javascript

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Double Pendulum Simulation</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Inter', sans-serif;
        }

        body {
            background-color: #faf7f5;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
            padding: 10px;
        }

        canvas {
            background-color: #faf7f5;
            border-radius: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
        }

        .container {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            max-width: 500px;
        }

        .controls {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
            width: 100%;
            justify-content: center;
        }

        .control {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
            font-weight: 500;
        }

        input[type="range"] {
            width: 120px;
            accent-color: #ff9a76;
        }

        .buttons {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        button {
            background-color: #ff9a76;
            color: white;
            border: none;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        button:hover {
            background-color: #ffb296;
            transform: scale(1.05);
        }

        .trail-color {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        input[type="color"] {
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            overflow: hidden;
        }

        input[type="color"]::-webkit-color-swatch-wrapper {
            padding: 0;
        }

        input[type="color"]::-webkit-color-swatch {
            border: none;
            border-radius: 50%;
        }
    </style>
</head>
<body>
    <div class="container">
        <canvas id="pendulumCanvas" width="420" height="350"></canvas>
        <div class="controls">
            <div class="control">
                <label>Gravity</label>
                <input type="range" id="gravity" min="0.1" max="2" step="0.1" value="0.8">
            </div>
            <div class="control">
                <label>Length 1</label>
                <input type="range" id="length1" min="50" max="120" value="80">
            </div>
            <div class="control">
                <label>Length 2</label>
                <input type="range" id="length2" min="50" max="120" value="80">
            </div>
            <div class="control">
                <label>Mass 1</label>
                <input type="range" id="mass1" min="5" max="30" value="10">
            </div>
            <div class="control">
                <label>Mass 2</label>
                <input type="range" id="mass2" min="5" max="30" value="10">
            </div>
            <div class="control trail-color">
                <label>Trail</label>
                <input type="color" id="trailColor" value="#ff9a76">
            </div>
        </div>
        <div class="buttons">
            <button id="playBtn" title="Play/Pause"><span id="playIcon">▶</span></button>
            <button id="resetBtn" title="Reset">↻</button>
            <button id="clearTrailBtn" title="Clear Trails">✖</button>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('pendulumCanvas');
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            const origin = { x: width / 2, y: height / 3 };

            // Parameters
            let gravity = 0.8;
            let length1 = 80;
            let length2 = 80;
            let mass1 = 10;
            let mass2 = 10;
            
            let angle1 = Math.PI / 2;
            let angle2 = Math.PI / 3;
            let angle1Velocity = 0;
            let angle2Velocity = 0;
            let angle1Acceleration = 0;
            let angle2Acceleration = 0;

            let trailPoints = [];
            let trailColor = "#ff9a76";
            let isPlaying = true;
            
            // DOM elements
            const gravitySlider = document.getElementById('gravity');
            const length1Slider = document.getElementById('length1');
            const length2Slider = document.getElementById('length2');
            const mass1Slider = document.getElementById('mass1');
            const mass2Slider = document.getElementById('mass2');
            const trailColorInput = document.getElementById('trailColor');
            const playBtn = document.getElementById('playBtn');
            const playIcon = document.getElementById('playIcon');
            const resetBtn = document.getElementById('resetBtn');
            const clearTrailBtn = document.getElementById('clearTrailBtn');

            // Set initial values from sliders
            gravity = parseFloat(gravitySlider.value);
            length1 = parseFloat(length1Slider.value);
            length2 = parseFloat(length2Slider.value);
            mass1 = parseFloat(mass1Slider.value);
            mass2 = parseFloat(mass2Slider.value);
            trailColor = trailColorInput.value;

            // Event listeners
            gravitySlider.addEventListener('input', () => gravity = parseFloat(gravitySlider.value));
            length1Slider.addEventListener('input', () => length1 = parseFloat(length1Slider.value));
            length2Slider.addEventListener('input', () => length2 = parseFloat(length2Slider.value));
            mass1Slider.addEventListener('input', () => mass1 = parseFloat(mass1Slider.value));
            mass2Slider.addEventListener('input', () => mass2 = parseFloat(mass2Slider.value));
            trailColorInput.addEventListener('input', () => trailColor = trailColorInput.value);
            
            playBtn.addEventListener('click', () => {
                isPlaying = !isPlaying;
                playIcon.textContent = isPlaying ? '❚❚' : '▶';
            });
            
            resetBtn.addEventListener('click', () => {
                angle1 = Math.PI / 2;
                angle2 = Math.PI / 3;
                angle1Velocity = 0;
                angle2Velocity = 0;
                trailPoints = [];
            });
            
            clearTrailBtn.addEventListener('click', () => {
                trailPoints = [];
            });

            // Mouse interaction for pendulum
            let isDragging = false;
            let draggedPendulum = 0; // 0: none, 1: first, 2: second

            canvas.addEventListener('mousedown', (e) => {
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // Calculate positions of pendulum bobs
                const pos1 = {
                    x: origin.x + length1 * Math.sin(angle1),
                    y: origin.y + length1 * Math.cos(angle1)
                };
                
                const pos2 = {
                    x: pos1.x + length2 * Math.sin(angle2),
                    y: pos1.y + length2 * Math.cos(angle2)
                };
                
                // Check if mouse is near either bob
                const dist1 = Math.sqrt((mouseX - pos1.x) ** 2 + (mouseY - pos1.y) ** 2);
                const dist2 = Math.sqrt((mouseX - pos2.x) ** 2 + (mouseY - pos2.y) ** 2);
                
                if (dist2 <= mass2) {
                    isDragging = true;
                    draggedPendulum = 2;
                    isPlaying = false;
                    playIcon.textContent = '▶';
                } else if (dist1 <= mass1) {
                    isDragging = true;
                    draggedPendulum = 1;
                    isPlaying = false;
                    playIcon.textContent = '▶';
                }
            });

            canvas.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                if (draggedPendulum === 1) {
                    // Update angle1 based on mouse position relative to origin
                    angle1 = Math.atan2(mouseX - origin.x, mouseY - origin.y);
                    angle1Velocity = 0;
                } else if (draggedPendulum === 2) {
                    // Calculate first pendulum position
                    const pos1 = {
                        x: origin.x + length1 * Math.sin(angle1),
                        y: origin.y + length1 * Math.cos(angle1)
                    };
                    
                    // Update angle2 based on mouse position relative to first pendulum
                    angle2 = Math.atan2(mouseX - pos1.x, mouseY - pos1.y);
                    angle2Velocity = 0;
                }
            });

            canvas.addEventListener('mouseup', () => {
                isDragging = false;
                draggedPendulum = 0;
            });

            canvas.addEventListener('mouseleave', () => {
                isDragging = false;
                draggedPendulum = 0;
            });

            function calculatePositions() {
                // Calculate positions of pendulum bobs
                const x1 = origin.x + length1 * Math.sin(angle1);
                const y1 = origin.y + length1 * Math.cos(angle1);
                
                const x2 = x1 + length2 * Math.sin(angle2);
                const y2 = y1 + length2 * Math.cos(angle2);
                
                return { x1, y1, x2, y2 };
            }

            function calculateAccelerations() {
                const num1 = -gravity * (2 * mass1 + mass2) * Math.sin(angle1);
                const num2 = -mass2 * gravity * Math.sin(angle1 - 2 * angle2);
                const num3 = -2 * Math.sin(angle1 - angle2) * mass2;
                const num4 = angle2Velocity * angle2Velocity * length2 + angle1Velocity * angle1Velocity * length1 * Math.cos(angle1 - angle2);
                const den = length1 * (2 * mass1 + mass2 - mass2 * Math.cos(2 * angle1 - 2 * angle2));
                angle1Acceleration = (num1 + num2 + num3 * num4) / den;

                const num5 = 2 * Math.sin(angle1 - angle2);
                const num6 = angle1Velocity * angle1Velocity * length1 * (mass1 + mass2);
                const num7 = gravity * (mass1 + mass2) * Math.cos(angle1);
                const num8 = angle2Velocity * angle2Velocity * length2 * mass2 * Math.cos(angle1 - angle2);
                const den2 = length2 * (2 * mass1 + mass2 - mass2 * Math.cos(2 * angle1 - 2 * angle2));
                angle2Acceleration = num5 * (num6 + num7 + num8) / den2;
            }

            function drawPendulum() {
                ctx.clearRect(0, 0, width, height);
                
                // Draw trail
                ctx.beginPath();
                for (let i = 0; i < trailPoints.length; i++) {
                    const alpha = i / trailPoints.length * 0.8;
                    ctx.fillStyle = \`\${trailColor}\${Math.floor(alpha * 255).toString(16).padStart(2, '0')}\`;
                    ctx.fillRect(trailPoints[i].x, trailPoints[i].y, 2, 2);
                }
                
                const positions = calculatePositions();
                const { x1, y1, x2, y2 } = positions;
                
                // Add to trail
                if (isPlaying && trailPoints.length < 1000) {
                    trailPoints.push({ x: x2, y: y2 });
                } else if (trailPoints.length >= 1000) {
                    trailPoints.shift();
                    trailPoints.push({ x: x2, y: y2 });
                }
                
                // Draw rods
                ctx.strokeStyle = "#666";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(origin.x, origin.y);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                
                // Draw pivot point
                ctx.fillStyle = "#4a86e8";
                ctx.beginPath();
                ctx.arc(origin.x, origin.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Draw joint
                ctx.fillStyle = "#4a86e8";
                ctx.beginPath();
                ctx.arc(x1, y1, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Draw pendulum bobs
                ctx.fillStyle = "#4a86e8";
                ctx.beginPath();
                ctx.arc(x1, y1, mass1, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = "#4a86e8";
                ctx.beginPath();
                ctx.arc(x2, y2, mass2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            function update() {
                if (isPlaying) {
                    calculateAccelerations();
                    
                    angle1Velocity += angle1Acceleration;
                    angle2Velocity += angle2Acceleration;
                    angle1 += angle1Velocity;
                    angle2 += angle2Velocity;
                    
                    // Add damping
                    angle1Velocity *= 0.9995;
                    angle2Velocity *= 0.9995;
                }
                
                drawPendulum();
                requestAnimationFrame(update);
            }
            
            update();
        });
    </script>
</body>
</html>



\`\`\``
