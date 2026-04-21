/**
 * Black Box experiment table calculator.
 * Reads table data, calls backend API, then renders computed results.
 */

const BLACKBOX_FREQUENCIES = [1000, 2000, 3000, 4000, 5000];

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
	enforcePositiveMeasurementInputs();
	const button = document.getElementById('calculateBlackBoxBtn');
	if (button) {
		button.addEventListener('click', calculateBlackBox);
	}
});

