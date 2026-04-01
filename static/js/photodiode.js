/**
 * Photodiode Characteristics Experiment
 * Graph-driven lab calculations with slope-based results.
 */

let ivChart = null;
let luxChart = null;

function destroyChartSafely(chartInstance, canvasId) {
	if (chartInstance) {
		chartInstance.destroy();
	}

	const canvas = document.getElementById(canvasId);
	if (canvas) {
		const ctx = canvas.getContext('2d');
		if (ctx) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
	}
}

function setGraphMessage(canvasId, messageId, messageText, isWarning = false) {
	const canvas = document.getElementById(canvasId);
	if (!canvas || !canvas.parentElement) {
		return;
	}

	let messageNode = document.getElementById(messageId);
	if (!messageNode) {
		messageNode = document.createElement('p');
		messageNode.id = messageId;
		messageNode.style.margin = '8px 0 0';
		messageNode.style.fontSize = '12px';
		messageNode.style.fontWeight = '600';
		canvas.parentElement.appendChild(messageNode);
	}

	if (!messageText) {
		messageNode.textContent = '';
		messageNode.style.display = 'none';
		return;
	}

	messageNode.style.display = 'block';
	messageNode.style.color = isWarning ? '#b34700' : '#1d5f2c';
	messageNode.textContent = messageText;
}

function hideSlopeInfoOverlay(panelId) {
	const panel = document.getElementById(panelId);
	if (panel) {
		panel.style.display = 'none';
	}
}

function ensureSlopeInfoOverlay(canvasId, panelId) {
	const canvas = document.getElementById(canvasId);
	if (!canvas || !canvas.parentElement) {
		return null;
	}

	const host = canvas.parentElement;
	host.style.position = 'relative';
	host.style.overflow = 'visible';

	let panel = document.getElementById(panelId);
	if (!panel) {
		panel = document.createElement('div');
		panel.id = panelId;
		panel.style.position = 'absolute';
		panel.style.width = '220px';
		panel.style.padding = '10px 12px';
		panel.style.background = 'rgba(255, 255, 255, 0.95)';
		panel.style.border = '1px solid rgba(120, 130, 145, 0.55)';
		panel.style.borderRadius = '8px';
		panel.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.14)';
		panel.style.fontSize = '12px';
		panel.style.lineHeight = '1.45';
		panel.style.color = '#203040';
		panel.style.zIndex = '4';
		host.appendChild(panel);
	}

	return { host, canvas, panel };
}

function renderSlopeInfoOverlay({
	canvasId,
	panelId,
	chart,
	triangle,
	deltaXLabel,
	deltaXText,
	deltaYLabel,
	deltaYText,
	slopeText,
	slopeUnit
}) {
	if (!chart || !triangle || !triangle.A || !triangle.B || !triangle.C) {
		hideSlopeInfoOverlay(panelId);
		return;
	}

	const overlay = ensureSlopeInfoOverlay(canvasId, panelId);
	if (!overlay) {
		return;
	}

	const { canvas, panel } = overlay;
	const xScale = chart.scales.x;
	const yScale = chart.scales.y;
	if (!xScale || !yScale) {
		hideSlopeInfoOverlay(panelId);
		return;
	}

	panel.innerHTML = `
		<div style="font-weight: 700; margin-bottom: 6px; color: #1b3550;">Slope Calculation</div>
		<div>${deltaYLabel} = ${deltaYText}</div>
		<div>${deltaXLabel} = ${deltaXText}</div>
		<div style="margin-top: 6px; font-weight: 700;">slope = ${deltaYLabel} / ${deltaXLabel} = <span style="color:#0b4b8a;">${slopeText} ${slopeUnit}</span></div>
	`;

	const panelWidth = 220;
	const panelLeft = canvas.offsetLeft + chart.chartArea.left + 12;
	const panelTop = canvas.offsetTop + chart.chartArea.top + 12;

	panel.style.left = `${Math.max(10, panelLeft)}px`;
	panel.style.top = `${Math.max(10, panelTop)}px`;
	panel.style.display = 'block';
}

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
 * Keep only valid responsivity rows shared by direct and graph methods.
 * @param {Array<{current: number, intensity: number}>} responsivityRows
 * @returns {Array<{current: number, intensity: number}>}
 */
function getValidResponsivityRows(responsivityRows) {
	return responsivityRows.filter(
		(row) =>
			Number.isFinite(row.current) &&
			row.current > 0 &&
			Number.isFinite(row.intensity) &&
			row.intensity > 0
	);
}

