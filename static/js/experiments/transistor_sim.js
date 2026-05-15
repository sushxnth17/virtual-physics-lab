/* Transistor Characteristics (Common Emitter) - Visual Simulation
 * - Builds its own SVG circuit and live controls
 * - Calls backend endpoints only for transistor values
 * - Keeps legacy observation tables secondary and auto-filled only when empty
 */

let simulationState = {
    vbe: 0,
    vce: 0,
    ib: 40,
    mode: 'input',
    autoFill: false,
    inputData: [],
    outputData: {
        40: [],
        60: [],
        80: []
    },
    lastRecorded: {
        input: null,
        output: null
    }
};

let inputChart = null;
let outputChart = null;

const transistorRuntime = {
    dom: {},
    stylesInjected: false,
    loopRunning: false,
    loopFrameId: null,
    inFlight: false,
    requestSeq: 0,
    inputVbeValues: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8],
    outputVceValues: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    baseCurrents: [40, 60, 80],
    meterState: {
        ib: { display: 0, target: 0, max: 100 },
        ic: { display: 0, target: 0, max: 10 }
    },
    graphStartTime: performance.now(),
    currentFlow: {
        region: 'cutoff',
        speed: 0,
        active: false,
        dots: []
    },
    lastRecorded: {
        input: null,
        output: null
    },
    wirePaths: {
        base: [],
        collector: [],
        emitter: []
    },
    pathLengths: {
        base: 0,
        collector: 0,
        emitter: 0
    },
    chartsReady: false,
    hiddenLegacySections: false
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function snapToAllowedValue(value, allowedValues) {
    if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
        return value;
    }

    return allowedValues.reduce((closest, current) => {
        const currentDistance = Math.abs(num(current, value) - value);
        const closestDistance = Math.abs(num(closest, value) - value);
        return currentDistance < closestDistance ? current : closest;
    }, allowedValues[0]);
}

