// JavaScript for LCR Circuit experiment - Manual Procedure
// Users enter measured current values in tables at fixed frequencies
// Then calculations derive resonant frequency, bandwidth, Q factor, etc.

let currentChart = null;

function init() {
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', calculateFromTableData);
    }
}

function getTableData(circuitType) {
    /**
     * Extract frequency and current data from the appropriate table
     * Returns: { frequencies: [f1, f2, ...], currents: [I1, I2, ...] }
     */
    const className = circuitType === 'series' ? 'series-current' : 'parallel-current';
    const inputs = document.querySelectorAll(`.${className}`);
    
    const frequencies = [];
    const currents = [];
    
    inputs.forEach(input => {
        const freq = parseFloat(input.getAttribute('data-frequency'));
        const current = parseFloat(input.value);
        
        // Only include entries where current is filled in
        if (!isNaN(freq) && !isNaN(current) && current > 0) {
            frequencies.push(freq);
            currents.push(current);
        }
    });
    
    return { frequencies, currents };
}

function calculateFromTableData() {
    const circuitType = document.getElementById('circuit_type_select').value;
    const { frequencies, currents } = getTableData(circuitType);
    
    // Validation
    if (frequencies.length < 3) {
        alert('Please enter current values for at least 3 frequencies');
        return;
    }
    
    // Sort by frequency to ensure proper analysis
    const sortedIndices = frequencies.map((v, i) => i).sort((a, b) => frequencies[a] - frequencies[b]);
    const sortedFreq = sortedIndices.map(i => frequencies[i]);
    const sortedCurrent = sortedIndices.map(i => currents[i]);
    
    // Find resonant frequency (max for series, min for parallel) and corresponding current
    let resonantIndex;
    let resonantFrequency;
    let extremeCurrent;
    
    if (circuitType === 'series') {
        // For series: resonance at maximum current
        resonantIndex = sortedCurrent.indexOf(Math.max(...sortedCurrent));
        extremeCurrent = Math.max(...sortedCurrent);
    } else {
        // For parallel: resonance at minimum current
        resonantIndex = sortedCurrent.indexOf(Math.min(...sortedCurrent));
        extremeCurrent = Math.min(...sortedCurrent);
    }
    
    resonantFrequency = sortedFreq[resonantIndex];
    
    // Half-power current (Imax/√2 for series, Imin×√2 for parallel)
    const halfPowerCurrent = circuitType === 'series' 
        ? extremeCurrent / Math.sqrt(2) 
        : extremeCurrent * Math.sqrt(2);
    
    // Find half-power frequencies (f1 and f2)
    let f1 = null, f2 = null;

    if (circuitType === 'series') {
        // Series logic is unchanged: use the first and last points above half-power.
        for (let i = 0; i < sortedCurrent.length; i++) {
            if (sortedCurrent[i] >= halfPowerCurrent) {
                if (f1 === null) f1 = sortedFreq[i];
                f2 = sortedFreq[i];
            }
        }

        // If measured points are too sparse around half-power, interpolate.
        if (f1 === null || f2 === null || f1 === f2) {
            f1 = findHalfPowerFrequency(sortedFreq, sortedCurrent, resonantFrequency, halfPowerCurrent, 'lower', circuitType);
            f2 = findHalfPowerFrequency(sortedFreq, sortedCurrent, resonantFrequency, halfPowerCurrent, 'upper', circuitType);
        }
    } else {
        // Match Python logic for parallel: use first and last points at/above I_half.
        for (let i = 0; i < sortedCurrent.length; i++) {
            if (sortedCurrent[i] >= halfPowerCurrent) {
                if (f1 === null) f1 = sortedFreq[i];
                f2 = sortedFreq[i];
            }
        }

        // If measured data do not span both half-power points, estimate from theoretical Q.
        if (f1 === null || f2 === null || f1 === f2) {
            const capInput = document.getElementById('capacitanceInput');
            const resInput = document.getElementById('resistanceInput');
            const Cmicro = Number.parseFloat(capInput ? capInput.value : '');
            const Rtot = Number.parseFloat(resInput ? resInput.value : '');

            let estimatedQ = 0;
            if (!Number.isNaN(Cmicro) && Cmicro > 0 && !Number.isNaN(Rtot) && Rtot > 0 && resonantFrequency > 0) {
                const C = Cmicro * 1e-6;
                const L = 1 / (4 * Math.PI * Math.PI * resonantFrequency * resonantFrequency * C);
                estimatedQ = Rtot * Math.sqrt(C / L);
            }

            if (!(estimatedQ > 0)) {
                estimatedQ = 3;
            }

            const estimatedBandwidth = resonantFrequency / estimatedQ;
            f1 = Math.max(sortedFreq[0], resonantFrequency - estimatedBandwidth / 2);
            f2 = Math.min(sortedFreq[sortedFreq.length - 1], resonantFrequency + estimatedBandwidth / 2);
        }
    }

    if (!(f2 > f1)) {
        alert('Unable to determine valid half-power frequencies from the entered data. Please enter additional readings around resonance.');
        clearSummaryRow(circuitType);
        plotTableGraph(sortedFreq, sortedCurrent, circuitType, resonantFrequency);
        return;
    }
    
    const bandwidth = f2 - f1;
    const experimentalQFactor = resonantFrequency / bandwidth;
    
    // Update summary result table values (inductance, resonant freq, bandwidth, Q)
    const other = circuitType === 'series' ? 'parallel' : 'series';
    clearSummaryRow(other);
    updateSummaryResults(circuitType, resonantFrequency, bandwidth, experimentalQFactor);

    // Plot graph with table data
    plotTableGraph(sortedFreq, sortedCurrent, circuitType, resonantFrequency);
}

