/**
 * Diffraction Grating Experiment Calculator
 * Reads lab data from table inputs and sends to backend for processing
 */
let diffractionChart = null;
// Constants
const GRATING_LPI = 500; // Lines per inch
const LPI_TO_LPM = 1 / 0.0254; // Conversion factor: lines per inch to lines per meter

/**
 * Get screen distance S from input (convert cm to meters)
 * @returns {number|null} Screen distance in meters, or null if invalid
 */
function getScreenDistance() {
	const input = document.getElementById('screen-distance');
	if (!input || !input.value) {
		return null;
	}
	const S_cm = parseFloat(input.value);
	if (isNaN(S_cm) || S_cm <= 0) {
		return null;
	}
	return S_cm / 100; // Convert cm to meters
}

/**
 * Get all 2xm values from table inputs (in cm)
 * Returns array with order and corresponding xm value
 * @returns {Array<{order: number, xm_m: number}>} Array of {order, xm_m} objects
 */
function getTableData() {
	const inputs = document.querySelectorAll('.two-xm-input');
	const data = [];

	inputs.forEach((input, index) => {
		const order = index + 1; // Orders 1-8
		if (input.value) {
			const two_xm_cm = parseFloat(input.value);
			if (!isNaN(two_xm_cm) && two_xm_cm > 0) {
				const xm_cm = two_xm_cm / 2;
				const xm_m = xm_cm / 100; // Convert cm to meters
				data.push({ order, xm_m, xm_cm });
			}
		}
	});

	return data;
}

/**
 * Validate collected data
 * @param {number|null} S_m - Screen distance in meters
 * @param {Array} tableData - Table data array
 * @returns {boolean} True if valid, false otherwise
 */
function validateData(S_m, tableData) {
	if (S_m === null) {
		alert('Please enter a valid Screen Distance S (in cm, must be positive)');
		return false;
	}

	if (tableData.length === 0) {
		alert('Please enter at least one 2xm value in the table');
		return false;
	}

	return true;
}

/**
 * Prepare API request payload
 * @param {number} S_m - Screen distance in meters
 * @param {Array<{order: number, xm_m: number}>} tableData - Table data
 * @returns {object} API request payload
 */
function prepareAPIPayload(S_m, tableData) {
	const N = GRATING_LPI * LPI_TO_LPM; // Convert LPI to lines per meter

	const orders = tableData.map(item => item.order);
	const x_values = tableData.map(item => item.xm_m);

	return {
		N: N,
		S: S_m,
		orders: orders,
		x_values: x_values
	};
}

/**
 * Call backend API
 * @param {object} payload - API request payload
 * @returns {Promise<object>} API response data
 */
async function callDiffractionAPI(payload) {
	try {
		const response = await fetch('/api/diffraction', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('API Error:', error);
		throw error;
	}
}

/**
 * Display results in table cells
 * @param {Array<{order: number, xm_m: number, xm_cm: number}>} tableData - Table data with original xm_cm
 * @param {object} apiResponse - API response containing calculations
 */
function displayResults(tableData, apiResponse) {
	const inputs = document.querySelectorAll('.two-xm-input');

	// Map tableData by order for easy lookup
	const dataMap = {};
	tableData.forEach(item => {
		dataMap[item.order] = item;
	});

	// Map API response by order for easy lookup
	const responseMap = {};
	if (apiResponse.orders && apiResponse.theta && apiResponse.sin_theta && apiResponse.wavelength) {
		apiResponse.orders.forEach((order, index) => {
			responseMap[order] = {
				theta: apiResponse.theta[index],
				sin_theta: apiResponse.sin_theta[index],
				wavelength: apiResponse.wavelength[index]
			};
		});
	}

	// Fill table cells for each row
	inputs.forEach((input, index) => {
		const order = index + 1;
		const row = input.closest('tr');

		if (!row) return;

		const xmCell = row.querySelector('.xm-value');
		const thetaCell = row.querySelector('.theta-value');
		const sinThetaCell = row.querySelector('.sin-theta-value');
		const lambdaCell = row.querySelector('.lambda-value');

		if (dataMap[order]) {
			// Display xm in cm
			if (xmCell) {
				xmCell.textContent = dataMap[order].xm_cm.toFixed(2);
			}
		}

		if (responseMap[order]) {
			const result = responseMap[order];

			// Display theta in degrees
			if (thetaCell) {
				const theta_deg = result.theta * (180 / Math.PI);
				thetaCell.textContent = theta_deg.toFixed(2);
			}

			// Display sin(theta)
			if (sinThetaCell) {
				sinThetaCell.textContent = result.sin_theta.toFixed(4);
			}

			// Display wavelength in nm
			if (lambdaCell) {
				const wavelength_nm = result.wavelength * 1e9;
				lambdaCell.textContent = wavelength_nm.toFixed(2);
			}
		}
	});

	// Display average wavelength
	const avgWavelengthNm = apiResponse.average_wavelength * 1e9;
	const avgWavelengthElement = document.getElementById('average-wavelength');
	if (avgWavelengthElement) {
		avgWavelengthElement.textContent = avgWavelengthNm.toFixed(2);
	}

	// Display final wavelength result
	const finalWavelengthElement = document.getElementById('final-wavelength');
	if (finalWavelengthElement) {
		finalWavelengthElement.textContent = avgWavelengthNm.toFixed(2);
	}
}

function plotGraph(apiResponse) {
    const ctx = document.getElementById('diffractionChart');

    if (!ctx) return;

    // Destroy old chart if exists
    if (diffractionChart) {
        diffractionChart.destroy();
    }

    const orders = apiResponse.orders;
    const sinTheta = apiResponse.sin_theta;

    diffractionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: orders,
            datasets: [{
                label: 'sinθ',
                data: sinTheta,
                borderWidth: 2,
                fill: false,
                tension: 0,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
			maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Order (m)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'sinθ'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Clear all result cells
 */
function clearResults() {
	// Clear table data cells
	document.querySelectorAll('.xm-value, .theta-value, .sin-theta-value, .lambda-value').forEach(cell => {
		cell.textContent = '';
	});

	// Clear average wavelength
	const avgWavelengthElement = document.getElementById('average-wavelength');
	if (avgWavelengthElement) {
		avgWavelengthElement.textContent = '';
	}

	// Clear final wavelength
	const finalWavelengthElement = document.getElementById('final-wavelength');
	if (finalWavelengthElement) {
		finalWavelengthElement.textContent = '';
	}
}

/**
 * Main computation handler
 */
async function computeDiffraction() {
	try {
		// Clear previous results
		clearResults();

		// Collect and validate data
		const S_m = getScreenDistance();
		const tableData = getTableData();

		if (!validateData(S_m, tableData)) {
			return;
		}

		// Prepare API payload
		const payload = prepareAPIPayload(S_m, tableData);

		// Call API
		const apiResponse = await callDiffractionAPI(payload);

		// Display results
		displayResults(tableData, apiResponse);
		// Plot graph
		plotGraph(apiResponse);

		console.log('Diffraction calculation completed successfully', apiResponse);
	} catch (error) {
		console.error('Computation failed:', error);
		alert(`Calculation error: ${error.message}`);
	}
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
	const computeBtn = document.getElementById('compute-btn');

	if (computeBtn) {
		computeBtn.addEventListener('click', computeDiffraction);
	}
}

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', () => {
	initializeEventListeners();
	console.log('Diffraction experiment initialized');
});