function num(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatValue(value, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function createSvgEl(tagName, attrs = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
}

function getEl(...ids) {
    for (const id of ids) {
        if (!id) {
            continue;
        }
        const element = document.getElementById(id);
        if (element) {
            return element;
        }
    }
    return null;
}

function ensureStyles() {
    if (transistorRuntime.stylesInjected) {
        return;
    }

    const style = document.createElement('style');
    style.textContent = `
        .transistor-sim-shell {
            margin: 10px 0 26px;
            padding: 18px;
            border-radius: 22px;
            background:
                radial-gradient(circle at top left, rgba(76, 173, 255, 0.18), transparent 36%),
                radial-gradient(circle at top right, rgba(47, 255, 167, 0.12), transparent 34%),
                linear-gradient(180deg, rgba(8, 14, 24, 0.96), rgba(11, 17, 30, 0.92));
            border: 1px solid rgba(120, 170, 255, 0.18);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255,255,255,0.03);
            color: #dce9ff;
        }

        .transistor-sim-header {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 14px;
            align-items: center;
            margin-bottom: 14px;
        }

        .transistor-sim-title {
            margin: 0;
            font-size: 22px;
            letter-spacing: 0.04em;
            color: #f4f8ff;
        }

        .transistor-sim-status {
            display: inline-flex;
            gap: 10px;
            align-items: center;
            padding: 10px 14px;
            border-radius: 999px;
            background: rgba(16, 26, 45, 0.7);
            border: 1px solid rgba(120, 170, 255, 0.18);
            box-shadow: inset 0 0 18px rgba(47, 255, 167, 0.05);
            font-size: 13px;
        }

        .transistor-status-chip {
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.08);
            color: #8fe7c3;
            font-weight: 700;
            letter-spacing: 0.03em;
        }

        .transistor-layout {
            display: grid;
            grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.9fr);
            gap: 18px;
            align-items: stretch;
        }

        .transistor-card {
            background: rgba(10, 18, 32, 0.72);
            border: 1px solid rgba(120, 170, 255, 0.16);
            border-radius: 18px;
            padding: 14px;
            box-shadow: inset 0 0 20px rgba(255,255,255,0.02);
        }

        .simulation-stage {
            min-height: 0;
            display: flex;
            flex-direction: column;
            align-self: stretch;
        }

        .knob-stack-card {
            padding: 0;
            background: transparent;
            border: none;
            box-shadow: none;
            align-self: stretch;
        }

        .control-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            width: 100%;
        }

        .knob-card {
            min-height: 100%;
            background: linear-gradient(180deg, rgba(13, 22, 39, 0.95), rgba(8, 15, 27, 0.95));
            border-radius: 16px;
            border: 1px solid rgba(120, 170, 255, 0.14);
            padding: 12px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.22);
        }

        .knob-card h4,
        .meter-card h4 {
            margin: 0 0 8px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #c7d8ff;
            text-align: center;
        }

        .knob-wrap {
            display: grid;
            place-items: center;
            gap: 8px;
        }

        .rotary-knob {
            width: 118px;
            height: 118px;
            border-radius: 50%;
            position: relative;
            background:
                radial-gradient(circle at 35% 35%, rgba(255,255,255,0.18), transparent 26%),
                radial-gradient(circle at center, #243246 0%, #0f1726 62%, #07101c 100%);
            border: 1px solid rgba(145, 190, 255, 0.28);
            box-shadow:
                0 0 0 5px rgba(20, 32, 52, 0.72),
                0 0 28px rgba(54, 150, 255, 0.14),
                inset 0 0 18px rgba(255,255,255,0.08);
            cursor: grab;
            user-select: none;
            touch-action: none;
        }

        .rotary-knob:active {
            cursor: grabbing;
        }

        .rotary-knob .knob-pointer {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 4px;
            height: 34px;
            background: linear-gradient(180deg, #75d2ff, #2fffa7);
            border-radius: 999px;
            transform-origin: 50% 90%;
            transform: translate(-50%, -88%) rotate(-90deg);
            filter: drop-shadow(0 0 8px rgba(47,255,167,0.8));
        }

        .rotary-knob .knob-cap {
            position: absolute;
            inset: 28px;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.14), rgba(255,255,255,0.04) 35%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.4));
            box-shadow: inset 0 0 18px rgba(0,0,0,0.28);
        }

        .knob-value {
            font-size: 14px;
            font-weight: 700;
            color: #e7f2ff;
            text-align: center;
        }

        .knob-readout {
            font-size: 12px;
            color: #8ea3c8;
            text-align: center;
        }

        .selector-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: flex-start;
            align-items: center;
        }

        .transistor-bottom-controls {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            grid-template-rows: auto auto;
            align-items: stretch;
            gap: 12px;
            padding: 8px 6px 0;
            width: 100%;
        }

        .control-box {
            background: rgba(10, 18, 32, 0.72);
            border: 1px solid rgba(120, 170, 255, 0.16);
            border-radius: 18px;
            padding: 12px;
            box-shadow: inset 0 0 20px rgba(255,255,255,0.02);
        }

        .selector-box {
            grid-column: 1;
            grid-row: 1;
            justify-self: stretch;
            width: 100%;
            max-width: 520px;
        }

        .mode-box {
            grid-column: 2;
            grid-row: 1;
            justify-self: stretch;
            width: 100%;
            max-width: 520px;
        }

        .record-row-bottom {
            grid-column: 1 / -1;
            grid-row: 2;
            display: flex;
            justify-content: center;
        }

        .record-row-bottom .mini-action {
            min-width: 170px;
        }

        .selector-buttons-bottom {
            justify-content: center;
        }

        .bottom-controls-mid {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-width: 0;
        }

        .mode-label {
            font-size: 12px;
            color: #c5d5f2;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            text-align: center;
        }

        .mode-switch-wrap {
            justify-content: center;
            align-items: center;
            gap: 8px;
            display: flex;
            flex-wrap: wrap;
        }

        .selector-buttons button,
        .mini-action {
            border: 1px solid rgba(120, 170, 255, 0.24) !important;
            background: linear-gradient(180deg, rgba(20, 31, 50, 0.95), rgba(12, 21, 36, 0.95)) !important;
            color: #d9e9ff !important;
            border-radius: 999px;
            padding: 10px 14px;
            cursor: pointer;
            box-shadow: inset 0 0 10px rgba(255,255,255,0.03), 0 4px 14px rgba(0,0,0,0.24) !important;
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .selector-buttons button:hover,
        .mini-action:hover {
            transform: translateY(-1px);
            box-shadow: 0 0 0 1px rgba(75, 173, 255, 0.2), 0 0 14px rgba(77, 166, 255, 0.12) !important;
            border-color: rgba(108, 178, 255, 0.34) !important;
        }

        .selector-buttons button.is-active {
            background: linear-gradient(180deg, rgba(45, 140, 235, 0.28), rgba(20, 34, 58, 0.95)) !important;
            border-color: rgba(104, 183, 255, 0.5) !important;
            color: #e7f3ff !important;
            box-shadow: 0 0 16px rgba(77,166,255,0.14), inset 0 0 10px rgba(255,255,255,0.05) !important;
        }

        .toggle-row {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 14px;
            margin-top: 12px;
            font-size: 13px;
            color: #c5d5f2;
            width: 100%;
        }

        .toggle-switch {
            position: relative;
            width: 54px;
            height: 28px;
            border-radius: 999px;
            background: rgba(109, 125, 152, 0.28);
            border: 1px solid rgba(180, 200, 230, 0.18);
            cursor: pointer;
            flex: 0 0 auto;
        }

        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .toggle-switch .thumb {
            position: absolute;
            left: 3px;
            top: 3px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: linear-gradient(180deg, #e8f4ff, #8dc4ff);
            box-shadow: 0 0 12px rgba(141,196,255,0.35);
            transition: transform 0.2s ease;
        }

        .toggle-switch.is-on {
            background: rgba(47,255,167,0.15);
            border-color: rgba(47,255,167,0.4);
        }

        .toggle-switch.is-on .thumb {
            transform: translateX(26px);
        }

        .mode-switch-wrap {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: flex-end;
            align-items: center;
        }

        /* Keep the selector controls aligned and compact */
        .control-grid {
            align-items: center;
        }

        .selector-card {
            gap: 12px;
        }

        .mode-switch-wrap {
            justify-content: center;
            align-items: center;
            gap: 8px;
            display: flex;
            flex-wrap: wrap;
        }

        .selector-card .toggle-row {
            grid-column: 3;
            grid-row: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .selector-card .toggle-row span {
            font-size: 12px;
            color: #c5d5f2;
            text-align: center;
        }

        .selector-card .toggle-row > span {
            min-width: 0;
        }

        .selector-card .record-row {
            grid-column: 1 / -1;
            grid-row: 2;
            display: flex;
            justify-content: center;
            width: 100%;
            margin-top: 0;
        }

        .selector-card .record-row .mini-action {
            min-width: 130px;
        }

        .transistor-sim-shell .transistor-layout {
            margin-bottom: 0;
        }

        .transistor-layout::after {
            content: '';
            grid-column: 1 / -1;
            display: none;
        }

        .mode-switch-wrap .mini-action.is-active {
            background: linear-gradient(180deg, rgba(77,166,255,0.28), rgba(18,32,56,0.95)) !important;
            border-color: rgba(102, 186, 255, 0.52) !important;
            color: #e8f4ff !important;
            box-shadow: 0 0 16px rgba(77,166,255,0.16), inset 0 0 10px rgba(255,255,255,0.06) !important;
        }

        .mode-helper {
            margin-top: 8px;
            font-size: 12px;
            color: #97a9c9;
            line-height: 1.5;
        }

        .selector-card .toggle-row:last-of-type {
            margin-bottom: 2px;
        }

        .rotary-knob.is-disabled,
        .mini-action.is-disabled {
            pointer-events: none;
            filter: grayscale(0.3) brightness(0.85);
            opacity: 0.6;
        }

        .table-block.is-hidden,
        .legacy-hidden {
            display: none !important;
        }

        .simulation-viewport {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
        }

        .circuit-frame {
            position: relative;
            padding: 10px 12px;
            border-radius: 18px;
            background:
                radial-gradient(circle at 50% 25%, rgba(47,255,167,0.06), transparent 24%),
                radial-gradient(circle at 75% 35%, rgba(77,166,255,0.08), transparent 20%),
                linear-gradient(180deg, rgba(7, 12, 20, 0.96), rgba(10, 16, 27, 0.92));
            border: 1px solid rgba(120, 170, 255, 0.16);
            overflow: hidden;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .circuit-frame svg {
            width: 100%;
            height: auto;
            max-height: 100%;
            display: block;
        }

        .meter-wrap {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }

        .analog-meter {
            display: grid;
            place-items: center;
            gap: 8px;
            padding: 10px;
            border-radius: 16px;
            background: rgba(11, 18, 30, 0.92);
            border: 1px solid rgba(120, 170, 255, 0.14);
        }

        .analog-meter svg {
            overflow: visible;
        }

        .meter-needle {
            transform-origin: 50% 50%;
            transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
            filter: drop-shadow(0 0 7px rgba(47,255,167,0.65));
        }

        .meter-label {
            font-size: 12px;
            color: #b8c9eb;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .live-readout {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            padding: 10px 12px;
            border-radius: 14px;
            background: rgba(14, 23, 39, 0.78);
            border: 1px solid rgba(120, 170, 255, 0.12);
            color: #dfe9ff;
            font-size: 13px;
        }

        .live-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.08);
        }

        .wire {
            stroke: rgba(172, 192, 223, 0.45);
            stroke-width: 4;
            fill: none;
            transition: stroke 0.2s ease, filter 0.2s ease, opacity 0.2s ease;
        }

        .wire.is-active {
            stroke: #2fffa7;
            filter: drop-shadow(0 0 7px rgba(47,255,167,0.85));
        }

        .wire.is-sat {
            stroke: #ffb347;
            filter: drop-shadow(0 0 7px rgba(255,179,71,0.85));
        }

        .wire.is-cutoff {
            opacity: 0.32;
            filter: none;
        }

        .transistor-core {
            transition: filter 0.2s ease, stroke 0.2s ease, fill 0.2s ease;
        }

        .transistor-core.is-active {
            filter: drop-shadow(0 0 14px rgba(47,255,167,0.24));
            stroke: #2fffa7;
        }

        .transistor-core.is-sat {
            filter: drop-shadow(0 0 14px rgba(255,179,71,0.24));
            stroke: #ffb347;
        }

        .transistor-core.is-cutoff {
            filter: none;
            stroke: rgba(190, 200, 214, 0.52);
        }

        .flow-dot {
            filter: drop-shadow(0 0 8px rgba(47,255,167,0.8));
            opacity: 0;
        }

        .flow-dot.is-visible {
            opacity: 1;
        }

        .flow-dot.is-sat {
            fill: #ffb347;
            filter: drop-shadow(0 0 8px rgba(255,179,71,0.9));
        }

        .flow-dot.is-active {
            fill: #2fffa7;
            filter: drop-shadow(0 0 8px rgba(47,255,167,0.9));
        }

        @media (max-width: 820px) {
            .transistor-layout {
                grid-template-columns: 1fr;
            }

            .transistor-bottom-controls {
                grid-template-columns: 1fr;
                justify-items: center;
                gap: 14px;
            }

            .selector-buttons-bottom {
                justify-content: center;
            }

            .bottom-controls-mid {
                width: 100%;
            }

            .record-row-bottom {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
    transistorRuntime.stylesInjected = true;
}

function hideLegacyBlocks() {
    document.querySelectorAll('#transistor-legacy-actions').forEach((el) => {
        el.classList.add('legacy-hidden');
    });
}

function buildSimulationShell() {
    const host = document.querySelector('.experiment-container');
    if (!host) {
        return;
    }

    let shell = document.getElementById('simulation-container');
    if (shell) {
        return;
    }

    shell = document.createElement('section');
    shell.id = 'simulation-container';
    shell.className = 'transistor-sim-shell';
    shell.innerHTML = `
        <div class="transistor-sim-header">
            <div>
                <h3 class="transistor-sim-title">Live Common Emitter Simulation</h3>
            </div>
            <div class="live-readout">
                <span class="live-pill">VBE: <strong id="live-vbe-value">0.00 V</strong></span>
                <span class="live-pill">VCE: <strong id="live-vce-value">0.00 V</strong></span>
                <span class="live-pill">IB: <strong id="live-ib-value">0.00 µA</strong></span>
                <span class="live-pill">IC: <strong id="live-ic-value">0.00 mA</strong></span>
            </div>
        </div>

        <div class="transistor-layout">
            <div class="transistor-card simulation-stage">
                <div class="circuit-frame">
                    <svg id="circuit-svg" viewBox="0 0 1200 460" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Transistor common emitter circuit">
                        <defs>
                            <filter id="glowGreen" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                            <filter id="glowOrange" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                            <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                                <path d="M0,0 L8,3 L0,6 Z" fill="#2fffa7"></path>
                            </marker>
                            <marker id="arrowOrange" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                                <path d="M0,0 L8,3 L0,6 Z" fill="#ffb347"></path>
                            </marker>
                        </defs>
                        <g id="wire-layer"></g>
                        <g id="flow-layer"></g>
                        <g id="circuit-elements"></g>
                    </svg>
                </div>

                <!-- Meters removed per user request -->
            </div>

            <div class="transistor-card knob-stack-card">
                <div class="control-grid">
                    <div class="knob-card">
                        <h4>VBE knob</h4>
                        <div class="knob-wrap">
                            <div id="vbe-knob" class="rotary-knob" data-min="0" data-max="0.8" data-value="0">
                                <div class="knob-pointer"></div>
                                <div class="knob-cap"></div>
                            </div>
                            <div class="knob-value" id="vbe-knob-value">0.00 V</div>
                            <div class="knob-readout">Range 0.00 to 0.80 V</div>
                        </div>
                    </div>
                    <div class="knob-card">
                        <h4>VCE knob</h4>
                        <div class="knob-wrap">
                            <div id="vce-knob" class="rotary-knob" data-min="0" data-max="1.0" data-value="0">
                                <div class="knob-pointer"></div>
                                <div class="knob-cap"></div>
                            </div>
                            <div class="knob-value" id="vce-knob-value">0.00 V</div>
                            <div class="knob-readout">Range 0.00 to 1.00 V</div>
                        </div>
                    </div>
                </div>

                <!-- lower live-readout badges removed per user request -->
            </div>
        </div>

        <div class="transistor-bottom-controls">
            <div class="control-box selector-box">
                <div class="bottom-controls-mid">
                <span class="mode-label">IB selectors</span>
                <div class="selector-buttons selector-buttons-bottom">
                <button type="button" class="mini-action is-active" data-ib="40">40 µA</button>
                <button type="button" class="mini-action" data-ib="60">60 µA</button>
                <button type="button" class="mini-action" data-ib="80">80 µA</button>
                </div>
                </div>
            </div>
            <div class="control-box mode-box">
                <div class="bottom-controls-mid">
                <span class="mode-label">Simulation mode</span>
                <div class="mode-switch-wrap" id="mode-switch-wrap">
                    <button type="button" class="mini-action is-active" data-mode="input">Input</button>
                    <button type="button" class="mini-action" data-mode="output">Output</button>
                </div>
                </div>
            </div>
            <div class="record-row record-row-bottom">
                <button type="button" id="record-reading-btn" class="mini-action">Record Reading</button>
            </div>
        </div>
    `;

    const sections = Array.from(host.querySelectorAll('section'));
    const procedureSection = sections.find((section) => {
        const heading = section.querySelector('h3');
        return heading && /procedure/i.test(heading.textContent || '');
    });

    if (procedureSection && procedureSection.nextSibling) {
        host.insertBefore(shell, procedureSection.nextSibling);
    } else if (procedureSection) {
        host.appendChild(shell);
    } else {
        host.appendChild(shell);
    }
}

function buildCircuitSvg() {
    const svg = document.getElementById('circuit-svg');
    if (!svg) {
        return;
    }

    const wireLayer = document.getElementById('wire-layer');
    const flowLayer = document.getElementById('flow-layer');
    const elementsLayer = document.getElementById('circuit-elements');
    if (!wireLayer || !flowLayer || !elementsLayer) {
        return;
    }

    wireLayer.innerHTML = '';
    flowLayer.innerHTML = '';
    elementsLayer.innerHTML = '';

    // Make the circuit occupy the frame more evenly (less dead space at bottom)
    const drawingTransform = 'translate(-90 -42) scale(1.12)';
    wireLayer.setAttribute('transform', drawingTransform);
    flowLayer.setAttribute('transform', drawingTransform);
    elementsLayer.setAttribute('transform', drawingTransform);

    const addLabel = (text, x, y, size = 18, anchor = 'middle') => {
        const label = createSvgEl('text', {
            x,
            y,
            fill: '#e9f4ff',
            'font-size': size,
            'font-weight': 700,
            'text-anchor': anchor
        });
        label.textContent = text;
        elementsLayer.appendChild(label);
    };

    addLabel('VBB', 84, 78, 18, 'start');
    addLabel('VCC', 956, 78, 18, 'start');
    addLabel('H', 360, 106, 16);
    addLabel('J', 360, 458, 16);
    addLabel('K', 860, 106, 16);
    addLabel('L', 860, 458, 16);

    const resistor = createSvgEl('path', {
        d: 'M170 120 L182 110 L194 130 L206 110 L218 130 L230 110 L242 130 L254 110 L266 130 L278 110 L290 120',
        fill: 'none',
        stroke: '#dce9ff',
        'stroke-width': 3.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
    });
    elementsLayer.appendChild(resistor);
    addLabel('R', 230, 92, 15);
    addLabel('33 KΩ', 230, 146, 15);

    const microA = createSvgEl('g', {});
    microA.appendChild(createSvgEl('circle', { cx: 430, cy: 120, r: 34, fill: 'rgba(18,29,47,0.92)', stroke: '#dce9ff', 'stroke-width': 3 }));
    const microAText = createSvgEl('text', { x: 430, y: 127, fill: '#e9f4ff', 'font-size': 18, 'text-anchor': 'middle', 'font-weight': 700 });
    microAText.textContent = 'µA';
    microA.appendChild(microAText);
    elementsLayer.appendChild(microA);

    const milliA = createSvgEl('g', {});
    milliA.appendChild(createSvgEl('circle', { cx: 760, cy: 120, r: 34, fill: 'rgba(18,29,47,0.92)', stroke: '#dce9ff', 'stroke-width': 3 }));
    const milliAText = createSvgEl('text', { x: 760, y: 127, fill: '#e9f4ff', 'font-size': 18, 'text-anchor': 'middle', 'font-weight': 700 });
    milliAText.textContent = 'mA';
    milliA.appendChild(milliAText);
    elementsLayer.appendChild(milliA);

    const vbeMeter = createSvgEl('g', {});
    vbeMeter.appendChild(createSvgEl('circle', { cx: 360, cy: 300, r: 32, fill: 'rgba(18,29,47,0.92)', stroke: '#dce9ff', 'stroke-width': 3 }));
    const vbeText = createSvgEl('text', { x: 360, y: 307, fill: '#e9f4ff', 'font-size': 15, 'text-anchor': 'middle', 'font-weight': 700 });
    vbeText.textContent = 'VBE';
    vbeMeter.appendChild(vbeText);
    addLabel('+', 360, 258, 14);
    addLabel('−', 360, 347, 14);
    elementsLayer.appendChild(vbeMeter);

    const vceMeter = createSvgEl('g', {});
    vceMeter.appendChild(createSvgEl('circle', { cx: 860, cy: 300, r: 32, fill: 'rgba(18,29,47,0.92)', stroke: '#dce9ff', 'stroke-width': 3 }));
    const vceText = createSvgEl('text', { x: 860, y: 307, fill: '#e9f4ff', 'font-size': 15, 'text-anchor': 'middle', 'font-weight': 700 });
    vceText.textContent = 'VCE';
    vceMeter.appendChild(vceText);
    addLabel('+', 860, 258, 14);
    addLabel('−', 860, 347, 14);
    elementsLayer.appendChild(vceMeter);

    const vbbSource = createSvgEl('g', { filter: 'url(#glowGreen)' });
    vbbSource.appendChild(createSvgEl('line', { x1: 104, y1: 258, x2: 136, y2: 232, stroke: '#2fffa7', 'stroke-width': 3 }));
    vbbSource.appendChild(createSvgEl('line', { x1: 98, y1: 266, x2: 144, y2: 224, stroke: '#2fffa7', 'stroke-width': 2.5, opacity: 0.9 }));
    vbbSource.appendChild(createSvgEl('line', { x1: 128, y1: 236, x2: 144, y2: 226, stroke: '#2fffa7', 'stroke-width': 2.5 }));
    elementsLayer.appendChild(vbbSource);

    const vcSource = createSvgEl('g', { filter: 'url(#glowOrange)' });
    vcSource.appendChild(createSvgEl('line', { x1: 964, y1: 258, x2: 996, y2: 232, stroke: '#ffb347', 'stroke-width': 3 }));
    vcSource.appendChild(createSvgEl('line', { x1: 958, y1: 266, x2: 1004, y2: 224, stroke: '#ffb347', 'stroke-width': 2.5, opacity: 0.9 }));
    vcSource.appendChild(createSvgEl('line', { x1: 988, y1: 236, x2: 1004, y2: 226, stroke: '#ffb347', 'stroke-width': 2.5 }));
    elementsLayer.appendChild(vcSource);

    const transistorGroup = createSvgEl('g', { id: 'transistor-group' });
    const transistorBody = createSvgEl('circle', {
        cx: 620,
        cy: 280,
        r: 52,
        fill: 'rgba(18, 29, 47, 0.95)',
        stroke: '#c7d8ff',
        'stroke-width': 4,
        class: 'transistor-core',
        id: 'transistor-body'
    });
    const baseLine = createSvgEl('line', { x1: 600, y1: 238, x2: 600, y2: 322, stroke: '#c7d8ff', 'stroke-width': 4.5, class: 'transistor-core', id: 'transistor-core' });
    const collectorInside = createSvgEl('line', { x1: 600, y1: 252, x2: 646, y2: 214, stroke: '#c7d8ff', 'stroke-width': 4.2, class: 'transistor-core' });
    const emitterInside = createSvgEl('line', { x1: 600, y1: 308, x2: 646, y2: 346, stroke: '#c7d8ff', 'stroke-width': 4.2, class: 'transistor-core' });
    const emitterArrow = createSvgEl('path', {
        d: 'M628 332 L651 351',
        fill: 'none',
        stroke: '#2fffa7',
        'stroke-width': 3.2,
        'marker-end': 'url(#arrowGreen)'
    });

    transistorGroup.appendChild(transistorBody);
    transistorGroup.appendChild(baseLine);
    transistorGroup.appendChild(collectorInside);
    transistorGroup.appendChild(emitterInside);
    transistorGroup.appendChild(emitterArrow);
    elementsLayer.appendChild(transistorGroup);

    addLabel('B', 584, 286, 15);
    addLabel('C', 652, 205, 15);
    addLabel('E', 652, 366, 15);
    addLabel('npn', 620, 352, 16);

    const wires = [
        [[120, 120], [170, 120]],
        [[290, 120], [360, 120]],
        [[360, 120], [396, 120]],
        [[464, 120], [520, 120], [520, 280], [600, 280]],
        [[646, 214], [646, 120], [726, 120]],
        [[794, 120], [860, 120], [980, 120]],
        [[120, 120], [120, 430]],
        [[980, 120], [980, 430]],
        [[360, 120], [360, 268]],
        [[360, 332], [360, 430]],
        [[860, 120], [860, 268]],
        [[860, 332], [860, 430]],
        [[646, 346], [646, 430]],
        [[120, 430], [980, 430]]
    ];

    wires.forEach((points, index) => {
        let d = `M ${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i += 1) {
            d += ` L ${points[i][0]} ${points[i][1]}`;
        }
        wireLayer.appendChild(createSvgEl('path', { d, class: 'wire', id: `wire-${index}` }));
    });

    transistorRuntime.wirePaths = {
        base: [[520, 280], [600, 280]],
        collector: [[646, 214], [646, 120], [860, 120]],
        emitter: [[646, 346], [646, 430], [860, 430]]
    };
    transistorRuntime.pathLengths = {
        base: 80,
        collector: 294,
        emitter: 298
    };

    // Flow dots and inline meter SVG removed per user request
}