function findHalfPowerFrequency(frequencies, currents, resonantFreq, halfPowerCurrent, direction, circuitType) {
    /**
     * Find half-power frequency using linear interpolation
     * direction: 'lower' for f1, 'upper' for f2
     */
    let targetFreq = null;
    
    if (direction === 'lower') {
        // Find closest frequency below resonance
        for (let i = frequencies.length - 1; i >= 0; i--) {
            if (frequencies[i] < resonantFreq) {
                if (i < frequencies.length - 1) {
                    const f1 = frequencies[i];
                    const f2 = frequencies[i + 1];
                    const c1 = currents[i];
                    const c2 = currents[i + 1];
                    
                    // Linear interpolation
                    if ((circuitType === 'series' && c1 < halfPowerCurrent && c2 > halfPowerCurrent) ||
                        (circuitType === 'parallel' && c1 > halfPowerCurrent && c2 < halfPowerCurrent)) {
                        targetFreq = f1 + (halfPowerCurrent - c1) * (f2 - f1) / (c2 - c1);
                    }
                }
                if (targetFreq) break;
            }
        }
    } else {
        // Find closest frequency above resonance
        for (let i = 0; i < frequencies.length; i++) {
            if (frequencies[i] > resonantFreq) {
                if (i > 0) {
                    const f1 = frequencies[i - 1];
                    const f2 = frequencies[i];
                    const c1 = currents[i - 1];
                    const c2 = currents[i];
                    
                    // Linear interpolation
                    if ((circuitType === 'series' && c1 > halfPowerCurrent && c2 < halfPowerCurrent) ||
                        (circuitType === 'parallel' && c1 < halfPowerCurrent && c2 > halfPowerCurrent)) {
                        targetFreq = f1 + (halfPowerCurrent - c1) * (f2 - f1) / (c2 - c1);
                    }
                }
                if (targetFreq) break;
            }
        }
    }
    
    return targetFreq || (direction === 'lower' ? frequencies[0] : frequencies[frequencies.length - 1]);
}


/**
 * Compute inductance using capacitance input and resonant frequency,
 * then update the top-level result table which shows values for series/parallel circuits.
 */
