"""Backend computations for Fermi energy experiment."""

import math
from typing import List, Dict, Any

BOLTZMANN_CONSTANT = 1.38e-23
FERMI_CONSTANT = 11.22e-19  # given in lab manual


def validate_input(temperatures_c: List[float], resistances: List[float]):
    if not isinstance(temperatures_c, list) or not isinstance(resistances, list):
        raise ValueError("temperatures_c and resistances must be lists")

    if len(temperatures_c) != len(resistances):
        raise ValueError("temperatures_c and resistances must have same length")

    if len(temperatures_c) < 3:
        raise ValueError("At least 3 data points required")

    for i, (t, r) in enumerate(zip(temperatures_c, resistances), start=1):
        if t is None or r is None:
            raise ValueError(f"Missing value at row {i}")

        try:
            t = float(t)
            r = float(r)
        except:
            raise ValueError(f"Invalid numeric value at row {i}")

        if r <= 0:
            raise ValueError(f"Resistance must be positive at row {i}")


def compute_kelvin(temperatures_c: List[float]) -> List[float]:
    return [t + 273.15 for t in temperatures_c]


def calculate_slope(x: List[float], y: List[float]) -> float:
    """
    Least squares linear regression
    x = Temperature (K)
    y = Resistance (Ω)
    """
    n = len(x)
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    sum_x2 = sum(xi * xi for xi in x)

    denominator = (n * sum_x2) - (sum_x ** 2)

    if abs(denominator) < 1e-12:
        raise ValueError("Cannot compute slope (degenerate data)")

    slope = ((n * sum_xy) - (sum_x * sum_y)) / denominator
    return slope


def compute_fermi_response(
    temperatures_c: List[float],
    resistances: List[float]
) -> Dict[str, Any]:

    validate_input(temperatures_c, resistances)

    # Convert to Kelvin
    temperatures_k = compute_kelvin(temperatures_c)

    # Sort data (important for stability)
    combined = sorted(zip(temperatures_k, resistances))
    temperatures_k = [t for t, _ in combined]
    resistances = [r for _, r in combined]

    # Calculate slope (ΔR / ΔT)
    slope = calculate_slope(temperatures_k, resistances)

    # Reference values (first point)
    T = temperatures_k[0]
    R = resistances[0]

    # Fermi Energy
    fermi_energy = FERMI_CONSTANT * ((T / R) ** 2) * (slope ** 2)

    # Fermi Temperature
    fermi_temperature = fermi_energy / BOLTZMANN_CONSTANT

    return {
        "temperatures_K": temperatures_k,
        "resistances": resistances,
        "slope": slope,
        "fermi_energy": fermi_energy,
        "fermi_temperature": fermi_temperature
    }


# # Example test
# if __name__ == "__main__":
#     result = compute_fermi_response(
#         temperatures_c=[85, 80, 75, 70, 65, 60],
#         resistances=[5.6, 5.5, 5.4, 5.3, 5.2, 5.1]
#     )

#     print(result)