function createFlowDot(layer, pathName) {
    const dot = createSvgEl('circle', {
        r: 6,
        fill: '#2fffa7',
        class: 'flow-dot',
        id: `flow-dot-${pathName}`
    });
    dot.dataset.path = pathName;
    layer.appendChild(dot);
    transistorRuntime.currentFlow.dots.push(dot);
}

function initializeDomReferences() {
    transistorRuntime.dom = {
        simulationContainer: document.getElementById('simulation-container'),
        vbeKnob: document.getElementById('vbe-knob'),
        vceKnob: document.getElementById('vce-knob'),
        autoFillToggle: document.getElementById('auto-fill-toggle'),
        autoFillWrap: document.getElementById('auto-fill-toggle-wrap'),
        recordReadingBtn: document.getElementById('record-reading-btn'),
        liveVbeValue: document.getElementById('live-vbe-value'),
        liveVceValue: document.getElementById('live-vce-value'),
        liveIbValue: document.getElementById('live-ib-value'),
        liveIcValue: document.getElementById('live-ic-value'),
        ibMeterReadout: document.getElementById('ib-meter-readout'),
        icMeterReadout: document.getElementById('ic-meter-readout'),
        regionDisplay: document.getElementById('region-display'),
        regionDetail: document.getElementById('region-detail'),
        inputPointCount: document.getElementById('input-point-count'),
        outputPointCount: document.getElementById('output-point-count'),
        inputGraph: document.getElementById('input-graph'),
        outputGraph: document.getElementById('output-graph'),
        plotGraphsBtn: document.getElementById('plot-graphs-btn'),
        calculateResultsBtn: document.getElementById('calculate-results-btn'),
        ibButtons: Array.from(document.querySelectorAll('[data-ib]')),
        modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
        inputTable: document.querySelector('.observation-table'),
        outputTable: document.querySelectorAll('.observation-table')[1] || null,
        inputTableBlock: document.getElementById('input-characteristics-table-block'),
        outputTableBlock: document.getElementById('output-characteristics-table-block'),
        modeHelper: document.getElementById('mode-helper')
    };
}

