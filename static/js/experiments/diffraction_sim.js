/**
 * Diffraction Grating Simulation Canvas - Physics-Driven Interactive Lab
 * Implements lab manual formulas: d sinθ = mλ
 * Professional-grade virtual physics laboratory setup
 */

// ============================================================================
// PHYSICS CONSTANTS
// ============================================================================

// Grating specifications
const LPI = 500;  // Lines per inch
const INCH_TO_METER = 0.0254;
const N = LPI / INCH_TO_METER;  // Grating lines per meter (≈ 19,685)
const GRATING_CONSTANT = 1 / N;  // d in meters (≈ 50.8e-6 m or 50.8 μm)

// Wavelength (adjustable)
let wavelength = 650e-9;  // 650 nm in meters (default red laser)

// Maximum diffraction order to display
const MAX_ORDER = 8;

// ============================================================================
// CANVAS LAYOUT CONSTANTS
// ============================================================================

// Canvas dimension variables
let canvasWidth;
let canvasHeight;
let centerY;

const BASE_CANVAS_HEIGHT = 560;
const MIN_ORDER_LABEL_SPACING = 24;
const CANVAS_VERTICAL_MARGIN = 60;
const DIFFRACTION_ERROR_KEY = 'diffraction_error_seed';
const DIFFRACTION_EXPERIMENT_KEY = 'diffraction_experiment_data';

// Physical scale: distance from grating to right canvas edge represents this distance
const MAX_PHYSICAL_DISTANCE = 2.0;  // 2 meters

// Pixels per meter (calculated dynamically based on canvas size)
let PIXELS_PER_METER;

// Component positions (fixed)
const LASER_X_RATIO = 0.1;      // Laser at 10% from left
const GRATING_X_RATIO = 0.4;    // Grating at 40% from left
const SCREEN_X_INITIAL_RATIO = 0.85;  // Screen initial position at 85% from left

// Component dimensions (as ratios of canvas size)
const LASER_WIDTH_RATIO = 0.15;   // Increased for better visibility
const LASER_HEIGHT_RATIO = 0.12;   // Increased for better proportions
const GRATING_WIDTH_RATIO = 0.04;  // Increased for better appearance
const GRATING_HEIGHT_RATIO = 0.55; // Increased for prominence

// Screen dimensions
const SCREEN_WIDTH_RATIO = 0.025;  // Width of screen plate
const SCREEN_HEIGHT_RATIO = 0.65;  // Height of screen plate

// Interaction constraints
const SCREEN_MIN_DISTANCE_FROM_GRATING = 0.1;  // meters
const SCREEN_MAX_DISTANCE_FROM_GRATING = 2.0;  // meters
const SCREEN_HOVER_TOLERANCE = 15;  // pixels

// ============================================================================
// LAYOUT VARIABLES (calculated from canvas)
// ============================================================================

let laserX;
let gratingX;
let screenX;
let laserWidth;
let laserHeight;
let gratingWidth;
let gratingHeight;
let screenWidth;
let screenHeight;

// ============================================================================
// SIMULATION STATE
// ============================================================================

let screenDistance = 1.0;  // Current physical distance from grating to screen (meters)
let pixelScale;  // Scaling factor for vertical diffraction pattern display
let measurementErrorFactor = 0; // Persistent student-specific xm variation (-3% to +3%)
let persistedXmValues = {}; // Stored measured xm values by order
let hasPersistedExperiment = false;
let persistedScreenDistance = null;

// Dragging state
let isDraggingScreen = false;
let dragStartMouseX = 0;
let dragStartScreenX = 0;
let hasDragged = false;  // Track if actual dragging occurred vs just click

// Measurement tool state
let selectedOrder = null;  // Currently selected diffraction order for measurement
let selectedXm = null;     // Measured xm value in meters
let highlightTimeout = null;  // Timeout for highlight effect

// Canvas context
let canvas;
let ctx;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize canvas dimensions and calculate layout parameters
 */
function initializeLayout() {
    canvas = document.getElementById('simulationCanvas');
    ctx = canvas.getContext('2d');

    const requiredCanvasHeight = calculateRequiredCanvasHeight();
    if (canvas.height !== requiredCanvasHeight) {
        canvas.height = requiredCanvasHeight;
    }
    
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    centerY = canvasHeight / 2;
    
    // Calculate pixels per meter based on available space
    // Distance from grating to right edge = MAX_PHYSICAL_DISTANCE meters
    const gratingToEdgePixels = canvasWidth * (1 - GRATING_X_RATIO);
    PIXELS_PER_METER = gratingToEdgePixels / MAX_PHYSICAL_DISTANCE;
    
    // Fixed component positions
    laserX = canvasWidth * LASER_X_RATIO;
    gratingX = canvasWidth * GRATING_X_RATIO;
    screenX = canvasWidth * SCREEN_X_INITIAL_RATIO;
    
    // Component dimensions
    laserWidth = canvasWidth * LASER_WIDTH_RATIO;
    laserHeight = canvasHeight * LASER_HEIGHT_RATIO;
    gratingWidth = canvasWidth * GRATING_WIDTH_RATIO;
    gratingHeight = canvasHeight * GRATING_HEIGHT_RATIO;
    screenWidth = canvasWidth * SCREEN_WIDTH_RATIO;
    screenHeight = canvasHeight * SCREEN_HEIGHT_RATIO;
    
    // Calculate initial screen distance
    screenDistance = computeScreenDistance(screenX);
}

// ============================================================================
// PHYSICS FUNCTIONS
// ============================================================================

/**
 * Compute physical distance from grating to screen based on screen pixel position
 * @param {number} screenPixelX - Screen x-coordinate in pixels
 * @returns {number} Distance in meters
 */
function computeScreenDistance(screenPixelX) {
    const distancePixels = screenPixelX - gratingX;
    return distancePixels / PIXELS_PER_METER;
}

/**
 * Compute screen pixel position from physical distance
 * @param {number} distance - Distance in meters
 * @returns {number} Screen x-coordinate in pixels
 */