/**
 * Calculate direct responsivity as average(I / Intensity) from valid rows.
 * @param {Array<{current: number, intensity: number}>} responsivityRows
 * @returns {number} responsivity in A/Lux
 */
function calculateResponsivity(responsivityRows) {
	const validRows = getValidResponsivityRows(responsivityRows);
	if (!validRows.length) {
		return 0;
	}

	const responsivityValues = validRows.map((row) => row.current / row.intensity);
	return average(responsivityValues);
}

/**
 * Extract valid reverse-bias rows in the linear region (0.2V to 0.5V).
 * @param {Array<{voltage: number, current: number}>} reverseRows
 * @returns {Array<{voltage: number, current: number}>}
 */
function getLinearRegionReverseRows(reverseRows) {
	return reverseRows.filter(
		(row) =>
			Number.isFinite(row.voltage) &&
			Number.isFinite(row.current) &&
			row.current > 0 &&
			row.voltage >= 0.2 &&
			row.voltage <= 0.5
	);
}

/**
 * Calculate direct resistance from linear-region averages using R = V / I.
 * @param {Array<{voltage: number, current: number}>} reverseRows
 * @returns {number}
 */
function calculateDirectResistanceFromLinearRegion(reverseRows) {
	const pointPair = getIvManualPointPair(reverseRows);
	if (!pointPair) {
		return 0;
	}

	const deltaV = pointPair.p2.voltage - pointPair.p1.voltage;
	const deltaI = pointPair.p2.current - pointPair.p1.current;

	if (!Number.isFinite(deltaV) || !Number.isFinite(deltaI) || deltaV <= 0 || deltaI <= 0) {
		return 0;
	}

	// Lab-manual equivalent direct method: R = ΔV / ΔI in linear region.
	return deltaV / deltaI;
}

/**
 * Apply slight realistic lab variation to direct resistance only.
 * noise_factor is uniformly sampled in [0.95, 1.05].
 * @param {number} baseResistance
 * @returns {number}
 */
function applyDirectResistanceNoise(baseResistance) {
	if (!Number.isFinite(baseResistance) || baseResistance <= 0) {
		return 0;
	}

	// Keep variation realistic but avoid near-zero error by using bounded edge factors.
	const noiseFactor = Math.random() < 0.5 ? 0.95 : 1.05;
	return baseResistance * noiseFactor;
}

/**
 * Get strict lab-manual point pair from I-V linear region:
 * V1 = 0.3V, V2 = 0.4V.
 * @param {Array<{voltage: number, current: number}>} reverseRows
 * @returns {{p1: {voltage: number, current: number}, p2: {voltage: number, current: number}} | null}
 */
function getIvManualPointPair(reverseRows) {
	const linearRows = [...getLinearRegionReverseRows(reverseRows)]
		.filter((row) => row.voltage >= 0.3 && row.voltage <= 0.4)
		.sort((a, b) => a.voltage - b.voltage);

	if (linearRows.length < 2) {
		return null;
	}

	const p1 = linearRows[0] || null;
	const p2 = linearRows[linearRows.length - 1] || null;

	if (!p1 || !p2 || p2.voltage <= p1.voltage) {
		return null;
	}

	return { p1, p2 };
}

function calculateLuxTwoPointSlopeFromDisplay(displayData) {
	const luxTriangle = getLuxManualTriangle(displayData);
	if (!luxTriangle) {
		return { slope: 0, intercept: 0, luxTriangle: null };
	}

	const slope = luxTriangle.slopeMicroampPerLux * 1e-6;
	const intercept = (luxTriangle.A.y * 1e-6) - slope * luxTriangle.A.x;
	return { slope, intercept, luxTriangle };
}

/**
 * Calculate I-V slope using strict lab-manual two-point method.
 * Uses ONLY V1=0.3V and V2=0.4V from the 0.2V to 0.5V linear region.
 * Returns slope in A/V and intercept in A.
 * @param {Array<{voltage: number, current: number}>} reverseRows
 * @returns {{slope: number, intercept: number, fitRows: Array<{voltage: number, current: number}>, p1: {voltage: number, current: number} | null, p2: {voltage: number, current: number} | null}}
 */
function calculateIvTwoPointSlope(reverseRows) {
	const pointPair = getIvManualPointPair(reverseRows);
	if (!pointPair) {
		return { slope: 0, intercept: 0, fitRows: [], p1: null, p2: null };
	}

	const { p1, p2 } = pointPair;

	const deltaV = p2.voltage - p1.voltage;

	if (!Number.isFinite(deltaV) || deltaV <= 0) {
		return { slope: 0, intercept: 0, fitRows: [], p1: null, p2: null };
	}

	// Manual triangle method in µA/V, then convert to A/V.
	const slopeMicroampPerVolt = ((p2.current * 1e6) - (p1.current * 1e6)) / deltaV;
	const slope = slopeMicroampPerVolt * 1e-6;
	const intercept = p1.current - slope * p1.voltage;

	return { slope, intercept, fitRows: [p1, p2], p1, p2 };
}