function updateKnobRotation(knob, value, min, max) {
    if (!knob) {
        return;
    }
    const pointer = knob.querySelector('.knob-pointer');
    const normalized = clamp((value - min) / ((max - min) || 1), 0, 1);
    const angle = -90 + normalized * 180;
    knob.dataset.value = String(value);
    if (pointer) {
        pointer.style.transform = `translate(-50%, -88%) rotate(${angle}deg)`;
    }

    const valueLabel = document.getElementById(`${knob.id}-value`);
    if (valueLabel) {
        valueLabel.textContent = `${formatValue(value, 2)} V`;
    }
}

function valueFromPointer(knob, event, min, max) {
    const rect = knob.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    // Map pointer position to knob rotation angle in degrees
    // Use a -90..90 degree sweep to match the visual pointer rotation
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    angle = clamp(angle, -90, 90);
    const normalized = (angle + 90) / 180; // 0..1 over -90..90
    return min + normalized * (max - min);
}

function bindKnob(knob, stateKey, min, max) {
    if (!knob) {
        return;
    }

    const allowedValues = stateKey === 'vbe'
        ? transistorRuntime.inputVbeValues
        : transistorRuntime.outputVceValues;

    let dragMode = null;
    let activePointerId = null;
    let angleOffset = 0;

    const angleFromEvent = (event) => {
        const rect = knob.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        return Math.atan2(dy, dx) * 180 / Math.PI;
    };

    const valueToAngle = (value) => {
        const normalized = clamp((value - min) / ((max - min) || 1), 0, 1);
        return -90 + normalized * 180;
    };

    const angleToValue = (angle) => {
        const clampedAngle = clamp(angle, -90, 90);
        const normalized = (clampedAngle + 90) / 180;
        return min + normalized * (max - min);
    };

    const applyAngleToState = (absoluteAngle) => {
        const rawValue = angleToValue(absoluteAngle);
        const nextValue = snapToAllowedValue(rawValue, allowedValues);
        simulationState[stateKey] = nextValue;
        updateKnobRotation(knob, nextValue, min, max);
        updateSimulationInstantFeedback();
    };

    const startDrag = (event, mode) => {
        if (knob.classList.contains('is-disabled')) {
            return;
        }

        event.preventDefault();
        dragMode = mode;

        const currentValue = Number(simulationState[stateKey]);
        const currentAngle = valueToAngle(Number.isFinite(currentValue) ? currentValue : min);
        const rect = knob.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const distance = Math.hypot(dx, dy);
        const radius = rect.width / 2;

        // Near-center clicks have unstable angle readings. Treat them as direct drag starts.
        if (distance < radius * 0.35) {
            angleOffset = 0;
        } else {
            const pointerAngle = clamp(angleFromEvent(event), -90, 90);
            angleOffset = currentAngle - pointerAngle;
        }

        if (mode === 'pointer') {
            activePointerId = event.pointerId;
            try {
                knob.setPointerCapture?.(event.pointerId);
            } catch (e) {
                // ignore capture failures
            }
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        } else {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
    };

    const stopDrag = () => {
        dragMode = null;
        activePointerId = null;
        angleOffset = 0;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };

    const onPointerMove = (event) => {
        if (dragMode !== 'pointer' || event.pointerId !== activePointerId) {
            return;
        }
        const pointerAngle = clamp(angleFromEvent(event), -90, 90);
        applyAngleToState(pointerAngle + angleOffset);
    };

    const onPointerUp = (event) => {
        if (dragMode !== 'pointer' || event.pointerId !== activePointerId) {
            return;
        }
        try {
            knob.releasePointerCapture?.(event.pointerId);
        } catch (e) {
            // ignore release failures
        }
        stopDrag();
    };

    const onMouseMove = (event) => {
        if (dragMode !== 'mouse') {
            return;
        }
        const pointerAngle = clamp(angleFromEvent(event), -90, 90);
        applyAngleToState(pointerAngle + angleOffset);
    };

    const onMouseUp = () => {
        if (dragMode !== 'mouse') {
            return;
        }
        stopDrag();
    };

    knob.addEventListener('pointerdown', (event) => {
        startDrag(event, 'pointer');
    });

    knob.addEventListener('mousedown', (event) => {
        if (window.PointerEvent) {
            return;
        }
        startDrag(event, 'mouse');
    });
}

function bindControls() {
    const { vbeKnob, vceKnob, autoFillToggle, autoFillWrap, ibButtons, modeButtons, recordReadingBtn, plotGraphsBtn, calculateResultsBtn } = transistorRuntime.dom;

    bindKnob(vbeKnob, 'vbe', 0, 0.8);
    bindKnob(vceKnob, 'vce', 0, 1.0);

    ibButtons.forEach((button) => {
        button.addEventListener('click', () => {
            simulationState.ib = num(button.dataset.ib, 40);
            ibButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
            updateSimulationInstantFeedback();
        });
    });

    modeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            setSimulationMode(button.dataset.mode || 'input');
        });
    });

    if (autoFillToggle) {
        autoFillToggle.addEventListener('change', () => {
            simulationState.autoFill = Boolean(autoFillToggle.checked);
            if (autoFillWrap) {
                autoFillWrap.classList.toggle('is-on', simulationState.autoFill);
            }
            updateSimulationInstantFeedback();
        });
    }

    if (recordReadingBtn) {
        recordReadingBtn.addEventListener('click', () => recordReading(true));
    }

    if (plotGraphsBtn) {
        plotGraphsBtn.addEventListener('click', plotGraphsFromTableData);
    }

    if (calculateResultsBtn) {
        calculateResultsBtn.addEventListener('click', calculateResultsFromTableData);
    }
}

