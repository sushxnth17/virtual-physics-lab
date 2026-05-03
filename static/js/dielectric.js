(function(){
	// Simulation mode: "charging" or "discharging"
	let mode = 'charging';

	// Stopwatch and voltage state (lifted to outer scope for debug API)
	let seconds = 0;
	let intervalId = null;
	let currentVoltage = 0; // Start at 0V when timer is at 0 seconds
	let timerStarted = false; // Track if user has started the timer
	const MAX_SECONDS = 200;

	// Chart instance
	let dielectricChart = null;
	let halfwayMarker = {
		tHalf: null,
		halfVoltage: 2.5
	};

	const halfwayMarkerPlugin = {
		id: 'halfwayMarkerPlugin',
		afterDraw: function(chart){
			if (halfwayMarker.tHalf === null || typeof halfwayMarker.tHalf === 'undefined') return;
			const xScale = chart.scales.x;
			const yScale = chart.scales.y;
			if (!xScale || !yScale) return;

			const x = xScale.getPixelForValue(halfwayMarker.tHalf);
			const y = yScale.getPixelForValue(halfwayMarker.halfVoltage);
			const ctx = chart.ctx;

			ctx.save();
			ctx.setLineDash([6, 6]);
			ctx.lineWidth = 2;

			// Horizontal dashed line at V = V0/2
			ctx.strokeStyle = '#d35d2b';
			ctx.beginPath();
			ctx.moveTo(chart.chartArea.left, y);
			ctx.lineTo(chart.chartArea.right, y);
			ctx.stroke();

			// Vertical dashed line at t = t_half
			ctx.strokeStyle = '#0f4c81';
			ctx.beginPath();
			ctx.moveTo(x, chart.chartArea.top);
			ctx.lineTo(x, chart.chartArea.bottom);
			ctx.stroke();

			// Intersection marker
			ctx.setLineDash([]);
			ctx.fillStyle = '#0f4c81';
			ctx.beginPath();
			ctx.arc(x, y, 5, 0, Math.PI * 2);
			ctx.fill();

			// Label t1/2
			ctx.font = 'bold 13px sans-serif';
			ctx.fillStyle = '#0f4c81';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'bottom';
			ctx.fillText('t₁/₂', x + 8, y - 8);
			ctx.restore();
		}
	};

	function setMode(newMode){
		if (newMode !== 'charging' && newMode !== 'discharging') return;
		mode = newMode;
		console.log('Simulation mode:', mode);
	}

	// Helper to show procedure messages
	function showProcedureMessage(msg, type){
		const msgDiv = document.getElementById('procedureMsg');
		if (!msgDiv) return;
		msgDiv.textContent = msg;
		msgDiv.style.display = 'block';
		// Auto-hide after 4 seconds unless it's an error
		if (type !== 'error'){
			setTimeout(function(){
				msgDiv.style.display = 'none';
			}, 4000);
		}
	}

	document.addEventListener('DOMContentLoaded', function(){
		const chargeBtn = document.getElementById('chargeBtn');
		const dischargeBtn = document.getElementById('dischargeBtn');

		// Controls placed inside the interactive area (.circuit-controls) - use explicit IDs
		const controlCharging = document.getElementById('chargingModeBtn');
		const controlDischarging = document.getElementById('dischargingModeBtn');
		const startBtn = document.getElementById('startBtn');
		const resetBtn = document.getElementById('resetBtn');
		const timerDisplay = document.getElementById('timerDisplay');
		const voltageDisplay = document.getElementById('voltageDisplay');

		if (chargeBtn) chargeBtn.addEventListener('click', function(){ setMode('charging'); });
		if (dischargeBtn) dischargeBtn.addEventListener('click', function(){ setMode('discharging'); });
		if (controlCharging) controlCharging.addEventListener('click', function(){ setMode('charging'); });
		if (controlDischarging) controlDischarging.addEventListener('click', function(){ setMode('discharging'); });

		// Stopwatch state is declared in outer scope

		function updateTimerDisplay(){
			if (!timerDisplay) return;
			timerDisplay.textContent = seconds + ' s';
		}

		function updateVoltageDisplay(){
			if (!voltageDisplay) return;
			// Ensure numeric and 3-decimal formatting
			let num = Number(currentVoltage);
			if (isNaN(num)) num = 0;
			voltageDisplay.textContent = 'Voltage: ' + num.toFixed(3) + ' V';
		}

		function startTimer(){
			if (intervalId !== null) return; // already running
			if (seconds >= MAX_SECONDS) return;
			timerStarted = true;
			intervalId = setInterval(function(){
				seconds += 1;
				if (seconds >= MAX_SECONDS){
					seconds = MAX_SECONDS;
					stopTimer();
					showProcedureMessage('⏱️ Maximum time (200s) reached. Timer stopped.', 'info');
				}
				updateTimerDisplay();
				// Fetch voltage for the new time
				fetchVoltageForTime(seconds);
			}, 1000);
		}

		function stopTimer(){
			if (intervalId !== null){
				clearInterval(intervalId);
				intervalId = null;
			}
		}

		function resetTimer(){
			stopTimer();
			timerStarted = false;
			seconds = 0;
			updateTimerDisplay();
			// Reset current voltage to 0V
			currentVoltage = 0;
			updateVoltageDisplay();
			halfwayMarker.tHalf = null;
			// Reinitialize chart
			initChart();
			showProcedureMessage('↺ Timer reset. Ready to start again.', 'info');
		}

		function updateHalfwayMarker(tHalf){
			const numericHalf = Number(tHalf);
			if (isNaN(numericHalf)) return;
			halfwayMarker.tHalf = numericHalf;
			halfwayMarker.halfVoltage = 2.5;
			if (dielectricChart) dielectricChart.update();
		}

		// Fetch voltage value from backend API for a given time (seconds)
		function fetchVoltageForTime(t){
			// Use POST /api/dielectric with JSON { time_points: [t] }
			return fetch('/api/dielectric', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ time_points: [t] })
			})
			.then(function(resp){ return resp.json(); })
			.then(function(data){
				// Expect arrays 'charging_voltage' and 'discharging_voltage'
				if (!data) return null;
				let chargeArr = data.charging_voltage;
				let dischargeArr = data.discharging_voltage;
				let value = null;
				if (mode === 'charging' && Array.isArray(chargeArr)){
					value = chargeArr[0];
				} else if (mode === 'discharging' && Array.isArray(dischargeArr)){
					value = dischargeArr[0];
				}
				currentVoltage = value;
				console.log('Fetched voltage at', t, 's ->', currentVoltage);
				updateVoltageDisplay();
				return currentVoltage;
			})
			.catch(function(err){
				console.error('Error fetching dielectric data:', err);
				return null;
			});
		}

		// Initialize chart with data from table
		function initChart(){
			// Destroy existing chart if present
			if (dielectricChart){
				dielectricChart.destroy();
			}

			// Extract data from observation table
			const tbody = document.querySelector('.observation-table tbody');
			if (!tbody) return;
			
			const rows = Array.from(tbody.querySelectorAll('tr'));
			const chargingData = [];
			const dischargingData = [];

			rows.forEach(function(row){
				const tds = row.querySelectorAll('td');
				if (tds.length >= 3){
					const time = Number(tds[0].textContent.trim());
					const chargingVoltage = tds[1].textContent.trim();
					const dischargingVoltage = tds[2].textContent.trim();

					// Only include recorded data (skip template defaults)
					// Template default at t=0 is "0.000", skip it
					// Include all non-empty values at t > 0
					// Include t=0 only if explicitly recorded (non-default value)
					
					if (chargingVoltage && !(time === 0 && chargingVoltage === '0.000')){
						chargingData.push({ x: time, y: Number(chargingVoltage) });
					}
					if (dischargingVoltage && !(time === 0 && dischargingVoltage === '0.000')){
						dischargingData.push({ x: time, y: Number(dischargingVoltage) });
					}
				}
			});

			// Create chart with both datasets
			const ctx = document.getElementById('dielectricChart');
			if (!ctx) return;
			
			dielectricChart = new Chart(ctx, {
				type: 'scatter',
				plugins: [halfwayMarkerPlugin],
				data: {
					datasets: [
						{
							label: 'Charging Voltage',
							data: chargingData,
							borderColor: '#0f4c81',
							backgroundColor: 'rgba(15, 76, 129, 0.5)',
							showLine: true,
							fill: false,
							tension: 0.4,
							pointRadius: 4,
							pointHoverRadius: 6,
							borderWidth: 2
						},
						{
							label: 'Discharging Voltage',
							data: dischargingData,
							borderColor: '#d35d2b',
							backgroundColor: 'rgba(211, 93, 43, 0.5)',
							showLine: true,
							fill: false,
							tension: 0.4,
							pointRadius: 4,
							pointHoverRadius: 6,
							borderWidth: 2
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: true,
					scales: {
						x: {
							type: 'linear',
							title: { display: true, text: 'Time (s)', font: { size: 14 } },
							min: 0,
							max: MAX_SECONDS
						},
						y: {
							title: { display: true, text: 'Voltage (V)', font: { size: 14 } },
							beginAtZero: true
						}
					},
					plugins: {
						legend: { display: true, position: 'top' },
						title: { display: false }
					}
				}
			});
		}

		// Update chart after recording a reading
		function updateChart(){
			if (!dielectricChart) return;

			// Re-extract data from table
			const tbody = document.querySelector('.observation-table tbody');
			if (!tbody) return;
			
			const rows = Array.from(tbody.querySelectorAll('tr'));
			const chargingData = [];
			const dischargingData = [];

			rows.forEach(function(row){
				const tds = row.querySelectorAll('td');
				if (tds.length >= 3){
					const time = Number(tds[0].textContent.trim());
					const chargingVoltage = tds[1].textContent.trim();
					const dischargingVoltage = tds[2].textContent.trim();

					// Only include recorded data (skip template defaults)
					if (chargingVoltage && !(time === 0 && chargingVoltage === '0.000')){
						chargingData.push({ x: time, y: Number(chargingVoltage) });
					}
					if (dischargingVoltage && !(time === 0 && dischargingVoltage === '0.000')){
						dischargingData.push({ x: time, y: Number(dischargingVoltage) });
					}
				}
			});

			// Update datasets
			dielectricChart.data.datasets[0].data = chargingData;
			dielectricChart.data.datasets[1].data = dischargingData;
			dielectricChart.update();
		}

		// Record reading button handler
		const recordBtn = document.getElementById('recordBtn');
		if (recordBtn) recordBtn.addEventListener('click', recordReading);

		function recordReading(){
			const t = seconds;

			// Enforce lab procedure: must start timer first
			if (!timerStarted){
				showProcedureMessage('⚠️ Start the timer first before recording readings.', 'error');
				return;
			}

			// Extract valid times from the table
			const tbody = document.querySelector('.observation-table tbody');
			if (!tbody) return;
			const rows = Array.from(tbody.querySelectorAll('tr'));
			const validTimes = rows.map(function(r){
				const td = r.querySelector('td');
				return td ? Number(td.textContent.trim()) : null;
			}).filter(function(t){ return t !== null; });

			// Enforce: must record at times that exist in the table only
			if (!validTimes.includes(t)){
				showProcedureMessage('⚠️ Recording not allowed at ' + t + 's. Allowed times: 0-50s (5s intervals), 60-200s (10s intervals).', 'error');
				return;
			}

			// Enforce: cannot record after 200 seconds
			if (t > MAX_SECONDS){
				showProcedureMessage('⏹️ Cannot record after 200 seconds. Please reset and try again.', 'error');
				return;
			}

			function doRecord(){
				if (currentVoltage === null || typeof currentVoltage === 'undefined'){
					console.warn('No voltage to record at', t);
					return;
				}
				const tbody = document.querySelector('.observation-table tbody');
				if (!tbody) return;
				const rows = Array.from(tbody.querySelectorAll('tr'));
				let found = rows.find(function(r){
					const td = r.querySelector('td');
					return td && Number(td.textContent.trim()) === t;
				});
				if (found){
					const tds = found.querySelectorAll('td');
					// columns: 0=time, 1=charging, 2=discharging
					const targetCol = mode === 'charging' ? 1 : 2;
					const currentCellValue = tds[targetCol].textContent.trim();
					
					// If cell already has a value (other than empty), don't overwrite it
					if (currentCellValue && currentCellValue !== ''){
						showProcedureMessage('⚠️ Value already recorded at ' + t + 's for ' + mode + ' mode. Entry is static and cannot be changed.', 'error');
						return;
					}
					
					// Record the value only if cell is empty
					tds[targetCol].textContent = Number(currentVoltage).toFixed(3);
					showProcedureMessage('✓ Reading recorded at ' + t + 's', 'success');
				} else {
					const tr = document.createElement('tr');
					const tdTime = document.createElement('td'); tdTime.textContent = t;
					const tdC = document.createElement('td'); const tdD = document.createElement('td');
					if (mode === 'charging') tdC.textContent = Number(currentVoltage).toFixed(3); else tdD.textContent = Number(currentVoltage).toFixed(3);
					tr.appendChild(tdTime); tr.appendChild(tdC); tr.appendChild(tdD);
					tbody.appendChild(tr);
					showProcedureMessage('✓ Reading recorded at ' + t + 's', 'success');
				}
				// Update chart with new data point
				updateChart();
			}

			// Always fetch fresh voltage when recording
			fetchVoltageForTime(t).then(function(){ doRecord(); });
		}

		// Calculate Dielectric Constant from recorded data
		function calculateDielectricConstant(){
			const tbody = document.querySelector('.observation-table tbody');
			if (!tbody) return;

			// Extract all recorded time points
			const rows = Array.from(tbody.querySelectorAll('tr'));
			const timePoints = [];

			rows.forEach(function(row){
				const tds = row.querySelectorAll('td');
				if (tds.length >= 3){
					const time = Number(tds[0].textContent.trim());
					const chargingVoltage = tds[1].textContent.trim();
					const dischargingVoltage = tds[2].textContent.trim();

					// Check if either charging or discharging has data (excluding template defaults at t=0)
					if ((chargingVoltage && chargingVoltage !== '0.000') || 
					    (dischargingVoltage && dischargingVoltage !== '0.000')){
						timePoints.push(time);
					}
				}
			});

			// Validation: need at least 3 data points for meaningful calculation
			if (timePoints.length < 3){
				showProcedureMessage('⚠️ Insufficient data. Record at least 3 readings to calculate dielectric constant.', 'error');
				return;
			}

			// Send time_points to backend to compute K and t_half
			fetch('/api/dielectric', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ time_points: timePoints })
			})
			.then(function(resp){ return resp.json(); })
			.then(function(data){
				if (!data || typeof data.dielectric_constant === 'undefined'){
					showProcedureMessage('⚠️ Failed to calculate. Please check your data.', 'error');
					return;
				}

				const K = data.dielectric_constant;
				const tHalf = data.t_half;

				// Display results
				const resultDiv = document.getElementById('calculationResult');
				const kValue = document.getElementById('kValue');
				const tHalfValue = document.getElementById('tHalfValue');

				if (resultDiv && kValue && tHalfValue){
					kValue.textContent = 'K = ' + K.toFixed(4);
					tHalfValue.textContent = 't₁/₂ = ' + tHalf.toFixed(3) + ' s';
					resultDiv.style.display = 'block';
					updateHalfwayMarker(tHalf);
					const bottomK = document.getElementById('calcK');
					const bottomTHalf = document.getElementById('calcTHalf');
					const resultText = document.getElementById('resultText');
					if (bottomK) bottomK.textContent = 'K = ' + K.toFixed(4);
					if (bottomTHalf) bottomTHalf.textContent = 't₁/₂ = ' + tHalf.toFixed(3) + ' s';
					if (resultText) resultText.textContent = 'The dielectric constant of the given dielectric material is ' + K.toFixed(4) + '.';
					showProcedureMessage('✓ Calculation complete!', 'success');
				}
			})
			.catch(function(err){
				console.error('Error calculating dielectric constant:', err);
				showProcedureMessage('⚠️ Calculation error. Please try again.', 'error');
			});
		}

		// Wire up calculate button
		const calculateBtn = document.getElementById('calculateBtn');
		if (calculateBtn) calculateBtn.addEventListener('click', calculateDielectricConstant);

		// Initialize chart on page load
		initChart();

		if (startBtn) startBtn.addEventListener('click', startTimer);
		if (resetBtn) resetBtn.addEventListener('click', resetTimer);

		// Initial display
		updateTimerDisplay();
		updateVoltageDisplay();

		// Initial log for testing
		console.log('Dielectric simulation script loaded. Initial mode:', mode);
	});

	// Expose small API for debugging in console
	window.dielectricSimulation = {
		getMode: function(){ return mode; },
		setMode: setMode,
		getCurrentVoltage: function(){ return currentVoltage; },
		getTime: function(){ return seconds; }
	};
})();