function updateSummaryResults(circuitType, fr, bandwidth, qGraph) {
    const capInput = document.getElementById('capacitanceInput');
    const resInput = document.getElementById('resistanceInput');
    const Cmicro = parseFloat(capInput.value);
    const Rtot = parseFloat(resInput.value);

    // Prepare element IDs based on circuit type
    const indId = `inductance_${circuitType}`;
    const qGraphId = `q_factor_graph_${circuitType}`;
    const qCalcId = `q_factor_calc_${circuitType}`;

    // Default display values
    let Lval = '-';
    let qCalcVal = '-';

    // Only compute if valid inputs are provided
    if (!isNaN(Cmicro) && Cmicro > 0 && !isNaN(Rtot) && Rtot > 0 && fr > 0 && bandwidth > 0) {
        const C = Cmicro * 1e-6; // convert µF to F
        Lval = 1 / (4 * Math.PI * Math.PI * fr * fr * C);
        if (circuitType === 'series') {
            // Series theoretical Q = (1/R) * sqrt(L/C)
            qCalcVal = (1 / Rtot) * Math.sqrt(Lval / C);
        } else {
            // Parallel theoretical Q = R * sqrt(C/L)
            qCalcVal = Rtot * Math.sqrt(C / Lval);
        }
    }

    // Update DOM elements
    if (document.getElementById(indId)) {
        document.getElementById(indId).textContent =
            typeof Lval === 'number' ? Lval.toExponential(3) : Lval;
    }
    if (document.getElementById(qGraphId)) {
        document.getElementById(qGraphId).textContent =
            typeof qGraph === 'number' ? qGraph.toFixed(4) : qGraph;
    }
    if (document.getElementById(qCalcId)) {
        document.getElementById(qCalcId).textContent =
            typeof qCalcVal === 'number' ? qCalcVal.toFixed(4) : qCalcVal;
    }

    // Also update frequency and bandwidth cells in summary table for selected circuit
    const frId = `resonant_freq_${circuitType}`;
    const bwId = `bandwidth_${circuitType}`;
    if (document.getElementById(frId)) {
        document.getElementById(frId).textContent =
            typeof fr === 'number' ? fr.toFixed(2) : fr;
    }
    if (document.getElementById(bwId)) {
        document.getElementById(bwId).textContent =
            typeof bandwidth === 'number' ? bandwidth.toFixed(2) : bandwidth;
    }
}

/**
 * Clear all summary cells for a given circuit type (series/parallel).
 * Used when switching circuits to avoid showing values from previous analysis.
 */
function clearSummaryRow(circuitType) {
    const ids = [
        `inductance_${circuitType}`,
        `resonant_freq_${circuitType}`,
        `bandwidth_${circuitType}`,
        `q_factor_graph_${circuitType}`,
        `q_factor_calc_${circuitType}`
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
}


function plotTableGraph(frequencies, currents, circuitType, resonantFrequency) {
    // Currents entered in the table are already in mA, so we
    // can use them directly for plotting. (Previous code multiplied
    // by 1000 which caused confusing values.)
    const currentsInmA = currents;
    
    const labelText = circuitType === 'series' 
        ? 'Current (mA) - Series LCR (Peak at Resonance)'
        : 'Current (mA) - Parallel LCR (Dip at Resonance)';
    
    // Destroy existing chart if present
    if (currentChart) {
        currentChart.destroy();
    }
    
    // Plot current vs frequency
    const ctx = document.getElementById('currentGraph').getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: labelText,
                data: frequencies.map((f, i) => ({ x: f, y: currentsInmA[i] })),
                borderColor: '#002d99',
                backgroundColor: 'rgba(0, 45, 153, 0.5)',
                showLine: true,
                fill: false,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                lineTension: 0.4
            },
            {
                label: 'Resonant Frequency',
                data: [{ x: resonantFrequency, y: currentsInmA[frequencies.indexOf(resonantFrequency)] }],
                borderColor: '#ff0000',
                backgroundColor: '#ff0000',
                pointRadius: 8,
                showLine: false,
                pointStyle: 'star'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Frequency (Hz)', font: { size: 14 } },
                    min: Math.min(...frequencies) * 0.95,
                    max: Math.max(...frequencies) * 1.05
                },
                y: {
                    title: { display: true, text: 'Current (mA)', font: { size: 14 } }
                }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                title: { display: false }
            }
        }
    });
}

// ========== FREQUENCY SLIDER CONTROL ==========

function getSelectedCircuitType() {
    const select = document.getElementById('circuit_type_select');
    return select ? select.value : 'series';
}

function getAvailableFrequencies(circuitType) {
    const className = circuitType === 'series' ? 'series-current' : 'parallel-current';
    const inputs = document.querySelectorAll(`input.${className}[data-frequency]`);
    return Array.from(inputs)
        .map(input => Number.parseFloat(input.getAttribute('data-frequency')))
        .filter(value => !Number.isNaN(value))
        .sort((a, b) => a - b);
}

function snapToNearestFrequency(frequency) {
    const circuitType = getSelectedCircuitType();
    const available = getAvailableFrequencies(circuitType);
    if (available.length === 0) {
        return frequency;
    }

    let nearest = available[0];
    let nearestDiff = Math.abs(available[0] - frequency);
    for (let i = 1; i < available.length; i++) {
        const diff = Math.abs(available[i] - frequency);
        if (diff < nearestDiff) {
            nearest = available[i];
            nearestDiff = diff;
        }
    }
    return nearest;
}

