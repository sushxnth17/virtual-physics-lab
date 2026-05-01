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

### 5.Black Box Experiment – Identification of Unknown Components

This experiment helps determine whether unknown components inside a black box are a Resistor, Capacitor, or Inductor by analyzing their impedance behavior with varying frequency.

### Features
- Component selection (Z1, Z2, Z3) for independent testing
- Simulated Ammeter and Voltmeter for real-time readings
- Frequency selection (1 kHz to 5 kHz in steps)
- Record button to store measured voltage and current values
- Observation table for systematic data entry
- Automatic impedance calculation for each component
- Automatic inference of component type based on frequency response
- Backend integration for calculation and validation

### Learning Outcomes

Students can observe:

- How impedance varies with frequency for different components
- Identification of resistor (constant impedance), capacitor (decreasing), and inductor (increasing)
- Relationship between voltage, current, and impedance
- Practical understanding of experimental data recording and analysis
- Concept of using indirect measurements to identify unknown components

---

### 6.Fermi Energy Experiment

This experiment demonstrates the concept of Fermi energy in metals by analyzing electron behavior and calculating the energy level at absolute zero temperature.

### Features
- Interactive simulation of electron distribution in a metal
- Input-based calculation of Fermi energy
- Visualization of energy levels and electron occupancy
- Automatic computation using standard Fermi energy formulas
- Displays key physical parameters like electron density and energy
- Clean and intuitive interface for quick experimentation

### Learning Outcomes

Students can understand:

- Concept of Fermi energy and its physical significance
- Behavior of electrons in metals at absolute zero
- Relationship between electron density and energy levels
- Application of quantum mechanics in solid-state physics
- How Fermi energy is calculated and interpreted

---

### 7.Numerical Aperture of Optical Fiber Experiment
This experiment determines the numerical aperture (NA) and acceptance angle of an optical fiber by analyzing the light output pattern formed on a screen.


### Features
- Interactive simulation of optical fiber light propagation
- Adjustable distance between fiber and screen (L)
- Measurement of spot diameter (D) on the screen
- Automatic calculation of:
   Acceptance angle (θₐ)
   Numerical Aperture (NA)
- Visualization of light cone and ray propagation
- Tabular data recording for multiple observations
- Computation of mean acceptance angle and numerical aperture


### Learning Outcomes

Students can understand:

- Concept of numerical aperture and acceptance angle
- Light propagation through optical fibers
- Relationship between spot diameter, distance, and angle
- How optical fibers gather and transmit light
- Practical method to calculate NA using experimental data


---


### 8.Energy Gap of Semiconductor Experiment
This experiment determines the energy gap of a semiconductor (thermistor) by studying the variation of resistance with temperature and analyzing the relationship betweenlog R and inverse temperature (1/T).


### Features
- Interactive simulation of thermistor-based circuit setup
- Temperature-controlled environment (heating and cooling)
- Real-time resistanceresistancent using virtual ohmmeter
- Automatic calculation of:
   Temperature in Kelvin
   log R values
  1/T values
- Graph generation of log R vs 1/T
- Linear best-fit line to determine slope (S)
- Automatic computation of energy gap (E₉)
- Tabular data recording for multiple         temperature readings


### Learning Outcomes
Students can understand:
- Concept of energy gap in semiconductors
- Behavior of thermistors with temperature    variation
- Relationship between resistance and         temperature
- Graphical analysis using log R vs 1/T
- How energy gap is experimentally            determined using slope


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

- Transistor Characteristics 
- Measurement of Dielectric Constant
- Bending Loss in Optical Fibre

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
