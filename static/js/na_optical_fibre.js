/**
 * Numerical Aperture of Optical Fiber Experiment
 * Table-based input workflow: read rows, call backend, fill results, compute means.
 */

let theta_values = [];
let na_values = [];

/**
 * Get NA observation table element.
 * @returns {HTMLTableElement|null}
 */
function getObservationTable() {
	return document.getElementById('naObservationTable');
}

/**
 * Get all table body rows for observations.
 * @returns {HTMLTableRowElement[]}
 */
function getObservationRows() {
	const table = getObservationTable();
	if (!table || !table.tBodies[0]) {
		return [];
	}

	return Array.from(table.tBodies[0].rows);
}

/**
 * Parse numeric input safely.
 * @param {HTMLInputElement|null} input
 * @returns {number|null}
 */
function parseInputValue(input) {
	if (!input || input.value.trim() === '') {
		return null;
	}

	const value = parseFloat(input.value);
	return Number.isFinite(value) ? value : null;
}

/**
 * Validate one row's L and D inputs.
 * @param {number|null} L
 * @param {number|null} D
 * @returns {boolean}
 */
function isValidRowInput(L, D) {
	if (L === null || D === null) {
		return false;
	}

	if (L <= 0 || D < 0) {
		return false;
	}

	return true;
}

/**
 * Build backend payload.
 * @param {number} L
 * @param {number} D
 * @returns {{L:number, D:number}}
 */
function prepareNAPayload(L, D) {
	return {
		L: Number(L),
		D: Number(D)
	};
}

/**
 * Call NA backend API.
 * @param {{L:number, D:number}} payload
 * @returns {Promise<{theta:number, NA:number}>}
 */
async function callNAApi(payload) {
	const response = await fetch('/api/na_optical_fibre', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	});

	const data = await response.json();
	if (!response.ok) {
		const message = data && data.error ? data.error : response.statusText;
		throw new Error(`HTTP ${response.status}: ${message}`);
	}

	return data;
}

/**
 * Normalize API response for safe rendering.
 * @param {{theta:number, NA:number}} apiResponse
 * @returns {{theta:number, NA:number}}
 */
function extractNAResponse(apiResponse) {
	const theta = Number(apiResponse.theta);
	const NA = Number(apiResponse.NA);

	if (!Number.isFinite(theta) || !Number.isFinite(NA)) {
		throw new Error('Invalid API response: theta/NA must be numeric.');
	}

	return { theta, NA };
}

/**
 * Fill one table row output cells.
 * @param {HTMLTableRowElement} row
 * @param {{theta:number, NA:number}} result
 */
function updateRowOutputs(row, result) {
	const thetaCell = row.querySelector('.theta-value');
	const naCell = row.querySelector('.na-value');

	if (thetaCell) {
		thetaCell.textContent = result.theta.toFixed(3);
	}

	if (naCell) {
		naCell.textContent = result.NA.toFixed(4);
	}
}

/**
 * Clear one row output cells.
 * @param {HTMLTableRowElement} row
 */
function clearRowOutputs(row) {
	const thetaCell = row.querySelector('.theta-value');
	const naCell = row.querySelector('.na-value');

	if (thetaCell) {
		thetaCell.textContent = '';
	}

	if (naCell) {
		naCell.textContent = '';
	}
}

/**
 * Compute arithmetic mean.
 * @param {number[]} values
 * @returns {number}
 */
function computeMean(values) {
	if (!values.length) {
		return 0;
	}

	const sum = values.reduce((acc, value) => acc + value, 0);
	return sum / values.length;
}

/**
 * Update result section values.
 */
function updateResults() {
	const meanThetaElement = document.getElementById('meanThetaValue');
	const meanNAElement = document.getElementById('meanNAValue');

	if (!meanThetaElement || !meanNAElement) {
		return;
	}

	if (!theta_values.length || !na_values.length) {
		meanThetaElement.textContent = '______';
		meanNAElement.textContent = '______';
		return;
	}

	meanThetaElement.textContent = computeMean(theta_values).toFixed(3);
	meanNAElement.textContent = computeMean(na_values).toFixed(4);
}

/**
 * Process one row by calling backend and updating output cells.
 * @param {HTMLTableRowElement} row
 * @returns {Promise<boolean>} true if row computed
 */
async function processObservationRow(row) {
	const lInput = row.querySelector('.na-l-input');
	const dInput = row.querySelector('.na-d-input');

	const L = parseInputValue(lInput);
	const D = parseInputValue(dInput);

	if (L === null && D === null) {
		clearRowOutputs(row);
		return false;
	}

	if (!isValidRowInput(L, D)) {
		clearRowOutputs(row);
		return false;
	}

	const payload = prepareNAPayload(L, D);
	const apiResponse = await callNAApi(payload);
	const result = extractNAResponse(apiResponse);

	updateRowOutputs(row, result);
	theta_values.push(result.theta);
	na_values.push(result.NA);

	return true;
}

/**
 * Handle Calculate All button click.
 */
async function calculateAllReadings() {
	try {
		theta_values = [];
		na_values = [];

		const rows = getObservationRows();
		if (!rows.length) {
			alert('Observation table rows are not available.');
			updateResults();
			return;
		}

		for (const row of rows) {
			await processObservationRow(row);
		}

		updateResults();
	} catch (error) {
		console.error('NA Calculate All failed:', error);
		alert(`Could not calculate readings: ${error.message}`);
	}
}

/**
 * Register event listeners.
 */
function attachEventListeners() {
	const calculateAllBtn = document.getElementById('calculateAllBtn');
	if (calculateAllBtn) {
		calculateAllBtn.addEventListener('click', calculateAllReadings);
	}
}

/**
 * Initialize NA experiment page.
 */
function initializeNAExperiment() {
	attachEventListeners();
	updateResults();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeNAExperiment);
} else {
	initializeNAExperiment();
}
