/**
 * Transistor Characteristics Experiment
 * Frontend: Handles API calls and data visualization
 * Backend: All physics calculations via /transistor endpoints
 * 
 * Users can:
 * 1. Manually enter IB and IC values in the tables
 * 2. Use "Generate" buttons to auto-fill via API
 * 3. Plot graphs and calculate results
 */

let inputChart = null;
let outputChart = null;

// State for storing experimental data
const experimentState = {
    inputData: [],
    outputData: {
        40: [],
        60: [],
        80: []
    }
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Transistor Experiment: DOM loaded');
    
    // Attach event listeners
    const generateInputBtn = document.getElementById('generateInputBtn');
    if (generateInputBtn) {
        generateInputBtn.addEventListener('click', generateInputData);
    }
    
    const generateOutputBtn = document.getElementById('generateOutputBtn');
    if (generateOutputBtn) {
        generateOutputBtn.addEventListener('click', generateOutputData);
    }
    
    const plotGraphBtn = document.getElementById('plotGraphBtn');
    if (plotGraphBtn) {
        plotGraphBtn.addEventListener('click', plotGraphs);
    }
    
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', calculateResults);
    }

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetExperiment);
    }
    
    console.log('Event listeners attached');
});

// ==================== INPUT DATA GENERATION ====================

async function generateInputData() {
    console.log('Starting: generateInputData()');
    
    // Define VBE values
    const vbeValues = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
    const vce = 2.0;
    
    // Clear previous data
    experimentState.inputData = [];
    
    try {
        for (const vbe of vbeValues) {
            console.log(`Fetching input data for VBE = ${vbe}V`);
            
            const response = await fetch('/transistor/input', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    v_be: vbe,
                    v_ce: vce
                })
            });
            
            if (!response.ok) {
                console.error(`API error for VBE ${vbe}:`, response.status);
                alert(`Error fetching data for VBE=${vbe}`);
                return;
            }
            
            const data = await response.json();
            const ib = data.i_b_microamp;
            
            console.log(`VBE: ${vbe}V → IB: ${ib}µA`);
            
            // Store data for graph
            experimentState.inputData.push({
                vbe: vbe,
                ib: ib
            });
            
            // Fill input field
            const inputId = `ib-${vbe}`;
            const input = document.getElementById(inputId);
            if (input) {
                input.value = ib.toFixed(4);
                console.log(`Updated input ${inputId} with value ${ib.toFixed(4)}`);
            } else {
                console.warn(`Input field ${inputId} not found in DOM`);
            }
        }
        
        console.log('✓ Input data generation complete');
        alert('Input data generated successfully!');
        
    } catch (error) {
        console.error('Error in generateInputData:', error);
        alert('Failed to generate input data');
    }
}

// ==================== OUTPUT DATA GENERATION ====================

async function generateOutputData() {
    console.log('Starting: generateOutputData()');
    
    // Define VCE and IB values
    const vceValues = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const ibValues = [40, 60, 80];
    
    // Clear previous data
    experimentState.outputData = {
        40: [],
        60: [],
        80: []
    };
    
    try {
        for (const ib of ibValues) {
            console.log(`\n--- Processing IB = ${ib}µA ---`);
            
            for (const vce of vceValues) {
                console.log(`Fetching output data for IB=${ib}µA, VCE=${vce}V`);
                
                const response = await fetch('/transistor/output', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        i_b: ib,
                        v_ce: vce
                    })
                });
                
                if (!response.ok) {
                    console.error(`API error for IB ${ib}, VCE ${vce}:`, response.status);
                    alert(`Error fetching data for IB=${ib}µA, VCE=${vce}V`);
                    return;
                }
                
                const data = await response.json();
                const ic = data.i_c_microamp;
                
                console.log(`IB: ${ib}µA, VCE: ${vce}V → IC: ${ic}µA`);
                
                // Store data for graph
                experimentState.outputData[ib].push({
                    vce: vce,
                    ic: ic
                });
                
                // Fill input field
                const inputId = `ic-${ib}-${vce}`;
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = ic.toFixed(4);
                    console.log(`Updated input ${inputId} with value ${ic.toFixed(4)}`);
                } else {
                    console.warn(`Input field ${inputId} not found in DOM`);
                }
            }
        }
        
        console.log('✓ Output data generation complete');
        alert('Output data generated successfully!');
        
    } catch (error) {
        console.error('Error in generateOutputData:', error);
        alert('Failed to generate output data');
    }
}

