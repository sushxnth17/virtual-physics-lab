document.addEventListener('DOMContentLoaded', () => {
	const canvas = document.getElementById('naSimulationCanvas');
	const distanceSlider = document.getElementById('naScreenDistance');
	const moveNearBtn = document.getElementById('naMoveScreenNear');
	const moveFarBtn = document.getElementById('naMoveScreenFar');
	const captureReadingBtn = document.getElementById('naCaptureReadingBtn');
	const captureStatus = document.getElementById('naCaptureStatus');
	const measuredDiameterLabel = document.getElementById('naMeasuredDiameterValue');
	const measuredDistanceLabel = document.getElementById('naMeasuredDistanceValue');
	const freeModeLabel = document.getElementById('naFreeModeLabel');
	const freeModeFeedback = document.getElementById('naFreeModeFeedback');
	const liveExploreL = document.getElementById('naLiveExploreL');
	const liveExploreD = document.getElementById('naLiveExploreD');

	if (!canvas || !distanceSlider) {
		return;
	}

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return;
	}

	const allowedLValues = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
	const freeModeBounds = { min: 0.0, max: 5.0, step: 0.01 };
	const PIXELS_PER_CM = 100;
	const axisConfig = {
		maxCm: 5,
		majorTickCm: 0.5,
		minorTickCm: 0.25
	};
	const NA_MODES = Object.freeze({
		LAB: 'lab',
		EXPLORE: 'explore'
	});

	const state = {
		Lcm: 0,
		screenX: 0,
		targetScreenX: 0,
		halfAngleDeg: 11.5,
		pixelsPerCm: PIXELS_PER_CM,
		screenDragging: false,
		animationFrameId: null,
		lastCapturedL: null,
		// Animation state for smooth transitions
		animationStartX: 0,
		animationStartTime: 0,
		animationDuration: 0,
		animationEasing: null
	};

	const geometry = {
		fiberTipX: 245,
		centerY: 210,
		axisStartX: 245,
		axisLengthPx: 535
	};

	// Easing functions for smooth animations
	const easing = {
		// Smooth cubic easing out (decelerating)
		easeOut: (t) => 1 - Math.pow(1 - t, 3),
		// Smooth cubic easing in-out (starts slow, fast middle, ends slow)
		easeInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
		// Linear easing (for drag feedback)
		linear: (t) => t
	};

	// Helper function to draw rounded rectangles (for browser compatibility)
	function drawRoundRect(x, y, width, height, radius) {
		const r = Math.min(radius, width / 2, height / 2);
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + width - r, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + r);
		ctx.lineTo(x + width, y + height - r);
		ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
		ctx.lineTo(x + r, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
	}

	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
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
	}

	function cmToPixels(cm) {
		return cm * state.pixelsPerCm;
	}

	function pixelsToCm(px) {
		return px / state.pixelsPerCm;
	}

	function snapToNearestL(valueCm) {
		let nearest = allowedLValues[0];
		let minDelta = Math.abs(valueCm - nearest);

		for (const value of allowedLValues) {
			const delta = Math.abs(valueCm - value);
			if (delta < minDelta) {
				minDelta = delta;
				nearest = value;
			}
		}

		return nearest;
	}

	function getCurrentLIndex() {
		return allowedLValues.findIndex((value) => Math.abs(value - state.Lcm) < 0.001);
	}

	function getMinLForMode() {
		return isExploreMode() ? freeModeBounds.min : allowedLValues[0];
	}

	function getMaxLForMode() {
		return isExploreMode() ? freeModeBounds.max : allowedLValues[allowedLValues.length - 1];
	}

	function normalizeLForMode(valueCm) {
		const bounded = clamp(valueCm, getMinLForMode(), getMaxLForMode());
		if (isExploreMode()) {
			return bounded;
		}

		return snapToNearestL(bounded);
	}

	function getScreenMinX() {
		return geometry.fiberTipX + cmToPixels(getMinLForMode());
	}

	function getScreenMaxX() {
		return geometry.fiberTipX + cmToPixels(getMaxLForMode());
	}

	function getScreenXForL(Lcm) {
		return geometry.fiberTipX + cmToPixels(Lcm);
	}

	function measureDistanceL() {
		const distancePx = Math.abs(state.screenX - geometry.fiberTipX);
		const measuredL = pixelsToCm(distancePx);
		state.Lcm = normalizeLForMode(measuredL);
	}

	function syncModeDependentState() {
		stopScreenAnimation();
		state.screenDragging = false;

		if (isExploreMode()) {
			state.Lcm = normalizeLForMode(state.Lcm);
			setScreenXImmediate(getScreenXForL(state.Lcm));
			distanceSlider.min = String(freeModeBounds.min);
			distanceSlider.max = String(freeModeBounds.max);
			distanceSlider.step = String(freeModeBounds.step);
			distanceSlider.value = state.Lcm.toFixed(2);
			if (freeModeLabel) {
				freeModeLabel.hidden = false;
			}
			if (freeModeFeedback) {
				freeModeFeedback.hidden = false;
			}
			render();
			return;
		}

		state.Lcm = normalizeLForMode(state.Lcm);
		setScreenXImmediate(getScreenXForL(state.Lcm));
		distanceSlider.min = String(allowedLValues[0]);
		distanceSlider.max = String(allowedLValues[allowedLValues.length - 1]);
		distanceSlider.step = '0.25';
		distanceSlider.value = state.Lcm.toString();
		if (freeModeLabel) {
			freeModeLabel.hidden = true;
		}
		if (freeModeFeedback) {
			freeModeFeedback.hidden = true;
		}
		render();
	}

	function enableFreeMode() {
		if (isExploreMode()) {
			return;
		}

		setCurrentMode(NA_MODES.EXPLORE);
		setCaptureStatus('Explore mode enabled: free screen movement and custom L values are now allowed.');
	}

	function moveToExploreLValue(value) {
		if (!Number.isFinite(value) || value <= 0) {
			return;
		}

		if (!isExploreMode()) {
			enableFreeMode();
		}

		updateDistanceFromControl(value);
	}

	function getScreenX() {
		return state.screenX;
	}

	function setScreenXImmediate(screenX) {
		state.screenX = clamp(screenX, getScreenMinX(), getScreenMaxX());
		state.targetScreenX = state.screenX;
		measureDistanceL();
	}

	function stopScreenAnimation() {
		if (state.animationFrameId !== null) {
			cancelAnimationFrame(state.animationFrameId);
			state.animationFrameId = null;
		}
	}

	function animateScreenTowardTarget() {
		if (state.animationFrameId !== null) {
			return;
		}

		const distance = Math.abs(state.targetScreenX - state.screenX);
		
		// Calculate duration based on distance (smooth but responsive)
		// Closer movements finish faster, longer distances get smooth easing
		state.animationDuration = Math.min(600, Math.max(200, distance * 1.2));
		state.animationStartX = state.screenX;
		state.animationStartTime = Date.now();
		state.animationEasing = easing.easeInOut;

		const step = () => {
			const elapsed = Date.now() - state.animationStartTime;
			const progress = Math.min(elapsed / state.animationDuration, 1);

			// Apply easing function
			const easedProgress = state.animationEasing(progress);
			
			// Calculate new position
			state.screenX = state.animationStartX + 
				(state.targetScreenX - state.animationStartX) * easedProgress;

			render();

			if (progress >= 1) {
				state.screenX = state.targetScreenX;
				stopScreenAnimation();
			} else {
				state.animationFrameId = requestAnimationFrame(step);
			}
		};

		state.animationFrameId = requestAnimationFrame(step);
	}

	function getSpotRadiusPx() {
		const halfAngleRad = (state.halfAngleDeg * Math.PI) / 180;
		return cmToPixels(state.Lcm * Math.tan(halfAngleRad));
	}

	function getSpotDiameterCm() {
		return pixelsToCm(getSpotRadiusPx() * 2);
	}

	function updateDiameterReadout() {
		if (!measuredDiameterLabel) {
			return;
		}

		const dCm = getSpotDiameterCm();
		measuredDiameterLabel.textContent = `${dCm.toFixed(2)}`;
		if (liveExploreD) {
			liveExploreD.textContent = dCm.toFixed(2);
		}
	}

	function updateDistanceReadout() {
		if (measuredDistanceLabel) {
			measuredDistanceLabel.textContent = `${state.Lcm.toFixed(2)}`;
		}
		if (liveExploreL) {
			liveExploreL.textContent = state.Lcm.toFixed(2);
		}

		distanceSlider.value = isExploreMode() ? state.Lcm.toFixed(2) : state.Lcm.toString();
	}

	function setCaptureStatus(message, isError = false) {
		if (!captureStatus) {
			return;
		}

		captureStatus.textContent = message;
		captureStatus.style.color = isError ? '#9b1c1c' : '#36546f';
	}

	function getObservationRows() {
		const table = document.getElementById('naObservationTable');
		if (!table || !table.tBodies[0]) {
			return [];
		}

		return Array.from(table.tBodies[0].rows);
	}

	function getNextAvailableRow(rows) {
		if (isExploreMode()) {
			for (const row of rows) {
				if (!row.classList.contains('na-explore-row')) {
					continue;
				}

				const dInput = row.querySelector('.na-d-input');
				if (dInput && dInput.value.trim() === '') {
					return row;
				}
			}

			return null;
		}

		for (const row of rows) {
			const dInput = row.querySelector('.na-d-input');

			if (!dInput) {
				continue;
			}

			const dEmpty = dInput.value.trim() === '';
			if (dEmpty) {
				return row;
			}
		}

		return null;
	}

	function parseRowLValue(row) {
		const fixedLCell = row.querySelector('.na-l-fixed');
		if (fixedLCell) {
			const fixedL = parseFloat(fixedLCell.dataset.l || fixedLCell.textContent || '');
			return Number.isFinite(fixedL) ? fixedL : null;
		}

		const editableLInput = row.querySelector('.na-l-input');
		if (!editableLInput || editableLInput.value.trim() === '') {
			return null;
		}

		const editableL = parseFloat(editableLInput.value);
		return Number.isFinite(editableL) ? editableL : null;
	}

	function isDuplicateLAcrossTable(value, excludedRow = null) {
		if (!Number.isFinite(value)) {
			return false;
		}

		const rows = getObservationRows();
		for (const row of rows) {
			if (row === excludedRow) {
				continue;
			}

			const rowL = parseRowLValue(row);
			if (rowL !== null && Math.abs(rowL - value) < 0.0001) {
				return true;
			}
		}

		return false;
	}

	function updateSelectedLHighlights() {
		const rows = getObservationRows();
		for (const row of rows) {
			const fixedLCell = row.querySelector('.na-l-fixed');
			if (!fixedLCell) {
				row.classList.remove('is-active');
				continue;
			}

			const rowL = parseFloat(fixedLCell.dataset.l || fixedLCell.textContent || '0');
			const isSelected = Number.isFinite(rowL) && Math.abs(rowL - state.Lcm) < 0.001;
			row.classList.toggle('is-active', isSelected);
		}
	}

	function updateStepButtonState() {
		if (isExploreMode()) {
			if (moveNearBtn) {
				moveNearBtn.disabled = false;
			}

			if (moveFarBtn) {
				moveFarBtn.disabled = false;
			}
			return;
		}

		const currentIndex = getCurrentLIndex();

		if (moveNearBtn) {
			moveNearBtn.disabled = currentIndex <= 0;
		}

		if (moveFarBtn) {
			moveFarBtn.disabled = currentIndex >= allowedLValues.length - 1;
		}
	}

	function captureCurrentReading() {
		measureDistanceL();
		const L = state.Lcm;
		const D = getSpotDiameterCm();
		const previousL = state.lastCapturedL;

		if (!Number.isFinite(L) || !Number.isFinite(D) || L <= 0 || D < 0) {
			setCaptureStatus('Unable to capture reading. Adjust setup and try again.', true);
			return;
		}

		const rows = getObservationRows();
		if (!rows.length) {
			setCaptureStatus('Observation table not available.', true);
			return;
		}

		const targetRow = getNextAvailableRow(rows);
		if (!targetRow) {
			if (isExploreMode()) {
				setCaptureStatus('No empty Explore row available. Click Explore More to append a new custom row.', true);
				return;
			}

			setCaptureStatus('All rows are filled. Clear a row to capture a new reading.', true);
			return;
		}

		const fixedLCell = targetRow.querySelector('.na-l-fixed');
		const editableLInput = targetRow.querySelector('.na-l-input');
		const dInput = targetRow.querySelector('.na-d-input');
		if ((!fixedLCell && !editableLInput) || !dInput) {
			setCaptureStatus('Could not find L/D input cells in target row.', true);
			return;
		}

		const thetaCell = targetRow.querySelector('.theta-value');
		const naCell = targetRow.querySelector('.na-value');
		if (thetaCell) {
			thetaCell.textContent = '';
		}
		if (naCell) {
			naCell.textContent = '';
		}

		const trialCell = targetRow.querySelector('td');
		const trialNo = trialCell ? trialCell.textContent.trim() : 'next';
		let targetL = L;
		let hasTargetL = false;

		if (fixedLCell && !isExploreMode()) {
			targetL = parseFloat(fixedLCell.dataset.l || fixedLCell.textContent || '0');
			hasTargetL = Number.isFinite(targetL) && targetL > 0;
			const deltaL = hasTargetL ? Math.abs(L - targetL) : null;

			if (hasTargetL && deltaL !== null && deltaL > 0.001) {
				setCaptureStatus(`Trial ${trialNo} expects L=${targetL.toFixed(2)} cm. Current selected L is ${L.toFixed(2)} cm. Set L to the highlighted step, then capture.`, true);
				return;
			}
		} else if (editableLInput) {
			if (isDuplicateLAcrossTable(L, targetRow)) {
				setCaptureStatus('Duplicate L value not allowed', true);
				return;
			}

			editableLInput.value = L.toFixed(2);
			hasTargetL = true;
		}

		dInput.value = D.toFixed(2);
		state.lastCapturedL = L;

		if (previousL !== null && Math.abs(previousL - L) < 0.05) {
			setCaptureStatus(`Captured trial ${trialNo}: D=${D.toFixed(2)} cm at fixed L=${hasTargetL ? targetL.toFixed(2) : L.toFixed(2)} cm. Use Next to proceed to the next L step.`);
			return;
		}

		setCaptureStatus(`Captured trial ${trialNo}: fixed L=${hasTargetL ? targetL.toFixed(2) : L.toFixed(2)} cm, D=${D.toFixed(2)} cm. Proceed step-by-step using Previous/Next.`);
	}

	function drawBackground() {
		// Main gradient background - professional lab appearance
		const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
		gradient.addColorStop(0, '#fafbfc');
		gradient.addColorStop(0.5, '#f3f7fb');
		gradient.addColorStop(1, '#eef3f9');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Add subtle vignette effect for depth
		const vignetteGradient = ctx.createRadialGradient(
			canvas.width / 2, canvas.height / 2, 100,
			canvas.width / 2, canvas.height / 2, canvas.width * 0.75
		);
		vignetteGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
		vignetteGradient.addColorStop(1, 'rgba(190, 210, 235, 0.08)');
		ctx.fillStyle = vignetteGradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw professional frame border around simulation
		ctx.strokeStyle = '#a0b8d0';
		ctx.lineWidth = 3;
		ctx.strokeRect(32, 18, canvas.width - 64, canvas.height - 90);

		// Add subtle inner shadow effect for depth
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
		ctx.lineWidth = 1.5;
		ctx.strokeRect(34, 20, canvas.width - 68, canvas.height - 94);
	}

	// Helper function to draw soft shadow
	function drawSoftShadow(x, y, width, height, shadowBlur = 4, offsetX = 1, offsetY = 2) {
		ctx.save();
		ctx.filter = `blur(${shadowBlur}px)`;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
		ctx.fillRect(x + offsetX, y + offsetY, width, height);
		ctx.restore();
	}

	function drawMeasurementDisplay() {
		const displayX = canvas.width - 185;
		const displayY = 32;
		const boxWidth = 160;
		const boxHeight = 95;
		const cornerRadius = 10;

		// === PROFESSIONAL INFO PANEL ===
		
		// Draw enhanced shadow for depth
		ctx.save();
		ctx.filter = 'blur(4px)';
		ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
		drawRoundRect(displayX + 1.5, displayY + 1.5, boxWidth, boxHeight, cornerRadius);
		ctx.fill();
		ctx.restore();

		// Draw clean professional white background
		ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
		drawRoundRect(displayX, displayY, boxWidth, boxHeight, cornerRadius);
		ctx.fill();

		// Draw professional border
		ctx.strokeStyle = 'rgba(160, 180, 200, 0.8)';
		ctx.lineWidth = 1.2;
		drawRoundRect(displayX, displayY, boxWidth, boxHeight, cornerRadius);
		ctx.stroke();

		// Draw subtle top highlight for glass effect
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
		ctx.lineWidth = 1;
		drawRoundRect(displayX + 1, displayY + 1, boxWidth - 2, boxHeight - 2, cornerRadius - 1);
		ctx.stroke();

		// === MEASUREMENT VALUES (L and D) ===
		
		const dCm = getSpotDiameterCm();

		// Padding and spacing
		const padX = 16;
		const padY = 14;
		const lineHeight = 38;

		// L value (distance in cm)
		ctx.font = '500 13px "IBM Plex Sans", sans-serif';
		ctx.fillStyle = '#4a5f7a';
		ctx.textAlign = 'left';
		ctx.fillText('L (cm):', displayX + padX, displayY + padY + 4);
		
		ctx.font = 'bold 19px "IBM Plex Sans", sans-serif';
		ctx.fillStyle = '#0f4c81';
		ctx.fillText(state.Lcm.toFixed(2), displayX + padX + 60, displayY + padY + 4);

		// D value (diameter in cm)
		ctx.font = '500 13px "IBM Plex Sans", sans-serif';
		ctx.fillStyle = '#4a5f7a';
		ctx.fillText('D (cm):', displayX + padX, displayY + padY + lineHeight + 2);
		
		ctx.font = 'bold 19px "IBM Plex Sans", sans-serif';
		ctx.fillStyle = '#d4870e';
		ctx.fillText(dCm.toFixed(2), displayX + padX + 60, displayY + padY + lineHeight + 2);

		ctx.restore();
	}

	function drawAxis() {
		const y = geometry.centerY + 138;
		const x0 = geometry.axisStartX;
		const x1 = x0 + cmToPixels(axisConfig.maxCm);

		// Draw main ruler baseline (darker, thicker)
		ctx.strokeStyle = '#1a2535';
		ctx.lineWidth = 3.2;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(x0, y);
		ctx.lineTo(x1, y);
		ctx.stroke();

		// Draw subtle shadow/depth line below
		ctx.strokeStyle = 'rgba(26, 37, 53, 0.18)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(x0, y + 1.5);
		ctx.lineTo(x1, y + 1.5);
		ctx.stroke();

		const totalMinorSteps = Math.round(axisConfig.maxCm / axisConfig.minorTickCm);
		const majorStepSize = Math.round(axisConfig.majorTickCm / axisConfig.minorTickCm);

		for (let step = 0; step <= totalMinorSteps; step += 1) {
			const LValue = step * axisConfig.minorTickCm;
			const tx = x0 + cmToPixels(LValue);
			const isMajor = step % majorStepSize === 0;
			const isSelectedMajor = isMajor && Math.abs(LValue - state.Lcm) <= axisConfig.majorTickCm / 2;

			if (isMajor) {
				// Major ticks: longer, darker, thicker
				const tickH = isSelectedMajor ? 16 : 13;
				ctx.strokeStyle = isSelectedMajor ? '#0f4c81' : '#1a2535';
				ctx.lineWidth = isSelectedMajor ? 2.8 : 2.2;
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(tx, y - tickH);
				ctx.lineTo(tx, y);
				ctx.stroke();

				// Add subtle shadow on major tick
				ctx.strokeStyle = 'rgba(26, 37, 53, 0.10)';
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(tx + 0.5, y - tickH + 0.5);
				ctx.lineTo(tx + 0.5, y + 0.5);
				ctx.stroke();

				// Draw numeric labels below ticks
				ctx.fillStyle = isSelectedMajor ? '#0f4c81' : '#1a2535';
				ctx.font = isSelectedMajor ? '700 13px "IBM Plex Sans", sans-serif' : '600 12px "IBM Plex Sans", sans-serif';
				ctx.textAlign = 'center';
				ctx.lineWidth = 1;
				
				// Format label: show as integer if whole number, else as decimal
				let label = LValue.toFixed(2);
				if (LValue % 1 === 0) {
					label = LValue.toFixed(0);
				} else if (LValue % 0.5 === 0) {
					label = LValue.toFixed(1);
				}
				ctx.fillText(label, tx, y + 28);
			} else {
				// Minor ticks: shorter, lighter
				const tickH = 6;
				ctx.strokeStyle = '#304c69';
				ctx.lineWidth = 1.2;
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(tx, y - tickH);
				ctx.lineTo(tx, y);
				ctx.stroke();
			}
		}

		// Draw ruler label
		ctx.strokeStyle = '#1a2535';
		ctx.lineWidth = 1;
		ctx.fillStyle = '#1a2535';
		ctx.font = '600 13px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText('Distance scale from fiber tip, L (cm)', x0, y + 50);
	}

	function drawLaserAndFiber() {
		const laserX = 35;
		const laserY = geometry.centerY - 46;
		const laserW = 130;
		const laserH = 92;
		const fiberStartX = 180;
		const fiberY = geometry.centerY - 50;
		const fiberH = 100;
		const fiberW = geometry.fiberTipX - fiberStartX;
		
		// Nozzle position (where beam exits laser)
		const nozzleX = laserX + laserW - 8;
		const nozzleY = geometry.centerY;
		
		const beamStartX = laserX + laserW;
		const beamEndX = geometry.fiberTipX - 1;
		const beamY = geometry.centerY;

		// Calculate subtle pulse animation based on time
		const pulsePhase = (Date.now() * 0.002) % (Math.PI * 2);
		const pulseFactor = 0.85 + 0.15 * Math.sin(pulsePhase);

		// === DRAW LASER DEVICE ===
		
		// Draw shadow before laser body
		drawSoftShadow(laserX, laserY, laserW, laserH, 3, 1, 2);

		// Draw metallic laser body with enhanced 3D gradient
		const laserGradient = ctx.createLinearGradient(laserX, laserY, laserX + laserW, laserY);
		laserGradient.addColorStop(0, '#e8e8ec');
		laserGradient.addColorStop(0.15, '#d4d4d8');
		laserGradient.addColorStop(0.4, '#c0c0c8');
		laserGradient.addColorStop(0.6, '#b0b0b8');
		laserGradient.addColorStop(0.85, '#8a8a92');
		laserGradient.addColorStop(1, '#707078');
		
		ctx.fillStyle = laserGradient;
		ctx.fillRect(laserX, laserY, laserW, laserH);

		// Draw laser body border with 3D edge effect
		ctx.strokeStyle = '#4a4a52';
		ctx.lineWidth = 2.5;
		ctx.strokeRect(laserX, laserY, laserW, laserH);
		
		// Draw top edge highlight for 3D effect
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(laserX + 2, laserY + 2);
		ctx.lineTo(laserX + laserW - 2, laserY + 2);
		ctx.stroke();

		// Draw laser front panel (rounded corner section)
		ctx.fillStyle = '#e8e8eb';
		ctx.beginPath();
		ctx.moveTo(laserX + 6, laserY + 10);
		ctx.lineTo(laserX + laserW - 12, laserY + 10);
		ctx.lineTo(laserX + laserW - 12, laserY + laserH - 10);
		ctx.lineTo(laserX + 6, laserY + laserH - 10);
		ctx.quadraticCurveTo(laserX, laserY + laserH - 4, laserX, laserY + laserH - 10);
		ctx.quadraticCurveTo(laserX, laserY + 4, laserX + 6, laserY + 10);
		ctx.fill();

		// Draw red LASER label on front
		ctx.fillStyle = '#c41e3a';
		ctx.font = '600 11px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('LASER', laserX + laserW / 2 - 6, laserY + laserH / 2 + 2);

		// Draw warning triangle icon
		ctx.fillStyle = '#ffc107';
		const triX = laserX + 12;
		const triY = laserY + 15;
		const triSize = 6;
		ctx.beginPath();
		ctx.moveTo(triX, triY - triSize);
		ctx.lineTo(triX + triSize, triY + triSize);
		ctx.lineTo(triX - triSize, triY + triSize);
		ctx.closePath();
		ctx.fill();

		// Draw triangle border
		ctx.strokeStyle = '#ff8c00';
		ctx.lineWidth = 0.8;
		ctx.stroke();

		// === DRAW LASER NOZZLE ===
		
		// Draw nozzle glow
		ctx.save();
		ctx.filter = 'blur(3px)';
		const nozzleGlowGradient = ctx.createRadialGradient(nozzleX, nozzleY, 0, nozzleX, nozzleY, 6);
		nozzleGlowGradient.addColorStop(0, 'rgba(255, 100, 80, 0.25)');
		nozzleGlowGradient.addColorStop(1, 'rgba(255, 80, 60, 0.05)');
		ctx.fillStyle = nozzleGlowGradient;
		ctx.beginPath();
		ctx.arc(nozzleX, nozzleY, 6, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// Draw nozzle cylinder (dark metallic)
		ctx.fillStyle = '#4a4a50';
		ctx.beginPath();
		ctx.arc(nozzleX, nozzleY, 4, 0, Math.PI * 2);
		ctx.fill();

		// Draw nozzle highlight
		ctx.fillStyle = '#6a6a70';
		ctx.beginPath();
		ctx.arc(nozzleX - 1, nozzleY - 1, 1.5, 0, Math.PI * 2);
		ctx.fill();

		// === DRAW LASER BEAM ===
		
		// Draw beam expansion after fiber (cone shape)
		const fiberTipX = geometry.fiberTipX;
		const beamExpansionDistance = beamEndX - fiberTipX;
		
		// Calculate beam cone parameters
		const coneTopY = beamY - 2;
		const coneBottomY = beamY + 2;
		
		// Draw beam glow cone (widest, most transparent)
		ctx.save();
		ctx.filter = 'blur(2px)';
		const beamGlowGradient = ctx.createLinearGradient(beamStartX, beamY, beamEndX, beamY);
		beamGlowGradient.addColorStop(0, `rgba(255, 100, 80, ${0.25 * pulseFactor})`);
		beamGlowGradient.addColorStop(1, `rgba(255, 60, 40, ${0.05 * pulseFactor})`);
		
		ctx.fillStyle = beamGlowGradient;
		ctx.beginPath();
		ctx.moveTo(beamStartX, beamY);
		ctx.lineTo(beamEndX, beamY - 5);
		ctx.lineTo(beamEndX, beamY + 5);
		ctx.closePath();
		ctx.fill();
		
		// Draw mid glow layer
		ctx.fillStyle = `rgba(255, 80, 60, ${0.35 * pulseFactor})`;
		ctx.beginPath();
		ctx.moveTo(beamStartX, beamY);
		ctx.lineTo(beamEndX - 10, beamY - 3.5);
		ctx.lineTo(beamEndX - 10, beamY + 3.5);
		ctx.closePath();
		ctx.fill();
		ctx.restore();

		// Draw core beam (bright red, expanding cone)
		ctx.fillStyle = '#ff4433';
		ctx.beginPath();
		ctx.moveTo(beamStartX, beamY);
		ctx.lineTo(beamEndX, beamY - 2);
		ctx.lineTo(beamEndX, beamY + 2);
		ctx.closePath();
		ctx.fill();

		// Draw bright inner core
		ctx.fillStyle = '#ffaa88';
		ctx.beginPath();
		ctx.moveTo(beamStartX, beamY);
		ctx.lineTo(beamEndX - 20, beamY - 1);
		ctx.lineTo(beamEndX - 20, beamY + 1);
		ctx.closePath();
		ctx.fill();

		// Draw fiber using new realistic visualization
		drawFiber();
	}

	function drawFiber() {
		const fiberStartX = 175;
		const fiberY = geometry.centerY - 42;
		const fiberH = 84;
		const fiberW = geometry.fiberTipX - fiberStartX;
		const fiberCenterY = geometry.centerY;
		const coreRadius = 8;
		const claddingRadius = 12;

		// Draw shadow before fiber
		drawSoftShadow(fiberStartX, fiberY, fiberW, fiberH, 3, 1, 2);

		// === DRAW FIBER BODY ===
		
		// Draw outer cladding cylinder with gradient
		const claddingGradient = ctx.createLinearGradient(fiberStartX, fiberCenterY - claddingRadius, fiberStartX + fiberW / 2, fiberCenterY + claddingRadius);
		claddingGradient.addColorStop(0, '#b5c5d5');
		claddingGradient.addColorStop(0.3, '#a0b0c0');
		claddingGradient.addColorStop(0.5, '#8fa0af');
		claddingGradient.addColorStop(0.7, '#7a8a9d');
		claddingGradient.addColorStop(1, '#5a7a8d');
		
		ctx.fillStyle = claddingGradient;
		ctx.fillRect(fiberStartX, fiberCenterY - claddingRadius, fiberW, claddingRadius * 2);

		// Draw fiber core cylinder with gradient
		const coreGradient = ctx.createLinearGradient(fiberStartX, fiberCenterY - coreRadius, fiberStartX + fiberW / 2, fiberCenterY + coreRadius);
		coreGradient.addColorStop(0, '#d8eef8');
		coreGradient.addColorStop(0.25, '#c4e0f0');
		coreGradient.addColorStop(0.5, '#a8d0e0');
		coreGradient.addColorStop(0.75, '#8fc8d8');
		coreGradient.addColorStop(1, '#70a8c0');
		
		ctx.fillStyle = coreGradient;
		ctx.fillRect(fiberStartX, fiberCenterY - coreRadius, fiberW, coreRadius * 2);

		// Draw cladding edge lines (top and bottom)
		ctx.strokeStyle = '#5f6f7f';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(fiberStartX, fiberCenterY - claddingRadius);
		ctx.lineTo(geometry.fiberTipX, fiberCenterY - claddingRadius);
		ctx.stroke();
		
		ctx.beginPath();
		ctx.moveTo(fiberStartX, fiberCenterY + claddingRadius);
		ctx.lineTo(geometry.fiberTipX, fiberCenterY + claddingRadius);
		ctx.stroke();

		// Draw reflection highlight on core (top)
		const highlightGradient = ctx.createLinearGradient(fiberStartX, fiberCenterY - coreRadius - 2, fiberStartX, fiberCenterY - coreRadius + 2);
		highlightGradient.addColorStop(0, 'rgba(220, 240, 255, 0.6)');
		highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
		highlightGradient.addColorStop(1, 'rgba(220, 240, 255, 0)');
		
		ctx.fillStyle = highlightGradient;
		ctx.fillRect(fiberStartX, fiberCenterY - coreRadius - 2, fiberW, 3);

		// === DRAW FIBER TIP ===
		
		// Glowing tip effect at fiber exit (creates emission point)
		ctx.save();
		ctx.filter = 'blur(3px)';
		const tipGlowGradient = ctx.createRadialGradient(geometry.fiberTipX, fiberCenterY, 0, geometry.fiberTipX, fiberCenterY, 8);
		tipGlowGradient.addColorStop(0, 'rgba(255, 120, 80, 0.35)');
		tipGlowGradient.addColorStop(1, 'rgba(255, 80, 60, 0.05)');
		ctx.fillStyle = tipGlowGradient;
		ctx.beginPath();
		ctx.arc(geometry.fiberTipX, fiberCenterY, 8, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// Fiber tip cap (small circle at fiber end)
		ctx.fillStyle = '#4a5a6a';
		ctx.beginPath();
		ctx.arc(geometry.fiberTipX, fiberCenterY, coreRadius, 0, Math.PI * 2);
		ctx.fill();

		// Bright tip highlight
		ctx.fillStyle = '#ffaa88';
		ctx.beginPath();
		ctx.arc(geometry.fiberTipX - 2, fiberCenterY - 2, 2, 0, Math.PI * 2);
		ctx.fill();

		// Label above fiber
		ctx.fillStyle = '#2f455b';
		ctx.font = '700 13px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText('Optical Fiber', fiberStartX + 23, fiberY - 12);
	}

	function drawAcceptanceRays() {
		// Draw faint rays showing the acceptance cone divergence
		// These rays demonstrate the acceptance angle θA based on D and L
		
		const screenX = getScreenX();
		const spotRadius = getSpotRadiusPx();
		const fiberTipX = geometry.fiberTipX;
		const fiberTipY = geometry.centerY;

		ctx.save();
		ctx.strokeStyle = 'rgba(255, 120, 90, 0.15)';
		ctx.lineWidth = 0.8;
		ctx.lineDash = [3, 3]; // dashed lines for acceptance rays
		
		// Draw acceptance rays from fiber tip through spot edges
		// Top acceptance ray
		ctx.beginPath();
		ctx.moveTo(fiberTipX, fiberTipY);
		ctx.lineTo(screenX, fiberTipY - spotRadius);
		ctx.stroke();
		
		// Bottom acceptance ray
		ctx.beginPath();
		ctx.moveTo(fiberTipX, fiberTipY);
		ctx.lineTo(screenX, fiberTipY + spotRadius);
		ctx.stroke();
		
		// Additional faint rays showing cone structure (3 on each side)
		for (let i = 1; i < 3; i++) {
		   const fraction = i / 3;
		   const rayY = fiberTipY + spotRadius * fraction;
		   const opacity = 0.10 * (1 - fraction);
		   
		   // Upper side rays
		   ctx.strokeStyle = `rgba(255, 120, 90, ${opacity})`;
		   ctx.beginPath();
		   ctx.moveTo(fiberTipX, fiberTipY);
		   ctx.lineTo(screenX, fiberTipY - rayY + fiberTipY);
		   ctx.stroke();
		   
		   // Lower side rays
		   ctx.beginPath();
		   ctx.moveTo(fiberTipX, fiberTipY);
		   ctx.lineTo(screenX, rayY);
		   ctx.stroke();
		}
		
		ctx.lineDash = [];
		ctx.restore();
	}

	function drawLightConeAndScreen() {
		const screenX = getScreenX();
		const spotRadius = getSpotRadiusPx();
		const topY = geometry.centerY - spotRadius;
		const bottomY = geometry.centerY + spotRadius;
		const spotDiameterCm = getSpotDiameterCm();
		const pulse = 0.6 + 0.4 * Math.sin(screenX * 0.04);
		
		// Draw acceptance rays to show cone structure
		drawAcceptanceRays();

		// === ENHANCED CONICAL LIGHT SPREAD ===
		
		// Draw multiple faint rays showing light propagation
		ctx.save();
		ctx.filter = 'blur(0.5px)';
		
		// Draw 7 rays from fiber tip to screen (at various angles)
		for (let i = -3; i <= 3; i++) {
			const rayFraction = i / 3; // -1 to 1
			const screenY = geometry.centerY + rayFraction * spotRadius;
			const distanceToScreen = screenX - geometry.fiberTipX;
			
			// Gradient opacity that fades with distance
			const maxOpacity = 0.20 - Math.abs(rayFraction) * 0.05;
			
			// Create gradient for each ray
			const rayGradient = ctx.createLinearGradient(
				geometry.fiberTipX, geometry.centerY,
				screenX, screenY
			);
			rayGradient.addColorStop(0, `rgba(255, 150, 100, ${maxOpacity})`);
			rayGradient.addColorStop(0.5, `rgba(255, 120, 80, ${maxOpacity * 0.6})`);
			rayGradient.addColorStop(1, `rgba(255, 100, 60, ${maxOpacity * 0.1})`);
			
			ctx.strokeStyle = rayGradient;
			ctx.lineWidth = 0.8;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(geometry.fiberTipX, geometry.centerY);
			ctx.lineTo(screenX, screenY);
			ctx.stroke();
		}
		
		ctx.restore();

		// Draw main gradient cone fill (bright near fiber, fade towards screen)
		ctx.save();
		ctx.filter = 'blur(2px)';

		const coneGradient = ctx.createLinearGradient(geometry.fiberTipX, geometry.centerY, screenX, geometry.centerY);
		coneGradient.addColorStop(0, 'rgba(255, 160, 120, 0.50)');     // Bright orange at fiber
		coneGradient.addColorStop(0.2, 'rgba(255, 140, 100, 0.45)');   
		coneGradient.addColorStop(0.4, 'rgba(255, 120, 85, 0.35)');    
		coneGradient.addColorStop(0.6, 'rgba(255, 100, 70, 0.20)');    // Fading orange
		coneGradient.addColorStop(0.8, 'rgba(255, 90, 65, 0.10)');     // Very faint
		coneGradient.addColorStop(1, 'rgba(255, 80, 60, 0.02)');       // Nearly invisible at screen

		ctx.fillStyle = coneGradient;
		ctx.beginPath();
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(screenX, topY);
		ctx.lineTo(screenX, bottomY);
		ctx.closePath();
		ctx.fill();

		ctx.restore();

		// Draw smooth edge lines with gradual fade
		ctx.strokeStyle = 'rgba(200, 70, 40, 0.80)';
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(screenX, topY);
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(screenX, bottomY);
		ctx.stroke();

		// Draw internal radiance rays with smooth fade
		ctx.save();
		ctx.filter = 'blur(0.8px)';
		ctx.strokeStyle = `rgba(255, 150, 110, ${0.50 * pulse})`;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		for (let i = -2; i <= 2; i += 1) {
			const t = i / 2;
			const rayY = geometry.centerY + t * spotRadius;
			ctx.moveTo(geometry.fiberTipX, geometry.centerY);
			ctx.lineTo(screenX, rayY);
		}
		ctx.stroke();
		ctx.restore();

		// === REALISTIC LAB SCREEN DESIGN ===
		
		// Screen panel dimensions - more prominent 3D appearance
		const screenPanelWidth = 54;
		const screenPanelHeight = 320;
		const screenPanelTop = 48;
		const screenPanelLeft = screenX - screenPanelWidth / 2;
		const screenPanelRight = screenX + screenPanelWidth / 2;
		const screenPanelBottom = screenPanelTop + screenPanelHeight;
		
		// Draw screen backing shadow for depth
		ctx.save();
		ctx.filter = 'blur(3px)';
		ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
		ctx.fillRect(screenPanelLeft + 2, screenPanelTop + 2, screenPanelWidth, screenPanelHeight);
		ctx.restore();
		
		// Draw main screen panel with enhanced 3D gradient
		const panelGradient = ctx.createLinearGradient(screenPanelLeft, screenPanelTop, screenPanelRight, screenPanelTop);
		panelGradient.addColorStop(0, '#c0d0e0');      // Left edge (darker shadow)
		panelGradient.addColorStop(0.15, '#d5e0ed');   
		panelGradient.addColorStop(0.5, '#e5f0f9');    // Center (lighter)
		panelGradient.addColorStop(0.85, '#d0e0f0');   
		panelGradient.addColorStop(1, '#b8c8d8');      // Right edge (darker shadow)
		ctx.fillStyle = panelGradient;
		ctx.fillRect(screenPanelLeft, screenPanelTop, screenPanelWidth, screenPanelHeight);
		
		// Draw screen frame border (darker edge)
		ctx.strokeStyle = '#5a6a7a';
		ctx.lineWidth = 2.5;
		ctx.strokeRect(screenPanelLeft, screenPanelTop, screenPanelWidth, screenPanelHeight);
		
		// Draw inner highlight on left edge (3D beveled effect)
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(screenPanelLeft + 1, screenPanelTop + 1);
		ctx.lineTo(screenPanelLeft + 1, screenPanelBottom - 1);
		ctx.stroke();
		
		// Draw inner shadow on right edge (beveled shadow)
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(screenPanelRight - 1, screenPanelTop + 1);
		ctx.lineTo(screenPanelRight - 1, screenPanelBottom - 1);
		ctx.stroke();
		
		// Draw screen surface with matte finish
		const surfaceGradient = ctx.createLinearGradient(screenPanelLeft + 2, screenPanelTop + 2, screenPanelRight - 2, screenPanelBottom - 2);
		surfaceGradient.addColorStop(0, 'rgba(240, 245, 250, 0.3)');
		surfaceGradient.addColorStop(0.5, 'rgba(245, 250, 255, 0.1)');
		surfaceGradient.addColorStop(1, 'rgba(235, 240, 248, 0.2)');
		ctx.fillStyle = surfaceGradient;
		ctx.fillRect(screenPanelLeft + 2, screenPanelTop + 2, screenPanelWidth - 4, screenPanelHeight - 4);
		
		// Draw screen label above
		ctx.fillStyle = '#2a3a4a';
		ctx.font = '700 13px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('Movable Screen', screenX, 50);
		
		// === SCREEN STAND/BASE ===
		const baseWidth = 48;
		const baseHeight = 8;
		const baseLeft = screenX - baseWidth / 2;
		const baseTop = screenPanelBottom + 1;
		
		// Draw stand shadow
		ctx.save();
		ctx.filter = 'blur(1.5px)';
		ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
		ctx.fillRect(baseLeft + 1, baseTop + 1, baseWidth, baseHeight);
		ctx.restore();
		
		// Draw stand base gradient
		const baseGradient = ctx.createLinearGradient(baseLeft, baseTop, baseLeft, baseTop + baseHeight);
		baseGradient.addColorStop(0, '#b8c8d8');
		baseGradient.addColorStop(0.5, '#a8b8c8');
		baseGradient.addColorStop(1, '#98a8b8');
		ctx.fillStyle = baseGradient;
		ctx.fillRect(baseLeft, baseTop, baseWidth, baseHeight);
		
		// Draw stand edge definition
		ctx.strokeStyle = '#7a8a9a';
		ctx.lineWidth = 1;
		ctx.strokeRect(baseLeft, baseTop, baseWidth, baseHeight);
		
		// Draw support legs
		const legWidth = 3;
		const legHeight = 6;
		const legColor = '#9ba8b8';
		
		// Left leg
		ctx.fillStyle = legColor;
		ctx.fillRect(baseLeft + 6, baseTop + baseHeight, legWidth, legHeight);
		
		// Right leg
		ctx.fillRect(baseLeft + baseWidth - 9, baseTop + baseHeight, legWidth, legHeight);

		// === ENHANCED SPOT ON SCREEN ===
		
		// Draw outer faint halo (very large, subtle)
		ctx.save();
		ctx.filter = 'blur(3px)';
		const haloGradient = ctx.createRadialGradient(
			screenX,
			geometry.centerY,
			spotRadius * 0.5,
			screenX,
			geometry.centerY,
			spotRadius * 2.2
		);
		haloGradient.addColorStop(0, 'rgba(255, 140, 100, 0.12)');
		haloGradient.addColorStop(0.4, 'rgba(255, 120, 85, 0.08)');
		haloGradient.addColorStop(1, 'rgba(255, 80, 60, 0.01)');
		ctx.fillStyle = haloGradient;
		ctx.beginPath();
		ctx.arc(screenX, geometry.centerY, spotRadius * 2.2, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// Draw main glow layer with blur (intermediate layer for depth)
		ctx.save();
		ctx.filter = 'blur(2.5px)';
		const mainGlowGradient = ctx.createRadialGradient(
			screenX,
			geometry.centerY,
			spotRadius * 0.10,
			screenX,
			geometry.centerY,
			spotRadius * 1.8
		);
		mainGlowGradient.addColorStop(0, 'rgba(255, 180, 140, 0.60)');
		mainGlowGradient.addColorStop(0.3, 'rgba(255, 150, 110, 0.50)');
		mainGlowGradient.addColorStop(0.6, 'rgba(255, 120, 80, 0.25)');
		mainGlowGradient.addColorStop(1, 'rgba(255, 80, 60, 0.05)');
		ctx.fillStyle = mainGlowGradient;
		ctx.beginPath();
		ctx.arc(screenX, geometry.centerY, spotRadius * 1.8, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// Draw main spot with strong radial gradient (bright center → fade edges)
		const spotGradient = ctx.createRadialGradient(
			screenX,
			geometry.centerY,
			spotRadius * 0.01,
			screenX,
			geometry.centerY,
			spotRadius
		);
		spotGradient.addColorStop(0, 'rgba(255, 200, 180, 0.85)');     // Intense white-red center
		spotGradient.addColorStop(0.20, 'rgba(255, 160, 120, 0.80)');  
		spotGradient.addColorStop(0.45, 'rgba(255, 130, 90, 0.72)');   
		spotGradient.addColorStop(0.70, 'rgba(255, 100, 70, 0.55)');   
		spotGradient.addColorStop(1, 'rgba(255, 70, 50, 0.25)');       // Faded edge

		ctx.fillStyle = spotGradient;
		ctx.beginPath();
		ctx.arc(screenX, geometry.centerY, spotRadius, 0, Math.PI * 2);
		ctx.fill();

		// Draw spot edge for definition
		ctx.strokeStyle = 'rgba(200, 60, 35, 0.70)';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(screenX, geometry.centerY, spotRadius, 0, Math.PI * 2);
		ctx.stroke();

		// Draw bright center core
		const coreRadius = Math.max(2, spotRadius * 0.35);
		
		// Core glow layer
		ctx.save();
		ctx.filter = 'blur(1.5px)';
		const coreGlowGradient = ctx.createRadialGradient(
			screenX,
			geometry.centerY,
			0,
			screenX,
			geometry.centerY,
			coreRadius * 1.3
		);
		coreGlowGradient.addColorStop(0, 'rgba(255, 250, 235, 0.55)');
		coreGlowGradient.addColorStop(1, 'rgba(255, 240, 220, 0.15)');
		ctx.fillStyle = coreGlowGradient;
		ctx.beginPath();
		ctx.arc(screenX, geometry.centerY, coreRadius * 1.3, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		
		// Core bright center
		const coreGradient = ctx.createRadialGradient(
			screenX,
			geometry.centerY,
			0,
			screenX,
			geometry.centerY,
			coreRadius
		);
		coreGradient.addColorStop(0, 'rgba(255, 250, 240, 0.85)');
		coreGradient.addColorStop(1, 'rgba(255, 245, 225, 0.70)');
		ctx.fillStyle = coreGradient;
		ctx.beginPath();
		ctx.arc(screenX, geometry.centerY, coreRadius, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#233f59';
		ctx.font = '600 12px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(`Selected L = ${state.Lcm.toFixed(2)} cm`, screenX + 14, 84);

		ctx.strokeStyle = '#c28a10';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(screenX + 30, topY);
		ctx.lineTo(screenX + 30, bottomY);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(screenX + 22, topY);
		ctx.lineTo(screenX + 38, topY);
		ctx.moveTo(screenX + 22, bottomY);
		ctx.lineTo(screenX + 38, bottomY);
		ctx.stroke();

		// === DIAMETER MEASUREMENT INDICATOR ===
		
		// Draw horizontal diameter line at top of spot
		const diameterLineY = topY - 8;
		ctx.strokeStyle = 'rgba(200, 100, 50, 0.8)';
		ctx.lineWidth = 1.8;
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(screenX - spotRadius, diameterLineY);
		ctx.lineTo(screenX + spotRadius, diameterLineY);
		ctx.stroke();
		
		// Draw tick marks at ends
		const tickLength = 6;
		ctx.lineWidth = 1.8;
		ctx.beginPath();
		// Left tick
		ctx.moveTo(screenX - spotRadius, diameterLineY - tickLength / 2);
		ctx.lineTo(screenX - spotRadius, diameterLineY + tickLength / 2);
		// Right tick
		ctx.moveTo(screenX + spotRadius, diameterLineY - tickLength / 2);
		ctx.lineTo(screenX + spotRadius, diameterLineY + tickLength / 2);
		ctx.stroke();
		
		// Draw diameter label
		ctx.fillStyle = '#c28a10';
		ctx.font = '500 11px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(`D = ${spotDiameterCm.toFixed(2)} cm`, screenX, diameterLineY - 12);
	}

	function render() {
		measureDistanceL();
		updateDistanceReadout();
		updateDiameterReadout();
		updateSelectedLHighlights();
		updateStepButtonState();
		drawBackground();
		drawAxis();
		drawLaserAndFiber();
		drawLightConeAndScreen();
		drawMeasurementDisplay();
	}

	function updateDistanceFromControl(newValue) {
		if (isExploreMode()) {
			const valueCm = normalizeLForMode(newValue);
			state.Lcm = valueCm;
			state.targetScreenX = clamp(
				getScreenXForL(valueCm),
				getScreenMinX(),
				getScreenMaxX()
			);
			animateScreenTowardTarget();
			return;
		}

		const valueCm = normalizeLForMode(newValue);
		state.Lcm = valueCm;
		state.targetScreenX = clamp(
			getScreenXForL(valueCm),
			getScreenMinX(),
			getScreenMaxX()
		);
		animateScreenTowardTarget();
	}

	function updateDistanceFromScreenPosition(screenX) {
		stopScreenAnimation();
		const clampedX = clamp(screenX, getScreenMinX(), getScreenMaxX());
		const measuredL = pixelsToCm(clampedX - geometry.fiberTipX);

		if (isExploreMode()) {
			const freeL = normalizeLForMode(measuredL);
			state.Lcm = freeL;
			// Smooth interpolation during drag for responsive feel
			const targetX = getScreenXForL(freeL);
			state.screenX = state.screenX + (targetX - state.screenX) * 0.5;
			render();
			return;
		}

		const snappedL = normalizeLForMode(measuredL);
		state.Lcm = snappedL;
		// Smooth interpolation toward snapped position
		const targetX = getScreenXForL(snappedL);
		state.screenX = state.screenX + (targetX - state.screenX) * 0.6;
		render();
	}

	function resetSimulationToLabMode() {
		state.lastCapturedL = null;
		state.Lcm = allowedLValues[0];
		setCurrentMode(NA_MODES.LAB);

		setCaptureStatus('');
	}

	function getPointerX(event) {
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		return (event.clientX - rect.left) * scaleX;
	}

	function onPointerDown(event) {
		const pointerX = getPointerX(event);

		if (Math.abs(pointerX - state.screenX) <= 14) {
			stopScreenAnimation();
			state.screenDragging = true;
		}
	}

	function onPointerMove(event) {
		if (state.screenDragging) {
			updateDistanceFromScreenPosition(getPointerX(event));
			return;
		}
	}

	function onPointerUp() {
		if (!state.screenDragging) {
			return;
		}

		state.screenDragging = false;
		
		// Smoothly animate to the final snapped position
		const measuredL = pixelsToCm(state.screenX - geometry.fiberTipX);
		const finalL = normalizeLForMode(measuredL);
		state.Lcm = finalL;
		state.targetScreenX = getScreenXForL(finalL);
		
		// Only animate if there's a noticeable difference
		if (Math.abs(state.screenX - state.targetScreenX) > 0.5) {
			animateScreenTowardTarget();
		} else {
			render();
		}
	}

	distanceSlider.addEventListener('input', (event) => {
		const value = parseFloat(event.target.value);
		if (!Number.isFinite(value)) {
			return;
		}
		updateDistanceFromControl(value);
	});

	if (moveNearBtn) {
		moveNearBtn.addEventListener('click', () => {
			if (isExploreMode()) {
				updateDistanceFromControl(state.Lcm - 0.05);
				return;
			}

			const currentIndex = getCurrentLIndex();
			const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
			updateDistanceFromControl(allowedLValues[nextIndex]);
		});
	}

	if (moveFarBtn) {
		moveFarBtn.addEventListener('click', () => {
			if (isExploreMode()) {
				updateDistanceFromControl(state.Lcm + 0.05);
				return;
			}

			const currentIndex = getCurrentLIndex();
			const nextIndex = currentIndex >= allowedLValues.length - 1 ? allowedLValues.length - 1 : currentIndex + 1;
			updateDistanceFromControl(allowedLValues[nextIndex]);
		});
	}

	if (captureReadingBtn) {
		captureReadingBtn.addEventListener('click', captureCurrentReading);
	}

	document.addEventListener('na:mode-changed', () => {
		syncModeDependentState();
	});
	document.addEventListener('na:explore-l-selected', (event) => {
		const detail = event.detail || {};
		const value = Number(detail.L);
		moveToExploreLValue(value);
	});
	document.addEventListener('na:experiment-reset', resetSimulationToLabMode);

	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerup', onPointerUp);
	canvas.addEventListener('pointerleave', onPointerUp);

	const initialCm = snapToNearestL(parseFloat(distanceSlider.value) || allowedLValues[0]);
	state.Lcm = initialCm;
	setScreenXImmediate(getScreenXForL(initialCm));
	setCaptureStatus('Capture stores current measured L and D into the next empty row.');
	syncModeDependentState();
	render();
});
