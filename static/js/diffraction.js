// Chart instances for cleanup
let orderThetaChart = null;
let orderWavelengthChart = null;

/**
 * Parse comma-separated input and convert to numeric array
 * @param {string} input - Comma-separated values
 * @returns {number[]} Array of numbers
 */
function parseCommaSeparatedInput(input) {
	return input
		.split(',')
		.map(val => parseFloat(val.trim()))
		.filter(val => !isNaN(val));
}

/**
 * Get input values from the form
 * @returns {object} Object containing form inputs
 */
function getFormInputs() {
	const N = parseFloat(document.getElementById('grating-lines').value);
	const S = parseFloat(document.getElementById('screen-distance').value);
	const orders = parseCommaSeparatedInput(document.getElementById('orders-list').value);
	const x_values = parseCommaSeparatedInput(document.getElementById('x-values-list').value);

	return { N, S, orders, x_values };
}

/**
 * Validate form inputs
 * @param {object} inputs - Form inputs object
 * @returns {boolean} True if valid, false otherwise
 */
function validateInputs(inputs) {
	const { N, S, orders, x_values } = inputs;

	if (!N || N <= 0) {
		alert('Please enter a valid Grating Lines per Meter (N > 0)');
		return false;
	}

	if (!S || S <= 0) {
		alert('Please enter a valid Screen Distance (S > 0)');
		return false;
	}

	if (!orders || orders.length === 0) {
		alert('Please enter valid Order values (comma-separated)');
		return false;
	}

	if (!x_values || x_values.length === 0) {
		alert('Please enter valid X values (comma-separated)');
		return false;
	}

	if (orders.length !== x_values.length) {
		alert('Orders and X values must have the same length');
		return false;
	}

	return true;
}

/**
 * Update output display elements
 * @param {object} data - Backend response data
 */
function updateOutputs(data) {
	// Grating constant (convert to scientific notation for readability)
	const gratConstantElement = document.getElementById('grating-constant');
	gratConstantElement.textContent = data.grating_constant.toExponential(4);

	// Average wavelength (convert meters to nanometers)
	const avgWavelengthNm = data.average_wavelength * 1e9;
	const avgWavelengthElement = document.getElementById('avg-wavelength');
	avgWavelengthElement.textContent = avgWavelengthNm.toFixed(2);
}

/**
 * Destroy existing Chart.js chart instance if it exists
 * @param {Chart} chartInstance - Chart instance to destroy
 */
function destroyChart(chartInstance) {
	if (chartInstance) {
		chartInstance.destroy();
	}
}

/**
 * Create Order vs Theta chart
 * @param {number[]} orders - Array of order values
 * @param {number[]} theta - Array of theta values (in degrees)
 * @returns {Chart} Chart instance
 */
function createOrderThetaChart(orders, theta) {
	destroyChart(orderThetaChart);

	const ctx = document.getElementById('order-theta-canvas').getContext('2d');
	orderThetaChart = new Chart(ctx, {
		type: 'scatter',
		data: {
			datasets: [{
				label: 'Order vs Theta',
				data: orders.map((order, index) => ({
					x: order,
					y: theta[index]
				})),
				backgroundColor: 'rgba(75, 192, 192, 0.6)',
				borderColor: 'rgba(75, 192, 192, 1)',
				borderWidth: 2,
				pointRadius: 6,
				showLine: true,
				tension: 0.1
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: {
					display: true
				},
				title: {
					display: false
				}
			},
			scales: {
				x: {
					title: {
						display: true,
						text: 'Order'
					},
					beginAtZero: true
				},
				y: {
					title: {
						display: true,
						text: 'Theta (°)'
					},
					beginAtZero: true
				}
			}
		}
	});

	return orderThetaChart;
}

/**
 * Create Order vs Wavelength chart
 * @param {number[]} orders - Array of order values
 * @param {number[]} wavelength - Array of wavelength values (in meters)
 * @returns {Chart} Chart instance
 */
function createOrderWavelengthChart(orders, wavelength) {
	destroyChart(orderWavelengthChart);

	// Convert wavelength from meters to nanometers
	const wavelengthNm = wavelength.map(w => w * 1e9);

	const ctx = document.getElementById('order-wavelength-canvas').getContext('2d');
	orderWavelengthChart = new Chart(ctx, {
		type: 'scatter',
		data: {
			datasets: [{
				label: 'Order vs Wavelength',
				data: orders.map((order, index) => ({
					x: order,
					y: wavelengthNm[index]
				})),
				backgroundColor: 'rgba(153, 102, 255, 0.6)',
				borderColor: 'rgba(153, 102, 255, 1)',
				borderWidth: 2,
				pointRadius: 6,
				showLine: true,
				tension: 0.1
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: {
					display: true
				},
				title: {
					display: false
				}
			},
			scales: {
				x: {
					title: {
						display: true,
						text: 'Order'
					},
					beginAtZero: true
				},
				y: {
					title: {
						display: true,
						text: 'Wavelength (nm)'
					},
					beginAtZero: true
				}
			}
		}
	});

	return orderWavelengthChart;
}

/**
 * Call backend API to perform diffraction calculation
 * @param {object} inputs - Form inputs object
 * @returns {object} Backend response data
 */
async function callDiffractionAPI(inputs) {
	try {
		const response = await fetch('/api/diffraction', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(inputs)
		});

		if (!response.ok) {
			throw new Error(`API Error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('Error calling API:', error);
		alert(`Error: ${error.message}`);
		throw error;
	}
}

/**
 * Main computation handler
 */
async function computeDiffraction() {
	try {
		// Get and validate inputs
		const inputs = getFormInputs();
		if (!validateInputs(inputs)) {
			return;
		}

		// Call backend API
		const response = await callDiffractionAPI(inputs);

		// Update output values
		updateOutputs(response);

		// Create charts
		const thetaDeg = response.theta.map(t => t * 180 / Math.PI);
        createOrderThetaChart(response.orders, thetaDeg);
		createOrderWavelengthChart(response.orders, response.wavelength);

		console.log('Diffraction calculation completed successfully', response);
	} catch (error) {
		console.error('Computation failed:', error);
	}
}

/**
 * Reset output and charts
 */
function resetResults() {
	// Reset output values
	document.getElementById('grating-constant').textContent = '—';
	document.getElementById('avg-wavelength').textContent = '—';

	// Destroy charts
	destroyChart(orderThetaChart);
	destroyChart(orderWavelengthChart);
	orderThetaChart = null;
	orderWavelengthChart = null;
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
	const computeBtn = document.getElementById('compute-btn');
	const resetBtn = document.getElementById('reset-btn');
	const form = document.getElementById('diffraction-form');

	if (computeBtn) {
		computeBtn.addEventListener('click', computeDiffraction);
	}

	if (resetBtn) {
		resetBtn.addEventListener('click', resetResults);
	}

	// Optional: Reset results when form is reset
	if (form) {
		form.addEventListener('reset', resetResults);
	}
}

/**
 * DOMContentLoaded event to initialize the page
 */
document.addEventListener('DOMContentLoaded', () => {
	initializeEventListeners();
	console.log('Diffraction experiment initialized');
});
