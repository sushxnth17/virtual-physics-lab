(() => {
	const CREST_FACTOR = 1.11;
	const ANGSTROM_TO_METER = 1e-10;

	const state = {
		recordedData: [],
		byWavelength: new Map(),
		chart: null
	};

	const ui = {
		tableRows: [],
		calculateBtn: null,
		resetBtn: null,
		errorEl: null,
		planckEl: null,
		slopeEl: null,
		processedBody: null,
		recordedCountEl: null,
		chartCanvas: null
	};

	function showError(message) {
		if (ui.errorEl) {
			ui.errorEl.textContent = message;
			ui.errorEl.style.display = 'block';
		}
		window.alert(message);
	}

	function clearError() {
		if (!ui.errorEl) {
			return;
		}
		ui.errorEl.textContent = '';
		ui.errorEl.style.display = 'none';
	}

	function updateRecordedCount() {
		if (!ui.recordedCountEl) {
			return;
		}
		ui.recordedCountEl.textContent = `Recorded readings: ${state.recordedData.length}`;
	}

	function handleSliderChange(event) {
		const slider = event.target;
		const row = slider.closest('[data-led-row]');
		if (!row) {
			return;
		}

		const value = Number.parseFloat(slider.value);
		const valueEl = row.querySelector('[data-voltage-display]');
		if (valueEl) {
			valueEl.textContent = `${value.toFixed(2)} V`;
		}

		updateLEDGlow(row, value);
	}

	function updateLEDGlow(row, voltage) {
		const indicator = row.querySelector('[data-led-indicator]');
		if (!indicator) {
			return;
		}

		const threshold = Number.parseFloat(row.dataset.threshold);
		if (!Number.isFinite(threshold) || threshold <= 0) {
			return;
		}

		let intensity = 0.2;
		if (voltage >= threshold) {
			intensity = 1;
		} else if (voltage >= threshold - 0.2) {
			intensity = 0.65;
		}

		indicator.style.opacity = String(intensity);
		indicator.style.boxShadow = `0 0 ${4 + intensity * 18}px rgba(255, 255, 255, ${0.25 + intensity * 0.55})`;
	}

	function computeLocalValues(wavelength, kneeVoltage) {
		const wavelengthM = wavelength * ANGSTROM_TO_METER;
		const correctedVoltage = CREST_FACTOR * kneeVoltage;
		const inverseLambda = 1 / wavelengthM;

		return {
			correctedVoltage,
			inverseLambda
		};
	}

	function recordReading(event) {
		clearError();
		const button = event.target.closest('[data-record-btn]');
		if (!button) {
			return;
		}

		const row = button.closest('[data-led-row]');
		if (!row) {
			return;
		}

		const wavelength = Number.parseFloat(row.dataset.wavelength);
		const slider = row.querySelector('[data-voltage-slider]');
		const kneeVoltage = Number.parseFloat(slider ? slider.value : 'NaN');

		if (!Number.isFinite(wavelength) || !Number.isFinite(kneeVoltage)) {
			showError('Unable to record this row due to invalid wavelength or voltage.');
			return;
		}

		if (state.byWavelength.has(wavelength)) {
			showError('This LED reading is already recorded. Duplicate recordings are not allowed.');
			return;
		}

		const local = computeLocalValues(wavelength, kneeVoltage);
		const record = {
			wavelength,
			knee_voltage: kneeVoltage
		};

		state.recordedData.push(record);
		state.byWavelength.set(wavelength, record);

		const kneeCell = row.querySelector('[data-knee-voltage]');
		const correctedCell = row.querySelector('[data-corrected-voltage]');
		const inverseCell = row.querySelector('[data-inverse-lambda]');

		if (kneeCell) kneeCell.textContent = kneeVoltage.toFixed(2);
		if (correctedCell) correctedCell.textContent = local.correctedVoltage.toFixed(3);
		if (inverseCell) inverseCell.textContent = local.inverseLambda.toExponential(3);

		row.classList.add('planck-recorded-row');
		button.disabled = true;
		button.textContent = 'Recorded';

		updateRecordedCount();
		plotGraph();
	}

	function collectInputData() {
		return state.recordedData.slice();
	}

	async function callAPI(data) {
		const response = await fetch('/api/planck', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data })
		});

		let payload = null;
		try {
			payload = await response.json();
		} catch (_error) {
			payload = null;
		}

		if (!response.ok) {
			const message = payload && payload.error
				? payload.error
				: `Request failed with status ${response.status}`;
			throw new Error(message);
		}

		return payload;
	}

	function displayResults(response) {
		if (!response) {
			throw new Error('No data received from server.');
		}

		if (ui.planckEl) {
			ui.planckEl.textContent = Number(response.planck_constant).toExponential(4);
		}
		if (ui.slopeEl) {
			ui.slopeEl.textContent = Number(response.slope).toExponential(4);
		}

		if (ui.processedBody && Array.isArray(response.processed_data)) {
			ui.processedBody.innerHTML = '';
			response.processed_data.forEach((row, index) => {
				const tr = document.createElement('tr');
				tr.innerHTML = `
					<td>${index + 1}</td>
					<td>${Number(row.wavelength_angstrom).toFixed(0)}</td>
					<td>${Number(row.knee_voltage).toFixed(2)}</td>
					<td>${Number(row.corrected_voltage).toFixed(3)}</td>
					<td>${Number(row.inverse_lambda).toExponential(3)}</td>
				`;
				ui.processedBody.appendChild(tr);
			});
		}
	}

	function linearFit(points) {
		const n = points.length;
		if (n < 2) {
			return null;
		}

		let sumX = 0;
		let sumY = 0;
		let sumXY = 0;
		let sumX2 = 0;

		for (const p of points) {
			sumX += p.x;
			sumY += p.y;
			sumXY += p.x * p.y;
			sumX2 += p.x * p.x;
		}

		const denominator = (n * sumX2) - (sumX * sumX);
		if (denominator === 0) {
			return null;
		}

		const slope = ((n * sumXY) - (sumX * sumY)) / denominator;
		const intercept = (sumY - (slope * sumX)) / n;
		return { slope, intercept };
	}

	function plotGraph() {
		if (!ui.chartCanvas || typeof Chart === 'undefined') {
			return;
		}

		const points = state.recordedData
			.map((row) => {
				const computed = computeLocalValues(row.wavelength, row.knee_voltage);
				return { x: computed.inverseLambda, y: computed.correctedVoltage };
			})
			.sort((a, b) => a.x - b.x);

		const fit = linearFit(points);
		const fitLine = fit && points.length >= 2
			? [
				{ x: points[0].x, y: fit.slope * points[0].x + fit.intercept },
				{ x: points[points.length - 1].x, y: fit.slope * points[points.length - 1].x + fit.intercept }
			]
			: [];

		if (state.chart) {
			state.chart.destroy();
		}

		state.chart = new Chart(ui.chartCanvas, {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: "Recorded Points",
						data: points,
						borderColor: '#0f4c81',
						backgroundColor: 'rgba(15, 76, 129, 0.7)',
						pointRadius: 5
					},
					{
						label: 'Best Fit Line',
						data: fitLine,
						type: 'line',
						showLine: true,
						fill: false,
						borderColor: '#b73b3b',
						backgroundColor: '#b73b3b',
						pointRadius: 0,
						borderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						type: 'linear',
						title: {
							display: true,
							text: '1/lambda (m^-1)'
						}
					},
					y: {
						title: {
							display: true,
							text: 'Corrected Voltage (V)'
						}
					}
				},
				plugins: {
					legend: { display: true, position: 'top' }
				}
			}
		});
	}

	async function onCalculateClick() {
		clearError();
		const recorded = collectInputData();

		if (recorded.length === 0) {
			showError('No readings recorded yet. Record at least two LED readings before calculating.');
			return;
		}

		if (recorded.length < 2) {
			showError('At least two readings are required to compute slope and Planck constant.');
			return;
		}

		try {
			const response = await callAPI(recorded);
			displayResults(response);
			plotGraph();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Calculation failed.';
			showError(message);
			console.error('Planck API error:', error);
		}
	}

	function resetExperimentData() {
		state.recordedData = [];
		state.byWavelength.clear();

		if (state.chart) {
			state.chart.destroy();
			state.chart = null;
		}

		for (const row of ui.tableRows) {
			const slider = row.querySelector('[data-voltage-slider]');
			const valueEl = row.querySelector('[data-voltage-display]');
			const recordBtn = row.querySelector('[data-record-btn]');
			const kneeCell = row.querySelector('[data-knee-voltage]');
			const correctedCell = row.querySelector('[data-corrected-voltage]');
			const inverseCell = row.querySelector('[data-inverse-lambda]');

			if (slider) {
				slider.value = '0';
				handleSliderChange({ target: slider });
			}
			if (valueEl) valueEl.textContent = '0.00 V';
			if (recordBtn) {
				recordBtn.disabled = false;
				recordBtn.textContent = 'Record';
			}
			if (kneeCell) kneeCell.textContent = '-';
			if (correctedCell) correctedCell.textContent = '-';
			if (inverseCell) inverseCell.textContent = '-';

			row.classList.remove('planck-recorded-row');
		}

		if (ui.processedBody) {
			ui.processedBody.innerHTML = '';
		}
		if (ui.planckEl) ui.planckEl.textContent = '-';
		if (ui.slopeEl) ui.slopeEl.textContent = '-';

		clearError();
		updateRecordedCount();
	}

	function init() {
		ui.tableRows = Array.from(document.querySelectorAll('[data-led-row]'));
		ui.calculateBtn = document.getElementById('calculateBtn');
		ui.resetBtn = document.getElementById('resetBtn');
		ui.errorEl = document.getElementById('planckError');
		ui.planckEl = document.getElementById('planckConstant');
		ui.slopeEl = document.getElementById('slopeValue');
		ui.processedBody = document.getElementById('processedDataBody');
		ui.recordedCountEl = document.getElementById('recordedCount');
		ui.chartCanvas = document.getElementById('planckChart');

		if (!ui.tableRows.length || !ui.calculateBtn) {
			return;
		}

		for (const row of ui.tableRows) {
			const slider = row.querySelector('[data-voltage-slider]');
			const recordBtn = row.querySelector('[data-record-btn]');

			if (slider) {
				slider.addEventListener('input', handleSliderChange);
				handleSliderChange({ target: slider });
			}

			if (recordBtn) {
				recordBtn.addEventListener('click', recordReading);
			}
		}

		ui.calculateBtn.addEventListener('click', onCalculateClick);
		if (ui.resetBtn) {
			ui.resetBtn.addEventListener('click', resetExperimentData);
		}
		updateRecordedCount();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
