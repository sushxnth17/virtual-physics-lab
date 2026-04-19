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
		lastCapturedL: null
	};

	const geometry = {
		fiberTipX: 235,
		centerY: 210,
		axisStartX: 235,
		axisLengthPx: 540
	};

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

		const step = () => {
			const delta = state.targetScreenX - state.screenX;
			if (Math.abs(delta) < 0.15) {
				state.screenX = state.targetScreenX;
				render();
				stopScreenAnimation();
				return;
			}

			state.screenX += delta * 0.2;
			render();
			state.animationFrameId = requestAnimationFrame(step);
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
		const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
		gradient.addColorStop(0, '#fbfdff');
		gradient.addColorStop(1, '#eef5fb');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	function drawAxis() {
		const y = geometry.centerY + 130;
		const x0 = geometry.axisStartX;
		const x1 = x0 + cmToPixels(axisConfig.maxCm);

		ctx.strokeStyle = '#304c69';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(x0, y);
		ctx.lineTo(x1, y);
		ctx.stroke();

		const totalMinorSteps = Math.round(axisConfig.maxCm / axisConfig.minorTickCm);
		const majorStepSize = Math.round(axisConfig.majorTickCm / axisConfig.minorTickCm);

		for (let step = 0; step <= totalMinorSteps; step += 1) {
			const LValue = step * axisConfig.minorTickCm;
			const tx = x0 + cmToPixels(LValue);
			const isMajor = step % majorStepSize === 0;
			const isSelectedMajor = isMajor && Math.abs(LValue - state.Lcm) <= axisConfig.majorTickCm / 2;
			const tickH = isMajor ? (isSelectedMajor ? 14 : 11) : 7;
			ctx.strokeStyle = isSelectedMajor ? '#0f4c81' : '#304c69';
			ctx.lineWidth = isSelectedMajor ? 2.4 : 1.6;
			ctx.beginPath();
			ctx.moveTo(tx, y - tickH);
			ctx.lineTo(tx, y + tickH);
			ctx.stroke();

			if (isMajor) {
				ctx.fillStyle = isSelectedMajor ? '#0f4c81' : '#29435d';
				ctx.font = isSelectedMajor ? '700 12px "IBM Plex Sans", sans-serif' : '12px "IBM Plex Sans", sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(LValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''), tx, y + 26);
			}
		}

		ctx.strokeStyle = '#304c69';
		ctx.lineWidth = 2;

		ctx.fillStyle = '#29435d';
		ctx.font = '600 13px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText('Distance scale from fiber tip, L (cm)', x0, y + 44);
	}

	function drawLaserAndFiber() {
		const laserX = 55;
		const laserY = geometry.centerY - 42;
		const laserW = 108;
		const laserH = 84;
		const fiberY = geometry.centerY - 16;
		const fiberW = geometry.fiberTipX - 175;

		ctx.fillStyle = '#f7e7d2';
		ctx.strokeStyle = '#a97032';
		ctx.lineWidth = 2;
		ctx.fillRect(laserX, laserY, laserW, laserH);
		ctx.strokeRect(laserX, laserY, laserW, laserH);

		ctx.fillStyle = '#7d4f1d';
		ctx.font = '700 13px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('Laser Source', laserX + laserW / 2, laserY - 10);

		ctx.fillStyle = '#8f9fae';
		ctx.fillRect(175, fiberY, fiberW, 32);
		ctx.strokeStyle = '#5f6c79';
		ctx.strokeRect(175, fiberY, fiberW, 32);

		ctx.fillStyle = '#2f455b';
		ctx.font = '700 13px "IBM Plex Sans", sans-serif';
		ctx.fillText('Optical Fiber', 198, fiberY - 12);

		ctx.strokeStyle = '#ff3b2e';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(laserX + laserW, geometry.centerY);
		ctx.lineTo(geometry.fiberTipX - 1, geometry.centerY);
		ctx.stroke();
	}

	function drawLightConeAndScreen() {
		const screenX = getScreenX();
		const spotRadius = getSpotRadiusPx();
		const topY = geometry.centerY - spotRadius;
		const bottomY = geometry.centerY + spotRadius;
		const spotDiameterCm = getSpotDiameterCm();
		const pulse = 0.6 + 0.4 * Math.sin(screenX * 0.04);

		const coneGradient = ctx.createLinearGradient(geometry.fiberTipX, geometry.centerY, screenX, geometry.centerY);
		coneGradient.addColorStop(0, 'rgba(255, 110, 85, 0.32)');
		coneGradient.addColorStop(0.45, 'rgba(255, 112, 70, 0.15)');
		coneGradient.addColorStop(1, 'rgba(255, 110, 85, 0.04)');

		ctx.fillStyle = coneGradient;
		ctx.beginPath();
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(screenX, topY);
		ctx.lineTo(screenX, bottomY);
		ctx.closePath();
		ctx.fill();

		ctx.strokeStyle = 'rgba(196, 57, 35, 0.85)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(screenX, topY);
		ctx.moveTo(geometry.fiberTipX, geometry.centerY);
		ctx.lineTo(screenX, bottomY);
		ctx.stroke();

		ctx.strokeStyle = `rgba(255, 132, 92, ${0.45 * pulse})`;
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		for (let i = -2; i <= 2; i += 1) {
			const t = i / 2;
			const rayY = geometry.centerY + t * spotRadius;
			ctx.moveTo(geometry.fiberTipX, geometry.centerY);
			ctx.lineTo(screenX, rayY);
		}
		ctx.stroke();

		ctx.strokeStyle = '#1f405e';
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.moveTo(screenX, 68);
		ctx.lineTo(screenX, 350);
		ctx.stroke();

		ctx.fillStyle = '#173851';
		ctx.font = '700 13px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('Movable Screen', screenX, 52);

		const glowGradient = ctx.createRadialGradient(
			screenX,
			geometry.centerY,
			spotRadius * 0.1,
			screenX,
			geometry.centerY,
			spotRadius * 1.35
		);
		glowGradient.addColorStop(0, 'rgba(255, 170, 140, 0.55)');
		glowGradient.addColorStop(0.6, 'rgba(255, 110, 76, 0.26)');
		glowGradient.addColorStop(1, 'rgba(255, 90, 60, 0.02)');
		ctx.fillStyle = glowGradient;
		ctx.beginPath();
		ctx.arc(screenX, geometry.centerY, spotRadius * 1.35, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = 'rgba(255, 70, 52, 0.56)';
		ctx.strokeStyle = 'rgba(169, 25, 13, 0.92)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(screenX, geometry.centerY, spotRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		const coreRadius = Math.max(2, spotRadius * 0.3);
		ctx.fillStyle = 'rgba(255, 235, 210, 0.52)';
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

		ctx.fillStyle = '#6a4b07';
		ctx.font = '600 12px "IBM Plex Sans", sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(`D = ${spotDiameterCm.toFixed(2)} cm`, screenX + 42, geometry.centerY + 4);
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
			setScreenXImmediate(getScreenXForL(freeL));
			render();
			return;
		}

		const snappedL = normalizeLForMode(measuredL);
		state.Lcm = snappedL;
		setScreenXImmediate(getScreenXForL(snappedL));
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
		state.screenDragging = false;
		state.targetScreenX = state.screenX;
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
