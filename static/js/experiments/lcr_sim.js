// LCR Circuit Simulation - connects frontend controls to backend API
// The backend does all physics calculations; this script only manages UI

let frequencies = [];        // Hz values entered/queried so far
let currents = [];           // corresponding current values in mA
let lcrChart = null;         // Chart.js instance

// Axis bounds to prevent shrinkage once expanded
// axis bounds are calculated from the data; start with infinities
let axisYMin = Number.POSITIVE_INFINITY;
let axisYMax = Number.NEGATIVE_INFINITY;
let axisXMin = Number.POSITIVE_INFINITY;
let axisXMax = Number.NEGATIVE_INFINITY;

// ---------------------------------------------------------------------------
// API communication
// ---------------------------------------------------------------------------
async function fetchLCRData(frequency, mode) {
    // compute circuit parameters (R, L, C) from available inputs or defaults
    const { R, L, C, f_min, f_max, points, V } = gatherCircuitParams(frequency);
    const payload = {
        circuit_type: mode,
        R: R,
        L: L,
        C: C,
        f_min: f_min,
        f_max: f_max,
        points: points,
        V: V
    };

    try {
        const response = await fetch('/api/lcr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error('Error fetching LCR data:', err);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Data management
// ---------------------------------------------------------------------------
function addDataPoint(freq, currentMilli) {
    // Round the frequency to nearest integer to avoid "almost equal" duplicates
    const fKey = Math.round(freq);

    // update existing entry if frequency already present
    const idx = frequencies.findIndex(f => f === fKey);
    if (idx !== -1) {
        currents[idx] = currentMilli;
    } else {
        frequencies.push(fKey);
        currents.push(currentMilli);
    }
}

function clearData() {
    frequencies = [];
    currents = [];
    axisYMin = 0;
    axisYMax = 0;
    axisXMin = Number.POSITIVE_INFINITY;
    axisXMax = 0;
    if (lcrChart) {
        lcrChart.destroy();
        lcrChart = null;
    }
    // clear table inputs
    document.querySelectorAll('.current-input').forEach(inp => inp.value = '');
    // clear result display values if present
    ['resonant_freq', 'bandwidth', 'quality_factor_graph', 'quality_factor_calc', 'f1', 'f2'].forEach(key => {
        const elSeries = document.getElementById(`${key}_series`);
        const elParallel = document.getElementById(`${key}_parallel`);
        if (elSeries) elSeries.textContent = '-';
        if (elParallel) elParallel.textContent = '-';
    });
}

function sortData() {
    const combined = frequencies.map((f, i) => ({ f, c: currents[i] }));
    combined.sort((a, b) => a.f - b.f);
    frequencies = combined.map(p => p.f);
    currents = combined.map(p => p.c);
}

// ---------------------------------------------------------------------------
// UI updates
// ---------------------------------------------------------------------------
function updateTable(frequency, currentMilli) {
    const mode = document.getElementById('circuit_type_select')?.value || 'series';
    // find the best matching row in case frequencies don't exactly line up
    const inputs = document.querySelectorAll(`.${mode}-current`);
    let target = null;
    let bestDiff = Infinity;

    inputs.forEach(inp => {
        const f = parseFloat(inp.dataset.frequency);
        if (isNaN(f)) return;
        const diff = Math.abs(f - frequency);
        if (diff < bestDiff) {
            bestDiff = diff;
            target = inp;
        }
    });

    if (target) {
        target.value = currentMilli.toFixed(2);
    }
}

function updateAmmeter(currentMilli) {
    const el = document.getElementById('ammeterDisplay') ||
               document.getElementById('ammeter') ||
               document.querySelector('.ammeter-display') ||
               document.getElementById('currentValue');
    if (el) {
        el.textContent = `${currentMilli.toFixed(2)} mA`;
    }
}

function displayResults(data) {
    if (!data) return;
    const mode = document.getElementById('circuit_type_select')?.value || 'series';
    const suffix = mode === 'series' ? 'series' : 'parallel';

    function setVal(id, val) {
        const el = document.getElementById(`${id}_${suffix}`);
        if (el) {
            el.textContent = (typeof val === 'number' ? val.toFixed(2) : val);
        }
    }

    setVal('resonant_freq', data.resonant_frequency);
    setVal('bandwidth', data.bandwidth);
    // support both naming conventions from api
    const qval = data.quality_factor !== undefined ? data.quality_factor : data.quality_factor_experimental;
    if (qval !== undefined) {
        setVal('quality_factor_graph', qval);
    }
    // optional values in case API returns them
    if (data.f1 !== undefined) setVal('f1', data.f1);
    if (data.f2 !== undefined) setVal('f2', data.f2);
}

function updateGraph() {
    if (frequencies.length === 0) return;

    // sort before plotting to keep x-axis ordered
    sortData();

    // update axis bounds
    axisXMin = Math.min(axisXMin, frequencies[0]);
    axisXMax = Math.max(axisXMax, frequencies[frequencies.length - 1]);
    const currentMin = Math.min(...currents);
    const currentMax = Math.max(...currents);
    axisYMin = Math.min(axisYMin, currentMin);
    axisYMax = Math.max(axisYMax, currentMax);

    const ctx = document.getElementById('currentGraph');
    if (!ctx) return;

    // destroy old chart if present so we can reconfigure axes
    if (lcrChart) {
        lcrChart.destroy();
    }

    const mode = document.getElementById('circuit_type_select')?.value || 'series';
    const labelText = mode === 'series'
        ? 'Current (mA) - Series LCR (Peak at Resonance)'
        : 'Current (mA) - Parallel LCR (Dip at Resonance)';

    // add a small padding so the dip or peak isn't flush against the edge
    const yRange = axisYMax - axisYMin;
    const padY = yRange * 0.05;
    const displayYMin = axisYMin === Number.POSITIVE_INFINITY ? 0 : axisYMin - padY;
    const displayYMax = axisYMax === Number.NEGATIVE_INFINITY ? 1 : axisYMax + padY;

    lcrChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: labelText,
                data: frequencies.map((f, i) => ({ x: f, y: currents[i] })),
                borderColor: '#002d99',
                backgroundColor: 'rgba(0,45,153,0.5)',
                showLine: true,
                fill: false,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Frequency (Hz)' },
                    min: axisXMin,
                    max: axisXMax
                },
                y: {
                    title: { display: true, text: 'Current (mA)' },
                    min: displayYMin,
                    max: displayYMax
                }
            },
            plugins: {
                legend: { display: true, position: 'top' }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Interaction handlers
// ---------------------------------------------------------------------------
// token to track latest fetch so out‑of‑order responses are ignored
let latestFetchToken = 0;

async function performFrequencyUpdate(freq) {
    const token = ++latestFetchToken;
    const mode = document.getElementById('circuit_type_select')?.value || 'series';
    const apiData = await fetchLCRData(freq, mode);
    // if another request started after this one, discard results
    if (token !== latestFetchToken) return;
    if (!apiData) return;

    // determine current corresponding to requested frequency
    let currentVal = 0;
    if (Array.isArray(apiData.current) && Array.isArray(apiData.frequency)) {
        let idx = apiData.frequency.findIndex(f => f === freq);
        if (idx === -1) {
            let best = { idx: 0, diff: Infinity };
            apiData.frequency.forEach((f, i) => {
                const d = Math.abs(f - freq);
                if (d < best.diff) {
                    best = { idx: i, diff: d };
                }
            });
            idx = best.idx;
        }
        currentVal = apiData.current[idx];
    } else if (typeof apiData.current === 'number') {
        currentVal = apiData.current;
    }

    const currentMilli = currentVal * 1000;

    updateAmmeter(currentMilli);
    updateTable(freq, currentMilli);
    addDataPoint(freq, currentMilli);
    updateGraph();
    displayResults(apiData);
}

// debounced wrapper so rapid slider movements don't flood the API
let frequencyChangeTimeout = null;
async function handleFrequencyChange(event) {
    const value = parseFloat(event.target.value);
    if (isNaN(value)) return;
    const freq = value;

    // keep the two frequency inputs in sync
    if (event.target.id === 'frequencyInput' && document.getElementById('frequencyNumber')) {
        document.getElementById('frequencyNumber').value = freq;
    } else if (event.target.id === 'frequencyNumber' && document.getElementById('frequencyInput')) {
        document.getElementById('frequencyInput').value = freq;
    }

    if (frequencyChangeTimeout) {
        clearTimeout(frequencyChangeTimeout);
    }
    frequencyChangeTimeout = setTimeout(() => {
        performFrequencyUpdate(freq);
    }, 100); // wait 100ms after last slider event
}

function initSimulation() {
    const freqInputs = [];
    const slider = document.getElementById('frequencyInput');
    const numberInput = document.getElementById('frequencyNumber');
    if (slider) freqInputs.push(slider);
    if (numberInput) freqInputs.push(numberInput);

    freqInputs.forEach(inp => {
        inp.addEventListener('input', handleFrequencyChange);
        inp.addEventListener('change', handleFrequencyChange);
    });

    const modeSelect = document.getElementById('circuit_type_select');
    if (modeSelect) {
        modeSelect.addEventListener('change', () => {
            clearData();
        });
    }
}

// helper: collect circuit parameters used by backend
function gatherCircuitParams(frequency) {
    // resistance input in ohms
    const Rinput = parseFloat(document.getElementById('resistanceInput')?.value);
    const R = !isNaN(Rinput) && Rinput > 0 ? Rinput : 330;

    // capacitance in microfarads, convert to farads
    const Cinput = parseFloat(document.getElementById('capacitanceInput')?.value);
    const Cmicro = !isNaN(Cinput) && Cinput > 0 ? Cinput : 0.047;
    const C = Cmicro * 1e-6;

    // inductance - no input field currently, use default
    const L = 0.1; // henry

    // frequency range for sweep: use table values if present, otherwise use +/- a small window
    const range = getFrequencyRange();
    let f_min = range.min;
    let f_max = range.max;
    if (isNaN(f_min) || isNaN(f_max) || f_min >= f_max) {
        f_min = frequency * 0.9;
        f_max = frequency * 1.1 + 1;
    }

    return { R, L, C, f_min, f_max, points: 200, V: 1.0 };
}

function getFrequencyRange() {
    const inputs = document.querySelectorAll('.current-input');
    const freqs = Array.from(inputs).map(i => parseFloat(i.dataset.frequency)).filter(f => !isNaN(f));
    if (freqs.length === 0) return { min: NaN, max: NaN };
    return { min: Math.min(...freqs), max: Math.max(...freqs) };
}

// expose a simple global API for external control (if needed)
window.updateLCRSimulation = function(newFreq, newMode) {
    if (typeof newMode === 'string' && document.getElementById('circuit_type_select')) {
        document.getElementById('circuit_type_select').value = newMode;
        clearData();
    }
    if (typeof newFreq === 'number') {
        const freqEl = document.getElementById('frequencyInput') || document.getElementById('frequencyNumber');
        if (freqEl) {
            freqEl.value = newFreq;
            freqEl.dispatchEvent(new Event('input'));
        } else {
            handleFrequencyChange({ target: { value: newFreq } });
        }
    }
};

// initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSimulation);
} else {
    initSimulation();
}