function computeScreenPosition(distance) {
    return gratingX + (distance * PIXELS_PER_METER);
}

/**
 * Load previously stored experiment data for this user.
 *
 * @returns {object|null} Parsed experiment object or null when unavailable/invalid
 */
function loadStoredExperiment() {
    try {
        const raw = localStorage.getItem(DIFFRACTION_EXPERIMENT_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        const xmValues = (parsed.xmValues && typeof parsed.xmValues === 'object') ? parsed.xmValues : {};
        const hasXmData = Object.keys(xmValues).length > 0;
        if (!hasXmData) return null;

        return {
            errorSeed: typeof parsed.errorSeed === 'number' ? parsed.errorSeed : null,
            screenDistance: typeof parsed.screenDistance === 'number' ? parsed.screenDistance : null,
            xmValues: xmValues
        };
    } catch (error) {
        return null;
    }
}

/**
 * Save current user experiment data.
 */
function persistExperiment() {
    try {
        localStorage.setItem(
            DIFFRACTION_EXPERIMENT_KEY,
            JSON.stringify({
                errorSeed: measurementErrorFactor,
                screenDistance: screenDistance,
                xmValues: persistedXmValues
            })
        );
        localStorage.setItem(DIFFRACTION_ERROR_KEY, measurementErrorFactor.toString());
    } catch (error) {
        // Ignore storage errors to keep simulation running.
    }
}

/**
 * Initialize persistent measurement error factor.
 * Reuses stored value per student/session, else creates a random factor in [-3%, +3%].
 */
function initializeMeasurementErrorFactor() {
    try {
        const storedExperiment = loadStoredExperiment();
        if (storedExperiment) {
            hasPersistedExperiment = true;
            persistedXmValues = storedExperiment.xmValues;
            persistedScreenDistance = storedExperiment.screenDistance;

            if (
                typeof storedExperiment.errorSeed === 'number' &&
                storedExperiment.errorSeed >= -0.03 &&
                storedExperiment.errorSeed <= 0.03
            ) {
                measurementErrorFactor = storedExperiment.errorSeed;
                localStorage.setItem(DIFFRACTION_ERROR_KEY, measurementErrorFactor.toString());
                return;
            }
        }

        const savedValue = localStorage.getItem(DIFFRACTION_ERROR_KEY);
        const parsedValue = savedValue !== null ? parseFloat(savedValue) : NaN;

        if (!isNaN(parsedValue) && parsedValue >= -0.03 && parsedValue <= 0.03) {
            measurementErrorFactor = parsedValue;
            return;
        }

        if (hasPersistedExperiment) {
            measurementErrorFactor = 0;
            return;
        }

        measurementErrorFactor = (Math.random() * 0.06) - 0.03;
        localStorage.setItem(DIFFRACTION_ERROR_KEY, measurementErrorFactor.toString());
    } catch (error) {
        // Fallback for environments where localStorage is unavailable.
        measurementErrorFactor = 0;
    }
}

/**
 * Calculate diffraction angle for a given order
 * Using grating equation: d sinθ = mλ → sinθ = mλ / d
 * 
 * @param {number} order - Diffraction order (m)
 * @returns {number|null} Angle in radians, or null if physically impossible (|sinθ| > 1)
 */
function calculateDiffractionAngle(order) {
    const sinTheta = (order * wavelength) / GRATING_CONSTANT;
    
    // Check physical validity: |sinθ| ≤ 1
    if (Math.abs(sinTheta) > 1) {
        return null;
    }
    
    return Math.asin(sinTheta);
}

/**
 * Calculate vertical screen position offset for a diffraction ray
 * Using: y = S × tan(θ)
 * 
 * @param {number|null} angle - Diffraction angle in radians
 * @returns {number|null} Vertical displacement in meters
 */
function calculateScreenOffset(angle) {
    if (angle === null) return null;
    return screenDistance * Math.tan(angle);
}

/**
 * Ideal displacement from diffraction relation without experimental error.
 *
 * @param {number} order - Diffraction order (m)
 * @returns {number} Vertical displacement in meters
 */
function calculateIdealOrderDisplacement(order) {
    return (Math.abs(order) * wavelength * screenDistance) / GRATING_CONSTANT;
}

/**
 * Calculate vertical diffraction displacement using the lab relation x_m = m * λ * S / d.
 * This keeps the rendered spot spacing directly tied to the observation-table formula.
 *
 * @param {number} order - Diffraction order (m)
 * @returns {number} Vertical displacement in meters
 */
function calculateOrderDisplacement(order) {
    const trueXm = calculateIdealOrderDisplacement(order);
    return trueXm * (1 + measurementErrorFactor);
}

/**
 * Compute a canvas height that keeps all orders through ±MAX_ORDER visible and readable.
 *
 * @returns {number} Required canvas height in pixels
 */
function calculateRequiredCanvasHeight() {
    const firstOrderDisplacement = calculateIdealOrderDisplacement(1);
    const highestOrderDisplacement = calculateIdealOrderDisplacement(MAX_ORDER);

    if (firstOrderDisplacement <= 0 || highestOrderDisplacement <= 0) {
        return BASE_CANVAS_HEIGHT;
    }

    const minimumPixelScale = MIN_ORDER_LABEL_SPACING / firstOrderDisplacement;
    const requiredHalfHeight = highestOrderDisplacement * minimumPixelScale + CANVAS_VERTICAL_MARGIN;

    return Math.max(BASE_CANVAS_HEIGHT, Math.ceil(requiredHalfHeight * 2));
}

/**
 * Calculate dynamic pixel scale for rendering diffraction pattern
 * Ensures highest visible order fits within 40% of canvas height
 * 
 * @returns {number} Pixel scale factor
 */
function calculatePixelScale() {
    const highestOrderDisplacement = calculateIdealOrderDisplacement(MAX_ORDER);
    const firstOrderDisplacement = calculateIdealOrderDisplacement(1);

    if (highestOrderDisplacement > 0 && firstOrderDisplacement > 0) {
        const allowedPixelHeight = Math.max(0, canvasHeight / 2 - CANVAS_VERTICAL_MARGIN);
        const fitScale = allowedPixelHeight / highestOrderDisplacement;
        const spacingScale = MIN_ORDER_LABEL_SPACING / firstOrderDisplacement;

        return Math.max(fitScale, spacingScale);
    }
    
    // Fallback: default scaling
    return canvasHeight / 2;
}

/**
 * Draw the laser source with realistic housing and beam
 */
function drawLaser() {
    const x = laserX;
    const y = centerY - laserHeight / 2;
    const width = laserWidth;
    const height = laserHeight;
    
    // Draw laser housing with gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, '#333333');
    gradient.addColorStop(0.5, '#1a1a1a');
    gradient.addColorStop(1, '#0a0a0a');
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    // Rounded corners for housing
    const radius = height * 0.15;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Laser emission aperture (bright red circle)
    const apertureX = x + width - width * 0.15;
    const apertureY = y + height / 2;
    
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(apertureX, apertureY, width * 0.08, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = '#FFAAAA';
    ctx.beginPath();
    ctx.arc(apertureX, apertureY, width * 0.05, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw laser beam from laser to grating
    const beamStartX = apertureX;
    const beamEndX = gratingX - gratingWidth / 2;
    
    // Beam glow (outer)
    const beamGradient = ctx.createLinearGradient(beamStartX, apertureY, beamEndX, apertureY);
    beamGradient.addColorStop(0, 'rgba(255, 100, 100, 0.4)');
    beamGradient.addColorStop(0.5, 'rgba(255, 80, 80, 0.2)');
    beamGradient.addColorStop(1, 'rgba(255, 60, 60, 0.1)');
    
    ctx.strokeStyle = beamGradient;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(beamStartX, apertureY);
    ctx.lineTo(beamEndX, apertureY);
    ctx.stroke();
    
    // Beam core (bright red)
    ctx.strokeStyle = '#FF3333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(beamStartX, apertureY);
    ctx.lineTo(beamEndX, apertureY);
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Laser', x + width / 2, y + height + 20);
}

/**
 * Draw the diffraction grating with metallic appearance
 */
function drawGrating() {
    const x = gratingX - gratingWidth / 2;
    const y = centerY - gratingHeight / 2;
    const width = gratingWidth;
    const height = gratingHeight;
    
    // Draw grating plate with metallic gradient
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(0.3, '#404040');
    gradient.addColorStop(0.5, '#555555');
    gradient.addColorStop(0.7, '#404040');
    gradient.addColorStop(1, '#1a1a1a');
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    
    // Draw fine grating lines (vertical lines on the surface)
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 0.5;
    const lineSpacing = height / 12;
    for (let i = 1; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(x + width * 0.2, y + i * lineSpacing);
        ctx.lineTo(x + width * 0.8, y + i * lineSpacing);
        ctx.stroke();
    }
    
    // Add subtle shadow on right edge for depth
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + width - 1, y, 1, height);
    
    // Label
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Grating', gratingX, centerY + gratingHeight / 2 + 25);
}

/**
 * Draw the observation screen with metallic appearance and 3D effect
 */
function drawScreen() {
    const x = screenX - screenWidth / 2;
    const y = centerY - screenHeight / 2;
    const width = screenWidth;
    const height = screenHeight;
    
    // Draw screen plate with metallic gradient
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(0.4, '#2a2a2a');
    gradient.addColorStop(0.5, '#3a3a3a');
    gradient.addColorStop(0.6, '#2a2a2a');
    gradient.addColorStop(1, '#0a0a0a');
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    
    // Add left highlight edge for 3D effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 5);
    ctx.lineTo(x + 0.5, y + height - 5);
    ctx.stroke();
    
    // Add subtle diffuse reflection pattern on surface (vertical gradation)
    ctx.fillStyle = 'rgba(100, 100, 100, 0.05)';
    for (let i = 0; i < height; i += 40) {
        ctx.fillRect(x + width * 0.1, y + i, width * 0.8, 20);
    }
    
    // Label
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Screen', screenX, centerY + screenHeight / 2 + 25);
}

/**
 * Draw distance arrow and label between grating and screen
 */
function drawDistanceArrow() {
    const arrowY = centerY - (screenHeight / 2 + 40);
    const startX = gratingX;
    const endX = screenX;
    const arrowSize = 8;
    
    // Draw line
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX, arrowY);
    ctx.lineTo(endX, arrowY);
    ctx.stroke();
    
    // Draw start arrow
    ctx.beginPath();
    ctx.moveTo(startX, arrowY);
    ctx.lineTo(startX + arrowSize, arrowY - arrowSize / 2);
    ctx.lineTo(startX + arrowSize, arrowY + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    // Draw end arrow
    ctx.beginPath();
    ctx.moveTo(endX, arrowY);
    ctx.lineTo(endX - arrowSize, arrowY - arrowSize / 2);
    ctx.lineTo(endX - arrowSize, arrowY + arrowSize / 2);
    ctx.closePath();
    ctx.fill();
    
    // Label with distance value
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`S = ${screenDistance.toFixed(2)} m`, (startX + endX) / 2, arrowY - 15);
}

// ============================================================================
// DIFFRACTION RAY AND SPOT RENDERING
// ============================================================================

/**
 * Draw diffraction rays from grating to screen
 * Central ray (m=0) is solid, diffraction orders are dashed
 */
/**
 * Draw diffraction rays from grating to screen
 * Central ray (m=0) is solid, diffraction orders are dashed
 */
function drawDiffractionRays() {
    const gratingCenterX = gratingX;
    const gratingCenterY = centerY;
    
    // ===== CENTRAL MAXIMUM RAY (m=0, slightly brighter) =====
    // Reset line dash for smooth continuous lines
    ctx.setLineDash([]);
    
    // Outer glow for central ray (brighter)
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gratingCenterX, gratingCenterY);
    ctx.lineTo(screenX, gratingCenterY);
    ctx.stroke();
    
    // Inner bright beam for central ray
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gratingCenterX, gratingCenterY);
    ctx.lineTo(screenX, gratingCenterY);
    ctx.stroke();
    
    // ===== DIFFRACTION ORDER RAYS (faint glowing beams) =====
    // Draw rays for orders 1 through MAX_ORDER
    for (let order = 1; order <= MAX_ORDER; order++) {
        const offsetMeters = calculateOrderDisplacement(order);
        const offsetPixels = offsetMeters * pixelScale;
        
        const screenY_positive = centerY - offsetPixels;
        const screenY_negative = centerY + offsetPixels;

        // Skip drawing if outside canvas
        if (
            screenY_positive < 0 ||
            screenY_positive > canvasHeight ||
            screenY_negative < 0 ||
            screenY_negative > canvasHeight
        ) {
            continue;
        }
        
        // Reduce brightness slightly for higher orders to simulate intensity loss
        const brightnessMultiplier = Math.max(0.6, 1 - order * 0.08);
        const glowAlpha = Math.round(15 * brightnessMultiplier);
        const beamAlpha = Math.round(60 * brightnessMultiplier);
        
        // ===== POSITIVE ORDER RAY (upper) =====
        // Faint outer glow
        ctx.strokeStyle = `rgba(255, 0, 0, ${glowAlpha / 255})`;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(gratingCenterX, gratingCenterY);
        ctx.lineTo(screenX, screenY_positive);
        ctx.stroke();
        
        // Bright inner beam
        ctx.strokeStyle = `rgba(255, 0, 0, ${beamAlpha / 255})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gratingCenterX, gratingCenterY);
        ctx.lineTo(screenX, screenY_positive);
        ctx.stroke();
        
        // ===== NEGATIVE ORDER RAY (lower, symmetric) =====
        // Faint outer glow
        ctx.strokeStyle = `rgba(255, 0, 0, ${glowAlpha / 255})`;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(gratingCenterX, gratingCenterY);
        ctx.lineTo(screenX, screenY_negative);
        ctx.stroke();
        
        // Bright inner beam
        ctx.strokeStyle = `rgba(255, 0, 0, ${beamAlpha / 255})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gratingCenterX, gratingCenterY);
        ctx.lineTo(screenX, screenY_negative);
        ctx.stroke();
    }
}

