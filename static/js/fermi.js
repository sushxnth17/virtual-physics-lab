document.addEventListener('DOMContentLoaded', () => {
	const simulationCanvas = document.getElementById('fermiSimulationCanvas');
	const chartCanvas = document.getElementById('fermiChart');
	const startBtn = document.getElementById('fermiStartBtn');
	const coolBtn = document.getElementById('fermiCoolBtn');
	const recordBtn = document.getElementById('fermiRecordBtn');
	const computeBtn = document.getElementById('compute-btn');

	const phaseLabel = document.getElementById('fermiPhaseLabel');
	const helperText = document.getElementById('fermiHelperText');
	const tempDisplay = document.getElementById('fermiTempDisplay');
	const tempKDisplay = document.getElementById('fermiTempKDisplay');
	const resistanceDisplay = document.getElementById('fermiResistanceDisplay');
	const slopeDisplay = document.getElementById('fermiSlopeDisplay');
	const graphSlopeDisplay = document.getElementById('fermiGraphSlope');
	const fermiEnergyDisplay = document.getElementById('fermi-energy');
	const fermiTempDisplay = document.getElementById('fermi-temp');

	const tableRows = Array.from(document.querySelectorAll('.observation-table tbody tr'));

	if (!simulationCanvas || !chartCanvas) {
		return;
	}

	const ctx = simulationCanvas.getContext('2d');
	const chartCtx = chartCanvas.getContext('2d');

	if (!ctx || !chartCtx) {
		return;
	}

	const CELSIUS_TO_KELVIN = 273;
	const START_TEMPERATURE_C = 85;
	const COOLING_STEPS = [85, 80, 75, 70, 65, 60];
	const AMBIENT_TEMPERATURE_C = 30;
	const HEAT_DURATION = 2600;
	const COOL_DURATION = 1300;

	const R0 = 4.2;
	const T0_K = 273;
	const ALPHA = 0.0039;
	const NOISE_MIN = -0.005;
	const NOISE_MAX = 0.005;
	const MONOTONIC_STEP_MIN = 0.01;
	const MONOTONIC_STEP_MAX = 0.03;
	const MONOTONIC_EPSILON_RATIO = 0.001;
	const JOULE_PER_EV = 1.6e-19;

	const state = {
		phase: 'idle',
		currentTempC: AMBIENT_TEMPERATURE_C,
		displayTempC: AMBIENT_TEMPERATURE_C,
		displayResistance: 0,
		stepResistance: 0,
		currentStepIndex: -1,
		recordedTemps: new Set(),
		recordedData: [],
		temperatureResistanceMap: new Map(),
		chart: null,
		isAnimating: false,
		animationFrameId: null
	};

	function formatTemp(value) {
		return Number.isFinite(value) ? value.toFixed(1) : '-';
	}

	function formatKelvin(value) {
		return Number.isFinite(value) ? Math.round(value).toString() : '-';
	}

	function formatResistance(value) {
		if (!Number.isFinite(value) || value <= 0) {
			return '-';
		}
		return value.toFixed(4);
	}

	function formatSlope(value) {
		if (!Number.isFinite(value)) {
			return '-';
		}
		return value.toFixed(6);
	}

	function formatScientificHtml(value, significantDigits = 4) {
		if (!Number.isFinite(value) || value === 0) {
			return '-';
		}

		const exponentString = value.toExponential(Math.max(0, significantDigits - 1));
		const [mantissaText, exponentText] = exponentString.split('e');
		const mantissa = Number.parseFloat(mantissaText);
		const exponent = Number.parseInt(exponentText, 10);

		if (!Number.isFinite(mantissa) || !Number.isFinite(exponent)) {
			return '-';
		}

		return `${mantissa.toFixed(Math.max(0, significantDigits - 1))} × 10<sup>${exponent}</sup>`;
	}

	function formatFermiEnergyHtml(energyJ) {
		if (!Number.isFinite(energyJ) || energyJ <= 0) {
			return '-';
		}

		const energyEV = energyJ / JOULE_PER_EV;
		const joulePart = `${formatScientificHtml(energyJ, 4)} J`;
		const evPart = Number.isFinite(energyEV) ? energyEV.toFixed(2) : '-';
		return `${joulePart} (≈ <strong>${evPart} eV</strong>)`;
	}

	function formatFermiTemperatureHtml(tempK) {
		if (!Number.isFinite(tempK) || tempK <= 0) {
			return '-';
		}

		return `${formatScientificHtml(tempK, 4)} K`;
	}

	function getTemperatureKelvin(tempC) {
		return tempC + CELSIUS_TO_KELVIN;
	}

	function updatePhaseLabel(text) {
		if (phaseLabel) {
			phaseLabel.textContent = text;
		}
	}

	function updateHelper(text) {
		if (helperText) {
			helperText.textContent = text;
		}
	}

	function updateLiveDisplays() {
		const tempK = getTemperatureKelvin(state.displayTempC);
		if (tempDisplay) {
			tempDisplay.textContent = formatTemp(state.displayTempC);
		}
		if (tempKDisplay) {
			tempKDisplay.textContent = formatKelvin(tempK);
		}
		if (resistanceDisplay) {
			resistanceDisplay.textContent = formatResistance(state.displayResistance);
		}
	}

	function clearAnimation() {
		if (state.animationFrameId !== null) {
			cancelAnimationFrame(state.animationFrameId);
			state.animationFrameId = null;
		}
	}

	function easeInOutCubic(t) {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}

	function animateStep(targetTempC, targetResistance, duration, onComplete) {
		clearAnimation();
		state.isAnimating = true;
		const startTemp = state.displayTempC;
		const startResistance = Number.isFinite(state.displayResistance) && state.displayResistance > 0
			? state.displayResistance
			: targetResistance;
		const startTime = performance.now();

		function frame(now) {
			const elapsed = now - startTime;
			const ratio = Math.min(1, elapsed / duration);
			const eased = easeInOutCubic(ratio);

			state.displayTempC = startTemp + (targetTempC - startTemp) * eased;
			state.displayResistance = startResistance + (targetResistance - startResistance) * eased;
			updateLiveDisplays();
			renderScene();

			if (ratio < 1) {
				state.animationFrameId = requestAnimationFrame(frame);
				return;
			}

			state.displayTempC = targetTempC;
			state.currentTempC = targetTempC;
			state.displayResistance = targetResistance;
			state.stepResistance = targetResistance;
			state.isAnimating = false;
			state.animationFrameId = null;
			updateLiveDisplays();
			renderScene();

			if (typeof onComplete === 'function') {
				onComplete();
			}
		}

		state.animationFrameId = requestAnimationFrame(frame);
	}

	function applyNoise(baseResistance) {
		const noiseFactor = NOISE_MIN + Math.random() * (NOISE_MAX - NOISE_MIN);
		const scaledFactor = 1 + noiseFactor;
		if (!Number.isFinite(scaledFactor) || scaledFactor <= 0) {
			return baseResistance;
		}

		const noisyResistance = baseResistance * scaledFactor;
		if (!Number.isFinite(noisyResistance) || noisyResistance <= 0) {
			return baseResistance;
		}

		return noisyResistance;
	}

	function randomBetween(min, max) {
		return min + Math.random() * (max - min);
	}

	function enforceMonotonicForCooling(tempC, resistance) {
		const nextHigherTemp = COOLING_STEPS.find((value) => value > tempC && state.temperatureResistanceMap.has(value));
		if (!Number.isFinite(nextHigherTemp)) {
			return resistance;
		}

		const higherResistance = state.temperatureResistanceMap.get(nextHigherTemp);
		if (!Number.isFinite(higherResistance) || higherResistance <= 0) {
			return resistance;
		}

		const minStepDrop = randomBetween(MONOTONIC_STEP_MIN, MONOTONIC_STEP_MAX);
		if (resistance >= higherResistance) {
			const adjusted = higherResistance - minStepDrop;
			return adjusted > 0 ? adjusted : higherResistance * (1 - MONOTONIC_EPSILON_RATIO);
		}

		// Avoid near-duplicate values after formatting by keeping a small non-zero drop.
		if ((higherResistance - resistance) < MONOTONIC_STEP_MIN) {
			const adjusted = higherResistance - minStepDrop;
			return adjusted > 0 ? adjusted : resistance;
		}

		return resistance;
	}

	function getResistanceForTemperature(tempC) {
		if (!Number.isFinite(tempC)) {
			return null;
		}

		const roundedTemp = Math.round(tempC);
		if (state.temperatureResistanceMap.has(roundedTemp)) {
			return state.temperatureResistanceMap.get(roundedTemp);
		}

		const tempK = getTemperatureKelvin(roundedTemp);
		if (!Number.isFinite(tempK) || tempK <= 0) {
			return null;
		}

		const baseResistance = R0 * (1 + ALPHA * (tempK - T0_K));
		if (!Number.isFinite(baseResistance) || baseResistance <= 0) {
			return null;
		}

		const noisyResistance = applyNoise(baseResistance);
		if (!Number.isFinite(noisyResistance) || noisyResistance <= 0) {
			return null;
		}

		const monotonicResistance = enforceMonotonicForCooling(roundedTemp, noisyResistance);
		if (!Number.isFinite(monotonicResistance) || monotonicResistance <= 0) {
			return null;
		}

		state.temperatureResistanceMap.set(roundedTemp, monotonicResistance);
		return monotonicResistance;
	}

	function clearResultDisplays() {
		if (fermiEnergyDisplay) {
			fermiEnergyDisplay.textContent = '-';
		}
		if (fermiTempDisplay) {
			fermiTempDisplay.textContent = '-';
		}
		if (slopeDisplay) {
			slopeDisplay.textContent = '-';
		}
		if (graphSlopeDisplay) {
			graphSlopeDisplay.textContent = '-';
		}
	}

	function initializeTable() {
		tableRows.forEach((row) => {
			row.classList.remove('energygap-recorded-row');
			const tempKCell = row.cells[1];
			const resistanceCell = row.cells[2];
			if (tempKCell) {
				tempKCell.textContent = '';
			}
			if (resistanceCell) {
				resistanceCell.textContent = '';
			}
		});
	}

	function updateControls() {
		const canStart = state.phase === 'idle';
		const hasCurrentStep = state.currentStepIndex >= 0 && state.currentStepIndex < COOLING_STEPS.length;
		const currentTemp = hasCurrentStep ? COOLING_STEPS[state.currentStepIndex] : null;
		const needsRecord = Number.isFinite(currentTemp) && !state.recordedTemps.has(currentTemp);
		const hasNextStep = hasCurrentStep && state.currentStepIndex < COOLING_STEPS.length - 1;

		if (startBtn) {
			startBtn.disabled = !canStart || state.isAnimating;
		}
		if (recordBtn) {
			recordBtn.disabled = !hasCurrentStep || needsRecord === false || state.isAnimating;
		}
		if (coolBtn) {
			coolBtn.disabled = !hasNextStep || needsRecord || state.isAnimating;
		}
		if (computeBtn) {
			computeBtn.disabled = state.recordedData.length < COOLING_STEPS.length || state.isAnimating;
		}
	}

	function linearRegression(points) {
		if (!Array.isArray(points) || points.length < 2) {
			return null;
		}

		let sumX = 0;
		let sumY = 0;
		let sumXY = 0;
		let sumX2 = 0;

		points.forEach((point) => {
			sumX += point.x;
			sumY += point.y;
			sumXY += point.x * point.y;
			sumX2 += point.x * point.x;
		});

		const n = points.length;
		const denominator = (n * sumX2) - (sumX * sumX);
		if (Math.abs(denominator) < 1e-20) {
			return null;
		}

		const slope = ((n * sumXY) - (sumX * sumY)) / denominator;
		const intercept = (sumY - slope * sumX) / n;
		return { slope, intercept };
	}

	function updateGraph() {
		const points = state.recordedData
			.slice()
			.sort((a, b) => a.tempK - b.tempK)
			.map((item) => ({ x: item.tempK, y: item.resistance }));

		if (points.length < 2) {
			if (state.chart) {
				state.chart.destroy();
				state.chart = null;
			}
			if (graphSlopeDisplay) {
				graphSlopeDisplay.textContent = '-';
			}
			if (slopeDisplay) {
				slopeDisplay.textContent = '-';
			}
			return;
		}

		const regression = linearRegression(points);
		if (!regression) {
			return;
		}

		const xValues = points.map((point) => point.x);
		const minX = Math.min(...xValues);
		const maxX = Math.max(...xValues);
		const linePoints = [
			{ x: minX, y: regression.slope * minX + regression.intercept },
			{ x: maxX, y: regression.slope * maxX + regression.intercept }
		];

		if (state.chart) {
			state.chart.destroy();
		}

		state.chart = new Chart(chartCtx, {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Recorded readings',
						data: points,
						pointBackgroundColor: '#0f4c81',
						pointBorderColor: '#0f4c81',
						pointRadius: 5,
						showLine: false
					},
					{
						label: 'Best-fit line',
						data: linePoints,
						type: 'line',
						borderColor: '#d35d2b',
						backgroundColor: 'rgba(211, 93, 43, 0.14)',
						borderWidth: 2,
						pointRadius: 0,
						tension: 0,
						fill: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				scales: {
					x: {
						type: 'linear',
						title: {
							display: true,
							text: 'Temperature (K)'
						}
					},
					y: {
						title: {
							display: true,
							text: 'Resistance (Ohm)'
						}
					}
				},
				plugins: {
					legend: {
						position: 'bottom'
					}
				}
			}
		});

		if (graphSlopeDisplay) {
			graphSlopeDisplay.textContent = formatSlope(regression.slope);
		}
		if (slopeDisplay) {
			slopeDisplay.textContent = formatSlope(regression.slope);
		}
	}

	function getCurrentStepTemp() {
		if (state.currentStepIndex < 0 || state.currentStepIndex >= COOLING_STEPS.length) {
			return null;
		}
		return COOLING_STEPS[state.currentStepIndex];
	}

	function findTableRow(tempC) {
		return tableRows.find((row) => {
			const tempText = row.cells[0] ? row.cells[0].textContent.trim() : '';
			const value = Number.parseFloat(tempText);
			return Number.isFinite(value) && Math.round(value) === Math.round(tempC);
		}) || null;
	}

	function recordCurrentReading() {
		if (state.isAnimating) {
			return;
		}

		const currentTemp = getCurrentStepTemp();
		if (!Number.isFinite(currentTemp)) {
			updateHelper('Start heating first, then record readings step by step.');
			updateControls();
			return;
		}

		if (state.recordedTemps.has(currentTemp)) {
			updateHelper(`The ${currentTemp}°C reading is already recorded. Click Cool Down for the next step.`);
			updateControls();
			return;
		}

		const row = findTableRow(currentTemp);
		if (!row) {
			updateHelper(`No table row available for ${currentTemp}°C.`);
			updateControls();
			return;
		}

		const resistance = state.stepResistance;
		const tempK = getTemperatureKelvin(currentTemp);
		if (!Number.isFinite(resistance) || resistance <= 0 || !Number.isFinite(tempK)) {
			updateHelper('Current reading is invalid. Try again.');
			updateControls();
			return;
		}

		row.cells[1].textContent = tempK.toFixed(0);
		row.cells[2].textContent = formatResistance(resistance);
		row.classList.add('energygap-recorded-row');

		state.recordedTemps.add(currentTemp);
		state.recordedData.push({
			tempC: currentTemp,
			tempK,
			resistance
		});

		updateGraph();
		if (currentTemp === 60) {
			state.phase = 'done';
			updatePhaseLabel('Cooling sequence complete');
			updateHelper('All readings recorded. Click Calculate to compute Fermi energy and temperature.');
		} else {
			updatePhaseLabel(`Recorded ${currentTemp}°C reading`);
			updateHelper(`Recorded ${currentTemp}°C successfully. Click Cool Down to move to the next 5°C step.`);
		}
		updateControls();
	}

	function moveToStep(stepIndex) {
		if (stepIndex < 0 || stepIndex >= COOLING_STEPS.length) {
			return;
		}

		const targetTemp = COOLING_STEPS[stepIndex];
		const targetResistance = getResistanceForTemperature(targetTemp);
		if (!Number.isFinite(targetResistance) || targetResistance <= 0) {
			updateHelper('Unable to compute resistance for this step.');
			return;
		}

		state.currentStepIndex = stepIndex;
		state.phase = 'cooling';
		updatePhaseLabel(stepIndex === 0 ? 'Heating to 85°C' : `Cooling to ${targetTemp}°C`);
		updateHelper(`Thermometer is settling at ${targetTemp}°C...`);
		updateControls();

		animateStep(targetTemp, targetResistance, stepIndex === 0 ? HEAT_DURATION : COOL_DURATION, () => {
			state.phase = 'ready';
			updatePhaseLabel(`Temperature stabilized at ${targetTemp}°C`);
			updateHelper(`Now record the ${targetTemp}°C reading before proceeding.`);
			updateControls();
		});
	}

	function startHeating() {
		if (state.phase !== 'idle' || state.isAnimating) {
			return;
		}
		moveToStep(0);
	}

	function coolDownStep() {
		if (state.isAnimating) {
			return;
		}

		const currentTemp = getCurrentStepTemp();
		if (!Number.isFinite(currentTemp)) {
			updateHelper('Start heating first.');
			updateControls();
			return;
		}

		if (!state.recordedTemps.has(currentTemp)) {
			updateHelper(`Record the ${currentTemp}°C reading before cooling further.`);
			updateControls();
			return;
		}

		if (state.currentStepIndex >= COOLING_STEPS.length - 1) {
			updateHelper('Cooling has reached 60°C. Record the final reading and calculate results.');
			updateControls();
			return;
		}

		moveToStep(state.currentStepIndex + 1);
	}

	async function computeResults() {
		if (state.recordedData.length < COOLING_STEPS.length) {
			updateHelper('Record all readings from 85°C to 60°C before calculating.');
			return;
		}

		const ordered = COOLING_STEPS
			.map((temp) => state.recordedData.find((item) => item.tempC === temp))
			.filter((item) => item);

		if (ordered.length !== COOLING_STEPS.length) {
			updateHelper('Missing recorded readings. Complete all steps before calculating.');
			return;
		}

		const payload = {
			temperatures_c: ordered.map((item) => item.tempC),
			resistances: ordered.map((item) => item.resistance)
		};

		try {
			const response = await fetch('/api/fermi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data && data.error ? data.error : 'Fermi calculation failed');
			}

			const fermiEnergyJ = Number(data.fermi_energy);
			const fermiTemperatureK = Number(data.fermi_temperature);

			if (fermiEnergyDisplay) {
				fermiEnergyDisplay.innerHTML = formatFermiEnergyHtml(fermiEnergyJ);
			}
			if (fermiTempDisplay) {
				fermiTempDisplay.innerHTML = formatFermiTemperatureHtml(fermiTemperatureK);
			}
			if (slopeDisplay && Number.isFinite(data.slope)) {
				slopeDisplay.textContent = formatSlope(data.slope);
			}
			if (graphSlopeDisplay && Number.isFinite(data.slope)) {
				graphSlopeDisplay.textContent = formatSlope(data.slope);
			}

			updateHelper('Fermi energy and Fermi temperature calculated successfully.');
		} catch (error) {
			console.error('Fermi API error:', error);
			updateHelper('Unable to calculate Fermi values right now.');
		}
	}

	function drawThermometer(tempC) {
		const x = 130;
		const topY = 72;
		const bottomY = 340;
		const tubeWidth = 24;
		const bulbRadius = 28;
		const SCALE_MIN = 60;  // Minimum displayed temperature
		const SCALE_MAX = 85;  // Maximum displayed temperature
		const clampedTemp = Math.min(SCALE_MAX, Math.max(SCALE_MIN, tempC));
		const fillRatio = (clampedTemp - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
		const fillTopY = bottomY - fillRatio * (bottomY - topY);

		ctx.save();

		// Draw glass tube with improved border
		ctx.strokeStyle = '#9fbbce';
		ctx.lineWidth = 3;
		ctx.fillStyle = 'rgba(255,255,255,0.95)';
		ctx.beginPath();
		ctx.roundRect(x - tubeWidth / 2, topY, tubeWidth, bottomY - topY, 12);
		ctx.fill();
		ctx.stroke();

		// Draw bulb (bottom sphere)
		ctx.beginPath();
		ctx.arc(x, bottomY + bulbRadius - 6, bulbRadius, 0, Math.PI * 2);
		ctx.fillStyle = '#e8e8e8';
		ctx.fill();
		ctx.stroke();

		// Draw temperature scale marks and labels
		const scaleTemps = [60, 65, 70, 75, 80, 85];
		scaleTemps.forEach((temp) => {
			const scaleRatio = (temp - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
			const scaleY = bottomY - scaleRatio * (bottomY - topY);

			// Tick marks
			ctx.strokeStyle = '#5f7486';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(x + tubeWidth / 2 + 8, scaleY);
			ctx.lineTo(x + tubeWidth / 2 + 16, scaleY);
			ctx.stroke();

			// Labels
			ctx.fillStyle = '#2d3e4f';
			ctx.font = '500 11px "IBM Plex Sans", sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText(`${temp}°C`, x + tubeWidth / 2 + 22, scaleY + 4);
		});

		// Draw red liquid fill with gradient
		const redGradient = ctx.createLinearGradient(x - 6, fillTopY, x + 6, fillTopY);
		redGradient.addColorStop(0, '#d85f57');
		redGradient.addColorStop(0.5, '#e05048');
		redGradient.addColorStop(1, '#c94a3f');
		ctx.fillStyle = redGradient;
		ctx.beginPath();
		ctx.roundRect(x - 6, fillTopY, 12, bottomY - fillTopY, 6);
		ctx.fill();

		// Draw liquid in bulb
		ctx.beginPath();
		ctx.arc(x, bottomY + bulbRadius - 6, bulbRadius - 7, 0, Math.PI * 2);
		ctx.fillStyle = '#c94a3f';
		ctx.fill();

		// Add subtle shine/highlight on glass
		ctx.strokeStyle = 'rgba(255,255,255,0.4)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.roundRect(x - tubeWidth / 2 + 2, topY + 2, tubeWidth - 4, (bottomY - topY) * 0.3, 10);
		ctx.stroke();

		ctx.restore();
	}

	function drawCoilAndBeaker(tempC) {
		ctx.save();
		const beakerX = 320;
		const beakerY = 90;
		const beakerWidth = 250;
		const beakerHeight = 250;
		const waterTop = beakerY + 40;
		const waterBottom = beakerY + beakerHeight - 15;

		// Draw beaker outline
		ctx.strokeStyle = '#5e7d95';
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.moveTo(beakerX - 20, beakerY - 10);
		ctx.lineTo(beakerX - 20, beakerY + beakerHeight - 5);
		ctx.lineTo(beakerX + beakerWidth + 20, beakerY + beakerHeight - 5);
		ctx.lineTo(beakerX + beakerWidth + 20, beakerY - 10);
		ctx.stroke();

		// Draw water with gradient
		const waterGradient = ctx.createLinearGradient(0, waterTop, 0, waterBottom);
		waterGradient.addColorStop(0, 'rgba(116, 182, 237, 0.75)');
		waterGradient.addColorStop(1, 'rgba(37, 111, 180, 0.92)');
		ctx.fillStyle = waterGradient;
		ctx.beginPath();
		ctx.roundRect(beakerX - 18, waterTop, beakerWidth + 36, waterBottom - waterTop, 18);
		ctx.fill();

		// Draw realistic helical copper coil (smooth spring-like)
		const coilCenterX = beakerX + 125;  // Center of beaker
		const coilRadiusX = 40;  // Horizontal radius of coil
		const coilRadiusY = 18;  // Vertical spacing between loops
		const numCoils = 7;  // Number of smooth helical turns

		// Create copper gradient
		const copperGradient = ctx.createLinearGradient(coilCenterX - coilRadiusX, waterTop, coilCenterX + coilRadiusX, waterBottom);
		copperGradient.addColorStop(0, '#d4a574');
		copperGradient.addColorStop(0.5, '#c97c3a');
		copperGradient.addColorStop(1, '#8b4513');

		// Draw smooth helical coil path (like a continuous sine wave)
		ctx.strokeStyle = copperGradient;
		ctx.lineWidth = 3.5;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		ctx.beginPath();
		let isFirst = true;

		for (let i = 0; i < numCoils; i++) {
			const baseY = waterTop + 20 + i * coilRadiusY;
			if (baseY > waterBottom - 20) break;

			// Left curve (outward and down)
			const leftX = coilCenterX - coilRadiusX;
			const rightX = coilCenterX + coilRadiusX;
			const midY = baseY;
			const nextY = baseY + coilRadiusY;

			if (isFirst) {
				ctx.moveTo(leftX, midY);
				isFirst = false;
			}

			// Smooth curve to right with sine-wave descent
			ctx.bezierCurveTo(
				coilCenterX - coilRadiusX * 0.6, midY - coilRadiusY * 0.2,
				coilCenterX + coilRadiusX * 0.6, midY - coilRadiusY * 0.15,
				rightX, midY
			);

			// Smooth curve back to left with continued descent
			ctx.bezierCurveTo(
				coilCenterX + coilRadiusX * 0.6, midY + coilRadiusY * 0.15,
				coilCenterX - coilRadiusX * 0.6, nextY - coilRadiusY * 0.2,
				leftX, nextY
			);
		}
		ctx.stroke();

		// Add subtle shading on underside for depth
		ctx.globalAlpha = 0.12;
		ctx.strokeStyle = '#1a1410';
		ctx.lineWidth = 4.5;

		ctx.beginPath();
		isFirst = true;

		for (let i = 0; i < numCoils; i++) {
			const baseY = waterTop + 22 + i * coilRadiusY;
			if (baseY > waterBottom - 20) break;

			const leftX = coilCenterX - coilRadiusX;
			const rightX = coilCenterX + coilRadiusX;
			const midY = baseY;
			const nextY = baseY + coilRadiusY;

			if (isFirst) {
				ctx.moveTo(leftX, midY);
				isFirst = false;
			}

			ctx.bezierCurveTo(
				coilCenterX - coilRadiusX * 0.6, midY - coilRadiusY * 0.2,
				coilCenterX + coilRadiusX * 0.6, midY - coilRadiusY * 0.15,
				rightX, midY
			);

			ctx.bezierCurveTo(
				coilCenterX + coilRadiusX * 0.6, midY + coilRadiusY * 0.15,
				coilCenterX - coilRadiusX * 0.6, nextY - coilRadiusY * 0.2,
				leftX, nextY
			);
		}
		ctx.stroke();
		ctx.globalAlpha = 1.0;

		// Draw realistic connecting wires (attached to coil and ohmmeter properly)
		// Connection point at coil
		const wireCoilLeftX = coilCenterX - coilRadiusX;
		const wireCoilLeftY = waterTop + 20;
		const wireCoilRightX = coilCenterX + coilRadiusX;
		const wireCoilRightY = waterTop + 20;

		// Connection points at ohmmeter terminals (top corners)
		const wireOhmLeftX = 700;   // Left terminal connection
		const wireOhmLeftY = 110;   // Top of ohmmeter
		const wireOhmRightX = 910;  // Right terminal connection
		const wireOhmRightY = 110;  // Top of ohmmeter

		// BLACK WIRE (left) - from coil left to ohmmeter left terminal
		ctx.strokeStyle = '#1a1a1a';
		ctx.lineWidth = 4;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(wireCoilLeftX, wireCoilLeftY);
		// Smooth curve with natural wire shape
		ctx.bezierCurveTo(
			wireCoilLeftX - 20, wireCoilLeftY - 35,
			wireOhmLeftX - 40, wireOhmLeftY - 40,
			wireOhmLeftX, wireOhmLeftY
		);
		ctx.stroke();

		// Add shadow to black wire
		ctx.strokeStyle = 'rgba(0,0,0,0.25)';
		ctx.lineWidth = 4.5;
		ctx.beginPath();
		ctx.moveTo(wireCoilLeftX + 1.5, wireCoilLeftY + 1.5);
		ctx.bezierCurveTo(
			wireCoilLeftX - 20 + 1.5, wireCoilLeftY - 35 + 1.5,
			wireOhmLeftX - 40 + 1.5, wireOhmLeftY - 40 + 1.5,
			wireOhmLeftX + 1.5, wireOhmLeftY + 1.5
		);
		ctx.stroke();

		// RED WIRE (right) - from coil right to ohmmeter right terminal
		ctx.strokeStyle = '#e53935';
		ctx.lineWidth = 4;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(wireCoilRightX, wireCoilRightY);
		// Smooth curve with natural wire shape
		ctx.bezierCurveTo(
			wireCoilRightX + 20, wireCoilRightY - 40,
			wireOhmRightX + 40, wireOhmRightY - 45,
			wireOhmRightX, wireOhmRightY
		);
		ctx.stroke();

		// Add shadow to red wire
		ctx.strokeStyle = 'rgba(0,0,0,0.2)';
		ctx.lineWidth = 4.5;
		ctx.beginPath();
		ctx.moveTo(wireCoilRightX + 1.5, wireCoilRightY + 1.5);
		ctx.bezierCurveTo(
			wireCoilRightX + 20 + 1.5, wireCoilRightY - 40 + 1.5,
			wireOhmRightX + 40 + 1.5, wireOhmRightY - 45 + 1.5,
			wireOhmRightX + 1.5, wireOhmRightY + 1.5
		);
		ctx.stroke();

		// Draw temperature label
		ctx.fillStyle = '#213547';
		ctx.font = '600 13px "IBM Plex Sans", sans-serif';
		ctx.fillText(`Coil temperature: ${formatTemp(tempC)}°C`, beakerX + 58, beakerY + 190);
		ctx.restore();
	}

	function drawOhmmeter(resistance) {
		ctx.save();
		const baseX = 680;
		const baseY = 110;
		const width = 250;
		const height = 210;

		ctx.fillStyle = '#f2f5f7';
		ctx.strokeStyle = '#5f7486';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.roundRect(baseX, baseY, width, height, 18);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = '#dce7ef';
		ctx.beginPath();
		ctx.roundRect(baseX + 20, baseY + 18, width - 40, 48, 10);
		ctx.fill();

		ctx.fillStyle = '#19364e';
		ctx.font = '700 28px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(formatResistance(resistance), baseX + width / 2, baseY + 51);
		ctx.fillStyle = '#596d7d';
		ctx.font = '600 13px "IBM Plex Sans", sans-serif';
		ctx.fillText('OHMMETER', baseX + width / 2, baseY + 88);
		ctx.restore();
	}

	function renderScene() {
		ctx.clearRect(0, 0, simulationCanvas.width, simulationCanvas.height);
		const background = ctx.createLinearGradient(0, 0, 0, simulationCanvas.height);
		background.addColorStop(0, '#f5fbff');
		background.addColorStop(1, '#e8f1f8');
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, simulationCanvas.width, simulationCanvas.height);

		drawThermometer(state.displayTempC);
		drawCoilAndBeaker(state.displayTempC);
		drawOhmmeter(state.displayResistance);
	}

	function attachHandlers() {
		if (startBtn) {
			startBtn.addEventListener('click', startHeating);
		}
		if (coolBtn) {
			coolBtn.addEventListener('click', coolDownStep);
		}
		if (recordBtn) {
			recordBtn.addEventListener('click', recordCurrentReading);
		}
		if (computeBtn) {
			computeBtn.addEventListener('click', computeResults);
		}
	}

	function initializeSimulation() {
		state.phase = 'idle';
		state.currentTempC = AMBIENT_TEMPERATURE_C;
		state.displayTempC = AMBIENT_TEMPERATURE_C;
		state.displayResistance = 0;
		state.stepResistance = 0;
		state.currentStepIndex = -1;
		state.recordedTemps = new Set();
		state.recordedData = [];
		state.temperatureResistanceMap = new Map();
		state.isAnimating = false;
		clearAnimation();

		initializeTable();
		clearResultDisplays();
		updatePhaseLabel('Ready to start heating');
		updateHelper('Heating has not started yet.');
		updateLiveDisplays();
		updateGraph();
		updateControls();
		renderScene();
	}

	attachHandlers();
	initializeSimulation();
});
