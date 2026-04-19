/**
 * Numerical Aperture of Optical Fiber Experiment
 * Table-based input workflow: read rows, call backend, fill results, compute means.
 */

let theta_values = [];
let na_values = [];
const LAB_L_VALUES = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
const EXPLORE_L_RANGE = {
	min: 0,
	max: 5
};
const NA_MODES = Object.freeze({
	LAB: 'lab',
	EXPLORE: 'explore'
});

if (!window.naExperimentState) {
	window.naExperimentState = {
		mode: NA_MODES.LAB,
		setMode(nextMode) {
			if (nextMode !== NA_MODES.LAB && nextMode !== NA_MODES.EXPLORE) {
				return;
			}

			if (this.mode === nextMode) {
				return;
			}

			this.mode = nextMode;
			document.dispatchEvent(
				new CustomEvent('na:mode-changed', {
					detail: { mode: nextMode }
				})
			);
		}
	};
}

function getCurrentMode() {
	return window.naExperimentState && window.naExperimentState.mode
		? window.naExperimentState.mode
		: NA_MODES.LAB;
}

function isExploreMode() {
	return getCurrentMode() === NA_MODES.EXPLORE;
}

function setCurrentMode(mode) {
	if (window.naExperimentState && typeof window.naExperimentState.setMode === 'function') {
		window.naExperimentState.setMode(mode);
	}

	updateModeLabels(mode);
}

/**
 * Update mode label chips.
 * @param {'lab'|'explore'} mode
 */
function updateModeLabels(mode) {
	const labLabel = document.getElementById('naModeLabLabel');
	const exploreLabel = document.getElementById('naModeExploreLabel');

	if (!labLabel || !exploreLabel) {
		return;
	}

	const exploreModeActive = mode === NA_MODES.EXPLORE;
	labLabel.classList.toggle('is-active', !exploreModeActive);
	exploreLabel.classList.toggle('is-active', exploreModeActive);
}

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
 * Check whether a value already belongs to fixed lab readings.
 * @param {number} value
 * @returns {boolean}
 */
function isLabManualLValue(value) {
	if (!Number.isFinite(value)) {
		return false;
	}

	return LAB_L_VALUES.some((labValue) => Math.abs(labValue - value) < 0.0001);
}

/**
 * Parse any row L value (fixed cell or editable input).
 * @param {HTMLTableRowElement} row
 * @returns {number|null}
 */
function parseAnyRowLValue(row) {
	const fixedL = parseFixedLValue(row);
	if (fixedL !== null) {
		return fixedL;
	}

	return parseEditableLValue(row);
}

/**
 * Check whether a given L value already exists elsewhere in the table.
 * @param {number} value
 * @param {HTMLTableRowElement} currentRow
 * @returns {boolean}
 */
function isDuplicateLInTable(value, currentRow) {
	if (!Number.isFinite(value)) {
		return false;
	}

	const rows = getObservationRows();
	for (const row of rows) {
		if (row === currentRow) {
			continue;
		}

		const rowL = parseAnyRowLValue(row);
		if (rowL !== null && Math.abs(rowL - value) < 0.0001) {
			return true;
		}
	}

	return false;
}

/**
 * Get or create warning node for an explore row L cell.
 * @param {HTMLTableRowElement} row
 * @returns {HTMLDivElement|null}
 */
function getExploreWarningNode(row) {
	const lCell = row.cells[1];
	if (!lCell) {
		return null;
	}

	let warning = lCell.querySelector('.na-explore-l-warning');
	if (!warning) {
		warning = document.createElement('div');
		warning.className = 'na-explore-l-warning';
		warning.style.display = 'none';
		warning.textContent = 'Duplicate L value not allowed';
		lCell.appendChild(warning);
	}

	return warning;
}

/**
 * Set warning visibility for an explore row.
 * @param {HTMLTableRowElement} row
 * @param {boolean} show
 * @param {string} [message]
 */
function setExploreWarning(row, show, message) {
	const warning = getExploreWarningNode(row);
	if (!warning) {
		return;
	}

	if (message) {
		warning.textContent = message;
	}

	warning.style.display = show ? 'block' : 'none';
}

/**
 * Notify simulation to sync to an explore-row custom L value.
 * @param {number} value
 */
function emitExploreLValue(value) {
	document.dispatchEvent(
		new CustomEvent('na:explore-l-selected', {
			detail: { L: value }
		})
	);
}

/**
 * Validate explore row L input against lab values.
 * @param {HTMLTableRowElement} row
 * @returns {boolean}
 */
function validateExploreRowL(row) {
	if (!row.classList.contains('na-explore-row')) {
		return true;
	}

	if (!isExploreMode()) {
		setExploreWarning(row, false);
		return true;
	}

	const lValue = parseEditableLValue(row);
	if (lValue === null) {
		setExploreWarning(row, false);
		return true;
	}

	if (lValue < EXPLORE_L_RANGE.min || lValue > EXPLORE_L_RANGE.max) {
		setExploreWarning(row, true, 'L must be within simulation range');
		return false;
	}

	const isDuplicate = isLabManualLValue(lValue) || isDuplicateLInTable(lValue, row);
	setExploreWarning(row, isDuplicate, 'Duplicate L value not allowed');
	return !isDuplicate;
}