// ==================== GRAPH PLOTTING ====================

function destroyChartSafely(chartInstance, canvasId) {
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    const canvas = document.getElementById(canvasId);
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
}

function plotGraphs() {
    console.log('Starting: plotGraphs()');
    
    // Read input data from table
    const inputTableRows = document.querySelectorAll('.transistor-ib-input');
    if (inputTableRows.length === 0) {
        alert('No input data available for plotting');
        console.warn('No input data rows found');
        return;
    }

    // Collect input data from user entries or generated values
    const inputData = [];
    inputTableRows.forEach(input => {
        const vbe = parseFloat(input.getAttribute('data-vbe'));
        const ib = parseFloat(input.value);
        
        if (Number.isFinite(vbe) && Number.isFinite(ib) && ib >= 0) {
            inputData.push({ vbe, ib });
        }
    });

    if (inputData.length === 0) {
        alert('Please enter or generate input data first!');
        console.warn('No valid input data for plotting');
        return;
    }

    // Collect output data from user entries or generated values
    const outputData = {
        40: [],
        60: [],
        80: []
    };

    const outputTableRows = document.querySelectorAll('.transistor-ic-input');
    outputTableRows.forEach(input => {
        const vce = parseFloat(input.getAttribute('data-vce'));
        const ib = parseFloat(input.getAttribute('data-ib'));
        const ic = parseFloat(input.value);
        
        if (Number.isFinite(vce) && Number.isFinite(ib) && Number.isFinite(ic) && ic >= 0) {
            if (!outputData[ib]) {
                outputData[ib] = [];
            }
            outputData[ib].push({ vce, ic });
        }
    });

    // Check if we have output data
    const hasOutputData = Object.values(outputData).some(arr => arr.length > 0);
    if (!hasOutputData) {
        alert('Please enter or generate output data first!');
        console.warn('No valid output data for plotting');
        return;
    }

    // Sort data by first parameter (VBE or VCE)
    inputData.sort((a, b) => a.vbe - b.vbe);
    Object.keys(outputData).forEach(ib => {
        outputData[ib].sort((a, b) => a.vce - b.vce);
    });

    // Plot input graph
    plotInputGraph(inputData);
    
    // Plot output graph
    plotOutputGraph(outputData);
    
    console.log('✓ Graphs plotted successfully');
    alert('Graphs plotted successfully!');
}

function plotInputGraph(inputData) {
    console.log('Plotting input graph...');
    
    // Destroy previous chart
    destroyChartSafely(inputChart, 'input-graph');
    
    // Prepare data
    const labels = inputData.map(d => d.vbe.toFixed(2));
    const values = inputData.map(d => d.ib);
    
    const canvas = document.getElementById('input-graph');
    if (!canvas) {
        console.error('Canvas element "input-graph" not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    inputChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Base Current (IB) vs Base Voltage (VBE)',
                    data: values,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointBackgroundColor: '#00ff88',
                    pointBorderColor: '#ffffff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Base Voltage VBE (V)',
                        color: '#ffffff'
                    },
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Base Current IB (µA)',
                        color: '#ffffff'
                    },
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
    
    console.log('✓ Input graph plotted');
}

function plotOutputGraph(outputData) {
    console.log('Plotting output graph...');
    
    // Destroy previous chart
    destroyChartSafely(outputChart, 'output-graph');
    
    const canvas = document.getElementById('output-graph');
    if (!canvas) {
        console.error('Canvas element "output-graph" not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Prepare datasets for each IB value
    const colors = {
        40: '#ff00ff',   // Magenta
        60: '#00ffff',   // Cyan
        80: '#ffff00'    // Yellow
    };
    
    const datasets = [];
    const ibValues = [40, 60, 80];
    let commonLabels = [];
    
    for (const ib of ibValues) {
        const data = outputData[ib];
        
        if (data && data.length > 0) {
            const labels = data.map(d => d.vce.toFixed(2));
            const values = data.map(d => d.ic);
            
            // Use first dataset's labels as common
            if (commonLabels.length === 0) {
                commonLabels = labels;
            }
            
            datasets.push({
                label: `IC vs VCE (IB = ${ib}µA)`,
                data: values,
                borderColor: colors[ib],
                backgroundColor: `${colors[ib]}33`,
                borderWidth: 2,
                tension: 0.4,
                pointBackgroundColor: colors[ib],
                pointBorderColor: '#ffffff',
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: false
            });
        }
    }
    
    if (datasets.length === 0) {
        console.warn('No output data to plot');
        return;
    }
    
    outputChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: commonLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Collector Voltage VCE (V)',
                        color: '#ffffff'
                    },
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Collector Current IC (µA)',
                        color: '#ffffff'
                    },
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
    
    console.log('✓ Output graph plotted');
}

