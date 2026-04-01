# Virtual Physics Lab Simulator

## Project Overview

The Virtual Physics Lab Simulator is a web-based platform designed to help students perform common undergraduate physics experiments in a virtual environment.

The system allows students to:

- Interact with experimental setups
- Modify experimental parameters
- Record observations
- Generate graphs
- Perform calculations similar to real laboratory experiments

The goal of the project is to improve conceptual understanding of physics experiments by combining interactive simulations, measurement tables, and automated analysis tools.

This project replicates the workflow of a real physics laboratory where students:

1. Vary experimental parameters
2. Record measurements
3. Plot graphs
4. Calculate final results

---

## Objectives

- Provide an interactive environment for practicing laboratory experiments
- Help students visualize physical concepts through simulations
- Reduce dependency on physical lab infrastructure
- Allow students to analyze experimental data through graphs and calculations
- Make laboratory learning accessible through a web interface

---

## Completed Experiments

### 1. LCR Circuits-Forced Oscillations in Electrical Circuit

This experiment studies the frequency response of Series and Parallel LCR circuits.

### Features

- Adjustable frequency input using an interactive slider
- Automatic current measurement generation
- Observation table for recording experimental values
- Automatic graph generation (Current vs Frequency)
- Automatic calculation of:
  - Resonant Frequency
  - Bandwidth
  - Quality Factor
  - Inductance
- Supports both Series LCR and Parallel LCR analysis

### Learning Outcomes

Students can observe:

- Resonance behavior in LCR circuits
- Difference between series resonance and parallel resonance
- Relationship between frequency, impedance, and current

---

### 2. Diffraction Grating Experiment

This experiment demonstrates the diffraction of light through a grating to calculate the wavelength of light.

### Features

- Interactive simulation of a diffraction setup
- Movable diagram that changes the distance S
- Automatic calculation of wavelength
- Visualization of diffraction geometry
- Graph generation for better understanding of the concept
- Includes instrument noise simulation so each student obtains slightly different readings (similar to real laboratory measurements)


### Learning Outcomes

Students can understand:

- Diffraction patterns
- Relationship between grating spacing, angle, and wavelength
- How wavelength of light is experimentally determined

---

### 3. Determination of Planck's Constant

This experiment determines Planck’s constant using LEDs of different wavelengths by analyzing the relationship between knee voltage and frequency of light.

### Features

- Adjustable voltage input using interactive sliders for each LED
- Real-time LED glow based on applied voltage
- Visual detection of knee voltage (LED starts glowing brightly)
- Observation table for recording knee voltage values
- Automatic calculation of corrected voltage
- Automatic graph generation (Voltage vs 1/λ)
- Best-fit line calculation for accurate slope determination
- Automatic calculation of:
  - Planck’s Constant
  - Slope of V vs 1/λ graph
- Supports multiple LEDs (Red, Yellow, Green, Blue)

### Learning Outcomes

Students can observe:

- Relationship between energy and frequency of light
- Concept of threshold (knee) voltage in LEDs
- Linear relationship between voltage and inverse wavelength
- Experimental determination of Planck’s constant
- Data analysis using graphs and best-fit lines

---

### 4. Photodiode Characteristics

This experiment studies the reverse bias characteristics of a photodiode and determines its photo responsivity by analyzing the relationship between photocurrent, voltage, and light intensity.

### Features

- Adjustable reverse bias voltage using an interactive slider
- Real-time photocurrent calculation based on applied voltage
- Simulation of light intensity variation using distance control
- Observation table for recording I vs V data
- Automatic graph generation (Reverse Current vs Voltage)
- Automatic graph generation (Photocurrent vs Light Intensity)
- Linear region selection for accurate slope calculation
- Automatic calculation of:
  - Reverse Resistance of Photodiode
  - Photo Responsivity
- Supports both voltage variation and light intensity analysis phases

### Learning Outcomes

Students can observe:

- Reverse bias behavior of a photodiode
- Relationship between photocurrent and applied voltage
- Linear relationship between photocurrent and light intensity
- Concept of photo responsivity
- Effect of distance on light intensity (inverse square law)
- Graph-based analysis and slope interpretation

---

## Technologies Used

- Python (Flask) – Backend experiment computation
- JavaScript – Interactive simulation logic
- HTML / CSS – Experiment interface
- Chart.js – Graph generation
- GitHub – Version control and collaboration

---

## Upcoming Experiments

The following experiments are planned for future development:

- Determination of Fermi Energy
- Transistor Characteristics 
- Black Box
- Numerical Aperture of an Optical Fibre
- Measurement of Dielectric Constant
- Bending Loss in Optical Fibre
- Energy Gap of the Semiconductor

More experiments will be added incrementally to expand the virtual laboratory.

---

## Future Improvements

- More experiments simulations
- Data export for lab reports
- Improved visualization and animations
- AI assistance for better understanding of experiment

---

## Contribution

This project is currently under active development as part of a collaborative effort to build a complete virtual physics laboratory platform.



---

## License

This project is intended for educational and academic use.
