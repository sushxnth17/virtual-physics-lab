import math

def compute_lcr_response(R, L, C, f_min, f_max, points=200):
    """
    Compute the response of an LCR series circuit over a frequency range.

    Parameters:
    R (float): Resistance in ohms (must be > 0)
    L (float): Inductance in henry (must be > 0)
    C (float): Capacitance in farad (must be > 0)
    f_min (float): Minimum frequency in Hz (must be > 0)
    f_max (float): Maximum frequency in Hz (must be > f_min)
    points (int): Number of data points (default 200, must be > 0)

    Returns:
    dict: Dictionary containing resonant frequency, quality factor, and arrays for frequency, current, impedance
    """
    # Input validation
    if R <= 0:
        raise ValueError("Resistance R must be positive")
    if L <= 0:
        raise ValueError("Inductance L must be positive")
    if C <= 0:
        raise ValueError("Capacitance C must be positive")
    if f_min <= 0:
        raise ValueError("Minimum frequency f_min must be positive")
    if f_max <= f_min:
        raise ValueError("Maximum frequency f_max must be greater than f_min")
    if points < 2:
        raise ValueError("Number of points must be at least 2")

    # Compute resonant frequency: fr = 1 / (2π√(LC))
    fr = 1 / (2 * math.pi * math.sqrt(L * C))

    # Compute quality factor: Q = (1/R)√(L/C)
    Q = (1 / R) * math.sqrt(L / C)
    V = 1.0  # Assume RMS voltage of 1V
    # Generate frequency array
    frequency = []
    current = []
    impedance = []

    for i in range(points):
        f = f_min + i * (f_max - f_min) / (points - 1)
        frequency.append(f)

        # Inductive reactance: XL = 2πfL
        XL = 2 * math.pi * f * L

        # Capacitive reactance: XC = 1 / (2πfC)
        XC = 1 / (2 * math.pi * f * C)

        # Impedance: Z = √(R² + (XL − XC)²)
        Z = math.sqrt(R**2 + (XL - XC)**2)
        impedance.append(Z)

        # Current: I = V / Z (assuming RMS voltage V = 1V)
        
        if Z < 1e-12:  # Avoid division by zero or very small impedance
            I = 0
        else:
            I = V / Z
        current.append(I)

    return {
        "resonant_frequency": fr, #float: Resonant frequency in Hz
        "quality_factor": Q,      #float: Quality factor (dimensionless)
        "frequency": frequency,   #list[float]: List of frequencies in Hz
        "current": current,       #list[float]: List of current values in A (assuming 1V RMS)
        "impedance": impedance    #list[float]: List of impedance values in ohms
    }
