/**
 * Black Box experiment table calculator.
 * Reads table data, calls backend API, then renders computed results.
 */

const BLACKBOX_FREQUENCIES = [1000, 2000, 3000, 4000, 5000];
let componentMap = {};
let capacitiveReactanceChartInstance = null;
let inductiveReactanceChartInstance = null;

function destroyBlackBoxCharts() {
	if (capacitiveReactanceChartInstance) {
		capacitiveReactanceChartInstance.destroy();
		capacitiveReactanceChartInstance = null;
	}

	if (inductiveReactanceChartInstance) {
		inductiveReactanceChartInstance.destroy();
		inductiveReactanceChartInstance = null;
	}
}

function getReactanceSeriesByType(responseData, targetType) {
	const componentInfo = [
		{ info: responseData.Z1, reactance: responseData.X1 },
		{ info: responseData.Z2, reactance: responseData.X2 },
		{ info: responseData.Z3, reactance: responseData.X3 }
	];

	const match = componentInfo.find((entry) => {
		return entry.info && entry.info.type === targetType && Array.isArray(entry.reactance);
	});

	return match ? match.reactance : null;
}

function computeLinearRegression(points) {
	if (!Array.isArray(points) || points.length < 2) {
		return null;
	}

	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumXX = 0;

	points.forEach((point) => {
		const x = Number(point.x);
		const y = Number(point.y);
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			return;
		}

		sumX += x;
		sumY += y;
		sumXY += x * y;
		sumXX += x * x;
	});

	const n = points.length;
	const denominator = (n * sumXX) - (sumX * sumX);
	if (Math.abs(denominator) < 1e-12) {
		return null;
	}

	const slope = ((n * sumXY) - (sumX * sumY)) / denominator;
	const intercept = (sumY - (slope * sumX)) / n;

	return { slope, intercept };
}

function createCapacitiveReactanceChart(canvasId, frequencies, reactanceValues) {
	if (typeof Chart === 'undefined') {
		return null;
	}

	const canvas = document.getElementById(canvasId);
	if (!canvas) {
		return null;
	}

	if (!Array.isArray(frequencies) || !Array.isArray(reactanceValues) || frequencies.length !== reactanceValues.length || frequencies.length === 0) {
		return null;
	}

	return new Chart(canvas, {
		type: 'line',
		data: {
			labels: frequencies,
			datasets: [{
				label: 'Capacitive Reactance (Xc)',
				data: reactanceValues,
				borderColor: '#1f77b4',
				backgroundColor: 'rgba(31, 119, 180, 0.18)',
				borderWidth: 2,
				pointRadius: 4,
				pointHoverRadius: 5,
				fill: false,
				tension: 0.4
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: true,
					position: 'top'
				}
			},
			scales: {
				x: {
					title: {
						display: true,
						text: 'Frequency (Hz)'
					}
				},
				y: {
					title: {
						display: true,
						text: 'Reactance (ohm)'
					},
					beginAtZero: true
				}
			}
		}
	});
}

function createInductiveReactanceChart(canvasId, frequencies, reactanceValues) {
	if (typeof Chart === 'undefined') {
		return null;
	}

	const canvas = document.getElementById(canvasId);
	if (!canvas) {
		return null;
	}

	if (!Array.isArray(frequencies) || !Array.isArray(reactanceValues) || frequencies.length !== reactanceValues.length || frequencies.length === 0) {
		return null;
	}

	const points = frequencies.map((frequency, index) => ({
		x: Number(frequency),
		y: Number(reactanceValues[index])
	})).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

	if (points.length < 2) {
		return null;
	}

	const regression = computeLinearRegression(points);
	if (!regression) {
		return null;
	}

	const xValues = points.map((point) => point.x).sort((a, b) => a - b);
	const xMin = xValues[0];
	const xMax = xValues[xValues.length - 1];
	const linePoints = [
		{ x: xMin, y: (regression.slope * xMin) + regression.intercept },
		{ x: xMax, y: (regression.slope * xMax) + regression.intercept }
	];

	return new Chart(canvas, {
		type: 'scatter',
		data: {
			datasets: [
				{
					label: 'Inductive Reactance Data (XL)',
					data: points,
					showLine: false,
					borderColor: '#2c3e50',
					backgroundColor: '#2c3e50',
					pointRadius: 4,
					pointHoverRadius: 5
				},
				{
					label: 'Best-fit Line',
					data: linePoints,
					type: 'line',
					showLine: true,
					borderColor: '#c0392b',
					backgroundColor: '#c0392b',
					borderWidth: 2,
					pointRadius: 0,
					pointHoverRadius: 0,
					fill: false,
					tension: 0
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: true,
					position: 'top'
				}
			},
			scales: {
				x: {
					type: 'linear',
					title: {
						display: true,
						text: 'Frequency (Hz)'
					}
				},
				y: {
					title: {
						display: true,
						text: 'Reactance (ohm)'
					},
					beginAtZero: true
				}
			}
		}
	});
}

