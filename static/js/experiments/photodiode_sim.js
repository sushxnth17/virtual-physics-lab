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
    const sourceX = width * 0.16;
    const diodeX = width * 0.5;
    const barX = width * 0.8;
    const centerY = height * 0.5;
    const diodeRadius = 44;
    let rayOffset = 0;
    let pulsePhase = 0;
    let glowPhase = 0;
    let displayedBarFill = 0;
    let linkedEnergy = 0;

    function drawRoundedRect(x, y, rectWidth, rectHeight, radius) {
        const r = Math.min(radius, rectWidth / 2, rectHeight / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + rectWidth - r, y);
        ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + r);
        ctx.lineTo(x + rectWidth, y + rectHeight - r);
        ctx.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - r, y + rectHeight);
        ctx.lineTo(x + r, y + rectHeight);
        ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawBackground() {
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, "#fbfcff");
        bgGradient.addColorStop(1, "#edf3fa");

        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(94, 125, 155, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY + 56);
        ctx.lineTo(width, centerY + 56);
        ctx.stroke();
    }

    function drawLightRays() {
        const rayCount = 5;
        const startX = sourceX + 24;
        const endX = diodeX - diodeRadius;
        const spacing = 26;
        const baseY = centerY - 52;
        const flowWave = 0.5 + 0.5 * Math.sin(pulsePhase * 1.15);
        const luxLevel = Math.min(1, Math.max(0, stateLux.lux / K2));
        const targetEnergy = 0.28 + flowWave * 0.3 + luxLevel * 0.75;
        linkedEnergy += (targetEnergy - linkedEnergy) * 0.08;
        const rayAlphaBoost = 0.75 + linkedEnergy * 0.55;

        for (let i = 0; i < rayCount; i += 1) {
            const y = baseY + i * spacing;
            const rayGradient = ctx.createLinearGradient(startX, y, endX, y);
            rayGradient.addColorStop(0, `rgba(255, 207, 95, ${0.25 * rayAlphaBoost})`);
            rayGradient.addColorStop(0.55, `rgba(255, 191, 58, ${0.95 * rayAlphaBoost})`);
            rayGradient.addColorStop(1, `rgba(255, 147, 73, ${0.45 + linkedEnergy * 0.35})`);

            ctx.save();
            ctx.lineCap = "round";
            ctx.lineWidth = 4.3;
            ctx.strokeStyle = rayGradient;
            ctx.setLineDash([18, 14]);
            ctx.lineDashOffset = -rayOffset - i * 6;
            ctx.shadowColor = `rgba(255, 196, 64, ${0.65 + linkedEnergy * 0.25})`;
            ctx.shadowBlur = 10 + linkedEnergy * 5;

            const animatedStart = startX - 18;
            ctx.beginPath();
            ctx.moveTo(animatedStart, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
            ctx.restore();
        }

        return linkedEnergy;
    }

    
    function drawPhotodiode(rayEnergy) {
        const centerX = diodeX;
        const radius = diodeRadius;
        const pulse = 0.5 + 0.5 * Math.sin(glowPhase);
        const glowStrength = 12 + pulse * 6 + rayEnergy * 10;
        const haloRadius = radius + 13 + rayEnergy * 7;

        ctx.save();
        const outerHalo = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, haloRadius + 20);
        outerHalo.addColorStop(0, `rgba(136, 189, 246, ${0.18 + rayEnergy * 0.16})`);
        outerHalo.addColorStop(1, "rgba(136, 189, 246, 0)");
        ctx.fillStyle = outerHalo;
        ctx.beginPath();
        ctx.arc(centerX, centerY, haloRadius + 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.shadowColor = `rgba(94, 146, 214, ${0.36 + rayEnergy * 0.35})`;
        ctx.shadowBlur = glowStrength;
        ctx.fillStyle = "rgba(208, 225, 241, 0.55)";
        ctx.beginPath();
        ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const bodyGradient = ctx.createRadialGradient(centerX - 10, centerY - 12, 8, centerX, centerY, 56);
        bodyGradient.addColorStop(0, "#f3f8fd");
        bodyGradient.addColorStop(1, "#c5d9ea");
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = "#5a7a98";
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#3b5d82";
        ctx.beginPath();
        ctx.moveTo(centerX - 14, centerY - 22);
        ctx.lineTo(centerX - 14, centerY + 22);
        ctx.lineTo(centerX + 20, centerY);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX + 23, centerY - 21);
        ctx.lineTo(centerX + 23, centerY + 21);
        ctx.strokeStyle = "#4f6f8e";
        ctx.lineWidth = 2.2;
        ctx.stroke();
    }

    function drawCurrentBar(rayEnergy) {
        const yTop = height * 0.2;
        const barWidth = 52;
        const barHeight = height * 0.62;
        const minFill = barHeight * 0.22;
        const maxFill = barHeight * 0.9;
        const pulse = (Math.sin(pulsePhase) + 1) / 2;
        const combinedCurrent = Math.max(stateIV.current, stateLux.current);
        const currentLevel = Math.min(1, Math.max(0, combinedCurrent / 30));
        const linkedLevel = Math.min(1, Math.max(0, pulse * 0.25 + rayEnergy * 0.3 + currentLevel * 0.8));
        const targetFill = minFill + (maxFill - minFill) * linkedLevel;
        displayedBarFill += (targetFill - displayedBarFill) * 0.09;

        drawRoundedRect(barX, yTop, barWidth, barHeight, 12);
        ctx.fillStyle = "#eef4f8";
        ctx.fill();
        ctx.strokeStyle = "#7f97ab";
        ctx.lineWidth = 2;
        ctx.stroke();

        const fillTop = yTop + (barHeight - displayedBarFill);
        const fillGradient = ctx.createLinearGradient(0, yTop + barHeight, 0, yTop);
        fillGradient.addColorStop(0, "#2f9a56");
        fillGradient.addColorStop(1, "#8bf0aa");

        drawRoundedRect(barX + 4, fillTop, barWidth - 8, displayedBarFill - 4, 8);
        ctx.fillStyle = fillGradient;
        ctx.shadowColor = `rgba(74, 181, 108, ${0.3 + rayEnergy * 0.28})`;
        ctx.shadowBlur = 7 + rayEnergy * 4;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawLabels() {
        ctx.fillStyle = "#2d4357";
        ctx.font = "600 15px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText("Light Source", sourceX, centerY + 82);
        ctx.fillText("Photodiode", diodeX, centerY + 82);
        ctx.fillText("Current", barX + 26, centerY + 82);
        ctx.textAlign = "start";
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        drawBackground();
        const rayEnergy = drawLightRays();
        drawPhotodiode(rayEnergy);
        drawCurrentBar(rayEnergy);
        drawLabels();

        rayOffset += 1.8;
        pulsePhase += 0.05;
        glowPhase += 0.06;
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
    animate();
});
