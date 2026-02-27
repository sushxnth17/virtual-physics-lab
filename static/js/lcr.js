// JavaScript for LCR Series Circuit experiment frontend
// Assumes Chart.js is loaded globally via base.html

let currentChart = null;
let impedanceChart = null;

function init() {
    const runBtn = document.getElementById('runBtn');
    runBtn.addEventListener('click', runExperiment);
}

async function runExperiment() {
    // collect input values
    const R = parseFloat(document.getElementById('R').value);
    const L = parseFloat(document.getElementById('L').value);
    const C = parseFloat(document.getElementById('C').value);
    const f_min = parseFloat(document.getElementById('f_min').value);
    const f_max = parseFloat(document.getElementById('f_max').value);
    if (f_min >= f_max) {
        alert('Minimum frequency must be less than maximum frequency');
        return;
    }
    const points= 40;
    const payload = { R, L, C, f_min, f_max, points };

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
    const rf = document.getElementById('resonantFrequency');
    const qf = document.getElementById('qualityFactor');
    rf.textContent = data.resonant_frequency.toFixed(2);
    qf.textContent = data.quality_factor.toFixed(2);
}

function plotCharts(data) {
    const freq = data.frequency;
    const current = data.current;
    const impedance = data.impedance;

    // destroy existing charts if present
    if (currentChart) {
        currentChart.destroy();
    }
    if (impedanceChart) {
        impedanceChart.destroy();
    }

    const ctx1 = document.getElementById('currentGraph').getContext('2d');
    currentChart = new Chart(ctx1, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Current (A)',
                data: freq.map((f, i) => ({ x: f, y: current[i] })),
                borderColor: 'blue',
                pointRadius: 3,
                pointHoverRadius: 5,
                pointHitRadius: 10,
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Frequency (Hz)' } },
                y: { title: { display: true, text: 'Current (A)' } }
            }
        }
    });

    const ctx2 = document.getElementById('impedanceGraph').getContext('2d');
    impedanceChart = new Chart(ctx2, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Impedance (Ω)',
                data: freq.map((f, i) => ({ x: f, y: impedance[i] })),
                borderColor: 'red',
                pointRadius: 3,
                pointHoverRadius: 5,
                pointHitRadius: 10,
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Frequency (Hz)' } },
                y: { title: { display: true, text: 'Impedance (Ω)' } }
            }
        }
    });
}

// initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
