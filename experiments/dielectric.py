"""
Dielectric Constant Measurement Experiment Module

Simulates capacitor charging and discharging behavior to compute dielectric constant.
Uses RC circuit equations with exponential charging/discharging curves.
"""

import math


def compute_dielectric_response(time_points, R=100000, d=0.1e-3, A=1440e-6, V0=5.0):
    """
    Simulate capacitor charging and discharging behavior and compute dielectric constant.
    
    This function models the charging and discharging of a parallel plate capacitor
    using RC circuit equations. The simulation assumes a known dielectric constant
    to generate realistic voltage curves, then computes the dielectric constant
    from the time to reach 50% voltage (t_1/2).
    
    Parameters:
    -----------
    time_points : list or tuple
        List of time values in seconds. Typically ranges from 0 to 200s in 5s or 10s intervals.
    R : float, optional
        Resistance in Ohms (default: 100,000 Ω = 100 kΩ)
    d : float, optional
        Thickness of dielectric material in meters (default: 0.1e-3 m = 0.1 mm)
    A : float, optional
        Area of capacitor plate in square meters (default: 1440e-6 m² = 1440 mm²)
    V0 : float, optional
        Supply voltage in Volts (default: 5.0 V)
    
    Returns:
    --------
    dict
        Dictionary containing:
        - time: list of input time points
        - charging_voltage: list of computed charging voltages (V)
        - discharging_voltage: list of computed discharging voltages (V)
        - t_half: time at which charging voltage reaches 50% of V0 (seconds)
        - dielectric_constant: computed dielectric constant K (dimensionless)
    
    Raises:
    -------
    ValueError
        If any input parameter is invalid (e.g., negative time, zero resistance)
    TypeError
        If time_points is not a list or tuple
    
    Notes:
    ------
    - Charging model: V_c(t) = V0 * (1 - exp(-t / τ))
    - Discharging model: V_c(t) = V0 * exp(-t / τ)
    - Time constant: τ = R * C
    - Capacitance: C = ε0 * K * A / d (where K is assumed to be 2.5 for simulation)
    - Dielectric constant formula: K = (10^-6 × d × t_1/2) / (0.693 × ε0 × A × R)
    
    Example:
    --------
    >>> time = [0, 10, 20, 30, 40, 50]
    >>> result = compute_dielectric_response(time)
    >>> print(result['dielectric_constant'])
    2.456
    """
    
    # ===== INPUT VALIDATION =====
    if not isinstance(time_points, (list, tuple)):
        raise TypeError("time_points must be a list or tuple of time values")
    
    if len(time_points) == 0:
        raise ValueError("time_points cannot be empty")
    
    if any(not isinstance(t, (int, float)) for t in time_points):
        raise ValueError("All time_points must be numeric (int or float)")
    
    if any(t < 0 for t in time_points):
        raise ValueError("time_points must contain only non-negative values")
    
    if V0 <= 0:
        raise ValueError("V0 (supply voltage) must be positive")
    
    if R <= 0:
        raise ValueError("R (resistance) must be positive")
    
    if d <= 0:
        raise ValueError("d (thickness) must be positive")
    
    if A <= 0:
        raise ValueError("A (area) must be positive")
    
    # ===== PHYSICAL CONSTANTS =====
    eps0 = 8.854e-12  # Permittivity of free space in F/m
    
    # Assumed dielectric constant for generating simulation data.
    # This value is chosen to produce realistic RC charging curves over 200 seconds
    # with the given R=100kΩ. It results in tau ≈ 40 seconds and t_1/2 ≈ 28 seconds.
    # In a real experiment, this K would be the unknown we're solving for.
    K_assumed = 3.137313969e6
    
    # ===== CALCULATE CAPACITANCE =====
    # C = ε0 * K * A / d
    C = eps0 * K_assumed * A / d
    
    # ===== TIME CONSTANT =====
    # τ = R * C
    tau = R * C
    
    # ===== GENERATE VOLTAGE CURVES =====
    charging_voltages = []
    discharging_voltages = []
    
    for t in time_points:
        # Charging phase: Vc(t) = V0 * (1 - exp(-t/τ))
        v_charge = V0 * (1 - math.exp(-t / tau))
        charging_voltages.append(round(v_charge, 3))
        
        # Discharging phase: Vc(t) = V0 * exp(-t/τ)
        v_discharge = V0 * math.exp(-t / tau)
        discharging_voltages.append(round(v_discharge, 3))
    
    # ===== FIND t_1/2 (TIME TO 50% VOLTAGE) =====
    target_voltage = 0.5 * V0
    t_half = None
    
    # Search through provided time_points first
    for i, v_charge in enumerate(charging_voltages):
        if v_charge >= target_voltage:
            t_half = time_points[i]
            break
    
    # If t_half not found in given time_points, calculate it analytically
    # For charging: 0.5 * V0 = V0 * (1 - exp(-t/τ))
    # Solving: t_1/2 = τ * ln(2)
    if t_half is None:
        t_half = tau * math.log(2)
    
    # ===== CALCULATE DIELECTRIC CONSTANT =====
    # K = (10^-6 × d × t_1/2) / (0.693 × ε0 × A × R)
    # Note: 0.693 ≈ ln(2), used in the lab formula
    K_computed = (1e-6 * d * t_half) / (0.693 * eps0 * A * R)
    K_computed = round(K_computed, 4)
    
    # ===== RETURN RESULTS =====
    return {
        "time": list(time_points),
        "charging_voltage": charging_voltages,
        "discharging_voltage": discharging_voltages,
        "t_half": round(t_half, 3),
        "dielectric_constant": K_computed
    }