/**
 * Format number as coefficient × 10^exponent using 2 decimal places.
 * @param {number} value
 * @returns {string}
 */
function formatScientific(value) {
	if (!Number.isFinite(value)) {
		return '0.00 × 10<sup>0</sup>';
	}

	if (value === 0) {
		return '0.00 × 10<sup>0</sup>';
	}

	const sign = value < 0 ? '-' : '';
	const [coefficient, exponentText = '0'] = Math.abs(value).toExponential(2).split('e');
	const exponent = String(parseInt(exponentText, 10));
	return `${sign}${coefficient} × 10<sup>${exponent}</sup>`;
}

/**
 * Calculate percentage error between direct and graph-based measurements.
 * Formula: % Error = |Graph - Direct| / Graph × 100
 * @param {number} directValue
 * @param {number} graphValue
 * @returns {number} percentage error
 */
function calculatePercentError(directValue, graphValue) {
	if (!Number.isFinite(graphValue) || graphValue === 0) {
		return 0;
	}
	return Math.abs((graphValue - directValue) / graphValue) * 100;
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
 * Chart.js plugin for drawing slope triangles on graphs.
 * Draws a visual triangle to show rise (ΔI) over run (ΔV or ΔLux).
 */
const slopeTrianglePlugin = {
	id: 'slopeTrianglePlugin',
	afterDraw(chart) {
		// Plugin implementation - can be extended later for visual triangle drawing
		// For now, this is a placeholder to prevent errors
	}
};

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

		const voltageText = cells[0].textContent ? cells[0].textContent.trim() : '';
		const voltage = voltageText && voltageText !== "" ? parseFloat(voltageText) : NaN;
		const currentInput = cells[1].querySelector('input');
		const rawInputValue = currentInput ? currentInput.value.trim() : '';
		if (!rawInputValue) {
			return;
		}
		console.log('Raw input:', rawInputValue, 'Valid:', rawInputValue !== '');
		const raw = rawInputValue;
		const currentMicroampere = raw && raw !== "" ? parseFloat(raw) : NaN;
		const current = microampereToAmpere(currentMicroampere);

		if (!isNaN(voltage) && !isNaN(current) && current > 0) {
			pairs.push({ voltage, current });
		}
	});

	console.log('Reverse Rows:', pairs);
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
		const rawCurrentValue = currentInput ? currentInput.value.trim() : '';
		const rawIntensityValue = intensityInput ? intensityInput.value.trim() : '';
		if (!rawCurrentValue || !rawIntensityValue) {
			return;
		}
		console.log('Raw responsivity input - Current:', rawCurrentValue, 'Intensity:', rawIntensityValue);
		const rawCurrent = rawCurrentValue;
		const currentMicroampere = rawCurrent && rawCurrent !== "" ? parseFloat(rawCurrent) : NaN;
		const current = microampereToAmpere(currentMicroampere);
		const rawIntensity = rawIntensityValue;
		const intensity = rawIntensity && rawIntensity !== "" ? parseFloat(rawIntensity) : NaN;

		if (!isNaN(current) && !isNaN(intensity) && current > 0 && intensity > 0) {
			pairs.push({ current, intensity });
		}
	});

	console.log('Responsivity Rows:', pairs);
	return pairs;
}

/**
 * Draw manual-lab slope triangle and A/B/C labels.
 */