function setSimulationMode(mode) {
    const previousMode = simulationState.mode;
    simulationState.mode = mode === 'output' ? 'output' : 'input';

    transistorRuntime.dom.modeButtons.forEach((button) => {
        button.classList.toggle('is-active', (button.dataset.mode || 'input') === simulationState.mode);
    });

    if (transistorRuntime.dom.vbeKnob) {
        transistorRuntime.dom.vbeKnob.classList.toggle('is-disabled', simulationState.mode === 'output');
    }
    if (transistorRuntime.dom.vceKnob) {
        transistorRuntime.dom.vceKnob.classList.toggle('is-disabled', simulationState.mode === 'input');
    }

    if (transistorRuntime.dom.inputTableBlock) {
        transistorRuntime.dom.inputTableBlock.classList.toggle('is-hidden', simulationState.mode === 'output');
    }
    if (transistorRuntime.dom.outputTableBlock) {
        transistorRuntime.dom.outputTableBlock.classList.toggle('is-hidden', simulationState.mode === 'input');
    }

    if (transistorRuntime.dom.modeHelper) {
        transistorRuntime.dom.modeHelper.textContent = simulationState.mode === 'input'
            ? 'Input mode keeps VCE constant at 2.0 V and records the VBE sweep.'
            : 'Output mode keeps IB fixed and records the VCE sweep for the selected base current.';
    }

    if (simulationState.mode === 'input') {
        simulationState.vce = 2.0;
        updateKnobRotation(transistorRuntime.dom.vceKnob, 0, 0, 1.0);
        const vceValue = document.getElementById('live-vce-value');
        if (vceValue) {
            vceValue.textContent = '2.00 V';
        }
    } else if (previousMode !== 'output') {
        simulationState.vce = 0;
        updateKnobRotation(transistorRuntime.dom.vceKnob, 0, 0, 1.0);
    }

    updateSimulationInstantFeedback();
}

function updateSimulationInstantFeedback() {
    const { vbeKnob, vceKnob, liveVbeValue, liveVceValue, regionDisplay } = transistorRuntime.dom;
    if (vbeKnob) {
        simulationState.vbe = snapToAllowedValue(simulationState.vbe, transistorRuntime.inputVbeValues);
        updateKnobRotation(vbeKnob, simulationState.vbe, 0, 0.8);
    }
    if (vceKnob) {
        if (simulationState.mode === 'input') {
            simulationState.vce = 2.0;
            updateKnobRotation(vceKnob, 0, 0, 1.0);
        } else {
            simulationState.vce = snapToAllowedValue(simulationState.vce, transistorRuntime.outputVceValues);
            updateKnobRotation(vceKnob, simulationState.vce, 0, 1.0);
        }
    }
    if (liveVbeValue) {
        liveVbeValue.textContent = `${formatValue(simulationState.vbe, 2)} V`;
    }
    if (liveVceValue) {
        liveVceValue.textContent = simulationState.mode === 'input'
            ? '2.00 V'
            : `${formatValue(simulationState.vce, 2)} V`;
    }
    if (regionDisplay) {
        regionDisplay.textContent = simulationState.mode === 'input' ? 'INPUT MODE' : 'OUTPUT MODE';
    }
    const autoChip = document.getElementById('auto-state-chip');
    if (autoChip) {
        autoChip.textContent = simulationState.autoFill ? 'AUTO-FILL ON' : 'AUTO-FILL OFF';
    }
}

function findTableCellsByVbe(vbe) {
    const key = formatTableKey(vbe);
    const cell = document.getElementById(`ib-${key}`) || document.getElementById(`ib-${vbe}`);
    return cell;
}

function findTableCellsByVce(ib, vce) {
    const key = formatTableKey(vce);
    return document.getElementById(`ic-${ib}-${key}`) || document.getElementById(`ic-${ib}-${vce}`);
}

function formatTableKey(value) {
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric)) {
        return String(value);
    }
    return numeric.toString();
}

function recordReading(force = false) {
    const ibVal = transistorRuntime.meterState.ib.display;
    const icVal = transistorRuntime.meterState.ic.display;

    if (simulationState.mode === 'input') {
        writeInputTableValue(simulationState.vbe, ibVal, force);
    } else {
        writeOutputTableValue(simulationState.ib, simulationState.vce, icVal, force);
    }
}

async function fetchInput(vbe) {
    const response = await fetch('/api/transistor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ v_be: vbe, v_ce: 2.0 })
    });

    if (!response.ok) {
        throw new Error(`Input endpoint failed with HTTP ${response.status}`);
    }
    const payload = await response.json();
    return payload.input_characteristics || payload;
}

async function fetchOutput(ib, vce) {
    const response = await fetch('/api/transistor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ i_b: ib, v_ce: vce })
    });

    if (!response.ok) {
        throw new Error(`Output endpoint failed with HTTP ${response.status}`);
    }
    const payload = await response.json();
    return payload.output_characteristics || payload;
}