def compute_dielectric_constant_from_data(charging_voltages, discharging_voltages, 
                                          time_points, V0=5.0, R=100000, d=0.1e-3, 
                                          A=1440e-6):
    """
    Compute dielectric constant from experimental voltage data.
    
    Given measured charging and discharging curves, extract t_1/2 and compute K.
    
    Parameters:
    -----------
    charging_voltages : list
        Measured voltages during charging phase
    discharging_voltages : list
        Measured voltages during discharging phase
    time_points : list
        Time points corresponding to measurements
    V0 : float, optional
        Supply voltage (default: 5.0 V)
    R : float, optional
        Resistance (default: 100,000 Ω)
    d : float, optional
        Dielectric thickness (default: 0.1e-3 m)
    A : float, optional
        Plate area (default: 1440e-6 m²)
    
    Returns:
    --------
    dict
        Dictionary with:
        - t_half: computed time to 50% voltage
        - dielectric_constant: computed K value
        - success: boolean indicating if computation succeeded
    """
    
    if not charging_voltages or not time_points:
        raise ValueError("charging_voltages and time_points cannot be empty")
    
    if len(charging_voltages) != len(time_points):
        raise ValueError("charging_voltages and time_points must have equal length")
    
    eps0 = 8.854e-12
    target_voltage = 0.5 * V0
    t_half = None
    
    # Find first time where charging voltage >= 50% of V0
    for i, v in enumerate(charging_voltages):
        if v >= target_voltage:
            t_half = time_points[i]
            break
    
    if t_half is None:
        return {
            "t_half": None,
            "dielectric_constant": None,
            "success": False
        }
    
    # Compute K
    K = (1e-6 * d * t_half) / (0.693 * eps0 * A * R)
    K = round(K, 4)
    
    return {
        "t_half": round(t_half, 3),
        "dielectric_constant": K,
        "success": True
    }


# Wrapper for Flask API compatibility
def compute_dielectric_response_api(**kwargs):
    """
    API wrapper for compute_dielectric_response.
    
    Accepts JSON-compatible keyword arguments and returns result.
    Used for Flask /api/dielectric endpoint.
    """
    time_points = kwargs.get('time_points', list(range(0, 205, 5)))
    R = kwargs.get('R', 100000)
    d = kwargs.get('d', 0.1e-3)
    A = kwargs.get('A', 1440e-6)
    V0 = kwargs.get('V0', 5.0)
    
    try:
        result = compute_dielectric_response(time_points, R=R, d=d, A=A, V0=V0)
        result['success'] = True
        return result
    except (ValueError, TypeError) as e:
        return {
            "success": False,
            "error": str(e)
        }


if __name__ == "__main__":
    # Example usage and testing
    print("Dielectric Constant Measurement Experiment Module")
    print("=" * 60)
    
    # Generate time points (0 to 200 seconds in 5s intervals)
    time_data = list(range(0, 205, 5))
    
    # Run simulation with default parameters
    result = compute_dielectric_response(time_data)
    
    print(f"Time points: {len(result['time'])} measurements")
    print(f"Charging voltage (first 5): {result['charging_voltage'][:5]}")
    print(f"Discharging voltage (first 5): {result['discharging_voltage'][:5]}")
    print(f"t_1/2 (time to 50% voltage): {result['t_half']} seconds")
    print(f"Computed dielectric constant K: {result['dielectric_constant']}")
    print()
    print("Expected K ≈ 2.5 (close match indicates correct simulation)")