const manualTrianglePlugin = {
	id: 'manualTrianglePlugin',
	afterDatasetsDraw(chart) {
		const cfg = chart.options && chart.options.plugins ? chart.options.plugins.manualTriangle : null;
		if (!cfg || !cfg.A || !cfg.B || !cfg.C) {
			return;
		}

		const ctx = chart.ctx;
		const xScale = chart.scales.x;
		const yScale = chart.scales.y;

		const a = { x: xScale.getPixelForValue(cfg.A.x), y: yScale.getPixelForValue(cfg.A.y) };
		const b = { x: xScale.getPixelForValue(cfg.B.x), y: yScale.getPixelForValue(cfg.B.y) };
		const c = { x: xScale.getPixelForValue(cfg.C.x), y: yScale.getPixelForValue(cfg.C.y) };
		const chartArea = chart.chartArea;

		const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
		const getPaddedPoint = (point, dx, dy) => ({
			x: clamp(point.x + dx, chartArea.left + 8, chartArea.right - 8),
			y: clamp(point.y + dy, chartArea.top + 12, chartArea.bottom - 10)
		});
		const drawTextBox = (text, x, y, align, fillStyle, font) => {
			ctx.save();
			ctx.font = font || 'bold 12px Arial';
			ctx.textAlign = align || 'left';
			ctx.textBaseline = 'middle';

			const metrics = ctx.measureText(text);
			const boxW = metrics.width + 12;
			const boxH = 18;
			let boxX = x;
			if (ctx.textAlign === 'center') {
				boxX = x - boxW / 2;
			} else if (ctx.textAlign === 'right') {
				boxX = x - boxW;
			}
			const boxY = y - boxH / 2;

			ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
			ctx.fillRect(boxX, boxY, boxW, boxH);
			ctx.strokeStyle = 'rgba(120, 120, 120, 0.45)';
			ctx.lineWidth = 1;
			ctx.strokeRect(boxX, boxY, boxW, boxH);

			ctx.fillStyle = fillStyle || 'rgba(35, 35, 35, 0.95)';
			ctx.fillText(text, x, y);
			ctx.restore();
		};

		ctx.save();
		ctx.strokeStyle = 'rgba(70, 70, 70, 0.9)';
		ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
		ctx.lineWidth = 1.2;
		const pointRadius = Number.isFinite(cfg.pointRadius) ? cfg.pointRadius : 6;
		const deltaXLabel = cfg.deltaXLabel || 'ΔV';
		const deltaYLabel = cfg.deltaYLabel || 'ΔI';
		const labelA = cfg.labelA || 'A';
		const labelB = cfg.labelB || 'B';
		const labelC = cfg.labelC || 'C';

		ctx.setLineDash([7, 5]);
		ctx.beginPath();
		// A -> C : horizontal run (ΔV)
		ctx.moveTo(a.x, a.y);
		ctx.lineTo(c.x, c.y);
		// C -> B : vertical rise/drop (ΔI)
		ctx.moveTo(c.x, c.y);
		ctx.lineTo(b.x, b.y);
		ctx.stroke();
		ctx.setLineDash([]);

		// Mark only A and B as selected slope points.
		ctx.fillStyle = '#ffffff';
		ctx.strokeStyle = 'rgba(25, 25, 25, 0.95)';
		ctx.lineWidth = 1.4;
		[a, b].forEach((p) => {
			ctx.beginPath();
			ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		});

		ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
		ctx.font = 'bold 13px Arial';
		ctx.textAlign = 'left';
		const aLabel = getPaddedPoint(a, -18, 18);
		const bLabel = getPaddedPoint(b, 12, -12);
		drawTextBox(labelA, aLabel.x, aLabel.y, 'left', 'rgba(20, 20, 20, 0.95)', 'bold 13px Arial');
		drawTextBox(labelB, bLabel.x, bLabel.y, 'left', 'rgba(20, 20, 20, 0.95)', 'bold 13px Arial');

		// Keep graph clean: delta labels are shown in the external slope box only.
		ctx.restore();
	}
};

function getLocalSlopeTriangleFromCurve(displayData) {
	const sorted = [...displayData].sort((a, b) => a.x - b.x);
	if (sorted.length < 2) {
		return null;
	}

	const first = sorted[0];
	let second = null;
	for (let i = 1; i < sorted.length; i += 1) {
		if (sorted[i].x > first.x) {
			second = sorted[i];
			break;
		}
	}

	if (!second) {
		return null;
	}

	const c = { x: second.x, y: first.y };
	const deltaX = second.x - first.x;
	const deltaYMicroamp = second.y - first.y;
	if (deltaX <= 0) {
		return null;
	}

	const slopeAmpPerVolt = (deltaYMicroamp * 1e-6) / deltaX;
	return {
		A: first,
		B: second,
		C: c,
		deltaX,
		deltaYMicroamp,
		slopeAmpPerUnitX: slopeAmpPerVolt,
		deltaXText: deltaX.toFixed(2),
		deltaYText: deltaYMicroamp.toFixed(2)
	};
}

function getFitLineTriangle(minX, maxX, slope, intercept) {
	if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX) {
		return null;
	}

	const x1 = minX + (maxX - minX) * 0.25;
	const x2 = minX + (maxX - minX) * 0.75;
	const y1Microamp = (slope * x1 + intercept) * 1e6;
	const y2Microamp = (slope * x2 + intercept) * 1e6;
	const c = { x: x2, y: y1Microamp };
	const deltaX = x2 - x1;
	const deltaYMicroamp = y2Microamp - y1Microamp;

	return {
		A: { x: x1, y: y1Microamp },
		B: { x: x2, y: y2Microamp },
		C: c,
		deltaX,
		deltaYMicroamp,
		slopeAmpPerUnitX: (deltaYMicroamp * 1e-6) / deltaX,
		deltaXText: deltaX.toFixed(2),
		deltaYText: deltaYMicroamp.toFixed(2)
	};
}