/**
 * Draw bright spots on the screen at diffraction maxima positions
 * Uses radial gradients for realistic glow effects
 */
function drawDiffractionSpots() {
    const screenX_pos = screenX;
    const labelX = screenX_pos + 22;
    
    // Central maximum (m=0, largest and brightest)
    const centralRadius = 12;
    const centralGlowRadius = centralRadius * 2.8;
    
    // Radial gradient for central maximum glow - enhanced with more realistic light falloff
    const centralGradient = ctx.createRadialGradient(screenX_pos, centerY, 0, screenX_pos, centerY, centralGlowRadius);
    centralGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');      // Bright white center
    centralGradient.addColorStop(0.2, 'rgba(255, 255, 200, 0.8)');    // Light yellow transition
    centralGradient.addColorStop(0.4, 'rgba(255, 255, 100, 0.5)');    // Yellow glow
    centralGradient.addColorStop(0.7, 'rgba(255, 200, 0, 0.2)');      // Orange/amber fade
    centralGradient.addColorStop(1, 'rgba(255, 200, 0, 0)');          // Transparent edge
    
    ctx.fillStyle = centralGradient;
    ctx.beginPath();
    ctx.arc(screenX_pos, centerY, centralGlowRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Central bright core - white center fading to yellow
    const coreCoreGradient = ctx.createRadialGradient(screenX_pos, centerY, 0, screenX_pos, centerY, centralRadius);
    coreCoreGradient.addColorStop(0, '#FFFFFF');       // Pure white center
    coreCoreGradient.addColorStop(0.7, '#FFFF99');     // Light yellow
    coreCoreGradient.addColorStop(1, '#FFFF00');       // Bright yellow edge
    
    ctx.fillStyle = coreCoreGradient;
    ctx.beginPath();
    ctx.arc(screenX_pos, centerY, centralRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Central core outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(screenX_pos, centerY, centralRadius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Label central maximum
    ctx.fillStyle = '#000000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('m = 0', labelX, centerY + 4);
    
    // Draw spots for diffraction orders 1 through MAX_ORDER
    for (let order = 1; order <= MAX_ORDER; order++) {
        const offsetMeters = calculateOrderDisplacement(order);
        const offsetPixels = offsetMeters * pixelScale;
        const screenY_positive = centerY - offsetPixels;
        const screenY_negative = centerY + offsetPixels;

        // Skip drawing if outside canvas bounds
        if (
            screenY_positive < 0 ||
            screenY_positive > canvasHeight ||
            screenY_negative < 0 ||
            screenY_negative > canvasHeight
        ) {
            continue;
        }
        
        // Spot size decreases with order (higher orders are dimmer)
        const baseRadius = Math.max(2.5, 10 - order * 0.8);
        const glowRadius = baseRadius * 2.5;  // Proportional glow radius
        
        // Color intensity decreases with order to simulate diffraction effects
        const brightness = 255 - order * 25;
        const colorIntBr = Math.max(120, brightness);
        const colorIntGr = Math.max(80, brightness - 40);
        
        // ===== POSITIVE ORDER SPOT =====
        // Draw glow halo with smooth gradient
        const gradientPos = ctx.createRadialGradient(screenX_pos, screenY_positive, 0, screenX_pos, screenY_positive, glowRadius);
        gradientPos.addColorStop(0, `rgba(255, 255, ${colorIntBr}, 0.7)`);       // Bright yellow/white center
        gradientPos.addColorStop(0.25, `rgba(255, 255, ${colorIntGr}, 0.5)`);    // Yellow middle
        gradientPos.addColorStop(0.6, `rgba(255, ${150 + order * 10}, 0, 0.2)`); // Orange fade
        gradientPos.addColorStop(1, `rgba(255, 200, 0, 0)`);                     // Transparent edge
        
        ctx.fillStyle = gradientPos;
        ctx.beginPath();
        ctx.arc(screenX_pos, screenY_positive, glowRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw bright core with gradient from white to yellow
        const coreGradientPos = ctx.createRadialGradient(screenX_pos, screenY_positive, 0, screenX_pos, screenY_positive, baseRadius);
        coreGradientPos.addColorStop(0, `rgb(255, 255, ${Math.min(255, colorIntBr + 30)})`);  // White center
        coreGradientPos.addColorStop(0.8, `rgb(255, 255, ${colorIntBr})`);                     // Yellow edge
        
        ctx.fillStyle = coreGradientPos;
        ctx.beginPath();
        ctx.arc(screenX_pos, screenY_positive, baseRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Core outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(screenX_pos, screenY_positive, baseRadius, 0, 2 * Math.PI);
        ctx.stroke();
        
        // ===== NEGATIVE ORDER SPOT (symmetric lower) =====
        // Draw glow halo
        const gradientNeg = ctx.createRadialGradient(screenX_pos, screenY_negative, 0, screenX_pos, screenY_negative, glowRadius);
        gradientNeg.addColorStop(0, `rgba(255, 255, ${colorIntBr}, 0.7)`);
        gradientNeg.addColorStop(0.25, `rgba(255, 255, ${colorIntGr}, 0.5)`);
        gradientNeg.addColorStop(0.6, `rgba(255, ${150 + order * 10}, 0, 0.2)`);
        gradientNeg.addColorStop(1, `rgba(255, 200, 0, 0)`);
        
        ctx.fillStyle = gradientNeg;
        ctx.beginPath();
        ctx.arc(screenX_pos, screenY_negative, glowRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw bright core
        const coreGradientNeg = ctx.createRadialGradient(screenX_pos, screenY_negative, 0, screenX_pos, screenY_negative, baseRadius);
        coreGradientNeg.addColorStop(0, `rgb(255, 255, ${Math.min(255, colorIntBr + 30)})`);
        coreGradientNeg.addColorStop(0.8, `rgb(255, 255, ${colorIntBr})`);
        
        ctx.fillStyle = coreGradientNeg;
        ctx.beginPath();
        ctx.arc(screenX_pos, screenY_negative, baseRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Core outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(screenX_pos, screenY_negative, baseRadius, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Labels for every visible order so the screen matches the observation table range.
        ctx.fillStyle = '#000000';
        ctx.font = '9px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`m = +${order}`, labelX, screenY_positive + 3);
        ctx.fillText(`m = -${order}`, labelX, screenY_negative + 3);
    }
}

// ============================================================================
// INTERACTION HELPERS
// ============================================================================

/**
 * Check if mouse is hovering over the draggable screen
 * @param {number} mouseX - Mouse x-coordinate (canvas-relative)
 * @param {number} mouseY - Mouse y-coordinate (canvas-relative)
 * @returns {boolean} True if mouse is over screen
 */
function isMouseOverScreen(mouseX, mouseY) {
    return (Math.abs(mouseX - screenX) < SCREEN_HOVER_TOLERANCE &&
            mouseY >= (centerY - gratingHeight / 2) &&
            mouseY <= (centerY + gratingHeight / 2));
}

/**
 * Update screen position from drag interaction
 * Applies physical constraints and updates distance
 * 
 * @param {number} newScreenX - Proposed new screen x-position in pixels
 */
function updateScreenFromDrag(newScreenX) {
    // Calculate physical constraints in pixels
    const minScreenX = computeScreenPosition(SCREEN_MIN_DISTANCE_FROM_GRATING);
    const maxScreenX = computeScreenPosition(SCREEN_MAX_DISTANCE_FROM_GRATING);
    
    // Apply constraints
    screenX = Math.max(minScreenX, Math.min(maxScreenX, newScreenX));
    
    // Update physical distance
    screenDistance = computeScreenDistance(screenX);
}

/**
 * Update screen position from slider input
 * @param {number} distance - Distance in meters
 */
function updateScreenFromSlider(distance) {
    // Constrain distance within physical limits
    screenDistance = Math.max(
        SCREEN_MIN_DISTANCE_FROM_GRATING,
        Math.min(SCREEN_MAX_DISTANCE_FROM_GRATING, distance)
    );
    
    // Update screen pixel position
    screenX = computeScreenPosition(screenDistance);
}

// ============================================================================
// MEASUREMENT TOOL FUNCTIONS
// ============================================================================

/**
 * MEASUREMENT AND DATA RECORDING SYSTEM
 * 
 * This system simulates the complete laboratory data collection process:
 * 
 * 1. MEASUREMENT PHASE
 *    - User clicks on any diffraction spot (orders 1-3)
 *    - System identifies which order was clicked
 *    - Computes xm (vertical distance from central maximum)
 *    - Displays measurement with visual feedback
 * 
 * 2. CALCULATION PHASE
 *    - Computes 2xm (total distance between ±m spots)
 *    - Calculates diffraction angle: θ = atan(xm / S)
 *    - Computes sin(θ)
 *    - Calculates wavelength: λ = (d × sin(θ)) / m
 *    - Converts all values to appropriate units (cm, degrees, nm)
 * 
 * 3. RECORDING PHASE
 *    - Automatically fills corresponding row in tabular column
 *    - Updates or overwrites existing data for that order
 *    - Recalculates average wavelength across all orders
 *    - Updates result section
 * 
 * 4. CONSISTENCY MAINTENANCE
 *    - When screen distance S changes, all recorded observations
 *      are automatically recalculated to maintain consistency
 *    - Manual input in 2xm fields also triggers full calculation
 * 
 * This follows the exact procedure from physics lab manuals.
 */

/**
 * Compute xm (vertical distance from central maximum to diffraction spot)
 * @param {number} order - Diffraction order (must be >= 1)
 * @returns {number|null} xm in meters, or null if order is not valid
 */
function computeXm(order) {
    if (order < 1) return null;

    return calculateOrderDisplacement(order);  // xm is always positive (distance magnitude)
}

/**
 * Get spot positions for all visible diffraction orders
 * @returns {Array} Array of objects with {order, pixelY, isPositive}
 */
function getSpotPositions() {
    const spots = [];
    
    for (let order = 1; order <= MAX_ORDER; order++) {
        const offsetMeters = calculateOrderDisplacement(order);
        const offsetPixels = offsetMeters * pixelScale;
        
        // Positive order (upper)
        spots.push({
            order: order,
            pixelY: centerY - offsetPixels,
            isPositive: true
        });
        
        // Negative order (lower, symmetric)
        spots.push({
            order: order,
            pixelY: centerY + offsetPixels,
            isPositive: false
        });
    }
    
    return spots;
}

/**
 * Handle click on diffraction spot for measurement
 * @param {number} mouseX - Mouse x-coordinate (canvas-relative)
 * @param {number} mouseY - Mouse y-coordinate (canvas-relative)
 */
function handleSpotClick(mouseX, mouseY) {
    // Check if click is near screen
    if (Math.abs(mouseX - screenX) > 30) return;
    
    // Check if click is on central maximum (m=0) - should not be measurable
    const centralRadius = 16;  // Including glow
    const distanceFromCenter = Math.abs(mouseY - centerY);
    if (distanceFromCenter < centralRadius) {
        // Clicked on central maximum - do nothing
        return;
    }
    
    // Get all spot positions
    const spots = getSpotPositions();
    
    // Find closest spot to click position
    let closestSpot = null;
    let minDistance = Infinity;
    const clickTolerance = 20;  // pixels
    
    for (const spot of spots) {
        const distance = Math.abs(mouseY - spot.pixelY);
        if (distance < minDistance && distance < clickTolerance) {
            minDistance = distance;
            closestSpot = spot;
        }
    }
    
    if (closestSpot) {
        // Set selected order and calculate xm
        selectedOrder = closestSpot.order;
        selectedXm = computeXm(closestSpot.order);
        
        // Update measurement display
        updateMeasurementDisplay();
        
        // Record observation into tabular column
        recordObservation(selectedOrder, selectedXm, screenDistance);
        
        // Trigger highlight and redraw
        clearTimeout(highlightTimeout);
        drawSetup();
        
        // Clear highlight after 2 seconds
        highlightTimeout = setTimeout(function() {
            selectedOrder = null;
            drawSetup();
        }, 2000);
    }
}

/**
 * Update measurement display in HTML
 */
function updateMeasurementDisplay() {
    const orderDisplay = document.getElementById('selectedOrderDisplay');
    const xmDisplay = document.getElementById('xmDisplay');
    
    if (selectedOrder !== null && selectedXm !== null) {
        // Convert xm from meters to centimeters
        const xmCm = selectedXm * 100;
        
        if (orderDisplay) {
            orderDisplay.textContent = `Selected Order: m = ±${selectedOrder}`;
        }
        if (xmDisplay) {
            xmDisplay.textContent = `xₘ = ${xmCm.toFixed(2)} cm`;
        }
    } else {
        if (orderDisplay) {
            orderDisplay.textContent = 'Click on a diffraction spot to measure';
        }
        if (xmDisplay) {
            xmDisplay.textContent = '';
        }
    }
}

/**
 * Calculate all observation parameters for a given order and xm
 * @param {number} order - Diffraction order
 * @param {number} xmMeters - xm in meters
 * @param {number} SMeters - Screen distance S in meters
 * @returns {Object} Calculated parameters
 */
function calculateObservationParameters(order, xmMeters, SMeters) {
    // Convert to centimeters for display
    const xmCm = xmMeters * 100;
    const twoXmCm = 2 * xmCm;
    const SCm = SMeters * 100;
    
    // Calculate theta: θ = atan(xm / S)
    const thetaRadians = Math.atan(xmMeters / SMeters);
    const thetaDegrees = thetaRadians * (180 / Math.PI);
    
    // Calculate sin(theta)
    const sinTheta = Math.sin(thetaRadians);
    
    // Calculate wavelength: λ = (d × sin(θ)) / m
    const lambdaMeters = (GRATING_CONSTANT * sinTheta) / order;
    const lambdaNm = lambdaMeters * 1e9;  // Convert to nanometers
    
    return {
        order: order,
        twoXmCm: twoXmCm,
        xmCm: xmCm,
        SCm: SCm,
        thetaDegrees: thetaDegrees,
        sinTheta: sinTheta,
        lambdaNm: lambdaNm
    };
}

/**
 * Record observation into the tabular column
 * @param {number} order - Diffraction order
 * @param {number} xmMeters - xm in meters
 * @param {number} SMeters - Screen distance S in meters
 */
function recordObservation(order, xmMeters, SMeters) {
    // Calculate all parameters
    const params = calculateObservationParameters(order, xmMeters, SMeters);
    
    // Find the row for this order
    const input = document.querySelector(`.two-xm-input[data-order="${order}"]`);
    if (!input) return;
    
    const row = input.closest('tr');
    if (!row) return;
    
    // Update 2xm input field
    input.value = params.twoXmCm.toFixed(2);
    
    // Update calculated value cells
    const xmCell = row.querySelector('.xm-value');
    const thetaCell = row.querySelector('.theta-value');
    const sinThetaCell = row.querySelector('.sin-theta-value');
    const lambdaCell = row.querySelector('.lambda-value');
    
    if (xmCell) xmCell.textContent = params.xmCm.toFixed(2);
    if (thetaCell) thetaCell.textContent = params.thetaDegrees.toFixed(4);
    if (sinThetaCell) sinThetaCell.textContent = params.sinTheta.toFixed(6);
    if (lambdaCell) lambdaCell.textContent = params.lambdaNm.toFixed(2);
    
    // Update screen distance in table header
    const screenDistanceInput = document.getElementById('screen-distance');
    if (screenDistanceInput) {
        screenDistanceInput.value = params.SCm.toFixed(1);
    }
    
    // Calculate and update average wavelength
    calculateAverageWavelength();

    // Persist measured xm for stable refresh behavior.
    persistedXmValues[String(order)] = xmMeters;
    persistExperiment();
}

/**
 * Calculate average wavelength from all filled rows
 */
function calculateAverageWavelength() {
    const lambdaCells = document.querySelectorAll('.lambda-value');
    let sum = 0;
    let count = 0;
    
    lambdaCells.forEach(cell => {
        const value = parseFloat(cell.textContent);
        if (!isNaN(value) && value > 0) {
            sum += value;
            count++;
        }
    });
    
    const avgDisplay = document.getElementById('average-wavelength');
    const finalDisplay = document.getElementById('final-wavelength');
    
    if (count > 0) {
        const average = sum / count;
        if (avgDisplay) {
            avgDisplay.textContent = `Average λ = ${average.toFixed(2)}`;
        }
        if (finalDisplay) {
            finalDisplay.textContent = average.toFixed(2);
        }
    } else {
        if (avgDisplay) {
            avgDisplay.textContent = '';
        }
        if (finalDisplay) {
            finalDisplay.textContent = '';
        }
    }
}

/**
 * Recalculate all existing observations when screen distance changes
 * This ensures all values remain consistent with current S
 */
function recalculateAllObservations() {
    const twoXmInputs = document.querySelectorAll('.two-xm-input');
    
    twoXmInputs.forEach(input => {
        const twoXmCm = parseFloat(input.value);
        
        if (!isNaN(twoXmCm) && twoXmCm > 0) {
            const order = parseInt(input.dataset.order);
            const xmCm = twoXmCm / 2;
            const xmMeters = xmCm / 100;
            
            // Recalculate with current screen distance
            recordObservation(order, xmMeters, screenDistance);
        }
    });
}

/**
 * Render measurement overlay (highlight selected spot)
 */
function renderMeasurementOverlay() {
    if (selectedOrder === null) return;

    const offsetMeters = calculateOrderDisplacement(selectedOrder);
    const offsetPixels = offsetMeters * pixelScale;
    
    // Highlight both positive and negative orders
    const spotYPositive = centerY - offsetPixels;
    const spotYNegative = centerY + offsetPixels;
    
    // Draw highlight rings
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    
    // Positive order highlight
    ctx.beginPath();
    ctx.arc(screenX, spotYPositive, 15, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Negative order highlight
    ctx.beginPath();
    ctx.arc(screenX, spotYNegative, 15, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.setLineDash([]);
}

// ============================================================================
// MASTER RENDERING FUNCTION
// ============================================================================

/**
 * Draw enhanced laser beam from laser aperture to grating
 * Features improved styling with glow effects
 */
function drawLaserBeam() {
    // Calculate beam start and end points
    const laserApertureX = laserX + laserWidth - laserWidth * 0.15;
    const laserApertureY = centerY;
    const gratingCenterX = gratingX;
    const gratingCenterY = centerY;
    
    // Draw glow effect (wider semi-transparent line behind main beam)
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(laserApertureX, laserApertureY);
    ctx.lineTo(gratingCenterX, gratingCenterY);
    ctx.stroke();
    
    // Draw secondary glow (medium width)
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(laserApertureX, laserApertureY);
    ctx.lineTo(gratingCenterX, gratingCenterY);
    ctx.stroke();
    
    // Draw main bright red beam
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(laserApertureX, laserApertureY);
    ctx.lineTo(gratingCenterX, gratingCenterY);
    ctx.stroke();
    
    // Draw inner core (brightest)
    ctx.strokeStyle = 'rgba(255, 100, 100, 1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(laserApertureX, laserApertureY);
    ctx.lineTo(gratingCenterX, gratingCenterY);
    ctx.stroke();
}

/**
 * Draw the complete experimental setup
 * Recalculates physics parameters and renders all components
 */
/**
 * Draw the complete experimental setup
 * Recalculates physics parameters and renders all components
 * Rendering order: Background → Laser & Beam → Grating → Rays → Screen → Spots → Overlay
 */
function drawSetup() {
    // Recalculate pixel scale based on current physics parameters
    pixelScale = calculatePixelScale();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw background: Subtle vertical gradient (optical table surface)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    bgGradient.addColorStop(0, '#F5F5F5');
    bgGradient.addColorStop(0.5, '#EBEBEB');
    bgGradient.addColorStop(1, '#F5F5F5');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Add subtle vertical line pattern (bench texture)
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvasWidth; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }
    
    // Draw all components in optimized rendering order
    // 1. Laser housing (background element)
    drawLaser();
    
    // 2. Enhanced laser beam with glow effects
    drawLaserBeam();
    
    // 3. Grating (central element)
    drawGrating();
    
    // 4. Diffraction rays (behind spots)
    drawDiffractionRays();
    
    // 5. Screen (structure)
    drawScreen();
    
    // 6. Distance arrow (dimension line)
    drawDistanceArrow();
    
    // 7. Diffraction spots (bright elements on top)
    drawDiffractionSpots();
    
    // 8. Measurement overlay if spot is selected (topmost)
    renderMeasurementOverlay();
}

/**
 * Update simulation with current parameters
 * Call this whenever wavelength or screen distance changes
 */
function updateSimulation() {
    drawSetup();
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Initialize event handlers and start simulation
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeMeasurementErrorFactor();
    initializeLayout();

    // Get UI elements
    const screenSlider = document.getElementById('screenSlider');
    const screenValueDisplay = document.getElementById('screenValue');

    // Restore prior experiment state before first render when available.
    if (
        hasPersistedExperiment &&
        typeof persistedScreenDistance === 'number' &&
        persistedScreenDistance >= SCREEN_MIN_DISTANCE_FROM_GRATING &&
        persistedScreenDistance <= SCREEN_MAX_DISTANCE_FROM_GRATING
    ) {
        updateScreenFromSlider(persistedScreenDistance);
    }

    drawSetup();

    // Initialize measurement display
    updateMeasurementDisplay();

    if (screenSlider) {
        screenSlider.value = screenDistance;
    }
    if (screenValueDisplay) {
        screenValueDisplay.textContent = screenDistance.toFixed(2);
    }

    if (hasPersistedExperiment) {
        const orderedEntries = Object.entries(persistedXmValues)
            .map(([key, value]) => [parseInt(key, 10), value])
            .filter(([order, value]) => Number.isInteger(order) && order >= 1 && order <= MAX_ORDER && typeof value === 'number' && value > 0)
            .sort((a, b) => a[0] - b[0]);

        orderedEntries.forEach(([order, xmMeters]) => {
            recordObservation(order, xmMeters, screenDistance);
        });
    }
    
    // ========================================================================
    // SLIDER CONTROL
    // ========================================================================
    
    if (screenSlider) {
        // Initialize slider with current distance
        screenSlider.value = screenDistance;
        screenSlider.min = SCREEN_MIN_DISTANCE_FROM_GRATING;
        screenSlider.max = SCREEN_MAX_DISTANCE_FROM_GRATING;
        
        screenSlider.addEventListener('input', function() {
            const newDistance = parseFloat(this.value);
            updateScreenFromSlider(newDistance);
            
            // Update display
            if (screenValueDisplay) {
                screenValueDisplay.textContent = screenDistance.toFixed(2);
            }
            
            // Redraw simulation
            updateSimulation();
            
            // Recalculate existing observations with new distance
            recalculateAllObservations();
            persistExperiment();
        });
    }
    
    // ========================================================================
    // MOUSE DRAG CONTROL
    // ========================================================================
    
    /**
     * Get mouse position relative to canvas
     */
    function getCanvasMousePosition(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
    
    /**
     * Handle mouse movement over canvas (for cursor and hover detection)
     */
    canvas.addEventListener('mousemove', function(event) {
        if (isDraggingScreen) return; // Handled by window listener during drag
        
        const pos = getCanvasMousePosition(event);
        
        // Update cursor based on hover state
        if (isMouseOverScreen(pos.x, pos.y)) {
            canvas.style.cursor = 'ew-resize';
        } else {
            canvas.style.cursor = 'default';
        }
    });
    
    /**
     * Start dragging screen
     */
    canvas.addEventListener('mousedown', function(event) {
        const pos = getCanvasMousePosition(event);
        
        if (isMouseOverScreen(pos.x, pos.y)) {
            isDraggingScreen = true;
            hasDragged = false;  // Reset drag flag
            dragStartMouseX = event.clientX;
            dragStartScreenX = screenX;
            canvas.style.cursor = 'ew-resize';
            event.preventDefault();
        }
    });
    
    /**
     * Handle click for spot measurement (only if not dragging)
     */
    canvas.addEventListener('click', function(event) {
        // Only handle click if we weren't dragging the screen
        if (!hasDragged) {
            const pos = getCanvasMousePosition(event);
            handleSpotClick(pos.x, pos.y);
        }
    });
    
    /**
     * Handle dragging (attached to window for smooth tracking)
     */
    window.addEventListener('mousemove', function(event) {
        if (!isDraggingScreen) return;
        
        // Calculate delta from drag start
        const deltaX = event.clientX - dragStartMouseX;
        
        // Mark as dragged if moved more than a few pixels
        if (Math.abs(deltaX) > 3) {
            hasDragged = true;
        }
        
        const newScreenX = dragStartScreenX + deltaX;
        
        // Update screen position with constraints
        updateScreenFromDrag(newScreenX);
        
        // Sync slider
        if (screenSlider) {
            screenSlider.value = screenDistance;
            if (screenValueDisplay) {
                screenValueDisplay.textContent = screenDistance.toFixed(2);
            }
        }
        
        // Redraw simulation in real time
        updateSimulation();
        persistExperiment();
    });
    
    /**
     * End dragging
     */
    window.addEventListener('mouseup', function(event) {
        if (isDraggingScreen) {
            isDraggingScreen = false;
            
            // Recalculate existing observations with new screen distance
            recalculateAllObservations();
            
            // Reset cursor if no longer over screen
            const rect = canvas.getBoundingClientRect();
            const pos = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            
            if (!isMouseOverScreen(pos.x, pos.y)) {
                canvas.style.cursor = 'default';
            }

            persistExperiment();
        }
    });
    
    // ========================================================================
    // WINDOW RESIZE
    // ========================================================================
    
    window.addEventListener('resize', function() {
        initializeLayout();
        drawSetup();
    });
    
    // ========================================================================
    // TABULAR COLUMN MANUAL INPUT
    // ========================================================================
    
    /**
     * Handle manual input in 2xm fields
     */
    const twoXmInputs = document.querySelectorAll('.two-xm-input');
    twoXmInputs.forEach(input => {
        input.addEventListener('input', function() {
            const order = parseInt(this.dataset.order);
            const twoXmCm = parseFloat(this.value);
            
            if (!isNaN(twoXmCm) && twoXmCm > 0) {
                // Calculate xm from 2xm
                const xmCm = twoXmCm / 2;
                const xmMeters = xmCm / 100;
                
                // Record observation with manually entered value
                recordObservation(order, xmMeters, screenDistance);
            }
        });
    });
    
    // ========================================================================
    // GLOBAL API
    // ========================================================================
    
    /**
     * Global function for external control of simulation parameters
     * @param {number} newWavelength - Wavelength in meters
     * @param {number} newScreenDistance - Screen distance in meters
     */
    window.updateDiffractionSimulation = function(newWavelength, newScreenDistance) {
        if (typeof newWavelength === 'number') {
            wavelength = newWavelength;
        }
        
        if (typeof newScreenDistance === 'number') {
            updateScreenFromSlider(newScreenDistance);
            
            // Sync slider
            if (screenSlider) {
                screenSlider.value = screenDistance;
                if (screenValueDisplay) {
                    screenValueDisplay.textContent = screenDistance.toFixed(2);
                }
            }
            
            // Recalculate existing observations with new parameters
            recalculateAllObservations();
        }
        
        updateSimulation();
        persistExperiment();
    };
});
