/**
 * Black Box experiment table calculator.
 * Reads table data, calls backend API, then renders computed results.
 */

const BLACKBOX_FREQUENCIES = [1000, 2000, 3000, 4000, 5000];
let componentMap = {};

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

	if (voltmeterDisplay) {
		voltmeterDisplay.textContent = `${Number(reading.V).toFixed(2)} V`;
	}
	if (ammeterDisplay) {
		ammeterDisplay.textContent = `${Number(reading.I).toFixed(2)} mA`;
	}
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