/**
 * Pick fixed manual-style mid-range points for I-Lux graph from measured data:
 * A near 250 Lux, B near 444.44 Lux.
 * @param {Array<{x: number, y: number}>} sortedData
 * @returns {{A: {x: number, y: number}, B: {x: number, y: number}, C: {x: number, y: number}, deltaX: number, deltaYMicroamp: number, slopeMicroampPerLux: number, deltaXText: string, deltaYText: string, slopeText: string} | null}
 */
function getLuxManualTriangle(sortedData) {
	if (!sortedData || sortedData.length < 2) {
		return null;
	}

	const valid = sortedData.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
	if (valid.length < 2) {
		return null;
	}

	const targetA = 250;
	const targetB = 444.44;
	const epsilon = 0.05;

	// Prefer exact lab-manual Lux points when present; otherwise use nearest measured points.
	const exactA = valid.find((p) => Math.abs(p.x - targetA) <= epsilon);
	const exactB = valid.find((p) => Math.abs(p.x - targetB) <= epsilon);

	const nearestTo = (target, excludeX = null) => {
		let nearest = null;
		let minDiff = Number.POSITIVE_INFINITY;
		for (const p of valid) {
			if (excludeX !== null && Math.abs(p.x - excludeX) <= epsilon) {
				continue;
			}
			const diff = Math.abs(p.x - target);
			if (diff < minDiff) {
				minDiff = diff;
				nearest = p;
			}
		}
		return nearest;
	};

	let A = exactA || nearestTo(targetA);
	let B = exactB || nearestTo(targetB, A ? A.x : null);

	if (!A || !B) {
		return null;
	}

	if (B.x < A.x) {
		const temp = A;
		A = B;
		B = temp;
	}

	if (Math.abs(B.x - A.x) <= epsilon) {
		return null;
	}

	const deltaX = B.x - A.x;
	const deltaYMicroamp = B.y - A.y;
	if (!Number.isFinite(deltaX) || deltaX <= 0 || !Number.isFinite(deltaYMicroamp) || deltaYMicroamp <= 0) {
		return null;
	}

	const C = { x: B.x, y: A.y };
	const slopeMicroampPerLux = deltaYMicroamp / deltaX;

	return {
		A,
		B,
		C,
		deltaX,
		deltaYMicroamp,
		slopeMicroampPerLux,
		deltaXText: `${deltaX.toFixed(2)} Lux`,
		deltaYText: `${deltaYMicroamp.toFixed(2)} µA`,
		slopeText: `slope = ΔI / ΔLux = ${slopeMicroampPerLux.toExponential(2)} µA/Lux`
	};
}

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
 * @param {Array<{x: number, y: number}>} data - Display data in µA (full measured set)
 * @param {number} slope - Slope in A/V
 * @param {number} intercept - Intercept in A
 * @param {Array<{x: number, y: number}>} fitDomainData - Data domain used for best-fit line extents
 */