function renderBlackBoxReactanceGraphs(responseData) {
	destroyBlackBoxCharts();

	const frequencies = Array.isArray(responseData.freq) ? responseData.freq : BLACKBOX_FREQUENCIES;
	const capacitiveReactance = getReactanceSeriesByType(responseData, 'Capacitor');
	const inductiveReactance = getReactanceSeriesByType(responseData, 'Inductor');

	capacitiveReactanceChartInstance = createCapacitiveReactanceChart(
		'capacitiveReactanceChart',
		frequencies,
		capacitiveReactance
	);

	inductiveReactanceChartInstance = createInductiveReactanceChart(
		'inductiveReactanceChart',
		frequencies,
		inductiveReactance
	);
}

function showSuccessNotification(message) {
	const notification = document.createElement('div');
	notification.textContent = message;
	notification.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		background-color: #4caf50;
		color: white;
		padding: 16px 24px;
		border-radius: 4px;
		font-size: 16px;
		font-weight: 500;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
		z-index: 10000;
		animation: slideIn 0.3s ease-out;
	`;
	document.body.appendChild(notification);

	setTimeout(() => {
		notification.style.animation = 'slideOut 0.3s ease-out';
		setTimeout(() => {
			notification.remove();
		}, 300);
	}, 3000);
}

function shuffle(array) {
	// Create a copy to avoid mutating the original
	const copy = [...array];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function initializeComponentMap() {
	const components = ['R', 'C', 'L'];
	console.log('Original components:', components);
	
	const shuffledComponents = shuffle(components);
	console.log('Shuffled components:', shuffledComponents);

	componentMap = {
		Z1: shuffledComponents[0],
		Z2: shuffledComponents[1],
		Z3: shuffledComponents[2]
	};

	console.log('Component Mapping:', componentMap);
	console.log('Z1 is:', componentMap.Z1, '| Z2 is:', componentMap.Z2, '| Z3 is:', componentMap.Z3);
}

function getReading(component, freq) {
	const type = componentMap[component];
	const frequency = Number(freq);
	const V = 10;

	let I = 0;
	if (type === 'R') {
		I = 2;
	} else if (type === 'C') {
		I = frequency / 1000;
	} else if (type === 'L') {
		const inductorCurrentByFrequency = {
			1000: 2,
			2000: 1.5,
			3000: 1,
			4000: 0.8,
			5000: 0.6
		};
		I = inductorCurrentByFrequency[frequency] ?? 0;
	}

	return { V, I };
}

function simulateReadings(freq) {
	const frequency = Number(freq);
	const V = 10;

	const I1 = 2;
	const I2 = frequency / 2000;
	const I3 = 5000 / frequency;

	return {
		V1: V,
		I1,
		V2: V,
		I2,
		V3: V,
		I3
	};
}

function updateSimulationDisplay(readings) {
	const v1Display = document.getElementById('v1Display');
	const i1Display = document.getElementById('i1Display');
	const v2Display = document.getElementById('v2Display');
	const i2Display = document.getElementById('i2Display');
	const v3Display = document.getElementById('v3Display');
	const i3Display = document.getElementById('i3Display');

	if (v1Display) {
		v1Display.textContent = Number(readings.V1).toFixed(2);
	}
	if (i1Display) {
		i1Display.textContent = Number(readings.I1).toFixed(2);
	}
	if (v2Display) {
		v2Display.textContent = Number(readings.V2).toFixed(2);
	}
	if (i2Display) {
		i2Display.textContent = Number(readings.I2).toFixed(2);
	}
	if (v3Display) {
		v3Display.textContent = Number(readings.V3).toFixed(2);
	}
	if (i3Display) {
		i3Display.textContent = Number(readings.I3).toFixed(2);
	}
}

function clearComponentDisplays() {
	const v1Display = document.getElementById('v1Display');
	const i1Display = document.getElementById('i1Display');
	const v2Display = document.getElementById('v2Display');
	const i2Display = document.getElementById('i2Display');
	const v3Display = document.getElementById('v3Display');
	const i3Display = document.getElementById('i3Display');

	if (v1Display) v1Display.textContent = '-';
	if (i1Display) i1Display.textContent = '-';
	if (v2Display) v2Display.textContent = '-';
	if (i2Display) i2Display.textContent = '-';
	if (v3Display) v3Display.textContent = '-';
	if (i3Display) i3Display.textContent = '-';
}

function updateSelectedComponentDisplay(component, reading) {
	clearComponentDisplays();

	if (component === 'Z1') {
		const v1Display = document.getElementById('v1Display');
		const i1Display = document.getElementById('i1Display');
		if (v1Display) v1Display.textContent = Number(reading.V).toFixed(2);
		if (i1Display) i1Display.textContent = Number(reading.I).toFixed(2);
	} else if (component === 'Z2') {
		const v2Display = document.getElementById('v2Display');
		const i2Display = document.getElementById('i2Display');
		if (v2Display) v2Display.textContent = Number(reading.V).toFixed(2);
		if (i2Display) i2Display.textContent = Number(reading.I).toFixed(2);
	} else if (component === 'Z3') {
		const v3Display = document.getElementById('v3Display');
		const i3Display = document.getElementById('i3Display');
		if (v3Display) v3Display.textContent = Number(reading.V).toFixed(2);
		if (i3Display) i3Display.textContent = Number(reading.I).toFixed(2);
	}
}

function updateInstrumentDisplays(reading) {
	const voltmeterDisplay = document.getElementById('voltmeterDisplay');
	const ammeterDisplay = document.getElementById('ammeterDisplay');
	const voltmeterPulse = document.getElementById('voltmeterPulse');
	const ammeterPulse = document.getElementById('ammeterPulse');
	const circuitVoltmeterReading = document.getElementById('circuitVoltmeterReading');
	const circuitAmmeterReading = document.getElementById('circuitAmmeterReading');
	const ammeterNeedleWrap = document.getElementById('ammeterNeedleWrap');
	const voltmeterNeedleWrap = document.getElementById('voltmeterNeedleWrap');

	const setMeterNeedle = (needleElement, value, minValue, maxValue, centerX, centerY) => {
		if (!needleElement) {
			return;
		}

		const numericValue = Number(value);
		const safeValue = Number.isFinite(numericValue) ? numericValue : minValue;
		const clampedValue = Math.min(maxValue, Math.max(minValue, safeValue));
		const ratio = maxValue > minValue ? (clampedValue - minValue) / (maxValue - minValue) : 0;
		const angle = -120 + (ratio * 240);

		needleElement.style.transformOrigin = `${centerX}px ${centerY}px`;
		needleElement.style.transform = `rotate(${angle}deg)`;
	};

	const animateLiveReading = (displayElement, pulseElement, textValue) => {
		if (!displayElement) {
			return;
		}

		const instrumentCard = displayElement.closest('.instrument-display-card');
		if (instrumentCard) {
			instrumentCard.classList.add('is-updating');
		}

		if (pulseElement) {
			pulseElement.classList.remove('is-active');
			window.requestAnimationFrame(() => {
				pulseElement.classList.add('is-active');
			});
			window.setTimeout(() => {
				pulseElement.classList.remove('is-active');
			}, 700);
		}

		displayElement.style.opacity = '0.45';
		displayElement.style.transform = 'translateY(-1px) scale(0.98)';

		window.setTimeout(() => {
			displayElement.textContent = textValue;
			window.requestAnimationFrame(() => {
				displayElement.style.opacity = '1';
				displayElement.style.transform = 'translateY(0) scale(1)';
			});
			window.setTimeout(() => {
				if (instrumentCard) {
					instrumentCard.classList.remove('is-updating');
				}
			}, 180);
		}, 110);
	};

	if (voltmeterDisplay) {
		animateLiveReading(voltmeterDisplay, voltmeterPulse, `${Number(reading.V).toFixed(2)} V`);
	}
	if (ammeterDisplay) {
		animateLiveReading(ammeterDisplay, ammeterPulse, `${Number(reading.I).toFixed(2)} mA`);
	}

	if (circuitVoltmeterReading) {
		circuitVoltmeterReading.textContent = `${Number(reading.V).toFixed(2)} V`;
	}
	if (circuitAmmeterReading) {
		circuitAmmeterReading.textContent = `${Number(reading.I).toFixed(2)} mA`;
	}

	setMeterNeedle(ammeterNeedleWrap, reading.I, 0, 5, 220, 180);
	setMeterNeedle(voltmeterNeedleWrap, reading.V, 0, 10, 505, 258);
}

function setBlackBoxActiveComponent(component) {
	const componentCards = document.querySelectorAll('[data-component-card]');
	const circuitComponents = document.querySelectorAll('[data-circuit-component]');
	const componentOptions = document.querySelectorAll('[data-component-option]');

	componentCards.forEach((card) => {
		const isActive = card.getAttribute('data-component-card') === component;
		card.classList.toggle('is-active', isActive);
		card.classList.toggle('is-muted', !isActive);
	});

	circuitComponents.forEach((group) => {
		const isActive = group.getAttribute('data-circuit-component') === component;
		group.classList.toggle('is-active', isActive);
		group.classList.toggle('is-muted', !isActive);
	});

	const selectedCircuitComponent = document.querySelector(`[data-circuit-component="${component}"]`);
	const selectedY = selectedCircuitComponent
		? Number(selectedCircuitComponent.getAttribute('data-circuit-y'))
		: 180;

	const updateLineY = (lineId, y1, y2) => {
		const line = document.getElementById(lineId);
		if (!line) {
			return;
		}
		line.setAttribute('y1', String(y1));
		line.setAttribute('y2', String(y2));
	};

	updateLineY('componentLeadLeft', 180, selectedY);
	updateLineY('componentLeadRight', 180, selectedY);
	updateLineY('voltmeterLeadLeft', selectedY, 258);
	updateLineY('voltmeterLeadRight', selectedY, 258);

	componentOptions.forEach((option) => {
		const isActive = option.getAttribute('data-component-option') === component;
		option.classList.toggle('is-active', isActive);
	});
}

function setBlackBoxActiveFrequency(freq) {
	const selectedFrequency = Number(freq);
	const frequencyChips = document.querySelectorAll('[data-frequency-chip]');
	const generatorFrequencyText = document.getElementById('generatorFrequencyText');

	frequencyChips.forEach((chip) => {
		const chipFrequency = Number(chip.getAttribute('data-frequency-chip'));
		chip.classList.toggle('is-active', chipFrequency === selectedFrequency);
	});

	if (generatorFrequencyText && Number.isFinite(selectedFrequency)) {
		generatorFrequencyText.textContent = `${selectedFrequency} Hz`;
	}
}

function updateBlackBoxRecordState(component, freq) {
	const isReady = Boolean(component) && Number.isFinite(Number(freq));
	const buttons = ['addReadingBtn', 'recordBtn'];

	buttons.forEach((buttonId) => {
		const button = document.getElementById(buttonId);
		if (button) {
			button.disabled = !isReady;
		}
	});
}

function updateSimulationDisplayWithDelay(readings, delayMs = 180) {
	const displayIds = ['v1Display', 'i1Display', 'v2Display', 'i2Display', 'v3Display', 'i3Display'];
	const displayElements = displayIds
		.map((id) => document.getElementById(id))
		.filter((element) => element);

	displayElements.forEach((element) => {
		element.style.transition = 'opacity 120ms ease';
		element.style.opacity = '0.45';
	});

	window.setTimeout(() => {
		updateSimulationDisplay(readings);
		displayElements.forEach((element) => {
			element.style.opacity = '1';
		});
	}, delayMs);
}

function highlightActiveFrequencyRow(freq) {
	const selectedFrequency = Number(freq);
	const observationRows = getObservationRows();

	observationRows.forEach((row) => {
		const frequencyCell = row.querySelector('td');
		const rowFrequency = frequencyCell ? Number(frequencyCell.textContent.trim()) : NaN;
		const isActive = rowFrequency === selectedFrequency;
		row.classList.toggle('active-frequency-row', isActive);
	});
}

function addReadingToTable() {
	const freqSelect = document.getElementById('freqSelect');
	const selectedComponentInput = document.querySelector('input[name="componentSelect"]:checked');
	if (!freqSelect || !selectedComponentInput) {
		return;
	}

	const selectedFrequency = Number(freqSelect.value);
	const selectedComponent = selectedComponentInput.value;
	const reading = getReading(selectedComponent, selectedFrequency);

	const observationRows = getObservationRows();
	const targetRow = observationRows.find((row) => {
		const frequencyCell = row.querySelector('td');
		if (!frequencyCell) {
			return false;
		}
		const text = frequencyCell.textContent.trim();
		const freqValue = Number(text.replace("Hz", "").trim());
		return freqValue === selectedFrequency;
	});

	if (!targetRow) {
		alert(`Could not find observation row for ${selectedFrequency} Hz.`);
		return;
	}

	const inputs = targetRow.querySelectorAll('input.measurement-input');
	let voltageInput;
	let currentInput;

	if (selectedComponent === 'Z1') {
		voltageInput = inputs[0];
		currentInput = inputs[1];
	} else if (selectedComponent === 'Z2') {
		voltageInput = inputs[2];
		currentInput = inputs[3];
	} else if (selectedComponent === 'Z3') {
		voltageInput = inputs[4];
		currentInput = inputs[5];
	}

	if (!voltageInput || !currentInput) {
		alert('Unable to record reading in the selected row.');
		return;
	}

	if (voltageInput.value.trim() !== '' || currentInput.value.trim() !== '') {
		alert('Reading already recorded for this frequency');
		return;
	}

	voltageInput.value = Number(reading.V).toFixed(2);
	currentInput.value = Number(reading.I).toFixed(2);
	voltageInput.readOnly = true;
	currentInput.readOnly = true;
	updateInstrumentDisplays(reading);
	showSuccessNotification(`✓ Reading added successfully for ${selectedComponent} at ${selectedFrequency} Hz`);
}

function legacyAddReadingToTableAllComponents() {
	const freqSelect = document.getElementById('freqSelect');
	if (!freqSelect) {
		return;
	}

	const selectedFrequency = Number(freqSelect.value);
	const readings = simulateReadings(selectedFrequency);

	const observationRows = getObservationRows();
	const targetRow = observationRows.find((row) => {
		const frequencyCell = row.querySelector('td');
		if (!frequencyCell) {
			return false;
		}
		const text = frequencyCell.textContent.trim();
		const freqValue = Number(text.replace("Hz", "").trim());
		return freqValue === selectedFrequency;
	});

	if (!targetRow) {
		alert(`Could not find observation row for ${selectedFrequency} Hz.`);
		return;
	}

	const inputs = targetRow.querySelectorAll('input.measurement-input');
	const targetInputs = [inputs[0], inputs[1], inputs[2], inputs[3], inputs[4], inputs[5]];

	const hasExistingValues = targetInputs.some((input) => input && input.value.trim() !== '');
	if (hasExistingValues) {
		alert('Reading already recorded for this frequency');
		return;
	}

	if (targetInputs[0]) {
		targetInputs[0].value = Number(readings.V1).toFixed(2);
	}
	if (targetInputs[1]) {
		targetInputs[1].value = Number(readings.I1).toFixed(2);
	}
	if (targetInputs[2]) {
		targetInputs[2].value = Number(readings.V2).toFixed(2);
	}
	if (targetInputs[3]) {
		targetInputs[3].value = Number(readings.I2).toFixed(2);
	}
	if (targetInputs[4]) {
		targetInputs[4].value = Number(readings.V3).toFixed(2);
	}
	if (targetInputs[5]) {
		targetInputs[5].value = Number(readings.I3).toFixed(2);
	}

	targetInputs.forEach((input) => {
		if (!input) {
			return;
		}
		input.readOnly = true;
	});
}

function getSelectedComponent() {
	const componentSelect = document.getElementById('componentSelect')
		|| document.getElementById('selectedComponent')
		|| document.getElementById('zSelect');

	if (componentSelect && componentSelect.value) {
		const normalized = componentSelect.value.toUpperCase().replace(/\s+/g, '');
		if (normalized === 'Z1' || normalized === 'Z2' || normalized === 'Z3') {
			return normalized;
		}
	}

	const componentRadio = document.querySelector('input[name="component"]:checked')
		|| document.querySelector('input[name="componentSelect"]:checked')
		|| document.querySelector('input[name="zComponent"]:checked');
	if (componentRadio && componentRadio.value) {
		const normalized = componentRadio.value.toUpperCase().replace(/\s+/g, '');
		if (normalized === 'Z1' || normalized === 'Z2' || normalized === 'Z3') {
			return normalized;
		}
	}

	return null;
}

function recordReading() {
	const freqSelect = document.getElementById('freqSelect');
	const selectedComponentInput = document.querySelector('input[name="componentSelect"]:checked');

	if (!freqSelect || !selectedComponentInput) {
		return;
	}

	const component = selectedComponentInput.value;
	const selectedFrequency = Number(freqSelect.value);
	if (!Number.isFinite(selectedFrequency)) {
		alert('Unable to record reading. Please verify frequency and instrument values.');
		return;
	}

	const reading = getReading(component, selectedFrequency);
	if (!Number.isFinite(reading.V) || !Number.isFinite(reading.I)) {
		alert('Unable to record reading. Please verify frequency and instrument values.');
		return;
	}

	const observationRows = getObservationRows();
	const targetRow = observationRows.find((row) => {
		const frequencyCell = row.querySelector('td');
		if (!frequencyCell) {
			return false;
		}
		return Number(frequencyCell.textContent.trim()) === selectedFrequency;
	});

	if (!targetRow) {
		alert(`Could not find observation row for ${selectedFrequency} Hz.`);
		return;
	}

	const inputs = targetRow.querySelectorAll('input.measurement-input');
	let voltageInput;
	let currentInput;

	if (component === 'Z1') {
		voltageInput = inputs[0];
		currentInput = inputs[1];
	} else if (component === 'Z2') {
		voltageInput = inputs[2];
		currentInput = inputs[3];
	} else if (component === 'Z3') {
		voltageInput = inputs[4];
		currentInput = inputs[5];
	}

	if (!voltageInput || !currentInput) {
		alert('Unable to record reading in the selected row.');
		return;
	}

	if (voltageInput.value.trim() !== '' || currentInput.value.trim() !== '') {
		alert('Reading already recorded');
		return;
	}

	voltageInput.value = Number(reading.V).toFixed(2);
	currentInput.value = Number(reading.I).toFixed(2);
	voltageInput.readOnly = true;
	currentInput.readOnly = true;
}

function formatNumber(value, digits = 4) {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) {
		return '-';
	}
	return numericValue.toFixed(digits);
}

function formatScientific(value, digits = 4) {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) {
		return '-';
	}
	return numericValue.toExponential(digits);
}

function getObservationRows() {
	const firstTableBody = document.querySelectorAll('.measurement-table tbody')[0];
	if (!firstTableBody) {
		return [];
	}

	const rows = Array.from(firstTableBody.querySelectorAll('tr'));
	return rows.slice(0, BLACKBOX_FREQUENCIES.length);
}

function enforcePositiveMeasurementInputs() {
	const observationRows = getObservationRows();
	observationRows.forEach((row) => {
		const inputs = row.querySelectorAll('input.measurement-input');
		for (let index = 0; index < 6; index += 1) {
			const input = inputs[index];
			if (!input) {
				continue;
			}

			input.setAttribute('min', '0');

			input.addEventListener('wheel', (event) => {
				event.preventDefault();
				input.blur();
			}, { passive: false });

			input.addEventListener('input', () => {
				if (!input.value) {
					return;
				}
				const numericValue = Number.parseFloat(input.value);
				if (Number.isFinite(numericValue) && numericValue < 0) {
					input.value = String(Math.abs(numericValue));
				}
			});
		}
	});
}

function getComponentValueRow(type, dataByType) {
	const values = dataByType[type];
	if (!values || !Array.isArray(values) || !values.length) {
		return null;
	}
	return values;
}

function displayBlackBoxResults(responseData) {
	const observationRows = getObservationRows();
	const x1 = responseData.X1 || [];
	x1.forEach((value, index) => {
		const row = observationRows[index];
		if (!row) {
			return;
		}
		const inputs = row.querySelectorAll('input.measurement-input');
		if (inputs[6]) {
			inputs[6].value = formatNumber(value, 3);
		}
	});

	const x2 = responseData.X2 || [];
	x2.forEach((value, index) => {
		const row = observationRows[index];
		if (!row) {
			return;
		}
		const inputs = row.querySelectorAll('input.measurement-input');
		if (inputs[7]) {
			inputs[7].value = formatNumber(value, 3);
		}
	});

	const x3 = responseData.X3 || [];
	x3.forEach((value, index) => {
		const row = observationRows[index];
		if (!row) {
			return;
		}
		const inputs = row.querySelectorAll('input.measurement-input');
		if (inputs[8]) {
			inputs[8].value = formatNumber(value, 3);
		}
	});

	const inferenceCells = document.querySelectorAll('.inference-cell');
	const zList = [responseData.Z1, responseData.Z2, responseData.Z3];
	zList.forEach((zData, index) => {
        const inferenceCell = inferenceCells[index];

        // Safety checks (prevents crashes)
        if (!inferenceCell || !zData || !zData.type || zData.value == null) {
            return;
        }

        inferenceCell.innerHTML = `
            Xz${index + 1} is ${zData.trend || 'unknown'}.
            <br><br>
            Hence Z${index + 1} is<br>
            ${zData.type}
        `;
    });

	const blanks = document.querySelectorAll('.result-summary-list .result-blank');
	zList.forEach((zData, index) => {
		const typeBlank = blanks[index * 2];
		const valueBlank = blanks[index * 2 + 1];
		if (typeBlank && zData) {
			typeBlank.textContent = zData.type;
		}
		if (valueBlank && zData) {
			const valueText = zData.unit === 'ohm'
				? `${formatNumber(zData.value, 2)} ohm`
				: `${formatScientific(zData.value, 3)} ${zData.unit}`;
			valueBlank.textContent = valueText;
		}
	});

	const tables = document.querySelectorAll('.measurement-table tbody');
    const secondTableBody = tables.length > 1 ? tables[1] : null;

    if (!secondTableBody) return;
	if (secondTableBody) {
		const valueRows = Array.from(secondTableBody.querySelectorAll('tr')).slice(0, BLACKBOX_FREQUENCIES.length);
		const dataByType = {
			Inductor: null,
			Capacitor: null,
			Resistor: null
		};

		zList.forEach((zData) => {
			if (!zData || !zData.type || !Array.isArray(zData.values_per_frequency)) {
				return;
			}
			if (zData.type && Array.isArray(zData.values_per_frequency)) {
                dataByType[zData.type] = zData.values_per_frequency;
            }
		});

		const lValues = getComponentValueRow('Inductor', dataByType);
		const cValues = getComponentValueRow('Capacitor', dataByType);
		const rValues = getComponentValueRow('Resistor', dataByType);

		valueRows.forEach((row, index) => {
			const inputs = row.querySelectorAll('input.measurement-input');
			if (inputs[0]) {
				inputs[0].value = lValues ? formatScientific(lValues[index], 3) : '';
			}
			if (inputs[1]) {
				inputs[1].value = cValues ? formatScientific(cValues[index], 3) : '';
			}
			if (inputs[2]) {
				inputs[2].value = rValues ? formatNumber(rValues[index], 3) : '';
			}
		});
	}

	renderBlackBoxReactanceGraphs(responseData);
}

async function calculateBlackBox() {
	const freq = [...BLACKBOX_FREQUENCIES];
	const V1 = [];
	const I1 = [];
	const V2 = [];
	const I2 = [];
	const V3 = [];
	const I3 = [];

	const observationRows = getObservationRows();
	if (observationRows.length !== BLACKBOX_FREQUENCIES.length) {
		alert('Observation table rows are not available.');
		return;
	}

	for (let index = 0; index < observationRows.length; index += 1) {
		const row = observationRows[index];
		const inputs = row.querySelectorAll('input.measurement-input');
		const requiredInputs = [inputs[0], inputs[1], inputs[2], inputs[3], inputs[4], inputs[5]];

		const hasEmpty = requiredInputs.some((input) => !input || input.value.trim() === '');
		if (hasEmpty) {
			alert(`Please fill all voltage and current values for ${freq[index]} Hz.`);
			return;
		}

		const v1 = parseFloat(inputs[0].value);
		const i1MilliAmp = parseFloat(inputs[1].value);
		const v2 = parseFloat(inputs[2].value);
		const i2MilliAmp = parseFloat(inputs[3].value);
		const v3 = parseFloat(inputs[4].value);
		const i3MilliAmp = parseFloat(inputs[5].value);

		if ([v1, i1MilliAmp, v2, i2MilliAmp, v3, i3MilliAmp].some((value) => !Number.isFinite(value) || value < 0)) {
			alert(`Please enter valid positive numeric values for ${freq[index]} Hz.`);
			return;
		}

		V1.push(v1);
		I1.push(i1MilliAmp / 1000);
		V2.push(v2);
		I2.push(i2MilliAmp / 1000);
		V3.push(v3);
		I3.push(i3MilliAmp / 1000);
	}

	try {
		const response = await fetch('/api/blackbox', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				freq,
				V1,
				I1,
				V2,
				I2,
				V3,
				I3
			})
		});

		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.error || `Request failed with status ${response.status}`);
		}

		displayBlackBoxResults(data);
	} catch (error) {
		console.error('Black box calculation failed:', error);
		alert(`Calculation failed: ${error.message}`);
	}
}

document.addEventListener('DOMContentLoaded', () => {
	initializeComponentMap();
	enforcePositiveMeasurementInputs();

	const freqSelect = document.getElementById('freqSelect');
	if (freqSelect) {
		const syncSimulationReadings = () => {
			const selectedRadio = document.querySelector('input[name="componentSelect"]:checked');
			const selectedComponent = selectedRadio ? selectedRadio.value : 'Z1';
			const selectedFrequency = Number(freqSelect.value);
			const instrumentReading = getReading(selectedComponent, selectedFrequency);
			setBlackBoxActiveComponent(selectedComponent);
			setBlackBoxActiveFrequency(selectedFrequency);
			updateBlackBoxRecordState(selectedComponent, selectedFrequency);
			highlightActiveFrequencyRow(selectedFrequency);
			updateSelectedComponentDisplay(selectedComponent, instrumentReading);
			updateInstrumentDisplays(instrumentReading);
		};

		freqSelect.addEventListener('change', syncSimulationReadings);
		document.querySelectorAll('input[name="componentSelect"]').forEach((radio) => {
			radio.addEventListener('change', syncSimulationReadings);
		});
		syncSimulationReadings();
	}

	const button = document.getElementById('calculateBlackBoxBtn');
	if (button) {
		button.addEventListener('click', calculateBlackBox);
	}

	const addReadingBtn = document.getElementById('addReadingBtn');
	if (addReadingBtn) {
		addReadingBtn.addEventListener('click', addReadingToTable);
	}

	const recordBtn = document.getElementById('recordBtn');
	if (recordBtn) {
		recordBtn.addEventListener('click', recordReading);
	}
});