function updateFrequencyDisplay(frequency) {
    const freqValue = document.getElementById('freqValue');
    if (freqValue) {
        freqValue.textContent = String(frequency);
    }
}

function highlightActiveRow(frequency) {
    const circuitType = getSelectedCircuitType();
    const className = circuitType === 'series' ? 'series-current' : 'parallel-current';

    document.querySelectorAll('.active-frequency-row').forEach(row => {
        row.classList.remove('active-frequency-row');
    });

    const input = document.querySelector(`input.${className}[data-frequency="${frequency}"]`);
    if (input) {
        const row = input.closest('tr');
        if (row) row.classList.add('active-frequency-row');
    }
}

function getInductanceValue(circuitType) {
    const resultEl = document.getElementById(`inductance_${circuitType}`);
    if (resultEl && resultEl.textContent && resultEl.textContent.trim() !== '-') {
        const parsed = Number.parseFloat(resultEl.textContent);
        if (!Number.isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }

    // Fallback used by existing simulation behavior in this project.
    return 0.1;
}

async function fetchCurrentForFrequency(frequency) {
    const circuitType = getSelectedCircuitType();
    const capacitanceInput = document.getElementById('capacitanceInput');
    const resistanceInput = document.getElementById('resistanceInput');

    const CmicroRaw = Number.parseFloat(capacitanceInput ? capacitanceInput.value : '');
    const Rraw = Number.parseFloat(resistanceInput ? resistanceInput.value : '');

    // Use defaults if user has not filled inputs yet, so slider still behaves like an instrument.
    const Cmicro = (!Number.isNaN(CmicroRaw) && CmicroRaw > 0) ? CmicroRaw : 0.047;
    const R = (!Number.isNaN(Rraw) && Rraw > 0) ? Rraw : 330;

    const payload = {
        circuit_type: circuitType,
        R: R,
        L: getInductanceValue(circuitType),
        C: Cmicro * 1e-6,
        f_min: frequency,
        f_max: frequency,
        points: 1
    };

    const response = await fetch('/api/lcr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();
    if (!data.current || !Array.isArray(data.current) || data.current.length === 0) {
        return null;
    }

    return data.current[0];
}

function fillCurrentValue(frequency, currentAmp) {
    const circuitType = getSelectedCircuitType();
    const className = circuitType === 'series' ? 'series-current' : 'parallel-current';
    const input = document.querySelector(`input.${className}[data-frequency="${frequency}"]`);

    if (!input) return;

    const currentMilliAmp = currentAmp * 1000;
    input.value = currentMilliAmp.toFixed(3);
}

async function handleSliderFrequencyChange(frequency) {
    const snappedFrequency = snapToNearestFrequency(frequency);
    const slider = document.getElementById('frequencySlider');
    if (slider) {
        slider.value = String(snappedFrequency);
    }

    updateFrequencyDisplay(snappedFrequency);
    highlightActiveRow(snappedFrequency);

    try {
        const currentAmp = await fetchCurrentForFrequency(snappedFrequency);
        if (currentAmp !== null) {
            fillCurrentValue(snappedFrequency, currentAmp);
        }
    } catch (error) {
        console.error('Failed to fetch LCR current for slider frequency:', error);
    }
}

function initSliderControl() {
    const slider = document.getElementById('frequencySlider');
    if (!slider) return;

    slider.addEventListener('input', event => {
        const frequency = Number.parseFloat(event.target.value);
        if (!Number.isNaN(frequency)) {
            handleSliderFrequencyChange(frequency);
        }
    });

    const circuitTypeSelect = document.getElementById('circuit_type_select');
    if (circuitTypeSelect) {
        circuitTypeSelect.addEventListener('change', () => {
            const frequency = Number.parseFloat(slider.value);
            if (!Number.isNaN(frequency)) {
                handleSliderFrequencyChange(frequency);
            }
        });
    }

    const initialFrequency = Number.parseFloat(slider.value);
    if (!Number.isNaN(initialFrequency)) {
        updateFrequencyDisplay(initialFrequency);
        highlightActiveRow(initialFrequency);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        initSliderControl();
    });
} else {
    init();
    initSliderControl();
}

