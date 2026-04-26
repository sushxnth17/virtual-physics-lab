document.addEventListener('DOMContentLoaded', () => {
	const canvas = document.getElementById('energygapSimulationCanvas');
	const graphCanvas = document.getElementById('energygapGraphCanvas');

	const startBtn = document.getElementById('energygapStartBtn');
	const nextBtn = document.getElementById('energygapNextBtn');
	const recordBtn = document.getElementById('energygapRecordBtn');

	const phaseLabel = document.getElementById('energygapPhaseLabel');
	const helperText = document.getElementById('energygapHelperText');
	const tempDisplay = document.getElementById('energygapTempDisplay');
	const tempKDisplay = document.getElementById('energygapTempKDisplay');
	const resistanceDisplay = document.getElementById('energygapResistanceDisplay');
	const resultDisplay = document.getElementById('energygapResultDisplay');
	const resultValue = document.getElementById('energyGapResultValue');
	const slopeValue = document.getElementById('energygapSlopeValue');
	const graphResultValue = document.getElementById('energygapGraphResult');

	const tableRows = Array.from(document.querySelectorAll('.observation-table tbody tr'));

	if (!canvas || !graphCanvas) {
		return;
	}

	const ctx = canvas.getContext('2d');
	const graphCtx = graphCanvas.getContext('2d');

	if (!ctx || !graphCtx) {
		return;
	}

	const BOLTZMANN_CONSTANT = 1.38e-23;
	const EV_DENOMINATOR = 1.601e-19;
	const CELSIUS_TO_KELVIN_OFFSET = 273;
	const THERMISTOR_R0 = 2000;
	const THERMISTOR_T0_K = 348;
	const THERMISTOR_B = 3500;
	const SYSTEMATIC_BIAS_SPAN = 0.05;
	const POINT_NOISE_SPAN = 0.01;
	const RUN_SLOPE_DRIFT_MIN = -150;
	const RUN_SLOPE_DRIFT_MAX = 270;
	const MONOTONIC_EPSILON_RATIO = 0.0005;
	const HEATING_TARGET_C = 95;
	const COOLING_STEPS = [90, 85, 80, 75, 70, 65, 60, 55, 50];
	const RECORDABLE_STEPS = new Set([75, 70, 65, 60, 55, 50]);
	const AMBIENT_TEMPERATURE_C = 30;
	const HEAT_UP_DURATION = 3600;
	const COOL_STEP_DURATION = 1300;

	const state = {
		phase: 'idle',
		currentTempC: AMBIENT_TEMPERATURE_C,
		displayTempC: AMBIENT_TEMPERATURE_C,
		displayResistance: 0,
		targetResistance: 0,
		coolingIndex: -1,
		recordedData: [],
		recordedTemps: new Set(),
		temperatureResistanceMap: new Map(),
		runBiasFactor: 1,
		runSlopeDrift: 0,
		chart: null,
		animationFrameId: null,
		isAnimating: false,
		stepResistance: 0
	};

	function formatTemperature(value) {
		return Number.isFinite(value) ? value.toFixed(1) : '-';
	}

	function formatKelvin(value) {
		return Number.isFinite(value) ? Math.round(value).toString() : '-';
	}

	function formatResistance(value) {
		if (!Number.isFinite(value) || value <= 0) {
			return '-';
		}

		if (value >= 100000) {
			return value.toExponential(2);
		}

		if (value >= 1000) {
			return value.toFixed(0);
		}

		return value.toFixed(1);
	}

	function formatMeterResistance(value) {
		if (!Number.isFinite(value) || value <= 0) {
			return '-';
		}

		if (value >= 100000) {
			return value.toExponential(2);
		}

		return value.toFixed(2);
	}

	function formatTableResistance(value) {
		if (!Number.isFinite(value) || value <= 0) {
			return '-';
		}

		return value.toFixed(2);
	}

	function formatTableLogR(value) {
		if (!Number.isFinite(value)) {
			return '-';
		}

		return value.toFixed(3);
	}

	function formatTableInvT(value) {
		if (!Number.isFinite(value) || value <= 0) {
			return '-';
		}

		return value.toExponential(5);
	}

	function formatSlope(value) {
		if (!Number.isFinite(value)) {
			return '-';
		}

		return value.toExponential(4);
	}

	function formatEg(value) {
		if (!Number.isFinite(value)) {
			return '-';
		}

		return value.toFixed(3);
	}

	function easeInOutCubic(t) {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}

	function getTemperatureKelvin(tempC) {
		return tempC + CELSIUS_TO_KELVIN_OFFSET;
	}

	function generateRunBiasFactor() {
		return 1 + (Math.random() - 0.5) * SYSTEMATIC_BIAS_SPAN;
	}

	function applySmallPointNoise(resistance) {
		const smallNoise = 1 + (Math.random() - 0.5) * POINT_NOISE_SPAN;
		return resistance * smallNoise;
	}

	function generateRunSlopeDrift() {
		return RUN_SLOPE_DRIFT_MIN + Math.random() * (RUN_SLOPE_DRIFT_MAX - RUN_SLOPE_DRIFT_MIN);
	}

	function enforceMonotonicResistance(tempC, resistance) {
		let nearestHigher = null;
		let nearestLower = null;

		state.temperatureResistanceMap.forEach((cachedResistance, cachedTemp) => {
			if (cachedTemp > tempC) {
				if (!nearestHigher || cachedTemp < nearestHigher.temp) {
					nearestHigher = { temp: cachedTemp, resistance: cachedResistance };
				}
			}

			if (cachedTemp < tempC) {
				if (!nearestLower || cachedTemp > nearestLower.temp) {
					nearestLower = { temp: cachedTemp, resistance: cachedResistance };
				}
			}
		});

		let adjustedResistance = resistance;

		if (nearestHigher && adjustedResistance <= nearestHigher.resistance) {
			adjustedResistance = nearestHigher.resistance * (1 + MONOTONIC_EPSILON_RATIO);
		}

		if (nearestLower && adjustedResistance >= nearestLower.resistance) {
			adjustedResistance = nearestLower.resistance * (1 - MONOTONIC_EPSILON_RATIO);
		}

		return adjustedResistance;
	}

	function getResistanceForTemperature(tempC) {
		if (!Number.isFinite(tempC)) {
			return null;
		}

		const normalizedTemp = Math.round(tempC);
		if (state.temperatureResistanceMap.has(normalizedTemp)) {
			return state.temperatureResistanceMap.get(normalizedTemp);
		}

		const tempK = getTemperatureKelvin(tempC);
		if (!Number.isFinite(tempK) || tempK <= 0) {
			return null;
		}

		const computedResistance = THERMISTOR_R0 * Math.exp(THERMISTOR_B * ((1 / tempK) - (1 / THERMISTOR_T0_K)));
		if (!Number.isFinite(computedResistance) || computedResistance <= 0) {
			return null;
		}

		const driftFactor = Math.exp(state.runSlopeDrift * ((1 / tempK) - (1 / THERMISTOR_T0_K)));
		if (!Number.isFinite(driftFactor) || driftFactor <= 0) {
			return null;
		}

		const driftedResistance = computedResistance * driftFactor;
		if (!Number.isFinite(driftedResistance) || driftedResistance <= 0) {
			return null;
		}

		const biasedResistance = driftedResistance * state.runBiasFactor;
		if (!Number.isFinite(biasedResistance) || biasedResistance <= 0) {
			return null;
		}

		const noisyResistance = applySmallPointNoise(biasedResistance);
		if (!Number.isFinite(noisyResistance) || noisyResistance <= 0) {
			return null;
		}

		const monotonicResistance = enforceMonotonicResistance(normalizedTemp, noisyResistance);
		if (!Number.isFinite(monotonicResistance) || monotonicResistance <= 0) {
			return null;
		}

		state.temperatureResistanceMap.set(normalizedTemp, monotonicResistance);
		return monotonicResistance;
	}

	function updateLiveDisplays() {
		const tempC = state.displayTempC;
		const tempK = getTemperatureKelvin(tempC);

		if (tempDisplay) {
			tempDisplay.textContent = formatTemperature(tempC);
		}

		if (tempKDisplay) {
			tempKDisplay.textContent = formatKelvin(tempK);
		}

		if (resistanceDisplay) {
			resistanceDisplay.textContent = formatMeterResistance(state.displayResistance);
		}

		if (resultDisplay) {
			resultDisplay.textContent = formatEg(getLatestEgValue());
		}
	}

	function updateHelperMessage(message) {
		if (helperText) {
			helperText.textContent = message;
		}
	}

	function updatePhaseLabel(message) {
		if (phaseLabel) {
			phaseLabel.textContent = message;
		}
	}

	function clearAnimation() {
		if (state.animationFrameId !== null) {
			cancelAnimationFrame(state.animationFrameId);
			state.animationFrameId = null;
		}
	}

	function animateStep(targetTempC, targetResistance, duration, onComplete) {
		clearAnimation();
		state.isAnimating = true;

		const startTemp = state.displayTempC;
		const startResistance = state.displayResistance || targetResistance;
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
			state.displayResistance = targetResistance;
			state.currentTempC = targetTempC;
			state.targetResistance = targetResistance;
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

	function animateOhmmeterForSelectedTemperature(tempC, duration, onComplete) {
		const selectedResistance = getResistanceForTemperature(tempC);
		const validResistance = Number.isFinite(selectedResistance) && selectedResistance > 0
			? selectedResistance
			: state.displayResistance;

		state.stepResistance = validResistance;
		animateStep(tempC, validResistance, duration, onComplete);
	}

	function initializeSimulationParameters() {
		state.currentTempC = AMBIENT_TEMPERATURE_C;
		state.displayTempC = AMBIENT_TEMPERATURE_C;
		state.targetResistance = 0;
		state.displayResistance = 0;
		state.stepResistance = 0;
		state.phase = 'idle';
		state.coolingIndex = -1;
		state.recordedData = [];
		state.recordedTemps = new Set();
		state.temperatureResistanceMap = new Map();
		state.runBiasFactor = generateRunBiasFactor();
		state.runSlopeDrift = generateRunSlopeDrift();

		tableRows.forEach((row) => {
			row.classList.remove('energygap-recorded-row');
			row.querySelectorAll('td').forEach((cell, index) => {
				if (index >= 2) {
					cell.textContent = '';
				}
			});
		});
		enforceTablePlaceholders();

		setLatestEgValue(null);
		setLatestSlopeValue(null);
		clearGraph();
		updateLiveDisplays();
		updatePhaseLabel('Ready to start heating');
		updateHelperMessage('Heating has not started yet.');
		updateControls();
		renderScene();
	}

	function normalizeText(value) {
		if (typeof value !== 'string') {
			return '';
		}

		return value.trim().toLowerCase();
	}

	function enforceTablePlaceholders() {
		tableRows.forEach((row) => {
			const resistanceCell = row.cells[3];
			const logRCell = row.cells[4];

			if (resistanceCell) {
				const text = normalizeText(resistanceCell.textContent || '');
				if (text === '' || text === 'undefined' || text === 'null' || text === 'nan' || text === 'infinity' || text === '-infinity') {
					resistanceCell.textContent = '-';
				}
			}

			if (logRCell) {
				const text = normalizeText(logRCell.textContent || '');
				if (text === '' || text === 'undefined' || text === 'null' || text === 'nan' || text === 'infinity' || text === '-infinity') {
					logRCell.textContent = '-';
				}
			}
		});
	}

	function getCurrentStepTemp() {
		const rounded = Math.round(state.currentTempC);
		return Number.isFinite(rounded) ? rounded : null;
	}

	function canRecordCurrentStep() {
		const currentStep = getCurrentStepTemp();
		return currentStep !== null && RECORDABLE_STEPS.has(currentStep) && !state.recordedTemps.has(currentStep);
	}

	function hasUnrecordedRowAtCurrentTemp() {
		return canRecordCurrentStep();
	}

	function updateControls() {
		const currentStep = getCurrentStepTemp();
		const needsRecording = currentStep !== null && RECORDABLE_STEPS.has(currentStep) && !state.recordedTemps.has(currentStep);
		const nextAvailable = state.phase === 'cooling' && !state.isAnimating && state.coolingIndex >= 0 && state.coolingIndex < COOLING_STEPS.length - 1;

		if (startBtn) {
			startBtn.disabled = state.phase !== 'idle';
		}

		if (nextBtn) {
			nextBtn.disabled = !nextAvailable || needsRecording;
		}

		if (recordBtn) {
			recordBtn.disabled = !hasUnrecordedRowAtCurrentTemp() || state.isAnimating;
		}
	}

	function setLatestEgValue(value) {
		state.latestEg = value;

		if (resultValue) {
			resultValue.textContent = formatEg(value);
		}

		if (resultDisplay) {
			resultDisplay.textContent = formatEg(value);
		}

		if (graphResultValue) {
			graphResultValue.textContent = formatEg(value);
		}
	}

	function getLatestEgValue() {
		return state.latestEg;
	}

	function setLatestSlopeValue(value) {
		state.latestSlope = value;

		if (slopeValue) {
			slopeValue.textContent = formatSlope(value);
		}
	}

	function clearGraph() {
		if (state.chart) {
			state.chart.destroy();
			state.chart = null;
		}

		if (graphCtx) {
			graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
		}

		setLatestSlopeValue(null);
		setLatestEgValue(null);
	}

	function linearRegression(points) {
		if (points.length < 2) {
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

	async function computeBackendAnalysis(records) {
		const safeRecords = Array.isArray(records) ? records : [];
		const payload = {
			temp_c: safeRecords.map((item) => item.tempC),
			resistance: safeRecords.map((item) => item.resistance)
		};

		try {
			const response = await fetch('/api/energygap', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data && data.error ? data.error : 'Energy gap analysis failed');
			}

			return data;
		} catch (error) {
			console.error('Energy gap API error:', error);
			return null;
		}
	}

	function updateChartFromPoints(points, analysis) {
		const orderedPoints = points.slice().sort((a, b) => a.x - b.x);
		const regression = analysis && Number.isFinite(analysis.slope)
			? { slope: analysis.slope, intercept: (orderedPoints.reduce((acc, point) => acc + point.y, 0) / orderedPoints.length) - (analysis.slope * (orderedPoints.reduce((acc, point) => acc + point.x, 0) / orderedPoints.length)) }
			: linearRegression(orderedPoints);

		if (!regression) {
			return;
		}

		const xValues = orderedPoints.map((point) => point.x);
		const minX = Math.min(...xValues);
		const maxX = Math.max(...xValues);
		const linePoints = [
			{ x: minX, y: regression.slope * minX + regression.intercept },
			{ x: maxX, y: regression.slope * maxX + regression.intercept }
		];

		if (state.chart) {
			state.chart.destroy();
		}

		state.chart = new Chart(graphCtx, {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Recorded readings',
						data: orderedPoints,
						pointBackgroundColor: '#0f4c81',
						pointBorderColor: '#0f4c81',
						pointRadius: 5,
						pointHoverRadius: 7,
						showLine: false
					},
					{
						label: 'Best-fit line',
						data: linePoints,
						type: 'line',
						borderColor: '#d35d2b',
						backgroundColor: 'rgba(211, 93, 43, 0.15)',
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
							text: '1/T (K^-1)'
						},
						grid: {
							color: 'rgba(128, 154, 175, 0.18)'
						}
					},
					y: {
						title: {
							display: true,
							text: 'log R'
						},
						grid: {
							color: 'rgba(128, 154, 175, 0.18)'
						}
					}
				},
				plugins: {
					legend: {
						position: 'bottom'
					},
					tooltip: {
						callbacks: {
							label(context) {
								return `${context.dataset.label}: (${context.parsed.x.toExponential(3)}, ${context.parsed.y.toFixed(3)})`;
							}
						}
					}
				}
			}
		});

		if (state.chart) {
			state.chart.resize();
			state.chart.update();
		}
	}

	async function refreshAnalysis() {
		const validRecordedData = state.recordedData.filter((item) => Number.isFinite(item.resistance) && item.resistance > 0 && Number.isFinite(item.logR));

		if (validRecordedData.length < 3) {
			clearGraph();
			updateHelperMessage('Record at least 3 valid resistance readings before plotting the graph.');
			return;
		}

		const analysis = await computeBackendAnalysis(validRecordedData);
		const points = validRecordedData.map((item) => ({
			x: item.invT,
			y: item.logR
		}));

		if (analysis) {
			setLatestSlopeValue(analysis.slope);
			setLatestEgValue(analysis.Eg);
		} else {
			const fallback = linearRegression(points);
			if (fallback) {
				const slope = fallback.slope;
				const eg = (2.303 * 2 * BOLTZMANN_CONSTANT * Math.abs(slope)) / EV_DENOMINATOR;
				setLatestSlopeValue(slope);
				setLatestEgValue(eg);
			}
		}

		updateChartFromPoints(points, analysis);
		updateHelperMessage('Graph updated from the recorded readings.');
		updateControls();
	}

	function findTableRow(tempC) {
		return tableRows.find((row) => {
			const tempCell = row.cells[1];
			const tempValue = tempCell ? Number.parseFloat(tempCell.textContent) : NaN;
			return Number.isFinite(tempValue) && Math.round(tempValue) === Math.round(tempC);
		}) || null;
	}

	function fillTableRow(tempC, resistance) {
		const row = findTableRow(tempC);

		if (!row) {
			updateHelperMessage(`No observation row is available for ${Math.round(tempC)}°C.`);
			return false;
		}

		if (state.recordedTemps.has(Math.round(tempC))) {
			updateHelperMessage(`The ${Math.round(tempC)}°C reading has already been recorded.`);
			return false;
		}

		const tempK = getTemperatureKelvin(tempC);
		const invTFromTemp = tempK > 0 ? 1 / tempK : null;
		const recordedResistance = Number.isFinite(resistance) && resistance > 0 ? resistance : null;
		let logR = null;
		let invT = invTFromTemp;
		const existingInvT = row.cells[5] ? row.cells[5].textContent.trim() : '';
		const shouldComputeInvT = existingInvT === '' || existingInvT === '-';

		row.cells[2].textContent = tempK.toFixed(0);
		row.cells[3].textContent = formatTableResistance(recordedResistance);

		if (Number.isFinite(recordedResistance) && recordedResistance > 0) {
			logR = Math.log10(recordedResistance);
		}

		row.cells[4].textContent = formatTableLogR(logR);
		if (shouldComputeInvT) {
			row.cells[5].textContent = formatTableInvT(invTFromTemp);
		} else {
			const parsedInvT = Number.parseFloat(existingInvT);
			invT = Number.isFinite(parsedInvT) && parsedInvT > 0 ? parsedInvT : null;
			row.cells[5].textContent = formatTableInvT(invT);
		}

		for (let index = 2; index <= 5; index += 1) {
			const cell = row.cells[index];
			if (!cell) {
				continue;
			}
			cell.setAttribute('contenteditable', 'false');
			cell.setAttribute('aria-readonly', 'true');
			cell.dataset.recorded = 'true';
		}

		row.classList.add('energygap-recorded-row');
		enforceTablePlaceholders();

		state.recordedTemps.add(Math.round(tempC));
		state.recordedData.push({
			tempC,
			tempK,
			resistance: Number.isFinite(recordedResistance) && recordedResistance > 0 ? recordedResistance : null,
			logR,
			invT: Number.isFinite(invT) && invT > 0 ? invT : null
		});

		return true;
	}

	function recordCurrentReading() {
		if (!canRecordCurrentStep()) {
			updateHelperMessage('Wait for a recordable cooling step: 75°C, 70°C, 65°C, 60°C, 55°C or 50°C.');
			return;
		}

		const tempC = Math.round(state.currentTempC);
		const resistance = state.stepResistance || state.displayResistance;

		if (!fillTableRow(tempC, resistance)) {
			return;
		}

		updatePhaseLabel(`Recorded ${tempC}°C reading`);
		updateHelperMessage(`Reading recorded at ${tempC}°C. Move to the next cooling step when ready.`);
		updateControls();
		if (state.recordedData.length >= 3) {
			window.requestAnimationFrame(() => {
				refreshAnalysis();
			});
		}
	}

	function moveToCoolingStep(stepIndex) {
		if (stepIndex < 0 || stepIndex >= COOLING_STEPS.length) {
			return;
		}

		const nextTempC = COOLING_STEPS[stepIndex];
		state.coolingIndex = stepIndex;
		state.phase = 'cooling';
		state.stepResistance = getResistanceForTemperature(nextTempC);

		const labelText = stepIndex === 0
			? 'Cooling started'
			: `Cooling step ${nextTempC}°C`;

		updatePhaseLabel(labelText);
		updateHelperMessage(RECORDABLE_STEPS.has(nextTempC)
			? `Temperature settled at ${nextTempC}°C. Record this reading before moving on.`
			: `Temperature settled at ${nextTempC}°C. Click Next Reading to continue cooling.`);
		updateControls();

		animateOhmmeterForSelectedTemperature(nextTempC, COOL_STEP_DURATION, () => {
			state.phase = nextTempC === 50 ? 'done' : 'cooling';
			updatePhaseLabel(nextTempC === 50 ? 'Cooling complete at 50°C' : `Cooling step ${nextTempC}°C`);
			updateHelperMessage(RECORDABLE_STEPS.has(nextTempC)
				? `Record the ${nextTempC}°C reading before the next step.`
				: `Cooling is in progress. The next step can be triggered with Next Reading.`);
			updateControls();
			if (state.recordedData.length >= 3) {
				window.requestAnimationFrame(() => {
					refreshAnalysis();
				});
			}
		});
	}

	function startHeating() {
		if (state.phase !== 'idle') {
			return;
		}

		state.phase = 'heating';
		state.stepResistance = getResistanceForTemperature(HEATING_TARGET_C);
		updatePhaseLabel('Heating thermistor in water');
		updateHelperMessage('Heating started. The temperature will rise to 95°C, then cooling will begin automatically.');
		updateControls();

		animateOhmmeterForSelectedTemperature(HEATING_TARGET_C, HEAT_UP_DURATION, () => {
			updateHelperMessage('Heating complete. Cooling begins now.');
			state.phase = 'cooling';
			state.displayTempC = HEATING_TARGET_C;
			state.currentTempC = HEATING_TARGET_C;
			state.displayResistance = state.stepResistance;
			updateLiveDisplays();
			renderScene();
			moveToCoolingStep(0);
		});
	}

	function advanceCooling() {
		if (state.phase === 'heating' || state.isAnimating) {
			return;
		}

		if (state.coolingIndex < 0) {
			return;
		}

		if (state.coolingIndex >= COOLING_STEPS.length - 1) {
			updatePhaseLabel('Cooling complete at 50°C');
			updateHelperMessage('Cooling is complete. Record the remaining readings and review the graph.');
			updateControls();
			return;
		}

		const nextIndex = state.coolingIndex + 1;

		if (RECORDABLE_STEPS.has(Math.round(state.currentTempC)) && !state.recordedTemps.has(Math.round(state.currentTempC))) {
			updateHelperMessage(`Record the ${Math.round(state.currentTempC)}°C reading before moving to the next step.`);
			updateControls();
			return;
		}

		moveToCoolingStep(nextIndex);
	}

	function drawThermometer(tempC) {
		const x = 110;
		const topY = 72;
		const bottomY = 340;
		const tubeWidth = 24;
		const bulbRadius = 28;
		const minTemp = 25;
		const maxTemp = 100;
		const clampedTemp = Math.min(maxTemp, Math.max(minTemp, tempC));
		const fillRatio = (clampedTemp - minTemp) / (maxTemp - minTemp);
		const fillTopY = bottomY - fillRatio * (bottomY - topY);

		ctx.save();
		ctx.strokeStyle = '#44657f';
		ctx.lineWidth = 3;
		ctx.fillStyle = 'rgba(255,255,255,0.9)';

		ctx.beginPath();
		ctx.roundRect(x - tubeWidth / 2, topY, tubeWidth, bottomY - topY, 12);
		ctx.fill();
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(x, bottomY + bulbRadius - 6, bulbRadius, 0, Math.PI * 2);
		ctx.fillStyle = '#fff6f0';
		ctx.fill();
		ctx.stroke();

		ctx.beginPath();
		ctx.roundRect(x - 6, fillTopY, 12, bottomY - fillTopY, 6);
		ctx.fillStyle = '#d85f57';
		ctx.fill();

		ctx.beginPath();
		ctx.arc(x, bottomY + bulbRadius - 6, bulbRadius - 7, 0, Math.PI * 2);
		ctx.fillStyle = '#e05048';
		ctx.fill();

		ctx.fillStyle = '#385165';
		ctx.font = '13px "IBM Plex Sans", sans-serif';
		for (let temp = 25; temp <= 100; temp += 5) {
			const y = bottomY - ((temp - minTemp) / (maxTemp - minTemp)) * (bottomY - topY);
			ctx.beginPath();
			ctx.moveTo(x + 18, y);
			ctx.lineTo(x + 28, y);
			ctx.stroke();
			if (temp % 10 === 0) {
				ctx.fillText(String(temp), x + 34, y + 4);
			}
		}

		ctx.restore();
	}

	function drawThermistor(tempC) {
		const beakerX = 330;
		const beakerY = 90;
		const beakerWidth = 245;
		const beakerHeight = 250;
		const waterTop = beakerY + 35;
		const waterBottom = beakerY + beakerHeight - 15;

		ctx.save();

		ctx.strokeStyle = '#5e7d95';
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.moveTo(beakerX - 20, beakerY - 10);
		ctx.lineTo(beakerX - 20, beakerY + beakerHeight - 5);
		ctx.lineTo(beakerX + beakerWidth + 20, beakerY + beakerHeight - 5);
		ctx.lineTo(beakerX + beakerWidth + 20, beakerY - 10);
		ctx.stroke();

		const waterGradient = ctx.createLinearGradient(0, waterTop, 0, waterBottom);
		waterGradient.addColorStop(0, 'rgba(116, 182, 237, 0.75)');
		waterGradient.addColorStop(1, 'rgba(37, 111, 180, 0.92)');
		ctx.fillStyle = waterGradient;
		ctx.beginPath();
		ctx.roundRect(beakerX - 18, waterTop, beakerWidth + 36, waterBottom - waterTop, 18);
		ctx.fill();

		const waveY = waterTop + 14 + Math.sin(tempC / 5) * 2;
		ctx.fillStyle = 'rgba(255,255,255,0.14)';
		ctx.beginPath();
		ctx.roundRect(beakerX - 10, waveY, beakerWidth + 20, 10, 5);
		ctx.fill();

		ctx.fillStyle = '#1f3041';
		ctx.fillRect(beakerX + 70, beakerY + 5, 80, 18);
		ctx.fillStyle = '#f4fafc';
		ctx.font = 'bold 12px "IBM Plex Sans", sans-serif';
		ctx.fillText('THERMISTOR', beakerX + 76, beakerY + 19);

		ctx.fillStyle = '#b4cde0';
		ctx.fillRect(beakerX + 98, beakerY + 20, 22, 120);
		ctx.fillStyle = '#9daab5';
		ctx.beginPath();
		ctx.arc(beakerX + 109, beakerY + 140, 12, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#f4fbff';
		ctx.beginPath();
		ctx.arc(beakerX + 109, beakerY + 140, 9, 0, Math.PI * 2);
		ctx.fill();

		ctx.strokeStyle = '#657d93';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(beakerX + 109, beakerY + 140);
		ctx.lineTo(beakerX + 109, waterBottom - 10);
		ctx.stroke();

		ctx.fillStyle = '#ef6759';
		ctx.beginPath();
		ctx.arc(beakerX + 109, waterBottom - 20, 15, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#fff8f3';
		ctx.beginPath();
		ctx.arc(beakerX + 109, waterBottom - 20, 10, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#213547';
		ctx.font = '600 13px "IBM Plex Sans", sans-serif';
		ctx.fillText(`${formatTemperature(tempC)}°C`, beakerX + 83, beakerY + 175);

		ctx.restore();
	}

	function drawOhmmeter(resistance) {
		const baseX = 670;
		const baseY = 110;
		const width = 255;
		const height = 210;

		ctx.save();

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

		const dialCenterX = baseX + width / 2;
		const dialCenterY = baseY + 140;
		const radius = 62;

		ctx.strokeStyle = '#8da1b2';
		ctx.lineWidth = 8;
		ctx.beginPath();
		ctx.arc(dialCenterX, dialCenterY, radius, Math.PI * 1.1, Math.PI * 1.9);
		ctx.stroke();

		ctx.strokeStyle = '#465d70';
		ctx.lineWidth = 2;
		for (let i = 0; i <= 6; i += 1) {
			const angle = Math.PI * 1.1 + (Math.PI * 0.8 * i) / 6;
			const outerX = dialCenterX + Math.cos(angle) * radius;
			const outerY = dialCenterY + Math.sin(angle) * radius;
			const innerX = dialCenterX + Math.cos(angle) * (radius - 10);
			const innerY = dialCenterY + Math.sin(angle) * (radius - 10);
			ctx.beginPath();
			ctx.moveTo(innerX, innerY);
			ctx.lineTo(outerX, outerY);
			ctx.stroke();
		}

		const normalized = Math.min(1, Math.max(0, Math.log10(Math.max(resistance, 1)) / 6));
		const needleAngle = Math.PI * 1.86 - normalized * Math.PI * 0.76;
		const needleX = dialCenterX + Math.cos(needleAngle) * (radius - 14);
		const needleY = dialCenterY + Math.sin(needleAngle) * (radius - 14);

		ctx.strokeStyle = '#d35d2b';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(dialCenterX, dialCenterY);
		ctx.lineTo(needleX, needleY);
		ctx.stroke();

		ctx.fillStyle = '#d35d2b';
		ctx.beginPath();
		ctx.arc(dialCenterX, dialCenterY, 6, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#354b5d';
		ctx.font = '600 12px "IBM Plex Sans", sans-serif';
		ctx.fillText('Low', baseX + 38, baseY + 175);
		ctx.fillText('High', baseX + width - 38, baseY + 175);

		ctx.restore();
	}

	function drawWaterHeatingHints() {
		ctx.save();
		ctx.fillStyle = 'rgba(255, 204, 102, 0.35)';
		ctx.beginPath();
		ctx.arc(675, 345, 32, 0, Math.PI * 2);
		ctx.fill();

		ctx.strokeStyle = '#ea9b2d';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(660, 363);
		ctx.lineTo(650, 382);
		ctx.moveTo(680, 363);
		ctx.lineTo(680, 386);
		ctx.moveTo(700, 363);
		ctx.lineTo(710, 382);
		ctx.stroke();

		ctx.fillStyle = '#7b4f1d';
		ctx.font = '600 13px "IBM Plex Sans", sans-serif';
		ctx.fillText(state.phase === 'heating' ? 'Heating' : 'Cooling', 635, 398);
		ctx.restore();
	}

	function renderScene() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
		background.addColorStop(0, '#f5fbff');
		background.addColorStop(1, '#e8f1f8');
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = 'rgba(41, 86, 121, 0.06)';
		for (let x = 0; x < canvas.width; x += 44) {
			ctx.fillRect(x, 0, 1, canvas.height);
		}

		drawThermometer(state.displayTempC);
		drawThermistor(state.displayTempC);
		drawOhmmeter(state.displayResistance);
		drawWaterHeatingHints();

		ctx.fillStyle = '#27445c';
		ctx.font = '700 14px "IBM Plex Sans", sans-serif';
		ctx.fillText('Thermistor immersed in water', 320, 56);
		ctx.fillText(`Temperature: ${formatTemperature(state.displayTempC)}°C`, 320, 75);
		ctx.fillText(`Resistance: ${formatResistance(state.displayResistance)} Ω`, 320, 94);
	}

	function attachHandlers() {
		if (startBtn) {
			startBtn.addEventListener('click', startHeating);
		}

		if (nextBtn) {
			nextBtn.addEventListener('click', advanceCooling);
		}

		if (recordBtn) {
			recordBtn.addEventListener('click', recordCurrentReading);
		}
	}

	initializeSimulationParameters();
	attachHandlers();
	renderScene();
	updateControls();
});
