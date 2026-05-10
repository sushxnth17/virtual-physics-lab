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

### 9.Determination of Dielectric Constant
This experiment determines the dielectric constant of a dielectric material by studying the charging and discharging behavior of a capacitor in an RC circuit and analyzing the variation of voltage with time.


### Features
- Interactive simulation of RC circuit setup
- Virtual capacitor charging and discharging process
- Adjustable dielectric material insertion
- Real-time voltage monitoring using virtual voltmeter
- Automatic calculation of time constant (RC)
- Dynamic plotting of charging and discharging curves
- Automatic computation of dielectric constant (K)
- Tabular recording of voltage and time readings
- Interactive controls for resistance and capacitance variation
- Realistic circuit visualization with animated current flow


### Learning Outcomes
Students can understand:
- Concept of dielectric materials and polarization
- Effect of dielectric medium on capacitance
- Charging and discharging behavior of capacitors
- Relationship between voltage and time in RC circuits
- Determination of dielectric constant experimentally
- Importance of dielectric materials in electronic circuits
- Graphical analysis of capacitor response curves
- Practical applications of capacitors and dielectrics

---

### 10.Bending Loss in Optical Fiber 
This experiment determines the attenuation constant of an optical fiber by studying the reduction in light intensity and output voltage for different fiber lengths and bending conditions.


### Features
- Interactive simulation of optical fiber communication setup
- Virtual laser source with ON/OFF control
- Realistic optical fiber transmission visualization
- Adjustable optical fiber lengths
- Solar panel detector for light intensity measurement
- Real-time voltage display using virtual voltmeter
- Automatic calculation of attenuation constant
- Dynamic signal strength indication
- Tabular recording of fiber length and voltage readings
- Visual demonstration of light attenuation in optical fibers


### Learning Outcomes
Students can understand:
- Basic principle of optical fiber communication
- Concept of attenuation and bending loss in fibers
- Effect of fiber length on signal strength
- Relationship between optical power and output voltage
- Experimental determination of attenuation constant
- Working of laser source and optical detectors
- Importance of low-loss transmission in communication systems
- Applications of optical fibers in modern networking and communication

---

### 11.Transistor Characteristics
This experiment studies the DC characteristics of a bipolar junction transistor (BJT) by measuring the collector current (`IC`) as a function of collector-emitter voltage (`VCE`) for different base currents (`IB`), and the transfer characteristics (`IC` vs `IB`) at a fixed `VCE`.


### Features
- Interactive simulation of a common-emitter transistor setup
- Adjustable base current (`IB`) or base-bias control
- Adjustable collector-emitter voltage (`VCE`) with optional automatic sweep
- Virtual ammeter and voltmeter for real-time measurements
- Observation table for systematic data recording of `VCE`, `IB`, and `IC`
- Automatic graph generation:
  - `IC` vs `VCE` (family of output characteristic curves for different `IB`)
  - `IC` vs `IB` (transfer characteristic at fixed `VCE`)
- Automatic calculation of:
  - DC current gain (β = `IC` / `IB`) in the active region
  - Output resistance / Early-effect estimation from `IC` vs `VCE` slope
- Instrument-noise simulation to emulate realistic measurement variation


### Learning Outcomes
Students can understand:
- Operating regions of a BJT: cutoff, active, and saturation
- How `IC` depends on both `IB` and `VCE` (including Early effect)
- Determination of DC current gain (β) from transfer characteristics
- Extraction of output resistance and its significance for amplifier design
- Practical data collection, plotting, and parameter extraction from characteristic curves


---


## Technologies Used

- Python (Flask) – Backend experiment computation
- JavaScript – Interactive simulation logic
- HTML / CSS – Experiment interface
- Chart.js – Graph generation
- GitHub – Version control and collaboration


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