function ensureCharts() {
    if (typeof Chart === 'undefined') {
        return;
    }

    if (!inputChart && transistorRuntime.dom.inputGraph) {
        inputChart = new Chart(transistorRuntime.dom.inputGraph.getContext('2d'), {
            type: 'line',
            data: {
                datasets: [{
                    label: 'IB vs VBE',
                    data: simulationState.inputData,
                    parsing: false,
                    borderColor: '#2fffa7',
                    backgroundColor: 'rgba(47,255,167,0.16)',
                    pointBackgroundColor: '#2fffa7',
                    pointBorderColor: '#eaf6ff',
                    pointRadius: 3,
                    tension: 0.35,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                animation: { duration: 180 },
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'VBE (V)' }, grid: { color: 'rgba(140,170,210,0.12)' } },
                    y: { title: { display: true, text: 'IB (µA)' }, grid: { color: 'rgba(140,170,210,0.12)' } }
                },
                plugins: { legend: { labels: { color: '#dce9ff' } } }
            }
        });
    }

    if (!outputChart && transistorRuntime.dom.outputGraph) {
        outputChart = new Chart(transistorRuntime.dom.outputGraph.getContext('2d'), {
            type: 'line',
            data: {
                datasets: transistorRuntime.baseCurrents.map((ib, index) => ({
                    label: `IB = ${ib} µA`,
                    data: simulationState.outputData[ib],
                    parsing: false,
                    borderColor: ['#2fffa7', '#4da6ff', '#ffb347'][index],
                    backgroundColor: 'transparent',
                    pointBackgroundColor: ['#2fffa7', '#4da6ff', '#ffb347'][index],
                    pointBorderColor: '#eaf6ff',
                    pointRadius: 3,
                    tension: 0.3,
                    fill: false
                }))
            },
            options: {
                responsive: true,
                animation: { duration: 180 },
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'VCE (V)' }, grid: { color: 'rgba(140,170,210,0.12)' } },
                    y: { title: { display: true, text: 'IC (mA)' }, grid: { color: 'rgba(140,170,210,0.12)' } }
                },
                plugins: { legend: { labels: { color: '#dce9ff' } } }
            }
        });
    }

    transistorRuntime.chartsReady = true;
}

function trimArray(array, limit = 120) {
    while (array.length > limit) {
        array.shift();
    }
}

function pushGraphPoint(series, point) {
    if (!Array.isArray(series) || !point) {
        return;
    }

    const normalizedX = num(point.x, NaN);
    if (!Number.isFinite(normalizedX)) {
        return;
    }

    const normalizedPoint = {
        x: normalizedX,
        y: num(point.y, 0)
    };

    const existingIndex = series.findIndex((entry) => Number.isFinite(num(entry?.x, NaN)) && Math.abs(num(entry.x, NaN) - normalizedX) < 1e-6);
    if (existingIndex >= 0) {
        series[existingIndex] = normalizedPoint;
    } else {
        series.push(normalizedPoint);
    }

    series.sort((a, b) => num(a.x, 0) - num(b.x, 0));
    trimArray(series);
}

function getClosestValue(target, values) {
    if (!values.length) {
        return target;
    }

    let closest = values[0];
    let distance = Math.abs(num(values[0], target) - target);
    values.forEach((value) => {
        const currentDistance = Math.abs(num(value, target) - target);
        if (currentDistance < distance) {
            closest = value;
            distance = currentDistance;
        }
    });

    return num(closest, target);
}

function findMatchingTableInput(selector, attributeName, target, extraAttributeName = null, extraAttributeValue = null) {
    const inputs = Array.from(document.querySelectorAll(selector));
    return inputs.find((input) => {
        const valueMatches = Math.abs(num(input.dataset[attributeName], NaN) - target) < 1e-6;
        if (!valueMatches) {
            return false;
        }
        if (!extraAttributeName) {
            return true;
        }
        return Math.abs(num(input.dataset[extraAttributeName], NaN) - extraAttributeValue) < 1e-6;
    }) || null;
}

function parseTableNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function readInputTableData() {
    return Array.from(document.querySelectorAll('.transistor-ib-input'))
        .map((input) => ({
            vbe: parseTableNumber(input.dataset.vbe),
            ib: parseTableNumber(input.value)
        }))
        .filter((row) => row.vbe !== null && row.ib !== null && row.ib >= 0)
        .sort((a, b) => a.vbe - b.vbe);
}

function readOutputTableData() {
    const outputData = {
        40: [],
        60: [],
        80: []
    };

    Array.from(document.querySelectorAll('.transistor-ic-input')).forEach((input) => {
        const vce = parseTableNumber(input.dataset.vce);
        const ib = parseTableNumber(input.dataset.ib);
        const ic = parseTableNumber(input.value);
        if (vce === null || ib === null || ic === null || ic < 0) {
            return;
        }
        if (!outputData[ib]) {
            outputData[ib] = [];
        }
        outputData[ib].push({ vce, ic });
    });

    Object.values(outputData).forEach((series) => series.sort((a, b) => a.vce - b.vce));
    return outputData;
}

function setChartMessage(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return;
    }

    const chartFrame = canvas.closest('.chart-frame');
    if (!chartFrame) {
        return;
    }

    let messageNode = chartFrame.querySelector('.transistor-chart-message');
    if (!messageNode) {
        messageNode = document.createElement('div');
        messageNode.className = 'transistor-chart-message';
        messageNode.style.marginTop = '10px';
        messageNode.style.fontSize = '13px';
        messageNode.style.color = '#c7d8ff';
        chartFrame.appendChild(messageNode);
    }

    messageNode.textContent = message || '';
}

function plotGraphsFromTableData() {
    const inputData = readInputTableData();
    const outputData = readOutputTableData();
    const hasOutputPoints = Object.values(outputData).some((series) => series.length > 0);

    if (!inputData.length && !hasOutputPoints) {
        setChartMessage('input-graph', 'Enter table values first, then plot the graphs.');
        setChartMessage('output-graph', 'Enter table values first, then plot the graphs.');
        return;
    }

    simulationState.inputData = inputData.map((row) => ({ x: row.vbe, y: row.ib }));
    simulationState.outputData = {
        40: (outputData[40] || []).map((row) => ({ x: row.vce, y: row.ic })),
        60: (outputData[60] || []).map((row) => ({ x: row.vce, y: row.ic })),
        80: (outputData[80] || []).map((row) => ({ x: row.vce, y: row.ic }))
    };

    ensureCharts();
    updateCharts();
    setChartMessage('input-graph', inputData.length ? 'Input characteristic plotted from the filled VBE / IB table.' : 'Input table is empty.');
    setChartMessage('output-graph', hasOutputPoints ? 'Output characteristics plotted from the filled VCE / IC table.' : 'Output table is empty.');
}

function findOutputRowWithAllCurrents() {
    const rows = new Map();

    Array.from(document.querySelectorAll('.transistor-ic-input')).forEach((input) => {
        const vce = parseTableNumber(input.dataset.vce);
        const ib = parseTableNumber(input.dataset.ib);
        const ic = parseTableNumber(input.value);
        if (vce === null || ib === null || ic === null || ic < 0) {
            return;
        }

        const rowKey = vce.toFixed(2);
        if (!rows.has(rowKey)) {
            rows.set(rowKey, { vce, values: {} });
        }
        rows.get(rowKey).values[ib] = ic;
    });

    const orderedRows = Array.from(rows.values()).sort((a, b) => a.vce - b.vce);
    return orderedRows.find((row) => row.values[40] !== undefined && row.values[60] !== undefined && row.values[80] !== undefined) || null;
}

function readCellNumericValue(cellId) {
    const cell = document.getElementById(cellId);
    if (!cell) {
        return null;
    }

    const rawValue = cell.value ?? cell.textContent ?? cell.innerText ?? '';
    const parsed = Number.parseFloat(String(rawValue).trim());
    return Number.isFinite(parsed) ? parsed : null;
}