// ==================== CALCULATIONS ====================

async function calculateResults() {
    console.log('Starting: calculateResults()');
    
    // Read output data from table
    const outputTableRows = document.querySelectorAll('.transistor-ic-input');
    if (outputTableRows.length === 0) {
        alert('Please enter or generate output data first!');
        console.warn('No output data available for calculations');
        return;
    }
    
    // Collect data for IB=40µA
    const data40 = [];
    outputTableRows.forEach(input => {
        const ib = parseFloat(input.getAttribute('data-ib'));
        if (ib === 40) {
            const vce = parseFloat(input.getAttribute('data-vce'));
            const ic = parseFloat(input.value);
            
            if (Number.isFinite(vce) && Number.isFinite(ic) && ic > 0) {
                data40.push({ vce, ic });
            }
        }
    });

    if (data40.length < 2) {
        alert('Need at least 2 data points for calculation');
        return;
    }

    // Sort and pick 2 points
    data40.sort((a, b) => a.vce - b.vce);
    const point1 = data40[Math.floor(data40.length * 0.3)];
    const point2 = data40[Math.floor(data40.length * 0.7)];
    
    // Get VBE value from input data
    const inputFields = document.querySelectorAll('.transistor-ib-input');
    let vbeValue = 0.5; // default
    if (inputFields.length > 5) {
        vbeValue = parseFloat(inputFields[5].getAttribute('data-vbe'));
    }
    
    const ic1 = point1.ic;
    const ic2 = point2.ic;
    const ib1 = 40;  // µA
    const ib2 = 40;  // µA
    const vbe = vbeValue;
    const ib = 40;
    
    console.log('Calculation parameters:');
    console.log(`IC1: ${ic1}µA, IC2: ${ic2}µA`);
    console.log(`IB1: ${ib1}µA, IB2: ${ib2}µA`);
    console.log(`VBE: ${vbe}V, IB: ${ib}µA`);
    
    try {
        const response = await fetch('/transistor/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                i_c1: ic1,
                i_c2: ic2,
                i_b1: ib1,
                i_b2: ib2,
                v_be: vbe,
                i_b: ib
            })
        });
        
        if (!response.ok) {
            console.error('API error:', response.status);
            alert('Error calculating results');
            return;
        }
        
        const results = await response.json();
        
        console.log('Calculation results:', results);
        
        // Update UI with results
        const betaElement = document.getElementById('beta-value');
        if (betaElement) {
            betaElement.textContent = results.beta !== undefined ? results.beta.toFixed(2) : '-';
        }
        
        const alphaElement = document.getElementById('alpha-value');
        if (alphaElement) {
            alphaElement.textContent = results.alpha !== undefined ? results.alpha.toFixed(4) : '-';
        }
        
        const rinElement = document.getElementById('rin-value');
        if (rinElement) {
            rinElement.textContent = results.rin !== undefined ? results.rin.toFixed(2) : '-';
        }
        
        console.log('✓ Results calculated and displayed');
        alert('Calculations completed successfully!');
        
    } catch (error) {
        console.error('Error in calculateResults:', error);
        alert('Failed to calculate results');
    }
}

// ==================== UTILITY FUNCTIONS ====================

function formatValue(value, decimals = 4) {
    if (!Number.isFinite(value)) {
        return '-';
    }
    return value.toFixed(decimals);
}

function resetExperiment() {
    console.log('Resetting experiment...');
    
    // Clear all input fields
    const allInputs = document.querySelectorAll('.transistor-ib-input, .transistor-ic-input');
    allInputs.forEach(input => {
        input.value = '';
    });
    
    // Clear results
    const resultElements = ['beta-value', 'alpha-value', 'rin-value'];
    resultElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '-';
        }
    });
    
    // Destroy charts
    destroyChartSafely(inputChart, 'input-graph');
    destroyChartSafely(outputChart, 'output-graph');
    
    // Reset state
    experimentState.inputData = [];
    experimentState.outputData = {
        40: [],
        60: [],
        80: []
    };
    
    console.log('✓ Experiment reset complete');
    alert('Experiment reset successfully!');
}

console.log('Transistor.js loaded successfully');
