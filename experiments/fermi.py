def compute_fermi_response(temperatures_c, resistances):
    if not isinstance(temperatures_c, list) or not isinstance(resistances, list):
        raise ValueError("temperatures_c and resistances must be lists")

    if not temperatures_c or not resistances:
        raise ValueError("temperatures_c and resistances must not be empty")

    if len(temperatures_c) != len(resistances):
        raise ValueError("temperatures_c and resistances must have the same length")

    if any(r <= 0 for r in resistances):
        raise ValueError("All resistance values must be positive")

    temperatures_k = [t + 273.15 for t in temperatures_c]

    if any(t <= 0 for t in temperatures_k):
        raise ValueError("All temperatures in Kelvin must be positive")

    t_first = temperatures_k[0]
    t_last = temperatures_k[-1]
    r_first = resistances[0]
    r_last = resistances[-1]

    delta_t = t_last - t_first
    if delta_t == 0:
        raise ValueError("Cannot compute slope when first and last Kelvin temperatures are equal")

    slope = (r_last - r_first) / delta_t

    t_ref = t_first
    r_ref = r_first

    c_constant = 11.22e-19
    k_constant = 1.38e-23

    fermi_energy = c_constant * (t_ref / r_ref) ** 2 * (slope ** 2)
    fermi_temperature = fermi_energy / k_constant

    return {
        "temperatures_k": temperatures_k,
        "slope": slope,
        "fermi_energy": fermi_energy,
        "fermi_temperature": fermi_temperature,
    }
""" testing the backend logic with some sample data. In a real application, this would be replaced with proper unit tests.
if __name__ == "__main__":
    result = compute_fermi_response(
        temperatures_c=[273.15, 200, 100, 0],
        resistances=[1000, 800, 600, 400]
    )

    print(result)
"""