async function calculateResultsFromTableData() {
    const i_b1 = 40;
    const i_b2 = 60;
    const i_c1 = readCellNumericValue('ic-40-0.5');
    const i_c2 = readCellNumericValue('ic-60-0.5');
    const i_b = readCellNumericValue('ib-0.6');

    if (i_c1 === null || i_c2 === null || i_b === null) {
        setChartMessage('input-graph', 'Fill ic-40-0.5, ic-60-0.5, and ib-0.6 before calculating.');
        setChartMessage('output-graph', 'Missing table values for calculation.');
        return;
    }

    try {
        const response = await fetch('/transistor/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                i_c1: i_c1,
                i_c2: i_c2,
                i_b1: i_b1,
                i_b2: i_b2,
                v_be: 0.6,
                i_b: i_b,
                i_c_unit: 'mA',
                i_b_unit: 'uA'
            })
        });

        if (!response.ok) {
            throw new Error(`Calculate endpoint failed with HTTP ${response.status}`);
        }

        const result = await response.json();
        const betaValue = document.getElementById('beta-value');
        const alphaValue = document.getElementById('alpha-value');
        const rinValue = document.getElementById('rin-value');

        if (betaValue) {
            betaValue.innerText = Number(result.beta).toFixed(2);
        }
        if (alphaValue) {
            alphaValue.innerText = Number(result.alpha).toFixed(4);
        }
        if (rinValue) {
            rinValue.innerText = Number(result.input_resistance).toFixed(2);
        }

        setChartMessage('input-graph', 'Results calculated from the filled table values.');
        setChartMessage('output-graph', 'Beta calculated from ic-40-0.5 and ic-60-0.5.');
    } catch (error) {
        console.error('[transistor] calculate failed', error);
        setChartMessage('input-graph', 'Calculation failed. Check the table values and try again.');
        setChartMessage('output-graph', 'Calculation failed.');
    }
}

function writeInputTableValue(vbe, ibVal, force = false) {
    const snappedVbe = getClosestValue(vbe, transistorRuntime.inputVbeValues);
    const cell = findMatchingTableInput('.transistor-ib-input', 'vbe', snappedVbe);
    if (!cell) {
        return;
    }

    const recordKey = `input:${snappedVbe}`;
    if (!force && simulationState.lastRecorded.input === recordKey && !simulationState.autoFill) {
        return;
    }

    cell.value = formatValue(ibVal, 4);
    if (simulationState.lastRecorded.input !== recordKey) {
        simulationState.lastRecorded.input = recordKey;
        pushGraphPoint(simulationState.inputData, { x: snappedVbe, y: ibVal });
    }
}

function writeOutputTableValue(ib, vce, icVal, force = false) {
    const snappedVce = getClosestValue(vce, transistorRuntime.outputVceValues);
    const cell = findMatchingTableInput('.transistor-ic-input', 'vce', snappedVce, 'ib', ib);
    if (!cell) {
        return;
    }

    const recordKey = `output:${ib}:${snappedVce}`;
    if (!force && simulationState.lastRecorded.output === recordKey && !simulationState.autoFill) {
        return;
    }

    cell.value = formatValue(icVal, 4);
    if (simulationState.lastRecorded.output !== recordKey) {
        simulationState.lastRecorded.output = recordKey;
        pushGraphPoint(simulationState.outputData[ib], { x: snappedVce, y: icVal });
    }
}

function updateCharts() {
    ensureCharts();
    if (inputChart) {
        inputChart.data.datasets[0].data = simulationState.inputData;
        inputChart.update('none');
    }
    if (outputChart) {
        outputChart.data.datasets.forEach((dataset, index) => {
            dataset.data = simulationState.outputData[transistorRuntime.baseCurrents[index]];
        });
        outputChart.update('none');
    }

    const inputCount = getEl('input-point-count');
    const outputCount = getEl('output-point-count');
    if (inputCount) {
        inputCount.textContent = String(simulationState.inputData.length);
    }
    if (outputCount) {
        const total = transistorRuntime.baseCurrents.reduce((sum, ib) => sum + (simulationState.outputData[ib] || []).length, 0);
        outputCount.textContent = String(total);
    }
}

function appendToLegacyTable(vbe, ibVal, vce, icVal) {
    const inputTableCell = document.getElementById(`ib-${vbe}`);
    if (inputTableCell && simulationState.autoFill && String(inputTableCell.value || '').trim() === '') {
        inputTableCell.value = formatValue(ibVal, 4);
    }

    const outputTableCell = document.getElementById(`ic-${simulationState.ib}-${vce}`);
    if (outputTableCell && simulationState.autoFill && String(outputTableCell.value || '').trim() === '') {
        outputTableCell.value = formatValue(icVal, 4);
    }
}

function setMeterTarget(id, value, max) {
    const meter = transistorRuntime.meterState[id];
    if (!meter) {
        return;
    }
    meter.target = clamp(num(value, 0), 0, max);
    meter.max = max;
}

function tickMeters() {
    const ib = transistorRuntime.meterState.ib;
    const ic = transistorRuntime.meterState.ic;

    ib.display += (ib.target - ib.display) * 0.14;
    ic.display += (ic.target - ic.display) * 0.14;

    const ibNeedle = document.getElementById('ib-meter-needle');
    const icNeedle = document.getElementById('ic-meter-needle');
    if (ibNeedle) {
        ibNeedle.style.transform = `rotate(${clamp(-90 + (ib.display / ib.max) * 180, -90, 90)}deg)`;
    }
    if (icNeedle) {
        icNeedle.style.transform = `rotate(${clamp(-90 + (ic.display / ic.max) * 180, -90, 90)}deg)`;
    }

    const ibReadout = document.getElementById('ib-meter-readout');
    const icReadout = document.getElementById('ic-meter-readout');
    if (ibReadout) {
        ibReadout.textContent = `${formatValue(ib.display, 2)} µA`;
    }
    if (icReadout) {
        icReadout.textContent = `${formatValue(ic.display, 2)} mA`;
    }
}

function setCircuitRegion(region) {
    const normalized = String(region || 'cutoff').toLowerCase();
    const core = document.getElementById('transistor-core');
    const body = document.getElementById('transistor-body');
    const wireNodes = Array.from(document.querySelectorAll('.wire'));

    wireNodes.forEach((wire) => {
        wire.classList.remove('is-active', 'is-sat', 'is-cutoff');
        if (normalized === 'active') {
            wire.classList.add('is-active');
        } else if (normalized === 'saturation') {
            wire.classList.add('is-sat');
        } else {
            wire.classList.add('is-cutoff');
        }
    });

    [core, body].forEach((node) => {
        if (!node) {
            return;
        }
        node.classList.remove('is-active', 'is-sat', 'is-cutoff');
        if (normalized === 'active') {
            node.classList.add('is-active');
        } else if (normalized === 'saturation') {
            node.classList.add('is-sat');
        } else {
            node.classList.add('is-cutoff');
        }
    });

    const regionLabel = document.getElementById('region-display');
    const regionDetail = document.getElementById('region-detail');
    if (regionLabel) {
        regionLabel.textContent = normalized.toUpperCase();
    }
    if (regionDetail) {
        regionDetail.textContent = normalized.toUpperCase();
    }
}

function buildFlowDots(region, icValue, elapsedMs) {
    const flow = transistorRuntime.currentFlow;
    flow.region = String(region || 'cutoff').toLowerCase();
    flow.active = flow.region !== 'cutoff';
    flow.speed = flow.region === 'saturation'
        ? clamp(1.6 + icValue * 0.22, 1.6, 4.5)
        : flow.region === 'active'
            ? clamp(0.9 + icValue * 0.1, 0.9, 2.8)
            : 0;

    const flowLayerDots = Array.from(document.querySelectorAll('.flow-dot'));
    const activeColorClass = flow.region === 'saturation' ? 'is-sat' : 'is-active';

    flowLayerDots.forEach((dot, index) => {
        if (!flow.active) {
            dot.classList.remove('is-visible', 'is-active', 'is-sat');
            return;
        }
        dot.classList.add('is-visible');
        dot.classList.remove('is-active', 'is-sat');
        dot.classList.add(activeColorClass);
        const pathName = dot.dataset.path;
        const pathPoints = transistorRuntime.wirePaths[pathName] || [];
        const totalLength = transistorRuntime.pathLengths[pathName] || 1;
        const phaseOffset = (index / flowLayerDots.length) * totalLength * 0.65;
        const progress = ((elapsedMs * flow.speed * 0.08) + phaseOffset) % totalLength;
        const point = pointOnPolyline(pathPoints, progress, totalLength);
        if (point) {
            dot.setAttribute('cx', String(point.x));
            dot.setAttribute('cy', String(point.y));
        }
    });
}

