// Bending loss simulation interactivity
(() => {
    const laserToggle = document.getElementById('laserToggle');
    const beam = document.getElementById('beam');
    const fiber = document.getElementById('fiber');
    const laserIndicator = document.getElementById('laserIndicator');
    const panelGlow = document.getElementById('panel-glow');
    const voltmeter = document.getElementById('voltmeter');
    const wireCanvas = document.getElementById('wireCanvas');
    const wireCtx = wireCanvas ? wireCanvas.getContext('2d') : null;
    const fiberLength = document.getElementById('fiberLength');
    const recordBtn = document.getElementById('recordBtn');
    const resetBtn = document.getElementById('resetBtn');
    const laserStatusValue = document.getElementById('laserStatusValue');
    const currentLengthValue = document.getElementById('currentLengthValue');
    const signalStrengthValue = document.getElementById('signalStrengthValue');
    const observationTableBody = document.querySelector('#observationTable tbody');
    const lengthRow1 = document.getElementById('lengthRow1');
    const voltageRow1 = document.getElementById('voltageRow1');
    const lengthRow2 = document.getElementById('lengthRow2');
    const voltageRow2 = document.getElementById('voltageRow2');
    const attenuationCell = document.getElementById('attenuationCell');
    const attenuationResult = document.getElementById('attenuationResult');

    let beamAnimId = null;
    let lastReading = null;
    let recordedReadings = [];
    const V0 = 5.0; // visual reference (backend default)

    function clearObservationTable() {
        lengthRow1.innerHTML = 'L<sub>1</sub>';
        voltageRow1.innerHTML = 'V<sub>1</sub>';
        lengthRow2.innerHTML = 'L<sub>2</sub>';
        voltageRow2.innerHTML = 'V<sub>2</sub>';
        attenuationCell.textContent = '';
        attenuationResult.textContent = '.............';
        recordedReadings = [];
    }

    function renderObservationTable() {
        if (recordedReadings.length === 0) {
            clearObservationTable();
            return;
        }

        const firstReading = recordedReadings.length === 1 ? recordedReadings[0] : recordedReadings[recordedReadings.length - 2];
        const secondReading = recordedReadings[recordedReadings.length - 1];

        lengthRow1.innerHTML = `L<sub>1</sub><div style="margin-top:0.35rem; font-size:0.95rem; color:#0f172a !important; font-weight:600;">${Number(firstReading.length_km ?? (firstReading.length_m / 1000)).toFixed(3)}</div>`;
        voltageRow1.innerHTML = `V<sub>1</sub><div style="margin-top:0.35rem; font-size:0.95rem; color:#0f172a !important; font-weight:600;">${Number(firstReading.voltage).toFixed(3)}</div>`;

        if (recordedReadings.length === 1) {
            lengthRow2.innerHTML = 'L<sub>2</sub>';
            voltageRow2.innerHTML = 'V<sub>2</sub>';
            attenuationCell.textContent = '-';
            return;
        }

        lengthRow2.innerHTML = `L<sub>2</sub><div style="margin-top:0.35rem; font-size:0.95rem; color:#0f172a !important; font-weight:600;">${Number(secondReading.length_km ?? (secondReading.length_m / 1000)).toFixed(3)}</div>`;
        voltageRow2.innerHTML = `V<sub>2</sub><div style="margin-top:0.35rem; font-size:0.95rem; color:#0f172a !important; font-weight:600;">${Number(secondReading.voltage).toFixed(3)}</div>`;

        const attenuationValue = secondReading.attenuation_constant;
        attenuationCell.textContent = attenuationValue === null || attenuationValue === undefined ? '-' : Number(attenuationValue).toFixed(4);
    }

    function getSignalStrength(voltage) {
        if (!Number.isFinite(voltage) || voltage <= 0) return 'Low';
        const ratio = voltage / V0;
        if (ratio >= 0.72) return 'High';
        if (ratio >= 0.35) return 'Medium';
        return 'Low';
    }

    function updateStatus({ laserOn, length, voltage }) {
        laserStatusValue.textContent = laserOn ? 'ON' : 'OFF';
        currentLengthValue.textContent = `${length} m`;

        const signal = getSignalStrength(voltage);
        signalStrengthValue.textContent = signal;
        signalStrengthValue.classList.remove('signal-high', 'signal-medium', 'signal-low');
        signalStrengthValue.classList.add(signal === 'High' ? 'signal-high' : signal === 'Medium' ? 'signal-medium' : 'signal-low');
    }

    function setVoltmeter(v) {
        voltmeter.textContent = Number(v).toFixed(3) + ' V';
    }

    function setPanelGlowFromVoltage(v) {
        const ratio = Math.max(0, Math.min(1, v / V0));
        const alpha = 0.05 + 0.35 * ratio;
        panelGlow.style.background = `rgba(34,197,94,${alpha})`;
        panelGlow.style.boxShadow = `0 0 ${6 + 14 * ratio}px rgba(34,197,94,${Math.min(0.45, alpha)})`;
    }

    let resizeWireCanvasScheduled = false;

    function resizeWireCanvas() {
        if (!wireCanvas || !wireCtx) {
            return;
        }

        const rect = wireCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        wireCanvas.width = Math.max(1, Math.round(rect.width * dpr));
        wireCanvas.height = Math.max(1, Math.round(rect.height * dpr));
        wireCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawWireConnections();
        resizeWireCanvasScheduled = false;
    }

    function scheduleWireCanvasResize() {
        if (resizeWireCanvasScheduled) return;
        resizeWireCanvasScheduled = true;
        requestAnimationFrame(resizeWireCanvas);
    }

    function getCanvasPoint(element, canvasRect) {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left - canvasRect.left + (rect.width / 2),
            y: rect.top - canvasRect.top + (rect.height / 2)
        };
    }

    function drawWirePath(startPoint, endPoint, color, lift) {
        if (!wireCtx) {
            return;
        }

        const control1X = startPoint.x + 42;
        const control1Y = startPoint.y + lift;
        const control2X = endPoint.x - 42;
        const control2Y = endPoint.y + lift;

        wireCtx.save();
        wireCtx.lineWidth = 3.2;
        wireCtx.lineCap = 'round';
        wireCtx.lineJoin = 'round';
        wireCtx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        wireCtx.beginPath();
        wireCtx.moveTo(startPoint.x + 1, startPoint.y + 1);
        wireCtx.bezierCurveTo(control1X + 1, control1Y + 1, control2X + 1, control2Y + 1, endPoint.x + 1, endPoint.y + 1);
        wireCtx.stroke();

        wireCtx.strokeStyle = color;
        wireCtx.beginPath();
        wireCtx.moveTo(startPoint.x, startPoint.y);
        wireCtx.bezierCurveTo(control1X, control1Y, control2X, control2Y, endPoint.x, endPoint.y);
        wireCtx.stroke();

        wireCtx.fillStyle = color;
        wireCtx.beginPath();
        wireCtx.arc(startPoint.x, startPoint.y, 2.8, 0, Math.PI * 2);
        wireCtx.fill();
        wireCtx.beginPath();
        wireCtx.arc(endPoint.x, endPoint.y, 2.8, 0, Math.PI * 2);
        wireCtx.fill();
        wireCtx.restore();
    }

    function drawWireConnections() {
        if (!wireCanvas || !wireCtx) {
            return;
        }

        const canvasRect = wireCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        // Clear using canvas pixel dimensions, accounting for devicePixelRatio scaling
        wireCtx.clearRect(0, 0, wireCanvas.width / dpr, wireCanvas.height / dpr);

        const detectorRed = document.querySelector('.terminal.detector-red');
        const detectorBlack = document.querySelector('.terminal.detector-black');
        const meterRed = document.querySelector('.terminal.meter-red');
        const meterBlack = document.querySelector('.terminal.meter-black');

        if (!detectorRed || !detectorBlack || !meterRed || !meterBlack) {
            return;
        }

        const redStart = getCanvasPoint(detectorRed, canvasRect);
        const redEnd = getCanvasPoint(meterRed, canvasRect);
        const blackStart = getCanvasPoint(detectorBlack, canvasRect);
        const blackEnd = getCanvasPoint(meterBlack, canvasRect);

        drawWirePath(redStart, redEnd, '#cf2e2e', -28);
        drawWirePath(blackStart, blackEnd, '#242424', 24);
    }

    function startBeamAnimation() {
        // Duration based on selected fiber length (longer fiber -> longer travel time)
        const length_m = Number(fiberLength.value) || 1;
        const durationMs = Math.round(450 + length_m * 14); // 1m ~464ms, 100m ~1850ms

        if (fiber) {
            fiber.style.setProperty('--beam-duration', `${durationMs}ms`);
            // Restart animation cleanly if already running
            fiber.classList.remove('beam-on');
            // force reflow so animation restarts with new duration
            void fiber.offsetWidth;
            fiber.classList.add('beam-on');
        }

        if (beam) {
            beam.style.opacity = '1';
        }
    }

    function stopBeamAnimation() {
        if (beamAnimId) {
            clearTimeout(beamAnimId);
            beamAnimId = null;
        }
        if (fiber) {
            fiber.classList.remove('beam-on');
        }
        if (beam) {
            beam.style.opacity = '0';
        }
    }

    async function fetchVoltage() {
        const length_m = Number(fiberLength.value);
        try {
            const res = await fetch('/api/bendingloss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ length_m })
            });
            const json = await res.json();
            if (!json || !json.success) {
                throw new Error((json && json.error) || 'API error');
            }
            const data = json.data;
            lastReading = data;
            setVoltmeter(data.voltage);
            setPanelGlowFromVoltage(data.voltage);
            updateStatus({ laserOn: true, length: data.length_m, voltage: data.voltage });
            if (data.attenuation_constant === null || data.attenuation_constant === undefined) {
                attenuationResult.textContent = '.............';
            } else {
                attenuationResult.textContent = Number(data.attenuation_constant).toFixed(4);
            }
            // laser indicator subtle
            const onAlpha = Math.max(0.35, Math.min(1, 0.35 + 0.65 * (data.voltage / V0)));
            if (laserIndicator) {
                laserIndicator.style.opacity = onAlpha;
                laserIndicator.style.background = '#8b0000';
            }
        } catch (err) {
            console.error('Error fetching voltage:', err);
        }
    }

    laserToggle.addEventListener('change', async (e) => {
        const on = e.target.checked;
        const length_m = Number(fiberLength.value);
        if (on) {
            // show small indicator and start beam
            if (laserIndicator) { laserIndicator.style.opacity = 0.6; }
            startBeamAnimation();
            await fetchVoltage();
        } else {
            stopBeamAnimation();
            setVoltmeter(0);
            panelGlow.style.background = 'transparent';
            panelGlow.style.boxShadow = 'none';
            if (laserIndicator) { laserIndicator.style.opacity = 0.25; }
            lastReading = null;
            updateStatus({ laserOn: false, length: length_m, voltage: 0 });
        }
    });

    // when length changes while laser is on, update reading
    fiberLength.addEventListener('change', async () => {
        const length_m = Number(fiberLength.value);
        currentLengthValue.textContent = `${length_m} m`;
        if (laserToggle.checked) await fetchVoltage();
        else updateStatus({ laserOn: false, length: length_m, voltage: 0 });
    });

    recordBtn.addEventListener('click', () => {

        if (!lastReading) return;
        recordedReadings.push(lastReading);
        if (recordedReadings.length > 2) {
            recordedReadings.shift();
        }
        renderObservationTable();
    });
    resetBtn.addEventListener('click', () => {
        // clear readings
        clearObservationTable();
        // reset meter
        if (laserToggle.checked) {
            laserToggle.checked = false;
        }
        stopBeamAnimation();
        setVoltmeter(0);
        panelGlow.style.background = 'transparent';
        panelGlow.style.boxShadow = 'none';
        if (laserIndicator) { laserIndicator.style.opacity = 0.25; }
        lastReading = null;
        fetch('/api/bendingloss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reset: true })
        }).catch(() => { });
        updateStatus({ laserOn: false, length: Number(fiberLength.value), voltage: 0 });
    });

    window.addEventListener('resize', scheduleWireCanvasResize);
    window.addEventListener('load', resizeWireCanvas);
    if (window.ResizeObserver && document.querySelector('.apparatus-card')) {
        const apparatusCard = document.querySelector('.apparatus-card');
        const observer = new ResizeObserver(() => scheduleWireCanvasResize());
        observer.observe(apparatusCard);
    }

    // init state
    stopBeamAnimation();
    setVoltmeter(0);
    updateStatus({ laserOn: false, length: Number(fiberLength.value), voltage: 0 });
    clearObservationTable();
    setTimeout(resizeWireCanvas, 0);
})();
