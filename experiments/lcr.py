import math


def compute_lcr_response(circuit_type, R, L, C, f_min, f_max, points=200, V=1.0):
    """
    Compute the response (current vs frequency) of Series or Parallel LCR circuits.
    
    This function calculates impedance, current, resonant frequency, and quality factors
    for both Series and Parallel LCR circuits over a specified frequency range.
    
    Circuit-Specific Behavior:
    - Series LCR: Current peaks at resonance, decreases on either side
      - Z = √(R² + (ωL − 1/ωC)²)
      - Q_theoretical = (1/R)√(L/C)
    
    - Parallel LCR: Current reaches minimum at resonance (anti-resonance)
      - Y = √((1/R)² + (ωC − 1/ωL)²); Z = 1/Y
      - Q_theoretical = R√(C/L)
    
    Parameters:
    -----------
    circuit_type (str): Type of circuit - "series" or "parallel"
    R (float): Resistance in ohms (must be > 0)
    L (float): Inductance in henry (must be > 0)
    C (float): Capacitance in farad (must be > 0)
    f_min (float): Minimum frequency in Hz (must be > 0)
    f_max (float): Maximum frequency in Hz (must be > f_min)
    points (int): Number of frequency points to sweep (default 200, must be >= 2)
    V (float): RMS voltage in volts (default 1.0, must be > 0)
    
    Returns:
    --------
    dict: JSON-serializable dictionary containing:
        - circuit_type (str): Type of circuit analyzed
        - resonant_frequency (float): Resonant frequency in Hz
        - bandwidth (float): Bandwidth at half-power points in Hz
        - f1 (float): Lower half-power frequency in Hz
        - f2 (float): Upper half-power frequency in Hz
        - quality_factor_theoretical (float): Theoretical Q factor
        - quality_factor_experimental (float): Q factor computed from bandwidth
        - frequency (list[float]): Frequency sweep array in Hz
        - current (list[float]): Current magnitude at each frequency in A
    
    Raises:
    -------
    ValueError: If input parameters are invalid or out of range
    """
    
    # Input validation
    circuit_type = circuit_type.lower().strip()
    if circuit_type not in ["series", "parallel"]:
        raise ValueError("circuit_type must be 'series' or 'parallel'")
    if R <= 0:
        raise ValueError("Resistance R must be positive")
    if L <= 0:
        raise ValueError("Inductance L must be positive")
    if C <= 0:
        raise ValueError("Capacitance C must be positive")
    if f_min <= 0:
        raise ValueError("Minimum frequency f_min must be positive")
    if f_max < f_min:
        raise ValueError("Maximum frequency f_max must be greater than or equal to f_min")
    if points < 1:
        raise ValueError("Number of points must be at least 1")
    if V <= 0:
        raise ValueError("Voltage V must be positive")
    
    # ========== RESONANT FREQUENCY ==========
    # fr = 1 / (2π√(LC)) — same for both circuit types
    sqrt_lc = math.sqrt(L * C)
    fr = 1.0 / (2 * math.pi * sqrt_lc)
    
    # ========== THEORETICAL QUALITY FACTOR ==========
    # Circuit-specific formulas:
    if circuit_type == "series":
        # Q_theoretical = (1/R) * √(L/C)
        Q_theoretical = (1.0 / R) * math.sqrt(L / C)
    else:  # parallel
        # Q_theoretical = R * √(C/L)
        Q_theoretical = R * math.sqrt(C / L)
    
    # ========== FREQUENCY SWEEP & IMPEDANCE/CURRENT CALCULATION ==========
    frequency = []
    current = []
    impedance = []
    for i in range(points):
        # Linear frequency sweep from f_min to f_max
        f = f_min + i * (f_max - f_min) / max(points - 1, 1)
        frequency.append(f)
        
        # Angular frequency: ω = 2πf
        omega = 2 * math.pi * f
        
        # Reactances
        XL = omega * L  # Inductive reactance
        
        # Capacitive reactance with guard against division by zero
        eps = 1e-15
        if abs(omega * C) < eps:
            XC = 1e15  # Very large value
        else:
            XC = 1.0 / (omega * C)
        
        # Impedance calculation (circuit-specific)
        

    
            
        
        # Current magnitude: compute consistently as I = V / Z
        # Protect against extremely small Z by using a large but finite current
        if circuit_type == "series":
            Z = math.sqrt(R**2 + (XL - XC)**2)
            I = V / Z
            impedance.append(Z)
        else:
            I_R = V / R
            I_L = V / (omega * L) 
            I_C = V * omega * C
            I = math.sqrt(I_R**2 + (I_C - I_L)**2)

            impedance.append(1.0 / V / I if I > eps else 1e15)
        current.append(I)
    # ========== HALF-POWER POINT ANALYSIS ==========
    # Find f1 and f2 numerically by identifying extreme current value
    # and computing half-power threshold
    
    if circuit_type == "series":
        # Series: current peaks at resonance
        I_extremum = max(current) if current else 1.0
        # Half-power: I_half = I_max / √2
        I_half = I_extremum / math.sqrt(2)
        
        # Find f1 (first crossing) and f2 (second crossing) of half-power threshold
        # Looking for indices where current >= I_half
        f1 = None
        f2 = None
        for i in range(len(current)):
            if current[i] >= I_half:
                if f1 is None:
                    f1 = frequency[i]
                f2 = frequency[i]
    
    else:  # parallel
        # Parallel: current reaches minimum at resonance (anti-resonance)
        I_min = min(current) if current else 1.0
        # Half-power: I_half = I_min * √2
        I_half = I_min * math.sqrt(2)
        
        # Find f1 (first crossing) and f2 (second crossing) of half-power threshold
        # Looking for indices where current <= I_half
        f1 = None
        f2 = None
        for i in range(len(current)):
            if current[i] >= I_half:
                if f1 is None:
                    f1 = frequency[i]
                f2 = frequency[i]
    
    # ========== FALLBACK FOR HALF-POWER POINTS ==========
    # If half-power points are not clearly defined, estimate from theoretical Q
    if f1 is None or f2 is None or f1 == f2:
        if Q_theoretical > 0:
            bandwidth_est = fr / Q_theoretical
            f1 = max(f_min, fr - bandwidth_est / 2)
            f2 = min(f_max, fr + bandwidth_est / 2)
        else:
            f1 = f_min
            f2 = f_max
    
    # Ensure f1 < f2
    if f1 > f2:
        f1, f2 = f2, f1
    
    # ========== EXPERIMENTAL QUALITY FACTOR ==========
    # Q_experimental = fr / bandwidth
    bandwidth = f2 - f1
    if bandwidth > 1e-15:
        Q_experimental = fr / bandwidth
    else:
        Q_experimental = Q_theoretical  # Fallback to theoretical
    
    # ========== RETURN OPTIMIZED FOR CURRENT vs FREQUENCY GRAPH ==========
    return {
        "circuit_type": circuit_type,
        "resonant_frequency": fr,
        "bandwidth": bandwidth,
        "impedance": impedance,
        "f1": f1,
        "f2": f2,
        "quality_factor_theoretical": Q_theoretical,
        "quality_factor_experimental": Q_experimental,
        "frequency": frequency,
        "current": current
    }
