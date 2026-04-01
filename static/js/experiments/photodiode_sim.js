document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("photodiodeCanvas");
    const voltageSlider = document.getElementById("voltageSlider");
    const distanceSlider = document.getElementById("distanceSlider");
    const voltageSliderValue = document.getElementById("voltageSliderValue");
    const distanceSliderValue = document.getElementById("distanceSliderValue");
    const liveVoltage = document.getElementById("liveVoltage");
    const liveDistance = document.getElementById("liveDistance");
    const liveIntensity = document.getElementById("liveIntensity");
    const liveCurrentIV = document.getElementById("liveCurrentIV");
    const liveCurrentLux = document.getElementById("liveCurrentLux");
    const resetIvBtn = document.getElementById("resetIvBtn");
    const resetLuxBtn = document.getElementById("resetLuxBtn");
    const modeResistanceBtn = document.getElementById("modeResistanceBtn");
    const modeResponsivityBtn = document.getElementById("modeResponsivityBtn");
    const interactiveModeLabel = document.getElementById("interactiveModeLabel");
    const ivControlCard = document.getElementById("ivControlCard");
    const luxControlCard = document.getElementById("luxControlCard");
    const fixedDistanceLabel = document.getElementById("fixedDistanceLabel");
    const fixedVoltageLabel = document.getElementById("fixedVoltageLabel");

    const tableNodes = document.querySelectorAll(".experiment-section .observation-table");
    const reverseTable = tableNodes[0] || null;
    const responsivityTable = tableNodes[1] || null;

    const K2 = 1000;
    const K3 = 0.02;
    const IV_FIXED_DISTANCE = 2.0;
    const LUX_FIXED_VOLTAGE = 5.0;
    const DEFAULT_VOLTAGE = 1.0;
    const DEFAULT_DISTANCE = 2.0;

    const stateIV = {
        voltage: DEFAULT_VOLTAGE,
        current: 0,
        dataPoints: []
    };

    const stateLux = {
        distance: DEFAULT_DISTANCE,
        lux: 0,
        current: 0,
        dataPoints: []
    };

    function toNumber(value) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : NaN;
    }

    function normalizeStepValue(value) {
        if (!Number.isFinite(value)) {
            return NaN;
        }
        return Number(parseFloat(value).toFixed(1));
    }

    function roundTo2(value) {
        return Number.isFinite(value) ? Number(value.toFixed(2)) : NaN;
    }

    function formatValue(value, digits) {
        return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
    }

    function computeLux(distance) {
        if (!Number.isFinite(distance) || distance <= 0) {
            return 0;
        }
        return K2 / (distance * distance);
    }

    function computeCurrentIV(voltage) {
        const validVoltage = Math.max(0, voltage);
        const linearSlope = 6.5; // µA/V in the linear region
        const transitionVoltage = 0.5;
        const saturationCurrent = 5.5; // µA saturation target
        const saturationRate = 1.2;

        let current;
        if (validVoltage <= transitionVoltage) {
            // Strong near-ideal linear response before saturation onset.
            current = linearSlope * validVoltage;
        } else {
            // Smooth exponential approach to saturation with no jump at 0.5 V.
            const currentAtTransition = linearSlope * transitionVoltage;
            current = currentAtTransition +
                (saturationCurrent - currentAtTransition) *
                (1 - Math.exp(-saturationRate * (validVoltage - transitionVoltage)));
        }

        const noise = (Math.random() * 0.1) - 0.05;
        const noisyCurrent = Math.max(0, current + noise);
        return roundTo2(noisyCurrent);
    }

    function computeCurrentLux(lux) {
        return roundTo2(K3 * Math.max(0, lux));
    }

    function pushOrUpdatePoint(points, x, y) {
        const key = normalizeStepValue(x);
        const idx = points.findIndex((p) => normalizeStepValue(p.x) === key);
        if (idx >= 0) {
            points[idx] = { x: key, y };
        } else {
            points.push({ x: key, y });
            points.sort((a, b) => a.x - b.x);
        }
    }

    function getFirstCellValue(row) {
        const firstCell = row.querySelector("td");
        if (!firstCell) {
            return NaN;
        }
        const value = toNumber(firstCell.textContent);
        return Number.isFinite(value) ? normalizeStepValue(value) : NaN;
    }

    function updateReverseTable(voltage, currentMicroamp) {
        if (!reverseTable) {
            console.log("ERROR: reverseTable not found");
            return;
        }

        const targetVoltage = normalizeStepValue(voltage);
        console.log("updateReverseTable - targetVoltage:", targetVoltage, "currentMicroamp:", currentMicroamp);
        const rows = reverseTable.querySelectorAll("tr");
        console.log("Total rows in table:", rows.length);

        rows.forEach((row, idx) => {
            const rowVoltage = getFirstCellValue(row);
            if (!Number.isFinite(rowVoltage)) {
                return;
            }

            console.log("Row", idx, "- rowVoltage:", rowVoltage);
            if (rowVoltage === targetVoltage) {
                const input = row.querySelector("input");
                if (input) {
                    console.log("Found matching row! Setting input value to:", formatValue(currentMicroamp, 2));
                    input.value = formatValue(currentMicroamp, 2);
                }
            }
        });
    }

    function updateResponsivityTable(distance, lux, currentMicroamp) {
        if (!responsivityTable) {
            console.log("ERROR: responsivityTable not found");
            return;
        }

        const targetDistance = normalizeStepValue(distance);
        console.log("updateResponsivityTable - targetDistance:", targetDistance, "currentMicroamp:", currentMicroamp, "lux:", lux);
        const rows = responsivityTable.querySelectorAll("tr");
        console.log("Total rows in responsivity table:", rows.length);

        rows.forEach((row, idx) => {
            const rowDistance = getFirstCellValue(row);
            if (!Number.isFinite(rowDistance)) {
                return;
            }

            console.log("Row", idx, "- rowDistance:", rowDistance);
            if (rowDistance === targetDistance) {
                const inputs = row.querySelectorAll("input");
                console.log("Found matching row! Found", inputs.length, "inputs");
                if (inputs[0]) {
                    console.log("Setting current input to:", formatValue(currentMicroamp, 2));
                    inputs[0].value = formatValue(currentMicroamp, 2);
                }
                if (inputs[1]) {
                    console.log("Setting lux input to:", formatValue(lux, 2));
                    inputs[1].value = formatValue(lux, 2);
                }
            }
        });
    }

    function updateIVUI() {
        if (voltageSliderValue) {
            voltageSliderValue.textContent = formatValue(stateIV.voltage, 1);
        }
        if (liveVoltage) {
            liveVoltage.textContent = formatValue(stateIV.voltage, 1);
        }
        if (liveCurrentIV) {
            liveCurrentIV.textContent = formatValue(stateIV.current, 2);
        }

        // Tabular constant for responsivity section: fixed voltage.
        if (fixedVoltageLabel) {
            fixedVoltageLabel.textContent = formatValue(stateIV.voltage, 1);
        }
    }

    function updateLuxUI() {
        if (distanceSliderValue) {
            distanceSliderValue.textContent = formatValue(stateLux.distance, 1);
        }
        if (liveDistance) {
            liveDistance.textContent = formatValue(stateLux.distance, 1);
        }
        if (liveIntensity) {
            liveIntensity.textContent = formatValue(stateLux.lux, 2);
        }
        if (liveCurrentLux) {
            liveCurrentLux.textContent = formatValue(stateLux.current, 2);
        }

        // Tabular constant for I-V section: fixed distance.
        if (fixedDistanceLabel) {
            fixedDistanceLabel.textContent = formatValue(stateLux.distance, 1);
        }
    }

    function updateIVSimulation() {
        const sliderVoltage = normalizeStepValue(toNumber(voltageSlider ? voltageSlider.value : ""));
        if (!Number.isFinite(sliderVoltage)) {
            return;
        }

        stateIV.voltage = sliderVoltage;
        stateIV.current = computeCurrentIV(stateIV.voltage);
        pushOrUpdatePoint(stateIV.dataPoints, stateIV.voltage, stateIV.current);

        updateIVUI();
        updateReverseTable(stateIV.voltage, stateIV.current);
    }

    function updateLuxSimulation() {
        const sliderDistance = normalizeStepValue(toNumber(distanceSlider ? distanceSlider.value : ""));
        if (!Number.isFinite(sliderDistance)) {
            return;
        }

        stateLux.distance = sliderDistance;
        stateLux.lux = roundTo2(computeLux(stateLux.distance));
        stateLux.current = computeCurrentLux(stateLux.lux);
        pushOrUpdatePoint(stateLux.dataPoints, stateLux.distance, stateLux.current);

        updateLuxUI();
        updateResponsivityTable(stateLux.distance, stateLux.lux, stateLux.current);
    }

    function clearReverseTableInputs() {
        if (!reverseTable) {
            return;
        }
        const inputs = reverseTable.querySelectorAll("tr td input");
        inputs.forEach((input) => {
            input.value = "";
        });
    }

    function clearResponsivityTableInputs() {
        if (!responsivityTable) {
            return;
        }
        const inputs = responsivityTable.querySelectorAll("tr td input");
        inputs.forEach((input) => {
            input.value = "";
        });
    }

    function clearGraphForIV() {
        const graphCanvas = document.getElementById("voltageGraphCanvas");
        if (graphCanvas) {
            const graphCtx = graphCanvas.getContext("2d");
            if (graphCtx) {
                graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
            }
        }

        const ivOutputIds = [
            "slopeVoltageNumeric",
            "equationVoltage",
            "resistanceGraphOutput",
            "resistanceDirectOutput"
        ];

        ivOutputIds.forEach((id) => {
            const node = document.getElementById(id);
            if (node) {
                node.textContent = "-";
            }
        });
    }

    function clearGraphForLux() {
        const graphCanvas = document.getElementById("intensityGraphCanvas");
        if (graphCanvas) {
            const graphCtx = graphCanvas.getContext("2d");
            if (graphCtx) {
                graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
            }
        }

        const luxOutputIds = [
            "slopeIntensityNumeric",
            "equationIntensity",
            "responsivityGraphOutput",
            "responsivityDirectOutput"
        ];

        luxOutputIds.forEach((id) => {
            const node = document.getElementById(id);
            if (node) {
                node.textContent = "-";
            }
        });
    }

    function resetIVSection() {
        stateIV.voltage = DEFAULT_VOLTAGE;
        stateIV.current = 0;
        stateIV.dataPoints = [];

        if (voltageSlider) {
            voltageSlider.value = formatValue(DEFAULT_VOLTAGE, 1);
        }

        clearReverseTableInputs();
        clearGraphForIV();
        updateIVSimulation();
    }

    function resetLuxSection() {
        stateLux.distance = DEFAULT_DISTANCE;
        stateLux.lux = 0;
        stateLux.current = 0;
        stateLux.dataPoints = [];

        if (distanceSlider) {
            distanceSlider.value = formatValue(DEFAULT_DISTANCE, 1);
        }

        clearResponsivityTableInputs();
        clearGraphForLux();
        updateLuxSimulation();
    }

    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const designWidth = 1120;
    const designHeight = 420;
    const sceneScale = Math.min(width / designWidth, height / designHeight);
    const sceneOffsetX = (width - designWidth * sceneScale) / 2;
    const sceneOffsetY = (height - designHeight * sceneScale) / 2;
    const topY = 75;
    const bottomY = 330;
    const leftBusX = 40;
    const rightBusX = 1020;
    
    // Restored balanced layout with LED placed to the right of photodiode
    const psu = { x: 50, y: 140, w: 130, h: 120 };
    const resistorUnit = { x: 210, y: 65, w: 150, h: 80 };
    const ammeterUnit = { x: 410, y: 55, w: 160, h: 105 };
    const photodiodeUnit = { x: 620, y: 115, w: 150, h: 120 };
    const voltmeterUnit = { x: 840, y: 230, w: 140, h: 100 };
    const lightSourceX = 820;  // LED moved to right of photodiode
    const lightSourceY = 95;   // Slightly above photodiode center
    const psuPlus = { x: psu.x + psu.w, y: psu.y + 36 };
    const psuMinus = { x: psu.x + psu.w, y: psu.y + psu.h - 36 };
    const resistorLeft = { x: resistorUnit.x, y: resistorUnit.y + resistorUnit.h / 2 };
    const resistorRight = { x: resistorUnit.x + resistorUnit.w, y: resistorUnit.y + resistorUnit.h / 2 };
    const ammeterLeft = { x: ammeterUnit.x, y: ammeterUnit.y + ammeterUnit.h / 2 };
    const ammeterRight = { x: ammeterUnit.x + ammeterUnit.w, y: ammeterUnit.y + ammeterUnit.h / 2 };
    const voltmeterTop = { x: voltmeterUnit.x + voltmeterUnit.w, y: voltmeterUnit.y + 20 };
    const voltmeterBottom = { x: voltmeterUnit.x + voltmeterUnit.w, y: voltmeterUnit.y + voltmeterUnit.h - 20 };
    const diodeTop = { x: photodiodeUnit.x + photodiodeUnit.w, y: photodiodeUnit.y + 22 };
    const diodeBottom = { x: photodiodeUnit.x + photodiodeUnit.w, y: photodiodeUnit.y + photodiodeUnit.h - 22 };
    let lightPhase = 0;
    let currentPhase = 0;
    let ammeterNeedleNorm = 0;
    let voltmeterNeedleNorm = 0;
    let pulsePhase = 0;
    let simulationMode = "resistance";

    const currentLoopPath = [
        { x: leftBusX, y: bottomY },
        { x: rightBusX, y: bottomY },
        { x: rightBusX, y: topY },
        { x: leftBusX, y: topY },
        { x: leftBusX, y: bottomY }
    ];

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function drawLine(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    function lerp(start, end, t) {
        return start + (end - start) * t;
    }

    function roundedRect(x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    function getActiveSimulationState() {
        if (simulationMode === "responsivity") {
            return {
                label: "Responsivity Phase",
                constantText: "Voltage fixed at 5.0 V",
                voltage: LUX_FIXED_VOLTAGE,
                current: stateLux.current,
                intensityLux: stateLux.lux
            };
        }

        return {
            label: "Resistance Phase",
            constantText: "Distance fixed at 2.0 cm",
            voltage: stateIV.voltage,
            current: stateIV.current,
            intensityLux: computeLux(IV_FIXED_DISTANCE)
        };
    }

    function getPathLength(path) {
        let length = 0;
        for (let i = 0; i < path.length - 1; i += 1) {
            const a = path[i];
            const b = path[i + 1];
            length += Math.hypot(b.x - a.x, b.y - a.y);
        }
        return length;
    }

    function getPointOnPath(path, distance) {
        let remaining = distance;
        for (let i = 0; i < path.length - 1; i += 1) {
            const a = path[i];
            const b = path[i + 1];
            const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
            if (remaining <= segmentLength) {
                const t = segmentLength === 0 ? 0 : remaining / segmentLength;
                return {
                    x: lerp(a.x, b.x, t),
                    y: lerp(a.y, b.y, t)
                };
            }
            remaining -= segmentLength;
        }
        return path[path.length - 1];
    }

    function updateInteractiveModeUI() {
        const isResistance = simulationMode === "resistance";
        if (interactiveModeLabel) {
            interactiveModeLabel.textContent = isResistance ? "Resistance (I vs V)" : "Responsivity (I vs Lux)";
        }

        if (modeResistanceBtn && modeResponsivityBtn) {
            modeResistanceBtn.className = isResistance ? "btn btn-primary" : "btn btn-secondary";
            modeResponsivityBtn.className = isResistance ? "btn btn-secondary" : "btn btn-primary";
        }

        if (voltageSlider) {
            voltageSlider.disabled = !isResistance;
        }
        if (distanceSlider) {
            distanceSlider.disabled = isResistance;
        }

        if (ivControlCard) {
            ivControlCard.style.opacity = isResistance ? "1" : "0.6";
            ivControlCard.style.borderColor = isResistance ? "#6ea6da" : "#dfe7f0";
            ivControlCard.style.boxShadow = isResistance ? "0 2px 10px rgba(58,108,163,0.18)" : "none";
        }

        if (luxControlCard) {
            luxControlCard.style.opacity = isResistance ? "0.6" : "1";
            luxControlCard.style.borderColor = isResistance ? "#dfe7f0" : "#6ea6da";
            luxControlCard.style.boxShadow = isResistance ? "none" : "0 2px 10px rgba(58,108,163,0.18)";
        }
    }

    function setSimulationMode(mode) {
        simulationMode = mode === "responsivity" ? "responsivity" : "resistance";
        updateInteractiveModeUI();
    }

    function drawBackground() {
        // Rich wooden lab table background
        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, "#b8956a");
        bg.addColorStop(0.5, "#a0845d");
        bg.addColorStop(1, "#8b7355");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // Wood grain texture pattern
        ctx.strokeStyle = "rgba(60, 30, 10, 0.08)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 32) {
            const offset = Math.sin(x * 0.005) * 3;
            drawLine(x + offset, 0, x + offset + height * 0.15, height);
        }

        // Cross grain for depth
        ctx.strokeStyle = "rgba(70, 40, 15, 0.06)";
        ctx.lineWidth = 0.8;
        for (let y = 0; y < height; y += 28) {
            drawLine(0, y, width, y + Math.sin(y * 0.008) * 2);
        }

        // Enhanced wood knots/marks
        ctx.fillStyle = "rgba(50, 25, 5, 0.05)";
        const knotPositions = [
            { x: 0.15, y: 0.3 }, { x: 0.35, y: 0.6 }, { x: 0.62, y: 0.25 },
            { x: 0.78, y: 0.65 }, { x: 0.48, y: 0.8 }, { x: 0.82, y: 0.4 }
        ];
        knotPositions.forEach(pos => {
            ctx.beginPath();
            ctx.arc(width * pos.x, height * pos.y, 15 + Math.random() * 8, 0, Math.PI * 2);
            ctx.fill();
        });

        // Vignette for depth
        const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.12, width / 2, height / 2, width * 0.7);
        vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
        vignette.addColorStop(1, "rgba(20, 10, 0, 0.32)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);

        // Table surface padding/frame
        const tablePad = 20;
        roundedRect(tablePad, tablePad, width - tablePad * 2, height - tablePad * 2, 16);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Subtle inner shadow for table edge
        ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
        ctx.lineWidth = 1;
        roundedRect(tablePad + 1.5, tablePad + 1.5, width - tablePad * 2 - 3, height - tablePad * 2 - 3, 15);
        ctx.stroke();
    }

    function drawComponentShadow(x, y, w, h) {
        // Drop shadow for component depth on lab table
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;
        roundedRect(x, y, w, h, 10);
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fill();
        ctx.restore();
    }

    function drawModeBanner(activeState) {
        // Left banner - Mode info
        roundedRect(15, 10, 280, 45, 8);
        ctx.fillStyle = "rgba(25, 60, 100, 0.92)";
        ctx.fill();
        ctx.strokeStyle = "rgba(100, 150, 200, 0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#e8f0f8";
        ctx.textAlign = "left";
        ctx.font = "700 12px Segoe UI";
        ctx.fillText(activeState.label, 28, 28);
        
        ctx.fillStyle = "#b8d8f0";
        ctx.font = "500 11px Segoe UI";
        ctx.fillText(activeState.constantText, 28, 41);

        // Right info panel - Values
        roundedRect(820, 10, 280, 45, 8);
        ctx.fillStyle = "rgba(25, 60, 100, 0.92)";
        ctx.fill();
        ctx.strokeStyle = "rgba(100, 150, 200, 0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#e8f0f8";
        ctx.textAlign = "left";
        ctx.font = "700 12px Segoe UI";
        ctx.fillText("V: " + activeState.voltage.toFixed(2) + " V", 835, 28);
        
        ctx.fillStyle = "#ffd700";
        ctx.font = "700 12px Segoe UI";
        ctx.fillText("I: " + activeState.current.toFixed(2) + " µA", 910, 28);
        
        ctx.fillStyle = "#b8d8f0";
        ctx.font = "500 10px Segoe UI";
        ctx.fillText("Live Values", 835, 42);
    }

    function drawTerminal(x, y, color) {
        ctx.beginPath();
        ctx.arc(x, y, 6.6, 0, Math.PI * 2);
        ctx.fillStyle = "#1a1f26";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#10151a";
        ctx.lineWidth = 0.9;
        ctx.stroke();
    }

    function drawDeviceBox(x, y, w, h, title, valueText) {
        ctx.save();
        
        // Prominent shadow under component for depth
        ctx.shadowColor = "rgba(8, 12, 18, 0.5)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        
        roundedRect(x, y, w, h, 10);
        const body = ctx.createLinearGradient(x, y, x + w, y + h);
        body.addColorStop(0, "#384551");
        body.addColorStop(0.55, "#2d3743");
        body.addColorStop(1, "#1f2730");
        ctx.fillStyle = body;
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = "#111820";
        ctx.lineWidth = 1.6;
        roundedRect(x, y, w, h, 10);
        ctx.stroke();

        // Top highlight to create a beveled instrument body.
        ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
        ctx.lineWidth = 1;
        drawLine(x + 10, y + 7, x + w - 10, y + 7);

        roundedRect(x + 12, y + 16, w - 24, h - 32, 7);
        const screen = ctx.createLinearGradient(x + 12, y + 16, x + 12, y + h - 16);
        screen.addColorStop(0, "#e5eadf");
        screen.addColorStop(1, "#c2ccb8");
        ctx.fillStyle = screen;
        ctx.fill();
        ctx.strokeStyle = "rgba(20, 24, 20, 0.5)";
        ctx.stroke();

        ctx.fillStyle = "#e7edf5";
        ctx.textAlign = "center";
        ctx.font = "600 11px Segoe UI";
        ctx.fillText(title, x + w / 2, y + 12);

        ctx.fillStyle = "#1c3320";
        ctx.font = "600 14px Consolas";
        ctx.fillText(valueText, x + w / 2, y + h / 2 + 6);

        // Metallic feet for bench realism.
        ctx.fillStyle = "rgba(22, 32, 42, 0.7)";
        ctx.fillRect(x + 12, y + h - 2, 12, 3);
        ctx.fillRect(x + w - 24, y + h - 2, 12, 3);
    }

    function drawCable(points, baseColor, glowColor) {
        if (points.length < 2) {
            return;
        }

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = "rgba(10, 14, 19, 0.9)";
        ctx.lineWidth = 5.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 3.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y - 0.5);
        for (let i = 1; i < points.length; i += 1) {
            ctx.lineTo(points[i].x, points[i].y - 0.5);
        }
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }

    function drawPowerSupply(active) {
        // Draw shadow first for depth
        drawComponentShadow(psu.x, psu.y, psu.w, psu.h);
        
        // Main body
        roundedRect(psu.x, psu.y, psu.w, psu.h, 8);
        const bodyGrad = ctx.createLinearGradient(psu.x, psu.y, psu.x + psu.w, psu.y + psu.h);
        bodyGrad.addColorStop(0, "#3d4248");
        bodyGrad.addColorStop(0.5, "#2a2f35");
        bodyGrad.addColorStop(1, "#1b1f25");
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 2;
        roundedRect(psu.x, psu.y, psu.w, psu.h, 8);
        ctx.stroke();

        // Title
        ctx.fillStyle = "#ddd";
        ctx.font = "700 10px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText("PWR SUPPLY", psu.x + psu.w / 2, psu.y + 14);

        // Display panel - cleaner design
        const displayX = psu.x + 12;
        const displayY = psu.y + 24;
        const displayW = psu.w - 24;
        const displayH = 30;
        
        roundedRect(displayX, displayY, displayW, displayH, 3);
        ctx.fillStyle = "#f0f0f0";
        ctx.fill();
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Display value only
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "700 14px Courier New";
        ctx.textAlign = "center";
        ctx.fillText(active.voltage.toFixed(2) + "V", displayX + displayW / 2, displayY + 20);

        // Specs below
        ctx.fillStyle = "#888";
        ctx.font = "500 8px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText("0-5V / 2A", psu.x + psu.w / 2, psu.y + psu.h - 14);

        // Plus/Minus symbols - clean positioning
        ctx.fillStyle = "#e8f1fb";
        ctx.textAlign = "left";
        ctx.font = "700 12px Georgia";
        ctx.fillText("+", psu.x + 14, psu.y + 66);
        ctx.fillText("−", psu.x + 14, psu.y + 104);

        // Color-coded terminal points
        drawTerminal(psuPlus.x, psuPlus.y, "#e46f6f");
        drawTerminal(psuMinus.x, psuMinus.y, "#6fa2e4");
    }

    function drawResistorUnit() {
        // Draw shadow first for depth
        drawComponentShadow(resistorUnit.x, resistorUnit.y, resistorUnit.w, resistorUnit.h);
        
        // Outer body
        roundedRect(resistorUnit.x, resistorUnit.y, resistorUnit.w, resistorUnit.h, 8);
        const bodybg = ctx.createLinearGradient(resistorUnit.x, resistorUnit.y, resistorUnit.x + resistorUnit.w, resistorUnit.y + resistorUnit.h);
        bodybg.addColorStop(0, "#3d4248");
        bodybg.addColorStop(0.5, "#2a2f35");
        bodybg.addColorStop(1, "#1b1f25");
        ctx.fillStyle = bodybg;
        ctx.fill();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 2;
        roundedRect(resistorUnit.x, resistorUnit.y, resistorUnit.w, resistorUnit.h, 8);
        ctx.stroke();

        // Title
        ctx.fillStyle = "#ddd";
        ctx.textAlign = "center";
        ctx.font = "700 10px Segoe UI";
        ctx.fillText("RESISTOR", resistorUnit.x + resistorUnit.w / 2, resistorUnit.y + 13);

        const centerY = resistorUnit.y + 50;

        // Real resistor component with color bands
        const componentX = resistorUnit.x + resistorUnit.w / 2 - 25;
        const resistorW = 50;
        const resistorH = 16;
        
        // Main body (tan/beige)
        roundedRect(componentX, centerY - resistorH / 2, resistorW, resistorH, 7);
        const resGrad = ctx.createLinearGradient(componentX, centerY - resistorH / 2, componentX, centerY + resistorH / 2);
        resGrad.addColorStop(0, "#e8bfa0");
        resGrad.addColorStop(1, "#d4a582");
        ctx.fillStyle = resGrad;
        ctx.fill();
        ctx.strokeStyle = "#8b6f47";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Color bands (1kΩ: Brown-Black-Red-Gold)
        const bands = [
            { color: "#8B4513", pos: 0.22 },  // Brown
            { color: "#1a1a1a", pos: 0.38 },  // Black
            { color: "#dc143c", pos: 0.60 },  // Red
            { color: "#FFD700", pos: 0.78 }   // Gold
        ];
        
        bands.forEach(band => {
            const bandX = componentX + resistorW * band.pos;
            ctx.fillStyle = band.color;
            ctx.fillRect(bandX - 1.4, centerY - resistorH / 2, 2.8, resistorH);
        });

        // Connection leads
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 1.2;
        drawLine(resistorUnit.x + 20, centerY, componentX, centerY);
        drawLine(componentX + resistorW, centerY, resistorUnit.x + resistorUnit.w - 20, centerY);

        // Value label
        ctx.fillStyle = "#ffd700";
        ctx.font = "600 10px Consolas";
        ctx.textAlign = "center";
        ctx.fillText("1kΩ", resistorUnit.x + resistorUnit.w / 2, resistorUnit.y + resistorUnit.h - 10);
    }

    function drawNeedleGauge(cx, cy, radius, norm) {
        const angle = (-Math.PI * 0.75) + norm * (Math.PI * 1.5);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#f4f7fb";
        ctx.fill();
        ctx.strokeStyle = "#2a4158";
        ctx.lineWidth = 1.3;
        ctx.stroke();

        ctx.strokeStyle = "#324b66";
        for (let i = 0; i <= 24; i += 1) {
            const a = (-Math.PI * 0.8) + (i / 24) * (Math.PI * 1.6);
            drawLine(cx + Math.cos(a) * (radius - 7), cy + Math.sin(a) * (radius - 7), cx + Math.cos(a) * (radius - 2), cy + Math.sin(a) * (radius - 2));
        }

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * (radius - 8), cy + Math.sin(angle) * (radius - 8));
        ctx.strokeStyle = "#b73333";
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = "#15283d";
        ctx.fill();

        ctx.font = "700 9px Segoe UI";
        ctx.fillStyle = "#1b2f45";
        ctx.textAlign = "center";
        ctx.fillText("0", cx - radius + 7, cy + radius - 4);
        ctx.fillText("8", cx + radius - 7, cy + radius - 4);
    }

    function drawAmmeter(active) {
        const x = ammeterUnit.x;
        const y = ammeterUnit.y;
        const w = ammeterUnit.w;
        const h = ammeterUnit.h;
        const lowerStripH = 24;

        // Draw shadow first for depth
        drawComponentShadow(x, y, w, h);
        
        // ===== OUTER BODY =====
        roundedRect(x, y, w, h, 8);
        const bodyGrad = ctx.createLinearGradient(x, y, x + w, y + h);
        bodyGrad.addColorStop(0, "#3d4248");
        bodyGrad.addColorStop(0.5, "#2a2f35");
        bodyGrad.addColorStop(1, "#1b1f25");
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        
        // Outer frame highlight
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 2.2;
        roundedRect(x, y, w, h, 8);
        ctx.stroke();

        const dialPad = 9;
        const dialX = x + dialPad;
        const dialY = y + dialPad;
        const dialW = w - dialPad * 2;
        const dialH = h - lowerStripH - dialPad - 5;

        // ===== DIAL BACKGROUND (WHITE) =====
        roundedRect(dialX, dialY, dialW, dialH, 3);
        ctx.fillStyle = "#fafafa";
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // ===== METER TITLE =====
        ctx.textAlign = "center";
        ctx.fillStyle = "#222";
        ctx.font = "700 9px Segoe UI";
        ctx.fillText("MICROAMMETER", x + w / 2, y + 15);

        // ===== SEMICIRCULAR DIAL WITH TICKS AND LABELS =====
        ctx.save();
        roundedRect(dialX, dialY, dialW, dialH, 3);
        ctx.clip();

        const cx = x + w / 2;
        const cy = dialY + dialH + 16;
        const rOuter = Math.min(dialW * 0.48, dialH * 1.05);
        const startAngle = Math.PI;
        const endAngle = 0;
        const maxValue = 50;  // 0-50 µA scale

        // Draw semicircle background
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter, startAngle, endAngle);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fillStyle = "#f5f7f9";
        ctx.fill();

        // Draw minor ticks (every 2 µA)
        ctx.strokeStyle = "rgba(100, 100, 100, 0.6)";
        ctx.lineWidth = 0.8;
        for (let i = 0; i <= 25; i += 1) {
            const value = i * 2;
            const t = value / maxValue;
            const angle = startAngle + (endAngle - startAngle) * t;
            const innerR = rOuter - 6;
            const outerR = rOuter - 1;
            drawLine(
                cx + Math.cos(angle) * innerR,
                cy + Math.sin(angle) * innerR,
                cx + Math.cos(angle) * outerR,
                cy + Math.sin(angle) * outerR
            );
        }

        // Draw major ticks (every 10 µA, 0, 10, 20, 30, 40, 50)
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 1.6;
        for (let i = 0; i <= 5; i += 1) {
            const value = i * 10;
            const t = value / maxValue;
            const angle = startAngle + (endAngle - startAngle) * t;
            const innerR = rOuter - 11;
            const outerR = rOuter - 1;
            drawLine(
                cx + Math.cos(angle) * innerR,
                cy + Math.sin(angle) * innerR,
                cx + Math.cos(angle) * outerR,
                cy + Math.sin(angle) * outerR
            );
        }

        // Draw numeric labels (0, 10, 20, 30, 40, 50)
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "600 9px Segoe UI";
        ctx.textAlign = "center";
        const labelValues = [0, 10, 20, 30, 40, 50];
        for (let i = 0; i < labelValues.length; i += 1) {
            const value = labelValues[i];
            const t = value / maxValue;
            const angle = startAngle + (endAngle - startAngle) * t;
            const labelR = rOuter - 23;
            const labelX = cx + Math.cos(angle) * labelR;
            const labelY = cy + Math.sin(angle) * labelR;
            ctx.fillText(String(value), labelX, labelY + 3);
        }

        // Draw unit label "µA"
        ctx.font = "700 11px Segoe UI";
        ctx.fillStyle = "#111";
        ctx.textAlign = "center";
        ctx.fillText("µA", cx, dialY + 21);

        // ===== NEEDLE ANIMATION =====
        // Scale needle position using ammeterNeedleNorm (0 to 1, already smoothly animated)
        const needleValue = ammeterNeedleNorm * maxValue;
        const t = needleValue / maxValue;
        const needleAngle = startAngle + (endAngle - startAngle) * t;
        const needleLen = rOuter - 7;

        // Draw needle with better styling
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(needleAngle - Math.PI / 2);
        
        // Needle body (red)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, needleLen);
        ctx.strokeStyle = "#c41e3a";
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.stroke();

        // Needle tip (darker red)
        ctx.fillStyle = "#8b1428";
        ctx.beginPath();
        ctx.moveTo(-1.2, needleLen - 3);
        ctx.lineTo(1.2, needleLen - 3);
        ctx.lineTo(0, needleLen + 1);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();

        // ===== PIVOT CIRCLE =====
        ctx.beginPath();
        ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = "#222";
        ctx.fill();
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pivot highlight
        ctx.beginPath();
        ctx.arc(cx - 1.2, cy - 1, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fill();

        // ===== GLASS EFFECT OVERLAY =====
        // Subtle gradient overlay for glass appearance
        const glassGradient = ctx.createLinearGradient(dialX, dialY, dialX, dialY + dialH);
        glassGradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
        glassGradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
        glassGradient.addColorStop(1, "rgba(0, 0, 0, 0.08)");
        ctx.fillStyle = glassGradient;
        roundedRect(dialX, dialY, dialW, dialH, 3);
        ctx.fill();

        // ===== REFLECTION ARC =====
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy - 5, rOuter * 0.85, Math.PI * 0.75, Math.PI * 0.25, true);
        ctx.stroke();

        ctx.restore();

        // ===== LOWER TERMINAL STRIP =====
        roundedRect(x + dialPad, y + h - lowerStripH - 3, w - dialPad * 2, lowerStripH, 2);
        const stripGrad = ctx.createLinearGradient(x, y + h - lowerStripH - 3, x, y + h);
        stripGrad.addColorStop(0, "#c0c4ca");
        stripGrad.addColorStop(1, "#a8adb3");
        ctx.fillStyle = stripGrad;
        ctx.fill();
        ctx.strokeStyle = "#7a8189";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Terminal symbols and jacks
        const stripY = y + h - lowerStripH + 11;
        ctx.textAlign = "left";
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "700 16px Segoe UI";
        ctx.fillText("−", x + 16, stripY);
        ctx.fillText("+", x + w - 24, stripY);

        const jackY = y + h - lowerStripH / 2 + 1;
        drawTerminal(x + 38, jackY, "#25a8ff");
        drawTerminal(x + w - 38, jackY, "#ff4141");

        // ===== CURRENT VALUE DISPLAY (drawn last so it stays visible) =====
        ctx.fillStyle = "#243447";
        ctx.font = "700 11px Courier New";
        ctx.textAlign = "center";
        const displayCurrent = Number.isFinite(active.current) ? active.current.toFixed(2) : "0.00";
        ctx.fillText(displayCurrent + " µA", x + w / 2, y + h - 8);

        // Side connection terminals on meter body
        drawTerminal(ammeterLeft.x, ammeterLeft.y, "#25a8ff");
        drawTerminal(ammeterRight.x, ammeterRight.y, "#ff4141");
    }

    function drawVoltmeter(active) {
        // Draw shadow first for depth
        drawComponentShadow(voltmeterUnit.x, voltmeterUnit.y, voltmeterUnit.w, voltmeterUnit.h);
        drawDeviceBox(voltmeterUnit.x, voltmeterUnit.y, voltmeterUnit.w, voltmeterUnit.h, "VOLTMETER", "");

        // Analog dial on left side
        drawNeedleGauge(voltmeterUnit.x + 36, voltmeterUnit.y + voltmeterUnit.h / 2 + 1, 18, voltmeterNeedleNorm);

        // Clean digital readout on right side (no overlap with dial)
        ctx.fillStyle = "#1c3320";
        ctx.font = "700 18px Consolas";
        ctx.textAlign = "left";
        ctx.fillText(active.voltage.toFixed(2), voltmeterUnit.x + 64, voltmeterUnit.y + 58);

        ctx.fillStyle = "#14283b";
        ctx.font = "700 14px Segoe UI";
        ctx.fillText("V", voltmeterUnit.x + 112, voltmeterUnit.y + 58);

        drawTerminal(voltmeterTop.x, voltmeterTop.y, "#e46f6f");
        drawTerminal(voltmeterBottom.x, voltmeterBottom.y, "#6fa2e4");
    }

    function drawPhotodiode(intensityLevel) {
        // Draw shadow first for depth
        drawComponentShadow(photodiodeUnit.x, photodiodeUnit.y, photodiodeUnit.w, photodiodeUnit.h);
        
        // Outer body
        roundedRect(photodiodeUnit.x, photodiodeUnit.y, photodiodeUnit.w, photodiodeUnit.h, 8);
        const bodyGrad = ctx.createLinearGradient(photodiodeUnit.x, photodiodeUnit.y, photodiodeUnit.x + photodiodeUnit.w, photodiodeUnit.y + photodiodeUnit.h);
        bodyGrad.addColorStop(0, "#3d4248");
        bodyGrad.addColorStop(0.5, "#2a2f35");
        bodyGrad.addColorStop(1, "#1b1f25");
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 2;
        roundedRect(photodiodeUnit.x, photodiodeUnit.y, photodiodeUnit.w, photodiodeUnit.h, 8);
        ctx.stroke();

        // Title
        ctx.fillStyle = "#ddd";
        ctx.textAlign = "center";
        ctx.font = "700 10px Segoe UI";
        ctx.fillText("PHOTODIODE", photodiodeUnit.x + photodiodeUnit.w / 2, photodiodeUnit.y + 13);

        // Sensor window
        const sensorX = photodiodeUnit.x + 14;
        const sensorY = photodiodeUnit.y + 28;
        const sensorW = photodiodeUnit.w - 28;
        const sensorH = 58;
        
        roundedRect(sensorX, sensorY, sensorW, sensorH, 5);
        ctx.fillStyle = "#0a0a0a";
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Sensor glass effect with glow based on light intensity
        const glowRadius = 14 + intensityLevel * 20 + Math.sin(pulsePhase) * 2;
        const centerX = sensorX + sensorW / 2;
        const centerY = sensorY + sensorH / 2;
        
        const sensorGlow = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, glowRadius);
        sensorGlow.addColorStop(0, `rgba(100, 200, 255, ${0.12 + intensityLevel * 0.28})`);
        sensorGlow.addColorStop(0.7, `rgba(100, 180, 255, ${0.03 + intensityLevel * 0.1})`);
        sensorGlow.addColorStop(1, "rgba(100, 180, 255, 0)");
        ctx.fillStyle = sensorGlow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Photodiode junction visualization
        ctx.beginPath();
        ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 200, 100, " + (0.25 + intensityLevel * 0.35) + ")";
        ctx.fill();
        ctx.strokeStyle = "rgba(150, 100, 50, 0.7)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // P-N labels - small and clean
        ctx.fillStyle = "#64c8ff";
        ctx.font = "600 8px Segoe UI";
        ctx.fillText("P", centerX - 6, centerY - 12);
        ctx.fillText("N", centerX + 2, centerY + 12);

        // Connection terminals
        drawTerminal(diodeTop.x, diodeTop.y, "#e46f6f");
        drawTerminal(diodeBottom.x, diodeBottom.y, "#6fa2e4");
    }

    function drawLightAnimation(intensityLevel) {
        // Light rays animating from LED to photodiode
        const rayCount = 5;
        const startX = lightSourceX + 18;
        const startY = lightSourceY + 8;
        const endX = photodiodeUnit.x + photodiodeUnit.w / 2;
        const endY = photodiodeUnit.y + photodiodeUnit.h / 2;
        
        // Calculate vector from LED to photodiode
        const dx = endX - startX;
        const dy = endY - startY;
        const totalDist = Math.sqrt(dx * dx + dy * dy);
        
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Draw light rays
        for (let i = 0; i < rayCount; i += 1) {
            const raySpacing = (i - rayCount / 2) * 3;
            const phase = (lightPhase + i * 0.12) % 1;
            const distance = phase * totalDist;
            
            // Current position of light particle
            const currentX = startX + (dx / totalDist) * distance;
            const currentY = startY + (dy / totalDist) * distance + raySpacing;
            
            // Light particle glow
            const particleSize = 1.8 + intensityLevel * 3;
            ctx.beginPath();
            ctx.arc(currentX, currentY, particleSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 160, 80, ${0.6 + intensityLevel * 0.4})`;
            ctx.fill();
            
            // Light trail behind particle
            ctx.strokeStyle = `rgba(255, 180, 100, ${0.25 + intensityLevel * 0.35})`;
            ctx.lineWidth = 1.2 + intensityLevel * 0.5;
            drawLine(startX, startY + raySpacing, currentX, currentY);
        }
        
        // Destination glow at photodiode
        const destGlow = 6 + intensityLevel * 7;
        const glowGrad = ctx.createRadialGradient(endX, endY, 0, endX, endY, destGlow);
        glowGrad.addColorStop(0, `rgba(255, 150, 70, ${0.3 + intensityLevel * 0.35})`);
        glowGrad.addColorStop(1, `rgba(255, 150, 70, 0)`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(endX, endY, destGlow, 0, Math.PI * 2);
        ctx.fill();

        lightPhase += 0.012 + intensityLevel * 0.035;
    }

    function drawCurrentFlow(currentLevel) {
        const loopLength = getPathLength(currentLoopPath);
        const dotCount = 20;
        const spacing = loopLength / dotCount;
        const speed = 0.8 + currentLevel * 4;
        currentPhase = (currentPhase + speed) % loopLength;

        for (let i = 0; i < dotCount; i += 1) {
            const d = (currentPhase + i * spacing) % loopLength;
            const p = getPointOnPath(currentLoopPath, d);
            const alpha = 0.2 + (i / dotCount) * 0.65;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(24, 53, 83, ${alpha})`;
            ctx.fill();
        }
    }

    function drawConnections() {
        // POSITIVE LINE: PSU+ → Resistor → Ammeter → Photodiode
        drawCable(
            [
                { x: psuPlus.x, y: psuPlus.y },
                { x: psuPlus.x + 12, y: psuPlus.y },
                { x: leftBusX, y: topY },
                { x: resistorLeft.x, y: topY },
                { x: resistorRight.x, y: topY },
                { x: ammeterLeft.x, y: topY },
                { x: ammeterRight.x, y: topY },
                { x: rightBusX, y: topY },
                { x: rightBusX, y: diodeTop.y },
                { x: diodeTop.x, y: diodeTop.y }
            ],
            "#1f4770",
            "rgba(118, 176, 230, 0.65)"
        );

        // NEGATIVE LINE: Photodiode → PSU−
        drawCable(
            [
                { x: diodeBottom.x, y: diodeBottom.y },
                { x: rightBusX, y: diodeBottom.y },
                { x: rightBusX, y: bottomY },
                { x: leftBusX, y: bottomY },
                { x: psuMinus.x - 12, y: psuMinus.y },
                { x: psuMinus.x, y: psuMinus.y }
            ],
            "#74353a",
            "rgba(230, 126, 126, 0.65)"
        );
    }

    function drawVoltmeterBranch() {
        // Voltmeter taps in parallel across photodiode
        const tapPosX = rightBusX - 40;
        const tapNegX = rightBusX - 40;
        
        drawCable(
            [
                { x: diodeTop.x - 8, y: diodeTop.y },
                { x: tapPosX, y: diodeTop.y },
                { x: tapPosX, y: voltmeterTop.y },
                { x: voltmeterTop.x, y: voltmeterTop.y }
            ],
            "#1f4770",
            "rgba(118, 176, 230, 0.65)"
        );
        drawCable(
            [
                { x: diodeBottom.x - 8, y: diodeBottom.y },
                { x: tapNegX, y: diodeBottom.y },
                { x: tapNegX, y: voltmeterBottom.y },
                { x: voltmeterBottom.x, y: voltmeterBottom.y }
            ],
            "#74353a",
            "rgba(230, 126, 126, 0.65)"
        );
    }

    function drawLightSource(intensityLevel) {
        const lamp = { x: lightSourceX - 42, y: lightSourceY - 8, w: 58, h: 50 };
        
        // Draw shadow first for depth
        drawComponentShadow(lamp.x, lamp.y, lamp.w, lamp.h);
        
        // Body
        roundedRect(lamp.x, lamp.y, lamp.w, lamp.h, 8);
        const bodyGrad = ctx.createLinearGradient(lamp.x, lamp.y, lamp.x + lamp.w, lamp.y + lamp.h);
        bodyGrad.addColorStop(0, "#3d4248");
        bodyGrad.addColorStop(0.5, "#2a2f35");
        bodyGrad.addColorStop(1, "#1b1f25");
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 2;
        roundedRect(lamp.x, lamp.y, lamp.w, lamp.h, 8);
        ctx.stroke();

        // Title
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "700 9px Segoe UI";
        ctx.fillText("LED", lamp.x + lamp.w / 2, lamp.y + 12);

        // LED lens/window
        const lensX = lamp.x + lamp.w / 2 - 12;
        const lensY = lamp.y + 18;
        const lensSize = 24;
        
        // Lens body (glass-like)
        ctx.beginPath();
        ctx.arc(lensX + lensSize / 2, lensY + lensSize / 2, lensSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = "#0a0a0a";
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.stroke();

        // LED emitter glow
        const ledGlowRadius = 12 + intensityLevel * 18 + Math.sin(pulsePhase * 0.5) * 2;
        const ledCenterX = lensX + lensSize / 2;
        const ledCenterY = lensY + lensSize / 2;
        
        const ledGlow = ctx.createRadialGradient(ledCenterX - 2, ledCenterY - 2, 1, ledCenterX, ledCenterY, ledGlowRadius);
        ledGlow.addColorStop(0, `rgba(255, 100, 80, ${0.4 + intensityLevel * 0.5})`);
        ledGlow.addColorStop(0.5, `rgba(255, 120, 90, ${0.2 + intensityLevel * 0.3})`);
        ledGlow.addColorStop(1, "rgba(255, 100, 80, 0)");
        ctx.fillStyle = ledGlow;
        ctx.beginPath();
        ctx.arc(ledCenterX, ledCenterY, ledGlowRadius, 0, Math.PI * 2);
        ctx.fill();

        // LED chip
        const chipGlow = ctx.createRadialGradient(ledCenterX - 3, ledCenterY - 3, 1, ledCenterX, ledCenterY, 8);
        chipGlow.addColorStop(0, `rgba(255, 200, 150, ${0.5 + intensityLevel * 0.5})`);
        chipGlow.addColorStop(1, `rgba(255, 100, 60, ${0.3 + intensityLevel * 0.35})`);
        ctx.fillStyle = chipGlow;
        ctx.beginPath();
        ctx.arc(ledCenterX, ledCenterY, 7, 0, Math.PI * 2);
        ctx.fill();

        // LED lens reflection
        ctx.beginPath();
        ctx.arc(ledCenterX - 4, ledCenterY - 4, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, " + (0.3 + intensityLevel * 0.4) + ")";
        ctx.fill();

        // Connection indicator
        ctx.fillStyle = "#ffd700";
        ctx.font = "600 8px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText(intensityLevel > 0.1 ? "ON" : "OFF", lamp.x + lamp.w / 2, lamp.y + lamp.h - 5);
    }

    function drawScene() {
        const active = getActiveSimulationState();
        const intensityLevel = clamp(active.intensityLux / K2, 0, 1);
        const currentLevel = clamp(active.current / 30, 0, 1);
        const voltageLevel = clamp(active.voltage / 5, 0, 1);

        ammeterNeedleNorm += (currentLevel - ammeterNeedleNorm) * 0.12;
        voltmeterNeedleNorm += (voltageLevel - voltmeterNeedleNorm) * 0.12;

        drawBackground();

        // Draw full setup in design coordinates, then scale and center to current canvas size.
        ctx.save();
        ctx.translate(sceneOffsetX, sceneOffsetY);
        ctx.scale(sceneScale, sceneScale);

        drawModeBanner(active);
        drawConnections();
        drawPowerSupply(active);
        drawResistorUnit();
        drawAmmeter(active);
        drawVoltmeterBranch();
        drawVoltmeter(active);
        drawPhotodiode(intensityLevel);
        drawLightSource(intensityLevel);
        drawLightAnimation(intensityLevel);

        ctx.restore();

        pulsePhase += 0.04;
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        drawScene();
        requestAnimationFrame(animate);
    }

    if (voltageSlider) {
        voltageSlider.addEventListener("input", updateIVSimulation);
    }
    if (distanceSlider) {
        distanceSlider.addEventListener("input", updateLuxSimulation);
    }
    if (resetIvBtn) {
        resetIvBtn.addEventListener("click", resetIVSection);
    }
    if (resetLuxBtn) {
        resetLuxBtn.addEventListener("click", resetLuxSection);
    }
    if (modeResistanceBtn) {
        modeResistanceBtn.addEventListener("click", () => setSimulationMode("resistance"));
    }
    if (modeResponsivityBtn) {
        modeResponsivityBtn.addEventListener("click", () => setSimulationMode("responsivity"));
    }

    const fixedDistanceNode = document.getElementById("ivFixedDistance");
    const fixedVoltageNode = document.getElementById("luxFixedVoltage");
    if (fixedDistanceNode) {
        fixedDistanceNode.textContent = formatValue(IV_FIXED_DISTANCE, 1);
    }
    if (fixedVoltageNode) {
        fixedVoltageNode.textContent = formatValue(LUX_FIXED_VOLTAGE, 1);
    }

    updateIVSimulation();
    updateLuxSimulation();
    setSimulationMode("resistance");
    animate();
});
