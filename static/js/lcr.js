// JavaScript for LCR Circuit experiment frontend
// Supports both Series and Parallel LCR circuits
// Assumes Chart.js is loaded globally via base.html

let currentChart = null;

function init() {
    const runBtn = document.getElementById('runBtn');
    runBtn.addEventListener('click', runExperiment);
}

async function runExperiment() {
    // Collect input values from form
    const circuit_type = document.getElementById('circuit_type').value;
    const R = parseFloat(document.getElementById('R').value);
    const L = parseFloat(document.getElementById('L').value);
    const C = parseFloat(document.getElementById('C').value);
    const f_min = parseFloat(document.getElementById('f_min').value);
    const f_max = parseFloat(document.getElementById('f_max').value);

    // Validation
    if (isNaN(R) || isNaN(L) || isNaN(C) || isNaN(f_min) || isNaN(f_max)) {
        alert('Please enter valid numbers for all parameters');
        return;
    }
    if (f_min >= f_max) {
        alert('Minimum frequency must be less than maximum frequency');
        return;
    }

    const points = 40;
    const payload = { circuit_type, R, L, C, f_min, f_max, points,V: 1.0 };

    try {
        const response = await fetch('/api/lcr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server error: ${text}`);
        }

        const data = await response.json();
        updateResults(data);
        plotCharts(data);
    } catch (err) {
        alert(`Error running experiment: ${err.message}`);
    }
}

function updateResults(data) {
    // Update circuit type display
    const ct = document.getElementById('circuitType');
    ct.textContent = data.circuit_type.charAt(0).toUpperCase() + data.circuit_type.slice(1);

    // Update resonant frequency
    const rf = document.getElementById('resonantFrequency');
    rf.textContent = data.resonant_frequency.toFixed(4);

    // Update bandwidth
    const bw = document.getElementById('bandwidth');
    bw.textContent = data.bandwidth.toFixed(4);

    // Update half-power points
    const hpp = document.getElementById('halfPowerPoints');
    hpp.textContent = `f₁ = ${data.f1.toFixed(4)} Hz, f₂ = ${data.f2.toFixed(4)} Hz`;

    // Update theoretical quality factor
    const qft = document.getElementById('qualityFactorTheoretical');
    qft.textContent = data.quality_factor_theoretical.toFixed(4);

    // Update experimental quality factor
    const qfe = document.getElementById('qualityFactorExperimental');
    qfe.textContent = data.quality_factor_experimental.toFixed(4);
}

function plotCharts(data) {
    const freq = data.frequency;
    const current = data.current;
    if(!freq || !current || freq.length === 0 ) {
        alert('No data recieved for plotting');
        return;
    }
    const labelText = data.circuit_type === 'series' ? 'Current (A) - Series LCR (Peak at Resonance)'
        : 'Current (A) - Parallel LCR (Dip at Resonance)';
    // Destroy existing chart if present
    if (currentChart) {
        currentChart.destroy();
    }

    // Plot current vs frequency
    const ctx = document.getElementById('currentGraph').getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: labelText,
                data: freq.map((f, i) => ({ x: f, y: current[i] })),
                borderColor: 'blue',
                pointRadius: 2,
                pointHoverRadius: 5,
                pointHitRadius: 10,
                fill: false,
                tension: 0.1,
                showLine: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Frequency (Hz)' }
                },
                y: {
                    title: { display: true, text: 'Current (A)' }
                }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                title: { display: false }
            }
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