/**
 * Read fixed L value from row.
 * @param {HTMLTableRowElement} row
 * @returns {number|null}
 */
function parseFixedLValue(row) {
	const lCell = row.querySelector('.na-l-fixed');
	if (!lCell) {
		return null;
	}

	const source = lCell.dataset.l || lCell.textContent;
	const value = parseFloat(String(source).trim());
	return Number.isFinite(value) ? value : null;
}

/**
 * Read editable L value from appended exploration row.
 * @param {HTMLTableRowElement} row
 * @returns {number|null}
 */
function parseEditableLValue(row) {
	const lInput = row.querySelector('.na-l-input');
	return parseInputValue(lInput);
}

/**
 * Resolve L value for a row (fixed lab row or editable exploration row).
 * @param {HTMLTableRowElement} row
 * @returns {number|null}
 */
function parseRowLValue(row) {
	const fixedL = parseFixedLValue(row);
	if (fixedL !== null) {
		return fixedL;
	}

	return parseEditableLValue(row);
}

/**
 * Get next trial number for a newly appended row.
 * @returns {number}
 */
function getNextTrialNumber() {
	const rows = getObservationRows();
	if (!rows.length) {
		return 1;
	}

	const lastRow = rows[rows.length - 1];
	const firstCell = lastRow.querySelector('td');
	const parsed = firstCell ? parseInt(firstCell.textContent.trim(), 10) : NaN;
	return Number.isFinite(parsed) ? parsed + 1 : rows.length + 1;
}

/**
 * Append one exploration row with editable L and D values.
 */
function appendExplorationRow() {
	const table = getObservationTable();
	if (!table || !table.tBodies[0]) {
		alert('Observation table is not available.');
		return;
	}

	setCurrentMode(NA_MODES.EXPLORE);

	const trialNumber = getNextTrialNumber();
	const row = table.tBodies[0].insertRow();
	row.classList.add('na-explore-row');

	row.innerHTML = `
		<td>${trialNumber}</td>
		<td><input type="number" step="0.01" min="0" class="input-compact na-l-input" data-trial="${trialNumber}"></td>
		<td><input type="number" step="0.01" min="0" class="input-compact na-d-input" data-trial="${trialNumber}"></td>
		<td class="theta-value"></td>
		<td class="na-value"></td>
	`;

	const lInput = row.querySelector('.na-l-input');
	if (lInput) {
		lInput.addEventListener('input', () => {
			const isValid = validateExploreRowL(row);
			if (!isValid) {
				return;
			}

			const value = parseEditableLValue(row);
			if (value !== null) {
				emitExploreLValue(value);
			}
		});
		lInput.addEventListener('blur', () => {
			const isValid = validateExploreRowL(row);
			if (!isValid) {
				return;
			}

			const value = parseEditableLValue(row);
			if (value !== null) {
				emitExploreLValue(value);
			}
		});
	}

	setExploreWarning(row, false);
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
	const dInput = row.querySelector('.na-d-input');

	const L = parseRowLValue(row);
	const D = parseInputValue(dInput);

	if (!validateExploreRowL(row)) {
		clearRowOutputs(row);
		return false;
	}

	if (D === null) {
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
 * Reset table to initial lab state.
 */
function resetNAExperiment() {
	theta_values = [];
	na_values = [];

	const rows = getObservationRows();
	for (const row of rows) {
		const dInput = row.querySelector('.na-d-input');
		if (dInput) {
			dInput.value = '';
		}

		const warning = row.querySelector('.na-explore-l-warning');
		if (warning) {
			warning.style.display = 'none';
		}

		clearRowOutputs(row);
	}

	for (const row of rows) {
		if (row.classList.contains('na-explore-row')) {
			row.remove();
		}
	}

	setCurrentMode(NA_MODES.LAB);
	updateResults();
	document.dispatchEvent(new CustomEvent('na:experiment-reset'));
}

/**
 * Register event listeners.
 */
function attachEventListeners() {
	const calculateAllBtn = document.getElementById('calculateAllBtn');
	const exploreMoreBtn = document.getElementById('exploreMoreBtn');
	const resetExperimentBtn = document.getElementById('resetExperimentBtn');
	if (calculateAllBtn) {
		calculateAllBtn.addEventListener('click', calculateAllReadings);
	}

	if (exploreMoreBtn) {
		exploreMoreBtn.addEventListener('click', appendExplorationRow);
	}

	if (resetExperimentBtn) {
		resetExperimentBtn.addEventListener('click', resetNAExperiment);
	}
}

/**
 * Initialize NA experiment page.
 */
function initializeNAExperiment() {
	attachEventListeners();
	setCurrentMode(NA_MODES.LAB);
	document.addEventListener('na:mode-changed', (event) => {
		const mode = event.detail && event.detail.mode ? event.detail.mode : getCurrentMode();
		updateModeLabels(mode);
	});
	updateResults();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeNAExperiment);
} else {
	initializeNAExperiment();
}
