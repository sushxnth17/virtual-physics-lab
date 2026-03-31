/**
 * Photodiode Characteristics Experiment
 * Graph-driven lab calculations with slope-based results.
 */

let voltageGraph = null;
let intensityGraph = null;

/**
 * Parse a numeric value from string.
 * @param {string} value
 * @returns {number}
 */
function toNumber(value) {
	const parsed = parseFloat(value);
	return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Convert microampere to ampere.
 * @param {number} currentMicroampere
 * @returns {number}
 */
function microampereToAmpere(currentMicroampere) {
	return currentMicroampere * 1e-6;
}

/**
 * Compute average of valid finite numbers.
 * @param {number[]} values
 * @returns {number}
 */
function average(values) {
	if (!values.length) {
		return 0;
	}

	const total = values.reduce((sum, value) => sum + value, 0);
	return total / values.length;
}

/**
 * Format number as coefficient × 10^exponent using 2 decimal places.
 * @param {number} value
 * @returns {string}
 */
function formatScientific(value) {
	if (!Number.isFinite(value) || value <= 0) {
		return '0.00 × 10<sup>0</sup>';
	}

	const [coefficient, exponentText = '0'] = value.toExponential(2).split('e');
	const exponent = String(parseInt(exponentText, 10));
	return `${coefficient} × 10<sup>${exponent}</sup>`;
}

/**
 * Calculate percentage error between direct and graph-based measurements.
 * Formula: % Error = |Direct - Graph| / Direct × 100
 * @param {number} directValue
 * @param {number} graphValue
 * @returns {number} percentage error
 */
function calculatePercentError(directValue, graphValue) {
	if (!Number.isFinite(directValue) || directValue === 0) {
		return 0;
	}
	return Math.abs((directValue - graphValue) / directValue) * 100;
}

/**
 * Generate observation text based on error percentage.
 * @param {number} percentError
 * @returns {string}
 */
function getObservationText(percentError) {
	if (percentError < 5) {
		return 'excellent agreement between direct and graph-based calculations';
	} else if (percentError < 15) {
		return 'good agreement with minor experimental variations';
	} else if (percentError < 30) {
		return 'reasonable agreement considering measurement uncertainties';
	} else {
		return 'notable differences suggesting potential measurement errors or non-linearity';
	}
}

/**
 * Calculate linear regression slope and intercept using least-squares method.
 * Formula: m = [NΣ(xy) - ΣxΣy] / [NΣ(x²) - (Σx)²]
 * Uses all data points for accurate regression.
 * @param {Array<{x: number, y: number}>} points
 * @returns {{slope: number, intercept: number}}
 */
function linearRegression(points) {
	if (points.length < 2) {
		return { slope: 0, intercept: 0 };
	}

	const n = points.length;
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumX2 = 0;

	// Calculate all required sums using all data points
	points.forEach((p) => {
		sumX += p.x;
		sumY += p.y;
		sumXY += p.x * p.y;
		sumX2 += p.x * p.x;
	});

	// Apply least-squares formula
	const denominator = n * sumX2 - sumX * sumX;
	const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
	const intercept = (sumY - slope * sumX) / n;

	return { slope, intercept };
}

/**
 * Find both tabular data tables in the photodiode page.
 * @returns {{reverseTable: HTMLTableElement | null, responsivityTable: HTMLTableElement | null}}
 */
function getPhotodiodeTables() {
	const allTables = document.querySelectorAll('.experiment-section .observation-table');
	return {
		reverseTable: allTables[0] || null,
		responsivityTable: allTables[1] || null
	};
}

/**
 * Read reverse-bias pairs (V, I) from table rows.
 * @param {HTMLTableElement | null} table
 * @returns {Array<{voltage: number, current: number}>}
 */
function readReverseBiasRows(table) {
	if (!table) {
		return [];
	}

	const rows = Array.from(table.querySelectorAll('tr')).slice(1);
	const pairs = [];

	rows.forEach((row) => {
		const cells = row.querySelectorAll('td');
		if (cells.length < 2) {
			return;
		}

		const voltage = toNumber(cells[0].textContent ? cells[0].textContent.trim() : '');
		const currentInput = cells[1].querySelector('input');
		const currentMicroampere = toNumber(currentInput ? currentInput.value : '');
		const current = microampereToAmpere(currentMicroampere);

		if (Number.isFinite(voltage) && Number.isFinite(current) && current > 0) {
			pairs.push({ voltage, current });
		}
	});

	return pairs;
}

/**
 * Read responsivity pairs (I, intensity) from table rows.
 * @param {HTMLTableElement | null} table
 * @returns {Array<{current: number, intensity: number}>}
 */
function readResponsivityRows(table) {
	if (!table) {
		return [];
	}

	const rows = Array.from(table.querySelectorAll('tr')).slice(1);
	const pairs = [];

	rows.forEach((row) => {
		const cells = row.querySelectorAll('td');
		if (cells.length < 3) {
			return;
		}

		const currentInput = cells[1].querySelector('input');
		const intensityInput = cells[2].querySelector('input');
		const currentMicroampere = toNumber(currentInput ? currentInput.value : '');
		const current = microampereToAmpere(currentMicroampere);
		const intensity = toNumber(intensityInput ? intensityInput.value : '');

		if (Number.isFinite(current) && Number.isFinite(intensity) && current > 0 && intensity > 0) {
			pairs.push({ current, intensity });
		}
	});

	return pairs;
}

/**
 * Chart.js plugin to draw slope triangle (rise/run visualization) on graphs.
 * Displays ΔY and ΔX labels on the best-fit line.
 */
const slopeTrianglePlugin = {
	id: 'slopeTrianglePlugin',
	afterDatasetsDraw(chart) {
		const ctx = chart.ctx;
		const xScale = chart.scales.x;
		const yScale = chart.scales.y;

		// Only draw if we have more than one dataset (data + fit line)
		if (chart.data.datasets.length < 2) {
			return;
		}

		const fittedLineDataset = chart.data.datasets[1]; // Best fit line
		if (!fittedLineDataset || !fittedLineDataset.data || fittedLineDataset.data.length < 2) {
			return;
		}

		const points = fittedLineDataset.data;
		if (points.length < 2) {
			return;
		}

		// Use middle of the range for triangle
		const midIdx = Math.floor(points.length / 2);
		const p1 = points[Math.max(0, midIdx - 2)];
		const p2 = points[Math.min(points.length - 1, midIdx + 2)];

		if (!p1 || !p2 || !Number.isFinite(p1.x) || !Number.isFinite(p1.y) || !Number.isFinite(p2.x) || !Number.isFinite(p2.y)) {
			return;
		}

		const x1 = xScale.getPixelForValue(p1.x);
		const y1 = yScale.getPixelForValue(p1.y);
		const x2 = xScale.getPixelForValue(p2.x);
		const y2 = yScale.getPixelForValue(p2.y);

		// Draw right triangle
		ctx.save();
		ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
		ctx.lineWidth = 1.5;
		ctx.setLineDash([4, 4]);

		// Vertical line (ΔY)
		ctx.beginPath();
		ctx.moveTo(x2, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();

		// Horizontal line (ΔX)
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y1);
		ctx.stroke();

		// Draw labels
		ctx.setLineDash([]);
		ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
		ctx.font = 'bold 11px Arial';
		ctx.textAlign = 'center';

		const deltaX = Math.abs(p2.x - p1.x).toFixed(2);
		const deltaY = Math.abs(p2.y - p1.y).toFixed(2);

		// ΔX label
		ctx.fillText(`ΔX = ${deltaX}`, (x1 + x2) / 2, y1 + 15);

		// ΔY label
		ctx.textAlign = 'right';
		ctx.fillText(`ΔY = ${deltaY}`, x2 - 10, (y1 + y2) / 2);

		ctx.restore();
	}
};

/**
 * Chart.js plugin to draw slope triangle (rise/run visualization) on graphs.
 * Displays ΔY and ΔX labels on the best-fit line.
 */
function getVoltageGraphData(reverseRows) {
	return reverseRows.map((row) => ({
		x: row.voltage,
		y: row.current * 1e6 // Convert back to µA for display
	}));
}

/**
 * Extract graph data (x, y points) for I vs Intensity graph.
 * X-axis: Intensity (Lux)
 * Y-axis: Current (µA)
 * @param {Array<{current: number, intensity: number}>} responsivityRows
 * @returns {Array<{x: number, y: number}>}
 */
function getIntensityGraphData(responsivityRows) {
	return responsivityRows.map((row) => ({
		x: row.intensity,
		y: row.current * 1e6 // Convert back to µA for display
	}));
}

/**
 * Plot I vs V graph (Reverse Bias Characteristics).
 * @param {Array<{x: number, y: number}>} data - Display data in µA
 * @param {number} slope - Slope in A/V
 * @param {number} intercept - Intercept in A
 */
function plotVoltageGraph(data, slope, intercept) {
	if (!data || data.length < 2) {
		alert('Insufficient data points for voltage graph (need at least 2).');
		return;
	}

	const ctx = document.getElementById('voltageGraphCanvas');
	if (!ctx) {
		return;
	}

	// Destroy existing chart if present
	if (voltageGraph) {
		voltageGraph.destroy();
	}

	// Sort data by x for better display
	const sortedData = [...data].sort((a, b) => a.x - b.x);

	// Calculate fitted line points using slope and intercept
	const minX = Math.min(...sortedData.map((p) => p.x));
	const maxX = Math.max(...sortedData.map((p) => p.x));
	
	// Convert slope and intercept to µA units for display
	const slopeDisplay = slope * 1e6; // A/V → µA/V
	const interceptDisplay = intercept * 1e6; // A → µA
	
	// Create best fit line with multiple points for smooth rendering
	const fittedPoints = [];
	const step = (maxX - minX) / 25; // 25 points for smooth line
	for (let x = minX; x <= maxX; x += step) {
		fittedPoints.push({ x: parseFloat(x.toFixed(4)), y: slopeDisplay * x + interceptDisplay });
	}
	fittedPoints.push({ x: maxX, y: slopeDisplay * maxX + interceptDisplay }); // Ensure end point

	voltageGraph = new Chart(ctx, {
		type: 'line',
		data: {
			datasets: [
				{
					label: '● Measured Data',
					data: sortedData,
					borderColor: 'rgb(66, 133, 244)',
					backgroundColor: 'rgb(66, 133, 244)',
					fill: false,
					tension: 0.1,
					borderWidth: 2.5,
					pointRadius: 6,
					pointHoverRadius: 8,
					pointBackgroundColor: 'rgb(66, 133, 244)',
					pointBorderColor: 'rgba(255, 255, 255, 0.8)',
					pointBorderWidth: 2,
					showLine: true
				},
				{
					label: '─ Best Fit Line',
					data: fittedPoints,
					borderColor: 'rgb(230, 70, 80)',
					backgroundColor: 'transparent',
					fill: false,
					tension: 0.4,
					borderWidth: 3.5,
					pointRadius: 0,
					pointHoverRadius: 0,
					showLine: true
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			aspectRatio: 1.25,
			plugins: {
				slopeTrianglePlugin: {},
				title: {
					display: true,
					text: 'Reverse Bias Characteristics (I vs V)',
					font: { size: 16, weight: 'bold', family: 'Arial' }
				},
				legend: {
					display: true,
					position: 'top',
					labels: {
						usePointStyle: false,
						padding: 15,
						font: { size: 12, family: 'Arial' }
					}
				},
				filler: {
					propagate: true
				}
			},
			scales: {
				x: {
					type: 'linear',
					min: 0,
					title: {
						display: true,
						text: 'Voltage (V)',
						font: { size: 13, weight: 'bold', family: 'Arial' }
					},
					grid: {
						color: 'rgba(180, 180, 180, 0.4)',
						drawBorder: true,
						lineWidth: 1
					},
					ticks: {
						font: { size: 11 }
					}
				},
				y: {
					beginAtZero: true,
					min: 0,
					title: {
						display: true,
						text: 'Current (µA)',
						font: { size: 13, weight: 'bold', family: 'Arial' }
					},
					grid: {
						color: 'rgba(180, 180, 180, 0.4)',
						drawBorder: true,
						lineWidth: 1
					},
					ticks: {
						font: { size: 11 }
					}
				}
			}
		},
		plugins: [slopeTrianglePlugin]
	});
}

/**
 * Plot I vs Lux graph (Photo Responsivity).
 * @param {Array<{x: number, y: number}>} data - Display data in µA
 * @param {number} slope - Slope in A/Lux
 * @param {number} intercept - Intercept in A
 */
function plotIntensityGraph(data, slope, intercept) {
	if (!data || data.length < 2) {
		alert('Insufficient data points for intensity graph (need at least 2).');
		return;
	}

	const ctx = document.getElementById('intensityGraphCanvas');
	if (!ctx) {
		return;
	}

	// Destroy existing chart if present
	if (intensityGraph) {
		intensityGraph.destroy();
	}

	// Sort data by x for better display
	const sortedData = [...data].sort((a, b) => a.x - b.x);

	// Calculate fitted line points using slope and intercept
	const minX = Math.min(...sortedData.map((p) => p.x));
	const maxX = Math.max(...sortedData.map((p) => p.x));
	
	// Convert slope and intercept to µA/Lux units for display
	const slopeDisplay = slope * 1e6; // A/Lux → µA/Lux
	const interceptDisplay = intercept * 1e6; // A → µA
	
	// Create best fit line with multiple points for smooth rendering
	const fittedPoints = [];
	const step = (maxX - minX) / 25; // 25 points for smooth line
	for (let x = minX; x <= maxX; x += step) {
		fittedPoints.push({ x: parseFloat(x.toFixed(4)), y: slopeDisplay * x + interceptDisplay });
	}
	fittedPoints.push({ x: maxX, y: slopeDisplay * maxX + interceptDisplay }); // Ensure end point

	intensityGraph = new Chart(ctx, {
		type: 'line',
		data: {
			datasets: [
				{
					label: '● Measured Data',
					data: sortedData,
					borderColor: 'rgb(75, 192, 100)',
					backgroundColor: 'rgb(75, 192, 100)',
					fill: false,
					tension: 0.1,
					borderWidth: 2.5,
					pointRadius: 6,
					pointHoverRadius: 8,
					pointBackgroundColor: 'rgb(75, 192, 100)',
					pointBorderColor: 'rgba(255, 255, 255, 0.8)',
					pointBorderWidth: 2,
					showLine: true
				},
				{
					label: '─ Best Fit Line',
					data: fittedPoints,
					borderColor: 'rgb(255, 140, 60)',
					backgroundColor: 'transparent',
					fill: false,
					tension: 0.4,
					borderWidth: 3.5,
					pointRadius: 0,
					pointHoverRadius: 0,
					showLine: true
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			aspectRatio: 1.25,
			plugins: {
				slopeTrianglePlugin: {},
				title: {
					display: true,
					text: 'Photo Responsivity (I vs Lux)',
					font: { size: 16, weight: 'bold', family: 'Arial' }
				},
				legend: {
					display: true,
					position: 'top',
					labels: {
						usePointStyle: false,
						padding: 15,
						font: { size: 12, family: 'Arial' }
					}
				},
				filler: {
					propagate: true
				}
			},
			scales: {
				x: {
					type: 'linear',
					min: 0,
					title: {
						display: true,
						text: 'Intensity (Lux)',
						font: { size: 13, weight: 'bold', family: 'Arial' }
					},
					grid: {
						color: 'rgba(180, 180, 180, 0.4)',
						drawBorder: true,
						lineWidth: 1
					},
					ticks: {
						font: { size: 11 }
					}
				},
				y: {
					beginAtZero: true,
					min: 0,
					title: {
						display: true,
						text: 'Current (µA)',
						font: { size: 13, weight: 'bold', family: 'Arial' }
					},
					grid: {
						color: 'rgba(180, 180, 180, 0.4)',
						drawBorder: true,
						lineWidth: 1
					},
					ticks: {
						font: { size: 11 }
					}
				}
			}
		},
		plugins: [slopeTrianglePlugin]
	});
}

/**
 * Format equation string from slope and intercept.
 * @param {number} slope
 * @param {number} intercept
 * @param {string} xVariable - "V" or "Lux"
 * @returns {string}
 */
function formatEquation(slope, intercept, xVariable) {
	if (!Number.isFinite(slope) || !Number.isFinite(intercept)) {
		return '-';
	}

	const slopeStr = Math.abs(slope) < 1e-6 ? '0' : slope.toExponential(2);
	const interceptStr = Math.abs(intercept) < 1e-6 ? '0' : intercept.toExponential(2);
	const sign = intercept >= 0 ? '+' : '-';
	const absIntercept = Math.abs(interceptStr);

	return `${slopeStr}${xVariable} ${sign} ${absIntercept}`;
}

/**
 * Display slope values and equations in the graph analysis sections.
 * @param {number} slopeVoltage - Slope from I vs V (in A/V)
 * @param {number} interceptVoltage - Intercept from I vs V
 * @param {number} slopeIntensity - Slope from I vs Lux (in A/Lux)
 * @param {number} interceptIntensity - Intercept from I vs Lux
 */
function displaySlopeValues(slopeVoltage, interceptVoltage, slopeIntensity, interceptIntensity) {
	// I vs V display - convert slope to µA/V for display
	const slopeVoltageNumeric = document.getElementById('slopeVoltageNumeric');
	const equationVoltage = document.getElementById('equationVoltage');

	if (slopeVoltageNumeric) {
		slopeVoltageNumeric.innerHTML = slopeVoltage !== 0
			? formatScientific(slopeVoltage * 1e6)
			: '-';
	}

	if (equationVoltage) {
		equationVoltage.textContent = slopeVoltage !== 0
			? formatEquation(slopeVoltage * 1e6, interceptVoltage * 1e6, 'V') + ' µA'
			: '-';
	}

	// I vs Lux display - convert slope to µA/Lux for display
	const slopeIntensityNumeric = document.getElementById('slopeIntensityNumeric');
	const equationIntensity = document.getElementById('equationIntensity');

	if (slopeIntensityNumeric) {
		slopeIntensityNumeric.innerHTML = slopeIntensity !== 0
			? formatScientific(slopeIntensity * 1e6)
			: '-';
	}

	if (equationIntensity) {
		equationIntensity.textContent = slopeIntensity !== 0
			? formatEquation(slopeIntensity * 1e6, interceptIntensity * 1e6, 'Lux') + ' µA'
			: '-';
	}
}

/**
 * Update direct calculation outputs in the Direct Calculation result section.
 * @param {number} resistance
 * @param {number} responsivity
 */
function updateDirectOutputs(resistance, responsivity) {
	const resistanceOutput = document.getElementById('resistanceDirectOutput');
	const responsivityOutput = document.getElementById('responsivityDirectOutput');

	const resistanceText = formatScientific(resistance);
	const responsivityText = formatScientific(responsivity);

	if (resistanceOutput) {
		resistanceOutput.innerHTML = resistanceText;
	}

	if (responsivityOutput) {
		responsivityOutput.innerHTML = responsivityText;
	}
}

/**
 * Update graph-based outputs in the Graph-Based result section.
 * @param {number} resistance
 * @param {number} responsivity
 */
function updateGraphOutputs(resistance, responsivity) {
	const resistanceOutput = document.getElementById('resistanceGraphOutput');
	const responsivityOutput = document.getElementById('responsivityGraphOutput');

	const resistanceText = formatScientific(resistance);
	const responsivityText = formatScientific(responsivity);

	if (resistanceOutput) {
		resistanceOutput.innerHTML = resistanceText;
	}

	if (responsivityOutput) {
		responsivityOutput.innerHTML = responsivityText;
	}
}

/**
 * Update both output sections and calculate % error.
 * @param {number} directResistance
 * @param {number} directResponsivity
 * @param {number} graphResistance
 * @param {number} graphResponsivity
 */
function updateAllOutputs(directResistance, directResponsivity, graphResistance, graphResponsivity) {
	updateDirectOutputs(directResistance, directResponsivity);
	updateGraphOutputs(graphResistance, graphResponsivity);

	// Calculate and display % error
	const percentErrorR = calculatePercentError(directResistance, graphResistance);
	const percentErrorResp = calculatePercentError(directResponsivity, graphResponsivity);

	const percentErrorResistanceEl = document.getElementById('percentErrorResistance');
	const percentErrorResponsivityEl = document.getElementById('percentErrorResponsivity');

	if (percentErrorResistanceEl) {
		percentErrorResistanceEl.textContent = percentErrorR.toFixed(2);
	}

	if (percentErrorResponsivityEl) {
		percentErrorResponsivityEl.textContent = percentErrorResp.toFixed(2);
	}

	// Update observation text
	const avgError = (percentErrorR + percentErrorResp) / 2;
	const observationEl = document.getElementById('observationText');
	const errorInterpretationEl = document.getElementById('errorInterpretation');

	if (observationEl) {
		observationEl.textContent = getObservationText(avgError);
	}

	if (errorInterpretationEl) {
		if (avgError < 5) {
			errorInterpretationEl.textContent = 'excellent';
		} else if (avgError < 15) {
			errorInterpretationEl.textContent = 'good';
		} else if (avgError < 30) {
			errorInterpretationEl.textContent = 'reasonable';
		} else {
			errorInterpretationEl.textContent = 'significant divergence, requiring verification';
		}
	}
}

/**
 * Update output targets (legacy fallback for compatibility).
 * @param {number} resistance
 * @param {number} responsivity
 */
function updateOutputs(resistance, responsivity) {
	const resistanceOutput = document.getElementById('resistanceOutput');
	const responsivityOutput = document.getElementById('responsivityOutput');
	const resultBlanks = document.querySelectorAll('.result-blank');

	const resistanceText = formatScientific(resistance);
	const responsivityText = formatScientific(responsivity);

	if (resistanceOutput) {
		resistanceOutput.innerHTML = resistanceText;
	} else if (resultBlanks[0]) {
		resultBlanks[0].innerHTML = resistanceText;
	}

	if (responsivityOutput) {
		responsivityOutput.innerHTML = responsivityText;
	} else if (resultBlanks[1]) {
		resultBlanks[1].innerHTML = responsivityText;
	}
}

/**
 * Calculate and plot graphs, then update results based on slopes.
 * This is the primary calculation method using graph-derived values.
 */
function plotGraphsAndCalculate() {
	const { reverseTable, responsivityTable } = getPhotodiodeTables();
	const reverseRows = readReverseBiasRows(reverseTable);
	const responsivityRows = readResponsivityRows(responsivityTable);

	if (reverseRows.length < 2 && responsivityRows.length < 2) {
		alert('Please enter valid data with at least 2 points in each table.');
		return;
	}

	let directResistance = 0;
	let directResponsivity = 0;
	let resistanceFromSlope = 0;
	let responsivityFromSlope = 0;
	let slopeVoltageVal = 0;
	let interceptVoltageVal = 0;
	let slopeIntensityVal = 0;
	let interceptIntensityVal = 0;

	// Calculate direct values first
	const lastReverseRow = reverseRows[reverseRows.length - 1] || null;
	directResistance = lastReverseRow && lastReverseRow.current > 0
		? (lastReverseRow.voltage / lastReverseRow.current)
		: 0;
	const directResponsivityValues = responsivityRows
		.filter((row) => row.intensity > 0)
		.map((row) => row.current / row.intensity);
	directResponsivity = average(directResponsivityValues);

	// Process I vs V graph
	if (reverseRows.length >= 2) {
		const voltageData = reverseRows.map((row) => ({ x: row.voltage, y: row.current }));
		const { slope: slopeV, intercept: interceptV } = linearRegression(voltageData);

		slopeVoltageVal = slopeV;
		interceptVoltageVal = interceptV;

		if (slopeV > 0) {
			resistanceFromSlope = 1 / slopeV;
		}

		// Plot voltage graph with slope and intercept
		const displayData = getVoltageGraphData(reverseRows);
		plotVoltageGraph(displayData, slopeV, interceptV);
	}

	// Process I vs Lux graph
	if (responsivityRows.length >= 2) {
		const intensityData = responsivityRows.map((row) => ({ x: row.intensity, y: row.current }));
		const { slope: slopeL, intercept: interceptL } = linearRegression(intensityData);

		slopeIntensityVal = slopeL;
		interceptIntensityVal = interceptL;
		responsivityFromSlope = slopeL;

		// Plot intensity graph with slope and intercept
		const displayData = getIntensityGraphData(responsivityRows);
		plotIntensityGraph(displayData, slopeL, interceptL);
	}

	// Display both slope values and equations
	displaySlopeValues(slopeVoltageVal, interceptVoltageVal, slopeIntensityVal, interceptIntensityVal);

	// Update all outputs including direct, graph-based, % error and observations
	updateAllOutputs(directResistance, directResponsivity, resistanceFromSlope, responsivityFromSlope);
}

/**
 * Calculate resistance and responsivity from tabular inputs (direct calculation).
 * Updates the Direct Calculation result section.
 */
function calculatePhotodiodeFromTables() {
	const { reverseTable, responsivityTable } = getPhotodiodeTables();
	const reverseRows = readReverseBiasRows(reverseTable);
	const responsivityRows = readResponsivityRows(responsivityTable);

	if (!reverseRows.length && !responsivityRows.length) {
		alert('Please enter valid data');
		updateDirectOutputs(0, 0);
		return;
	}

	const lastReverseRow = reverseRows[reverseRows.length - 1] || null;
	const resistance = lastReverseRow && lastReverseRow.current > 0
		? (lastReverseRow.voltage / lastReverseRow.current)
		: 0;
	const responsivityValues = responsivityRows
		.filter((row) => row.intensity > 0)
		.map((row) => row.current / row.intensity);
	const responsivity = average(responsivityValues);

	updateDirectOutputs(resistance, responsivity);
}

/**
 * Clear editable table cells and output fields.
 */
function resetPhotodiodeTables() {
	const inputs = document.querySelectorAll('.experiment-section .observation-table input[type="number"]');
	inputs.forEach((input) => {
		input.value = '';
	});

	// Clear slope and equation displays
	const slopeVoltageNumeric = document.getElementById('slopeVoltageNumeric');
	const equationVoltage = document.getElementById('equationVoltage');
	const slopeIntensityNumeric = document.getElementById('slopeIntensityNumeric');
	const equationIntensity = document.getElementById('equationIntensity');

	if (slopeVoltageNumeric) {
		slopeVoltageNumeric.textContent = '-';
	}

	if (equationVoltage) {
		equationVoltage.textContent = '-';
	}

	if (slopeIntensityNumeric) {
		slopeIntensityNumeric.textContent = '-';
	}

	if (equationIntensity) {
		equationIntensity.textContent = '-';
	}

	// Destroy existing charts
	if (voltageGraph) {
		voltageGraph.destroy();
		voltageGraph = null;
	}

	if (intensityGraph) {
		intensityGraph.destroy();
		intensityGraph = null;
	}

	// Reset both output sections
	updateDirectOutputs(0, 0);
	updateGraphOutputs(0, 0);
}

/**
 * Wire up button interactions.
 */
function initializeEventListeners() {
	const plotGraphsButton = document.getElementById('plotGraphs');
	const calculateButton = document.getElementById('calculatePhotodiode');
	const resetButton = document.getElementById('resetSimulation');

	if (plotGraphsButton) {
		plotGraphsButton.addEventListener('click', plotGraphsAndCalculate);
	}

	if (calculateButton) {
		calculateButton.addEventListener('click', calculatePhotodiodeFromTables);
	}

	if (resetButton) {
		resetButton.addEventListener('click', resetPhotodiodeTables);
	}
}

document.addEventListener('DOMContentLoaded', () => {
	initializeEventListeners();
	updateOutputs(0, 0);
});