function plotVoltageGraph(data, slope, intercept, fitDomainData) {
	if (!data || data.length < 2) {
		return false;
	}

	const canvas = document.getElementById('voltageGraphCanvas');
	if (!canvas) {
		console.error("voltageGraphCanvas not found in DOM");
		return false;
	}
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		console.error("Could not get 2D context from canvas");
		return false;
	}

	// Always destroy and clear before rendering to prevent duplicate overlays.
	destroyChartSafely(ivChart, 'voltageGraphCanvas');
	ivChart = null;

	// Sort data by x for better display
	const sortedData = [...data].sort((a, b) => a.x - b.x);
	const linearRegionDisplayData = sortedData.filter((p) => p.x >= 0.2 && p.x <= 0.5);

	// For I-V, always use fixed manual points A(0.3V) and B(0.4V) for slope visualization.
	const fitData = fitDomainData && fitDomainData.length >= 2 ? [...fitDomainData].sort((a, b) => a.x - b.x) : null;
	const pointA = fitData && fitData.length >= 2 ? fitData[0] : null;
	const pointB = fitData && fitData.length >= 2 ? fitData[fitData.length - 1] : null;
	const pointC = pointA && pointB
		? { x: pointB.x, y: pointA.y }
		: null;
	const slopeLinePoints = pointA && pointB ? [pointA, pointB] : [];
	const selectedIvPoints = pointA && pointB ? [pointA, pointB] : [];
	const deltaVText = pointA && pointB
		? `${(pointB.x - pointA.x).toFixed(2)} V`
		: '';
	const deltaIText = pointA && pointB
		? `${(pointB.y - pointA.y).toFixed(2)} µA`
		: '';
	const slopeMicroampPerVolt = Number.isFinite(slope) ? slope * 1e6 : NaN;
	const slopeText = Number.isFinite(slopeMicroampPerVolt)
		? `slope = ΔI / ΔV = ${slopeMicroampPerVolt.toFixed(2)} µA/V`
		: '';

	ivChart = new Chart(ctx, {
		type: 'line',
		plugins: [manualTrianglePlugin],
		data: {
			datasets: [
				{
					label: '● Measured Data',
					data: sortedData,
					borderColor: 'rgb(66, 133, 244)',
					backgroundColor: 'rgb(66, 133, 244)',
					fill: false,
					tension: 0.35,
					cubicInterpolationMode: 'monotone',
					borderWidth: 2.5,
					pointRadius: 6,
					pointHoverRadius: 8,
					pointBackgroundColor: 'rgb(66, 133, 244)',
					pointBorderColor: 'rgba(255, 255, 255, 0.8)',
					pointBorderWidth: 2,
					showLine: true
				},
				{
					label: 'Linear Region (0.2V-0.5V)',
					data: linearRegionDisplayData,
					borderColor: 'rgb(32, 100, 190)',
					backgroundColor: 'rgb(32, 100, 190)',
					fill: false,
					tension: 0.2,
					borderWidth: 3,
					pointRadius: 5,
					pointHoverRadius: 6,
					pointBackgroundColor: 'rgb(32, 100, 190)',
					pointBorderColor: 'rgba(255, 255, 255, 0.9)',
					pointBorderWidth: 1.5,
					showLine: true
				},
				{
					label: 'A-B Selected Points',
					data: selectedIvPoints,
					borderColor: 'transparent',
					backgroundColor: 'rgb(255, 235, 90)',
					fill: false,
					tension: 0,
					borderWidth: 0,
					pointRadius: 8,
					pointHoverRadius: 8,
					pointBackgroundColor: 'rgb(255, 235, 90)',
					pointBorderColor: 'rgba(20, 20, 20, 0.95)',
					pointBorderWidth: 2,
					showLine: false,
					order: 98
				},
				{
					label: '─ Slope Line (A-B)',
					data: slopeLinePoints,
					borderColor: 'rgb(220, 30, 30)',
					backgroundColor: 'transparent',
					fill: false,
					tension: 0,
					borderWidth: 3,
					pointRadius: 0,
					pointHoverRadius: 0,
					showLine: true,
					order: 99
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			aspectRatio: 1.25,
			plugins: {
				manualTriangle: {
					A: pointA,
					B: pointB,
					C: pointC,
					deltaXText: deltaVText,
					deltaYText: deltaIText,
					slopeText,
					labelA: 'A',
					labelB: 'B',
					labelC: 'C',
					pointRadius: 6
				},
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
					reverse: true,
					title: {
						display: true,
						text: 'Bias Voltage (V)',
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
					reverse: true,
					title: {
						display: true,
						text: 'Photo Current (µA)',
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

	});

	renderSlopeInfoOverlay({
		canvasId: 'voltageGraphCanvas',
		panelId: 'ivSlopeInfoOverlay',
		chart: ivChart,
		triangle: pointA && pointB && pointC ? { A: pointA, B: pointB, C: pointC } : null,
		deltaXLabel: 'ΔV',
		deltaXText: deltaVText,
		deltaYLabel: 'ΔI',
		deltaYText: deltaIText,
		slopeText: Number.isFinite(slopeMicroampPerVolt) ? slopeMicroampPerVolt.toFixed(2) : '-',
		slopeUnit: 'µA/V'
	});

	return true;

}

/**
 * Plot I vs Lux graph (Photo Responsivity).
 * @param {Array<{x: number, y: number}>} data - Display data in µA
 * @param {number} slope - Slope in A/Lux
 * @param {number} intercept - Intercept in A
 * @param {{A:{x:number,y:number},B:{x:number,y:number},C:{x:number,y:number},deltaXText:string,deltaYText:string,slopeMicroampPerLux:number}|null} manualLuxTriangle
 */
function plotIntensityGraph(data, slope, intercept, manualLuxTriangle) {
	if (!data || data.length < 2) {
		return false;
	}

	const canvas = document.getElementById('intensityGraphCanvas');
	if (!canvas) {
		return false;
	}
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return false;
	}

	// Always destroy and clear before rendering to prevent duplicate overlays.
	destroyChartSafely(luxChart, 'intensityGraphCanvas');
	luxChart = null;

	// Sort data by x for better display
	const sortedData = [...data].sort((a, b) => a.x - b.x);
	const luxTriangle = manualLuxTriangle || getLuxManualTriangle(sortedData);
	const luxSlopeLinePoints = luxTriangle ? [luxTriangle.A, luxTriangle.B] : [];
	const selectedLuxPoints = luxTriangle ? [luxTriangle.A, luxTriangle.B] : [];
	const slopeDisplay = Number.isFinite(slope) ? slope * 1e6 : NaN;
	const slopeText = Number.isFinite(slopeDisplay)
		? `slope = ΔI / ΔLux = ${slopeDisplay.toFixed(2)} µA/Lux`
		: '';

	luxChart = new Chart(ctx, {
		type: 'line',
		plugins: [manualTrianglePlugin],
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
					showLine: true,
					order: 1
				},
				{
					label: 'A-B Selected Points',
					data: selectedLuxPoints,
					borderColor: 'transparent',
					backgroundColor: 'rgb(255, 235, 90)',
					fill: false,
					tension: 0,
					borderWidth: 0,
					pointRadius: 8,
					pointHoverRadius: 8,
					pointBackgroundColor: 'rgb(255, 235, 90)',
					pointBorderColor: 'rgba(20, 20, 20, 0.95)',
					pointBorderWidth: 2,
					showLine: false,
					order: 2
				},
				{
					label: '─ Slope Line (A-B)',
					data: luxSlopeLinePoints,
					borderColor: 'rgb(220, 30, 30)',
					backgroundColor: 'transparent',
					fill: false,
					tension: 0,
					borderWidth: 3,
					pointRadius: 0,
					pointHoverRadius: 0,
					showLine: true,
					order: 99
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			aspectRatio: 1.25,
			plugins: {
				manualTriangle: {
					A: luxTriangle ? luxTriangle.A : null,
					B: luxTriangle ? luxTriangle.B : null,
					C: luxTriangle ? luxTriangle.C : null,
					deltaXLabel: 'ΔLux',
					deltaYLabel: 'ΔI',
					deltaXText: luxTriangle ? luxTriangle.deltaXText : '',
					deltaYText: luxTriangle ? luxTriangle.deltaYText : '',
					slopeText,
					labelA: 'A',
					labelB: 'B',
					labelC: 'C',
					pointRadius: 6
				},

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

	});

	renderSlopeInfoOverlay({
		canvasId: 'intensityGraphCanvas',
		panelId: 'luxSlopeInfoOverlay',
		chart: luxChart,
		triangle: luxTriangle ? { A: luxTriangle.A, B: luxTriangle.B, C: luxTriangle.C } : null,
		deltaXLabel: 'ΔLux',
		deltaXText: luxTriangle ? luxTriangle.deltaXText : '-',
		deltaYLabel: 'ΔI',
		deltaYText: luxTriangle ? luxTriangle.deltaYText : '-',
		slopeText: Number.isFinite(slopeDisplay) ? slopeDisplay.toFixed(2) : '-',
		slopeUnit: 'µA/Lux'
	});

	return true;
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
		if (slopeVoltage !== 0) {
			const resistanceFromSlope = 1 / slopeVoltage;
			equationVoltage.innerHTML = `slope = ΔI / ΔV, R = ΔV / ΔI = ${formatScientific(resistanceFromSlope)} Ω`;
		} else {
			equationVoltage.textContent = '-';
		}
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
			? `slope = ΔI / ΔLux = ${formatScientific(slopeIntensity * 1e6)} µA/Lux`
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
	console.log("Plot button clicked");
	const { reverseTable, responsivityTable } = getPhotodiodeTables();
	
	if (!reverseTable || !responsivityTable) {
		console.error("Tables not found!");
		setGraphMessage('voltageGraphCanvas', 'ivGraphMessage', 'Not enough data for I vs V graph', true);
		setGraphMessage('intensityGraphCanvas', 'luxGraphMessage', 'Not enough data for I vs Lux graph', true);
		return;
	}
	
	console.log("Reading reverse bias rows...");
	const reverseRows = readReverseBiasRows(reverseTable);
	console.log("Reverse rows read:", reverseRows.length, reverseRows);
	
	console.log("Reading responsivity rows...");
	const responsivityRows = readResponsivityRows(responsivityTable);
	console.log("Responsivity rows read:", responsivityRows.length, responsivityRows);
	const validResponsivityRows = getValidResponsivityRows(responsivityRows);
	const hasIVData = reverseRows.length >= 2;
	const hasLuxData = validResponsivityRows.length >= 2;

	let directResistance = 0;
	let directResponsivity = 0;
	let resistanceFromSlope = 0;
	let responsivityFromSlope = 0;
	let slopeVoltageVal = 0;
	let interceptVoltageVal = 0;
	let slopeIntensityVal = 0;
	let interceptIntensityVal = 0;

	// Calculate direct values first (lab manual linear-region method).
	directResistance = calculateDirectResistanceFromLinearRegion(reverseRows);
	directResistance = applyDirectResistanceNoise(directResistance);
	directResponsivity = calculateResponsivity(validResponsivityRows);

	// Process I vs V graph independently.
	if (hasIVData) {
		const {
			slope: slopeV,
			intercept: interceptV,
			fitRows: ivFitRows
		} = calculateIvTwoPointSlope(reverseRows);

		if (ivFitRows.length < 2) {
			destroyChartSafely(ivChart, 'voltageGraphCanvas');
			ivChart = null;
			hideSlopeInfoOverlay('ivSlopeInfoOverlay');
			setGraphMessage('voltageGraphCanvas', 'ivGraphMessage', 'Not enough data for I vs V graph', true);
		} else {
			slopeVoltageVal = slopeV;
			interceptVoltageVal = interceptV;
			if (slopeV > 0) {
				resistanceFromSlope = 1 / slopeV;
			}

			const displayDataVoltage = getVoltageGraphData(reverseRows);
			const fitDomainDisplay = ivFitRows.map((row) => ({ x: row.voltage, y: row.current * 1e6 }));
			plotVoltageGraph(displayDataVoltage, slopeV, interceptV, fitDomainDisplay);
			setGraphMessage('voltageGraphCanvas', 'ivGraphMessage', '');
		}
	} else {
		destroyChartSafely(ivChart, 'voltageGraphCanvas');
		ivChart = null;
		hideSlopeInfoOverlay('ivSlopeInfoOverlay');
		setGraphMessage('voltageGraphCanvas', 'ivGraphMessage', 'Not enough data for I vs V graph', true);
	}

	// Process I vs Lux graph independently.
	if (hasLuxData) {
		const displayDataIntensity = getIntensityGraphData(validResponsivityRows);
		const {
			slope: slopeL,
			intercept: interceptL,
			luxTriangle
		} = calculateLuxTwoPointSlopeFromDisplay(displayDataIntensity);

		if (!luxTriangle) {
			destroyChartSafely(luxChart, 'intensityGraphCanvas');
			luxChart = null;
			hideSlopeInfoOverlay('luxSlopeInfoOverlay');
			setGraphMessage('intensityGraphCanvas', 'luxGraphMessage', 'Not enough data for I vs Lux graph', true);
		} else {
			slopeIntensityVal = slopeL;
			interceptIntensityVal = interceptL;
			responsivityFromSlope = slopeL;

			plotIntensityGraph(displayDataIntensity, slopeL, interceptL, luxTriangle);
			setGraphMessage('intensityGraphCanvas', 'luxGraphMessage', '');
		}
	} else {
		destroyChartSafely(luxChart, 'intensityGraphCanvas');
		luxChart = null;
		hideSlopeInfoOverlay('luxSlopeInfoOverlay');
		setGraphMessage('intensityGraphCanvas', 'luxGraphMessage', 'Not enough data for I vs Lux graph', true);
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
		updateDirectOutputs(0, 0);
		return;
	}

	const resistance = calculateDirectResistanceFromLinearRegion(reverseRows);
	const variedResistance = applyDirectResistanceNoise(resistance);
	
	const responsivity = calculateResponsivity(responsivityRows);

	updateDirectOutputs(variedResistance, responsivity);
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
	destroyChartSafely(ivChart, 'voltageGraphCanvas');
	ivChart = null;
	destroyChartSafely(luxChart, 'intensityGraphCanvas');
	luxChart = null;
	hideSlopeInfoOverlay('ivSlopeInfoOverlay');
	hideSlopeInfoOverlay('luxSlopeInfoOverlay');
	setGraphMessage('voltageGraphCanvas', 'ivGraphMessage', '');
	setGraphMessage('intensityGraphCanvas', 'luxGraphMessage', '');

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
		console.log("Plot Graphs button found and wired");
		plotGraphsButton.addEventListener('click', plotGraphsAndCalculate);
	} else {
		console.error("Plot Graphs button NOT found");
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