function pointOnPolyline(points, distance, totalLength) {
    if (!points.length) {
        return null;
    }
    if (points.length === 1) {
        return { x: points[0][0], y: points[0][1] };
    }

    let travelled = 0;
    for (let i = 1; i < points.length; i += 1) {
        const [x1, y1] = points[i - 1];
        const [x2, y2] = points[i];
        const segmentLength = Math.hypot(x2 - x1, y2 - y1);
        if (travelled + segmentLength >= distance) {
            const local = segmentLength === 0 ? 0 : (distance - travelled) / segmentLength;
            return {
                x: x1 + (x2 - x1) * local,
                y: y1 + (y2 - y1) * local
            };
        }
        travelled += segmentLength;
    }

    const last = points[points.length - 1];
    return { x: last[0], y: last[1] };
}

function updateLiveReadouts(ibVal, icVal) {
    const liveIb = document.getElementById('live-ib-value');
    const liveIc = document.getElementById('live-ic-value');
    const autoChip = document.getElementById('auto-state-chip');
    if (liveIb) {
        liveIb.textContent = `${formatValue(ibVal, 2)} µA`;
    }
    if (liveIc) {
        liveIc.textContent = `${formatValue(icVal, 2)} mA`;
    }
    if (autoChip) {
        autoChip.textContent = simulationState.autoFill ? 'AUTO-FILL ON' : 'AUTO-FILL OFF';
    }
}

async function stepSimulation(timestamp) {
    if (transistorRuntime.inFlight) {
        tickMeters();
        buildFlowDots(transistorRuntime.currentFlow.region, transistorRuntime.meterState.ic.display, timestamp || performance.now());
        return;
    }

    transistorRuntime.inFlight = true;
    const requestStamp = ++transistorRuntime.requestSeq;
    const currentVbe = simulationState.vbe;
    const currentVce = simulationState.vce;
    const currentIb = simulationState.ib;

    try {
        const [inputRes, outputRes] = await Promise.all([
            fetchInput(currentVbe),
            fetchOutput(currentIb, currentVce)
        ]);

        if (requestStamp !== transistorRuntime.requestSeq) {
            return;
        }

        const ibVal = num(inputRes.i_b_microamp, 0);
        const icVal = num(outputRes.i_c_milliamp, 0);
        const region = String(outputRes.region || inputRes.region || 'cutoff').toLowerCase();

        transistorRuntime.dom.liveVbeValue.textContent = `${formatValue(currentVbe, 2)} V`;
        transistorRuntime.dom.liveVceValue.textContent = `${formatValue(currentVce, 2)} V`;

        updateLiveReadouts(ibVal, icVal);
        setMeterTarget('ib', ibVal, 100);
        setMeterTarget('ic', icVal, 10);
        setCircuitRegion(region);

        if (simulationState.mode === 'input') {
            writeInputTableValue(currentVbe, ibVal, false);
        } else {
            writeOutputTableValue(currentIb, currentVce, icVal, false);
        }

        updateCharts();
        updateSimulationInfo(region, ibVal, icVal);
        buildFlowDots(region, icVal, timestamp || performance.now());
    } catch (error) {
        console.error('[transistor] live simulation step failed', error);
    } finally {
        transistorRuntime.inFlight = false;
    }
}

function updateSimulationInfo(region, ibVal, icVal) {
    const regionDetail = document.getElementById('region-detail');
    if (regionDetail) {
        regionDetail.textContent = String(region || 'cutoff').toUpperCase();
    }
    const chip = document.getElementById('region-display');
    if (chip) {
        chip.textContent = String(region || 'cutoff').toUpperCase();
    }
    const countEl = document.getElementById('output-point-count');
    if (countEl) {
        const total = transistorRuntime.baseCurrents.reduce((sum, ib) => sum + (simulationState.outputData[ib] || []).length, 0);
        countEl.textContent = String(total);
    }
    updateLiveReadouts(ibVal, icVal);
}

function simulationLoop(timestamp) {
    tickMeters();
    buildFlowDots(transistorRuntime.currentFlow.region, transistorRuntime.meterState.ic.display, timestamp || performance.now());
    if (transistorRuntime.loopRunning) {
        stepSimulation(timestamp);
        transistorRuntime.loopFrameId = requestAnimationFrame(simulationLoop);
    }
}

function startSimulationLoop() {
    if (transistorRuntime.loopRunning) {
        return;
    }
    transistorRuntime.loopRunning = true;
    transistorRuntime.loopFrameId = requestAnimationFrame(simulationLoop);
}

function stopSimulationLoop() {
    transistorRuntime.loopRunning = false;
    if (transistorRuntime.loopFrameId !== null) {
        cancelAnimationFrame(transistorRuntime.loopFrameId);
        transistorRuntime.loopFrameId = null;
    }
}

function initializeStateFromDom() {
    const { vbeKnob, vceKnob, autoFillToggle } = transistorRuntime.dom;
    if (vbeKnob) {
        simulationState.vbe = num(vbeKnob.dataset.value, 0);
    }
    if (vceKnob) {
        simulationState.vce = 2.0;
    }
    if (autoFillToggle) {
        simulationState.autoFill = true;
        autoFillToggle.checked = true;
        if (transistorRuntime.dom.autoFillWrap) {
            transistorRuntime.dom.autoFillWrap.classList.add('is-on');
        }
    }
}

function resetSimulation() {
    simulationState = {
        vbe: 0,
        vce: 2.0,
        ib: 40,
        mode: 'input',
        autoFill: true,
        inputData: [],
        outputData: { 40: [], 60: [], 80: [] },
        lastRecorded: { input: null, output: null }
    };

    transistorRuntime.meterState.ib.display = 0;
    transistorRuntime.meterState.ib.target = 0;
    transistorRuntime.meterState.ic.display = 0;
    transistorRuntime.meterState.ic.target = 0;
    transistorRuntime.currentFlow.region = 'cutoff';
    transistorRuntime.currentFlow.speed = 0;

    const inputGraph = inputChart;
    const outputGraph = outputChart;
    if (inputGraph) {
        inputGraph.data.datasets[0].data = [];
        inputGraph.update('none');
    }
    if (outputGraph) {
        outputGraph.data.datasets.forEach((dataset) => {
            dataset.data = [];
        });
        outputGraph.update('none');
    }

    ['ib-meter-readout', 'ic-meter-readout'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = id.indexOf('ib') !== -1 ? '0.00 µA' : '0.00 mA';
        }
    });

    ['live-vbe-value', 'live-vce-value'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '0.00 V';
        }
    });
    const ibValue = document.getElementById('live-ib-value');
    const icValue = document.getElementById('live-ic-value');
    if (ibValue) ibValue.textContent = '0.00 µA';
    if (icValue) icValue.textContent = '0.00 mA';

    document.querySelectorAll('.observation-table input').forEach((input) => {
        input.value = '';
    });

    transistorRuntime.dom.ibButtons.forEach((button) => button.classList.toggle('is-active', Number(button.dataset.ib) === 40));
    setSimulationMode('input');
    updateKnobRotation(transistorRuntime.dom.vbeKnob, 0, 0, 0.8);
    updateKnobRotation(transistorRuntime.dom.vceKnob, 0, 0, 1.0);
    updateSimulationInfo('cutoff', 0, 0);
    setCircuitRegion('cutoff');
    updateCharts();
}

function removeLegacyUi() {
    const legacyActions = document.getElementById('transistor-legacy-actions');
    if (legacyActions) {
        legacyActions.remove();
    }
    document.querySelectorAll('.experiment-section').forEach((section) => {
        if (section.querySelector('#input-graph') || section.querySelector('#output-graph') || section.querySelector('#beta-value') || section.querySelector('#alpha-value') || section.querySelector('#rin-value')) {
            section.remove();
        }
        if (section.querySelector('#circuit-diagram')) {
            section.classList.add('legacy-hidden');
        }
    });
}

async function initializeSimulation() {
    ensureStyles();
    hideLegacyBlocks();
    buildSimulationShell();
    initializeDomReferences();
    initializeStateFromDom();
    buildCircuitSvg();
    bindControls();
    setSimulationMode('input');
    updateSimulationInstantFeedback();
    ensureCharts();
    updateCharts();
    setCircuitRegion('cutoff');
    startSimulationLoop();
}

window.addEventListener('beforeunload', stopSimulationLoop);
window.onload = function () {
    initializeSimulation();
};
