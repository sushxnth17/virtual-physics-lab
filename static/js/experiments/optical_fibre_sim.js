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
	const liveExploreTheta = document.getElementById('naLiveExploreTheta');
	const liveExploreNA = document.getElementById('naLiveExploreNA');
	const exploreDControlWrap = document.getElementById('naExploreDControlWrap');

	if (!canvas || !distanceSlider) {
		return;
	}

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return;
	}

	const allowedLValues = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
	const freeModeBounds = { min: 0.25, max: 5.0, step: 0.01 };
	// Acceptance angle is fixed for this setup and defined in radians.
	const ACCEPTANCE_ANGLE_RAD = 0.20071286398;
	const PIXELS_PER_CM = 100;
	const axisConfig = {
		maxCm: 5,
		majorTickCm: 0.5,
		minorTickCm: 0.1
	};
	const NA_MODES = Object.freeze({
		LAB: 'lab',
		EXPLORE: 'explore'
	});

	const state = {
		Lcm: 0,
		screenX: 0,
		targetScreenX: 0,
		pixelsPerCm: PIXELS_PER_CM,
		screenDragging: false,
		animationFrameId: null,
		lastCapturedL: null,
		// Animation state for smooth transitions
		animationStartX: 0,
		animationStartTime: 0,
		animationDuration: 0,
		animationEasing: null,
		infoPanelDisplayL: 0,
		infoPanelDisplayD: 0,
		infoPanelLastTargetL: null,
		infoPanelLastTargetD: null,
		infoPanelPulseUntil: 0,
		infoPanelAnimationFrameId: null,
		visualFxFrameId: null,
		visualFxLastRenderMs: 0
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
			if (exploreDControlWrap) {
				exploreDControlWrap.hidden = true;
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
		if (exploreDControlWrap) {
			exploreDControlWrap.hidden = true;
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

	function getCalculatedSpotDiameterCm() {
		return Math.max(0, 2 * state.Lcm * Math.tan(ACCEPTANCE_ANGLE_RAD));
	}

	function getSpotDiameterCm() {
		return getCalculatedSpotDiameterCm();
	}

	function getSpotRadiusPx() {
		return cmToPixels(getSpotDiameterCm() / 2);
	}

	function getCurrentThetaDeg() {
		const safeL = Math.max(state.Lcm, 0.0001);
		return (Math.atan(getSpotDiameterCm() / (2 * safeL)) * 180) / Math.PI;
	}

	function getCurrentNAValue() {
		return Math.sin((getCurrentThetaDeg() * Math.PI) / 180);
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
		if (liveExploreTheta) {
			liveExploreTheta.textContent = getCurrentThetaDeg().toFixed(2);
		}
		if (liveExploreNA) {
			liveExploreNA.textContent = getCurrentNAValue().toFixed(4);
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
		const ambient = ctx.createLinearGradient(0, 0, 0, canvas.height);
		ambient.addColorStop(0, '#ffffff');
		ambient.addColorStop(1, '#edf1f5');
		ctx.fillStyle = ambient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		const boardX = 14;
		const boardY = 10;
		const boardW = canvas.width - 28;
		const boardH = canvas.height - 80;

		ctx.save();
		ctx.shadowColor = 'rgba(32, 58, 84, 0.2)';
		ctx.shadowBlur = 16;
		ctx.shadowOffsetY = 4;
		drawRoundRect(boardX, boardY, boardW, boardH, 16);
		ctx.fillStyle = '#f2f4f8';
		ctx.fill();
		ctx.restore();

		const panelGradient = ctx.createLinearGradient(boardX, boardY, boardX, boardY + boardH);
		panelGradient.addColorStop(0, '#f5f7fb');
		panelGradient.addColorStop(0.6, '#edf1f6');
		panelGradient.addColorStop(1, '#e5ebf3');
		drawRoundRect(boardX, boardY, boardW, boardH, 16);
		ctx.fillStyle = panelGradient;
		ctx.fill();

		ctx.strokeStyle = '#c7d2de';
		ctx.lineWidth = 1.6;
		drawRoundRect(boardX, boardY, boardW, boardH, 16);
		ctx.stroke();

		ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
		ctx.lineWidth = 1;
		drawRoundRect(boardX + 1, boardY + 1, boardW - 2, boardH - 2, 14);
		ctx.stroke();

		ctx.strokeStyle = 'rgba(151, 166, 181, 0.4)';
		ctx.lineWidth = 1;
		drawRoundRect(boardX + 3, boardY + 3, boardW - 6, boardH - 6, 12);
		ctx.stroke();
	}

	// Helper function to draw soft shadow
	function drawSoftShadow(x, y, width, height, shadowBlur = 4, offsetX = 1, offsetY = 2) {
		ctx.save();
		ctx.filter = `blur(${shadowBlur}px)`;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
		ctx.fillRect(x + offsetX, y + offsetY, width, height);
		ctx.restore();
	}

	function requestInfoPanelAnimation() {
		if (state.infoPanelAnimationFrameId !== null || state.animationFrameId !== null) {
			return;
		}

		state.infoPanelAnimationFrameId = requestAnimationFrame(() => {
			state.infoPanelAnimationFrameId = null;
			render();
			if (Date.now() < state.infoPanelPulseUntil - 12) {
				requestInfoPanelAnimation();
			}
		});
	}

	function startVisualFxLoop() {
		if (state.visualFxFrameId !== null) {
			return;
		}

		const step = (timestamp) => {
			state.visualFxFrameId = requestAnimationFrame(step);

			if (state.screenDragging || state.animationFrameId !== null) {
				return;
			}

			if (timestamp - state.visualFxLastRenderMs < 70) {
				return;
			}

			state.visualFxLastRenderMs = timestamp;
			render();
		};

		state.visualFxFrameId = requestAnimationFrame(step);
	}

	function drawMeasurementDisplay() {
		const displayX = canvas.width - 160;
		const displayY = 42;
		const boxWidth = 128;
		const boxHeight = 80;
		const cornerRadius = 8;
		const targetL = state.Lcm;
		const targetD = getSpotDiameterCm();

		if (state.infoPanelLastTargetL === null || state.infoPanelLastTargetD === null) {
			state.infoPanelDisplayL = targetL;
			state.infoPanelDisplayD = targetD;
			state.infoPanelLastTargetL = targetL;
			state.infoPanelLastTargetD = targetD;
		}

		const lChanged = Math.abs(targetL - state.infoPanelLastTargetL) > 0.0005;
		const dChanged = Math.abs(targetD - state.infoPanelLastTargetD) > 0.0005;
		if (lChanged || dChanged) {
			state.infoPanelPulseUntil = Date.now() + 260;
			state.infoPanelLastTargetL = targetL;
			state.infoPanelLastTargetD = targetD;
			requestInfoPanelAnimation();
		}

		state.infoPanelDisplayL += (targetL - state.infoPanelDisplayL) * 0.26;
		state.infoPanelDisplayD += (targetD - state.infoPanelDisplayD) * 0.26;

		const pulseT = clamp((state.infoPanelPulseUntil - Date.now()) / 260, 0, 1);
		const valueAlpha = 1 - 0.42 * pulseT;
		const accentGlow = pulseT * 0.35;

		ctx.save();
		ctx.shadowColor = 'rgba(32, 42, 58, 0.2)';
		ctx.shadowBlur = 10;
		ctx.shadowOffsetY = 2;
		drawRoundRect(displayX, displayY, boxWidth, boxHeight, cornerRadius);
		ctx.fillStyle = '#f8fbff';
		ctx.fill();
		ctx.restore();

		const panelFill = ctx.createLinearGradient(displayX, displayY, displayX, displayY + boxHeight);
		panelFill.addColorStop(0, 'rgba(250, 252, 255, 0.96)');
		panelFill.addColorStop(1, 'rgba(237, 244, 251, 0.98)');
		drawRoundRect(displayX, displayY, boxWidth, boxHeight, cornerRadius);
		ctx.fillStyle = panelFill;
		ctx.fill();

		ctx.strokeStyle = '#b9c8d8';
		ctx.lineWidth = 1;
		drawRoundRect(displayX, displayY, boxWidth, boxHeight, cornerRadius);
		ctx.stroke();

		if (pulseT > 0) {
			ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + accentGlow * 0.35})`;
			drawRoundRect(displayX + 2, displayY + 2, boxWidth - 4, boxHeight - 4, cornerRadius - 2);
			ctx.fill();
		}

		ctx.textAlign = 'left';
		ctx.fillStyle = '#4d6077';
		ctx.font = '600 11px "IBM Plex Sans", sans-serif';
		ctx.fillText('L (cm):', displayX + 14, displayY + 29);
		ctx.fillText('D (cm):', displayX + 14, displayY + 58);

		ctx.font = '700 16px "IBM Plex Sans", sans-serif';
		ctx.fillStyle = `rgba(31, 92, 148, ${valueAlpha})`;
		ctx.fillText(state.infoPanelDisplayL.toFixed(2), displayX + 70, displayY + 29);
		ctx.fillStyle = `rgba(201, 119, 23, ${valueAlpha})`;
		ctx.fillText(state.infoPanelDisplayD.toFixed(2), displayX + 70, displayY + 58);
	}

	function drawAxis() {
		const y = geometry.centerY + 138;
		const x0 = geometry.axisStartX;
		const x1 = x0 + cmToPixels(axisConfig.maxCm);

		ctx.strokeStyle = '#1f3f62';
		ctx.lineWidth = 2.2;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(x0, y);
		ctx.lineTo(x1, y);
		ctx.stroke();

		ctx.strokeStyle = 'rgba(31, 63, 98, 0.2)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(x0, y + 1);
		ctx.lineTo(x1, y + 1);
		ctx.stroke();

		const totalMinorSteps = Math.round(axisConfig.maxCm / axisConfig.minorTickCm);
		const majorStepSize = Math.round(axisConfig.majorTickCm / axisConfig.minorTickCm);

		for (let step = 0; step <= totalMinorSteps; step += 1) {
			const LValue = step * axisConfig.minorTickCm;
			const tx = x0 + cmToPixels(LValue);
			const isMajor = step % majorStepSize === 0;
			const isSelectedMajor = isMajor && Math.abs(LValue - state.Lcm) < 0.26;

			if (isMajor) {
				const tickH = isSelectedMajor ? 13 : 10;
				ctx.strokeStyle = isSelectedMajor ? '#0f4c81' : '#1f3f62';
				ctx.lineWidth = isSelectedMajor ? 2 : 1.55;
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(tx, y - tickH);
				ctx.lineTo(tx, y);
				ctx.stroke();

				ctx.fillStyle = isSelectedMajor ? '#0f4c81' : '#1f3f62';
				ctx.font = '700 11px "IBM Plex Sans", sans-serif';
				ctx.textAlign = 'center';
				ctx.lineWidth = 1;

				let label = LValue.toFixed(2);
				if (LValue % 1 === 0) {
					label = LValue.toFixed(0);
				} else if (LValue % 0.5 === 0) {
					label = LValue.toFixed(1);
				}
				ctx.fillText(label, tx, y + 22);
			} else {
				const tickH = 4;
				ctx.strokeStyle = '#2f567f';
				ctx.lineWidth = 0.95;
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(tx, y - tickH);
				ctx.lineTo(tx, y);
				ctx.stroke();
			}
		}

		ctx.fillStyle = '#1f3f62';
		ctx.font = '600 11px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText('Distance scale from fiber tip, L (cm)', x0, y + 38);
	}

	function drawLaserAndFiber() {
		const laserX = 32;
		const laserY = geometry.centerY - 30;
		const laserW = 126;
		const laserH = 60;
		const nozzleY = geometry.centerY;
		const nozzleBaseX = laserX + laserW;
		const nozzleW = 24;
		const nozzleH = 20;
		const nozzleTipX = nozzleBaseX + nozzleW;
		const fiberStartX = nozzleTipX + 3;
		const currentDcm = Math.max(getSpotDiameterCm(), 0.001);
		const currentLcm = Math.max(state.Lcm, 0.01);
		const beamSlope = (currentDcm / 2) / currentLcm;
		const guidedHalfWidth = clamp(cmToPixels(beamSlope * 0.07), 1.15, 2.5);
		const beamFlicker = 0.9 + 0.1 * Math.sin(Date.now() * 0.014);

		ctx.save();
		ctx.fillStyle = 'rgba(30, 42, 56, 0.2)';
		ctx.beginPath();
		ctx.ellipse(laserX + laserW * 0.52, laserY + laserH + 8, laserW * 0.55, 8, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		const bodyGradient = ctx.createLinearGradient(laserX, laserY, laserX, laserY + laserH);
		bodyGradient.addColorStop(0, '#f2efe9');
		bodyGradient.addColorStop(0.55, '#dbd6ce');
		bodyGradient.addColorStop(1, '#c3bdb4');
		drawRoundRect(laserX, laserY, laserW, laserH, 4);
		ctx.fillStyle = bodyGradient;
		ctx.fill();
		ctx.strokeStyle = '#989289';
		ctx.lineWidth = 1.4;
		drawRoundRect(laserX, laserY, laserW, laserH, 4);
		ctx.stroke();

		ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
		drawRoundRect(laserX + 2, laserY + 2, laserW - 4, 10, 3);
		ctx.fill();

		ctx.save();
		ctx.shadowColor = 'rgba(212, 24, 36, 0.38)';
		ctx.shadowBlur = 6;
		ctx.fillStyle = '#d8212d';
		drawRoundRect(laserX + 10, laserY + 18, 60, 21, 2);
		ctx.fill();
		ctx.restore();
		ctx.fillStyle = '#ffffff';
		ctx.font = '700 10px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('LASER', laserX + 40, laserY + 32);

		const warnCx = laserX + 95;
		const warnCy = laserY + 30;
		ctx.fillStyle = '#f4d54b';
		ctx.beginPath();
		ctx.moveTo(warnCx, warnCy - 11);
		ctx.lineTo(warnCx + 11, warnCy + 10);
		ctx.lineTo(warnCx - 11, warnCy + 10);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = '#5b4e2b';
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.fillStyle = '#1d1b17';
		ctx.font = '700 10px "IBM Plex Sans", sans-serif';
		ctx.fillText('!', warnCx, warnCy + 5);

		const nozzleGradient = ctx.createLinearGradient(nozzleBaseX, nozzleY - nozzleH / 2, nozzleTipX, nozzleY + nozzleH / 2);
		nozzleGradient.addColorStop(0, '#647280');
		nozzleGradient.addColorStop(0.5, '#a4b1bd');
		nozzleGradient.addColorStop(1, '#56626f');
		drawRoundRect(nozzleBaseX, nozzleY - nozzleH / 2, nozzleW, nozzleH, 8);
		ctx.fillStyle = nozzleGradient;
		ctx.fill();
		ctx.strokeStyle = '#46505a';
		ctx.lineWidth = 1;
		drawRoundRect(nozzleBaseX, nozzleY - nozzleH / 2, nozzleW, nozzleH, 8);
		ctx.stroke();

		ctx.fillStyle = 'rgba(205, 220, 232, 0.7)';
		drawRoundRect(nozzleBaseX + 2, nozzleY - nozzleH / 2 + 2, nozzleW - 7, 4, 2);
		ctx.fill();

		ctx.fillStyle = '#42505d';
		ctx.beginPath();
		ctx.ellipse(nozzleTipX + 2, nozzleY, 5.5, 7, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#2f3943';
		ctx.stroke();

		ctx.fillStyle = '#8395a7';
		drawRoundRect(nozzleTipX + 1, nozzleY - 6, 4, 12, 2);
		ctx.fill();

		drawFiber(fiberStartX);

		// Guided beam inside fiber: thin bright red core with a soft halo.
		ctx.save();
		ctx.lineCap = 'round';
		ctx.strokeStyle = `rgba(255, 102, 86, ${0.32 * beamFlicker})`;
		ctx.lineWidth = guidedHalfWidth * 2.8;
		ctx.beginPath();
		ctx.moveTo(fiberStartX + 1, nozzleY);
		ctx.lineTo(geometry.fiberTipX - 2, nozzleY);
		ctx.stroke();

		const guidedGradient = ctx.createLinearGradient(fiberStartX, nozzleY, geometry.fiberTipX, nozzleY);
		guidedGradient.addColorStop(0, `rgba(255, 78, 62, ${0.9 * beamFlicker})`);
		guidedGradient.addColorStop(0.55, `rgba(255, 98, 82, ${0.82 * beamFlicker})`);
		guidedGradient.addColorStop(1, `rgba(255, 136, 116, ${0.45 * beamFlicker})`);
		ctx.strokeStyle = guidedGradient;
		ctx.lineWidth = guidedHalfWidth * 1.35;
		ctx.beginPath();
		ctx.moveTo(fiberStartX + 1, nozzleY);
		ctx.lineTo(geometry.fiberTipX - 1, nozzleY);
		ctx.stroke();
		ctx.restore();

		const beamGradient = ctx.createLinearGradient(nozzleTipX + 3, nozzleY, geometry.fiberTipX, nozzleY);
		beamGradient.addColorStop(0, `rgba(255, 74, 56, ${0.8 * beamFlicker})`);
		beamGradient.addColorStop(0.6, `rgba(255, 108, 88, ${0.42 * beamFlicker})`);
		beamGradient.addColorStop(1, `rgba(255, 136, 112, ${0.08 * beamFlicker})`);
		ctx.fillStyle = beamGradient;
		ctx.beginPath();
		ctx.moveTo(nozzleTipX + 3, nozzleY);
		ctx.lineTo(geometry.fiberTipX - 1, nozzleY - 3.2);
		ctx.lineTo(geometry.fiberTipX - 1, nozzleY + 3.2);
		ctx.closePath();
		ctx.fill();

		// Fiber exit emission node with compact bright glow.
		const nodeRadius = clamp(guidedHalfWidth * 1.55, 2.0, 3.4);
		ctx.save();
		ctx.filter = 'blur(2px)';
		const nodeHalo = ctx.createRadialGradient(
			geometry.fiberTipX,
			nozzleY,
			nodeRadius * 0.4,
			geometry.fiberTipX,
			nozzleY,
			nodeRadius * 3.0
		);
		nodeHalo.addColorStop(0, `rgba(255, 182, 156, ${0.52 * beamFlicker})`);
		nodeHalo.addColorStop(0.6, `rgba(255, 123, 96, ${0.22 * beamFlicker})`);
		nodeHalo.addColorStop(1, 'rgba(255, 90, 72, 0.01)');
		ctx.fillStyle = nodeHalo;
		ctx.beginPath();
		ctx.arc(geometry.fiberTipX, nozzleY, nodeRadius * 3.0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		const nodeCore = ctx.createRadialGradient(
			geometry.fiberTipX,
			nozzleY,
			0,
			geometry.fiberTipX,
			nozzleY,
			nodeRadius
		);
		nodeCore.addColorStop(0, `rgba(255, 246, 236, ${0.95 * beamFlicker})`);
		nodeCore.addColorStop(0.55, `rgba(255, 145, 118, ${0.84 * beamFlicker})`);
		nodeCore.addColorStop(1, `rgba(255, 108, 82, ${0.36 * beamFlicker})`);
		ctx.fillStyle = nodeCore;
		ctx.beginPath();
		ctx.arc(geometry.fiberTipX, nozzleY, nodeRadius, 0, Math.PI * 2);
		ctx.fill();
	}

	function drawFiber(fiberStartX = 176) {
		const fiberW = geometry.fiberTipX - fiberStartX;
		const fiberCenterY = geometry.centerY;
		const claddingRadius = 8.4;
		const coreRadius = 3.8;

		if (fiberW < 12) {
			return;
		}

		const fiberTop = fiberCenterY - claddingRadius;
		const fiberHeight = claddingRadius * 2;
		drawSoftShadow(fiberStartX, fiberTop, fiberW, fiberHeight, 2, 1, 1);

		const outerGradient = ctx.createLinearGradient(fiberStartX, fiberTop, fiberStartX, fiberTop + fiberHeight);
		outerGradient.addColorStop(0, 'rgba(236, 247, 255, 0.94)');
		outerGradient.addColorStop(0.45, 'rgba(174, 212, 238, 0.86)');
		outerGradient.addColorStop(1, 'rgba(92, 155, 198, 0.92)');
		drawRoundRect(fiberStartX, fiberTop, fiberW, fiberHeight, claddingRadius);
		ctx.fillStyle = outerGradient;
		ctx.fill();

		const coreTop = fiberCenterY - coreRadius;
		const coreHeight = coreRadius * 2;
		const coreGradient = ctx.createLinearGradient(fiberStartX, coreTop, fiberStartX, coreTop + coreHeight);
		coreGradient.addColorStop(0, 'rgba(247, 253, 255, 0.96)');
		coreGradient.addColorStop(0.55, 'rgba(218, 240, 255, 0.9)');
		coreGradient.addColorStop(1, 'rgba(159, 209, 238, 0.9)');
		drawRoundRect(fiberStartX, coreTop, fiberW, coreHeight, coreRadius);
		ctx.fillStyle = coreGradient;
		ctx.fill();

		ctx.strokeStyle = 'rgba(62, 111, 155, 0.94)';
		ctx.lineWidth = 1.25;
		drawRoundRect(fiberStartX, fiberTop, fiberW, fiberHeight, claddingRadius);
		ctx.stroke();

		ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(fiberStartX + 2, fiberCenterY - 4.8);
		ctx.lineTo(geometry.fiberTipX - 2, fiberCenterY - 4.8);
		ctx.stroke();

		ctx.save();
		ctx.shadowColor = 'rgba(255, 133, 103, 0.52)';
		ctx.shadowBlur = 10;
		ctx.fillStyle = '#ffac91';
		ctx.beginPath();
		ctx.arc(geometry.fiberTipX, fiberCenterY, 2.8, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		ctx.fillStyle = 'rgba(81, 103, 126, 0.5)';
		ctx.beginPath();
		ctx.ellipse(fiberStartX - 1.5, fiberCenterY, 2.2, claddingRadius - 0.7, 0, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#24415b';
		ctx.font = '600 12px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText('Optical Fiber', fiberStartX + 16, fiberCenterY - 20);
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
		const rodX = getScreenX();
		const scaleY = geometry.centerY + 138;
		const spotDiameterCm = Math.max(getSpotDiameterCm(), 0.001);
		const safeLcm = Math.max(state.Lcm, 0.01);
		const beamSlope = (spotDiameterCm / 2) / safeLcm;
		const screenRadius = cmToPixels(spotDiameterCm / 2);
		const screenTopY = geometry.centerY - screenRadius;
		const screenBottomY = geometry.centerY + screenRadius;
		const beamFlicker = 0.93 + 0.07 * Math.sin(Date.now() * 0.012 + 1.4);

		drawAcceptanceRays();

		// Draw movable rod first so cone remains visible over it and source never feels blocked.
		const rodTop = 86;
		const rodBottom = scaleY + 1;
		const rodWidth = 5;
		const rodLeft = rodX - rodWidth / 2;
		const rodHeight = rodBottom - rodTop;

		ctx.save();
		ctx.globalAlpha = 0.82;
		ctx.shadowColor = 'rgba(24, 46, 72, 0.18)';
		ctx.shadowBlur = 3;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;
		const rodGradient = ctx.createLinearGradient(rodLeft, rodTop, rodLeft + rodWidth, rodTop);
		rodGradient.addColorStop(0, '#193750');
		rodGradient.addColorStop(0.5, '#2a5476');
		rodGradient.addColorStop(1, '#163047');
		drawRoundRect(rodLeft, rodTop, rodWidth, rodHeight, 3);
		ctx.fillStyle = rodGradient;
		ctx.fill();
		ctx.restore();

		ctx.strokeStyle = 'rgba(14, 36, 58, 0.62)';
		ctx.lineWidth = 0.8;
		drawRoundRect(rodLeft, rodTop, rodWidth, rodHeight, 3);
		ctx.stroke();

		ctx.strokeStyle = 'rgba(188, 223, 255, 0.52)';
		ctx.lineWidth = 0.85;
		ctx.beginPath();
		ctx.moveTo(rodLeft + 1.2, rodTop + 2);
		ctx.lineTo(rodLeft + 1.2, rodBottom - 2);
		ctx.stroke();

		ctx.save();
		ctx.filter = 'blur(2.6px)';
		const coneOuterGradient = ctx.createLinearGradient(geometry.fiberTipX, geometry.centerY, rodX, geometry.centerY);
		coneOuterGradient.addColorStop(0, `rgba(255, 96, 74, ${0.4 * beamFlicker})`);
		coneOuterGradient.addColorStop(0.45, `rgba(255, 126, 96, ${0.24 * beamFlicker})`);
		coneOuterGradient.addColorStop(0.8, `rgba(255, 169, 131, ${0.11 * beamFlicker})`);
		coneOuterGradient.addColorStop(1, 'rgba(255, 206, 170, 0.01)');
		ctx.fillStyle = coneOuterGradient;
		ctx.beginPath();
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(rodX, screenTopY);
		ctx.lineTo(rodX, screenBottomY);
		ctx.closePath();
		ctx.fill();
		ctx.restore();

		const coneInnerGradient = ctx.createLinearGradient(geometry.fiberTipX, geometry.centerY, rodX, geometry.centerY);
		coneInnerGradient.addColorStop(0, `rgba(255, 74, 58, ${0.5 * beamFlicker})`);
		coneInnerGradient.addColorStop(0.45, `rgba(255, 108, 82, ${0.3 * beamFlicker})`);
		coneInnerGradient.addColorStop(1, 'rgba(255, 166, 124, 0.03)');
		ctx.fillStyle = coneInnerGradient;
		ctx.beginPath();
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(rodX, screenTopY);
		ctx.lineTo(rodX, screenBottomY);
		ctx.closePath();
		ctx.fill();

		ctx.strokeStyle = `rgba(230, 114, 86, ${0.36 * beamFlicker})`;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(rodX, screenTopY);
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(rodX, screenBottomY);
		ctx.stroke();

		ctx.fillStyle = '#24435f';
		ctx.font = '600 11px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'center';
		const movableLabelX = clamp(rodX + 8, geometry.fiberTipX + 8, canvas.width - 110);
		ctx.fillText('Movable Screen', movableLabelX, 52);
		ctx.fillStyle = '#2b3f53';
		const selectedLabelX = clamp(rodX + 44, geometry.fiberTipX + 88, canvas.width - 90);
		ctx.fillText(`Selected L = ${state.Lcm.toFixed(2)} cm`, selectedLabelX, 68);

		// D-based spot at movable screen position (diameter equals computed D).
		const movableSpotRadius = Math.max(2, screenRadius);
		ctx.save();
		ctx.filter = 'blur(1.8px)';
		const movableSpotHalo = ctx.createRadialGradient(rodX, geometry.centerY, 1, rodX, geometry.centerY, movableSpotRadius * 1.9);
		movableSpotHalo.addColorStop(0, `rgba(255, 212, 186, ${0.4 * beamFlicker})`);
		movableSpotHalo.addColorStop(0.55, `rgba(255, 150, 116, ${0.2 * beamFlicker})`);
		movableSpotHalo.addColorStop(1, 'rgba(255, 120, 90, 0.02)');
		ctx.fillStyle = movableSpotHalo;
		ctx.beginPath();
		ctx.arc(rodX, geometry.centerY, movableSpotRadius * 1.9, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		const movableSpotGradient = ctx.createRadialGradient(rodX, geometry.centerY, 0, rodX, geometry.centerY, movableSpotRadius);
		movableSpotGradient.addColorStop(0, 'rgba(255, 249, 240, 0.95)');
		movableSpotGradient.addColorStop(0.35, `rgba(255, 176, 139, ${0.88 * beamFlicker})`);
		movableSpotGradient.addColorStop(1, `rgba(255, 122, 92, ${0.28 * beamFlicker})`);
		ctx.fillStyle = movableSpotGradient;
		ctx.beginPath();
		ctx.arc(rodX, geometry.centerY, movableSpotRadius, 0, Math.PI * 2);
		ctx.fill();

		// Dynamic diameter indicator on the movable screen.
		const exitBracketY = geometry.centerY - movableSpotRadius - 10;
		const dynamicBracketW = Math.max(24, movableSpotRadius * 2);
		const bracketStartX = rodX - dynamicBracketW / 2;
		const bracketEndX = rodX + dynamicBracketW / 2;
		const capH = 3.8;

		ctx.strokeStyle = '#cc8a2e';
		ctx.lineWidth = 1.2;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(bracketStartX, exitBracketY);
		ctx.lineTo(bracketEndX, exitBracketY);
		ctx.moveTo(bracketStartX, exitBracketY - capH);
		ctx.lineTo(bracketStartX, exitBracketY + capH);
		ctx.moveTo(bracketEndX, exitBracketY - capH);
		ctx.lineTo(bracketEndX, exitBracketY + capH);
		ctx.stroke();

		ctx.fillStyle = '#c6781b';
		ctx.font = '600 11px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'left';
		const dLabelX = Math.min(bracketEndX + 8, canvas.width - 120);
		const dLabelY = exitBracketY - 8;
		ctx.fillText(`D = ${spotDiameterCm.toFixed(2)} cm`, dLabelX, dLabelY);
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

		if (Math.abs(pointerX - state.screenX) <= 10) {
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
	startVisualFxLoop();
});
