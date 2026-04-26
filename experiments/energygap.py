"""Backend computations for the energy gap of semiconductor experiment."""

import math
from typing import Dict, List, Tuple, Any


BOLTZMANN_CONSTANT = 1.38e-23
EV_DENOMINATOR = 1.601e-19
CELSIUS_TO_KELVIN_OFFSET = 273.0
THERMISTOR_R0 = 2000.0
THERMISTOR_T0_K = 348.0
THERMISTOR_B = 3500.0


def validate_input(temp_c: List[Any], resistance: List[Any]) -> Tuple[List[float], List[float]]:
    """Validate request arrays and return numeric vectors."""

    if temp_c is None or resistance is None:
        raise ValueError("Both 'temp_c' and 'resistance' arrays are required.")

    if not isinstance(temp_c, list) or not isinstance(resistance, list):
        raise ValueError("'temp_c' and 'resistance' must be lists.")

    if len(temp_c) != len(resistance):
        raise ValueError("'temp_c' and 'resistance' must have the same length.")

    if len(temp_c) < 3:
        raise ValueError("At least 3 data points are required.")

    temp_values: List[float] = []
    res_values: List[float] = []

    for index, (temp, res) in enumerate(zip(temp_c, resistance), start=1):
        if temp is None or res is None:
            raise ValueError(f"Missing value at row {index}.")

        try:
            temp_value = float(temp)
            res_value = float(res)
        except (TypeError, ValueError):
            raise ValueError(f"Non-numeric value found at row {index}.")

        if res_value <= 0:
            raise ValueError(f"Resistance must be positive at row {index}.")

        temp_values.append(temp_value)
        res_values.append(res_value)

    return temp_values, res_values


def compute_values(temp_c: List[float], resistance: List[float]) -> Tuple[List[float], List[float], List[float]]:
    """Compute table columns: temperature in K, log10(R), and 1/T."""

    temp_k: List[float] = []
    log_r: List[float] = []
    inv_t: List[float] = []

    for index, (temp, res) in enumerate(zip(temp_c, resistance), start=1):
        t_kelvin = temp + CELSIUS_TO_KELVIN_OFFSET

        if t_kelvin <= 0:
            raise ValueError(f"Invalid temperature (Kelvin <= 0) at row {index}.")

        if res <= 0:
            raise ValueError(f"Invalid resistance for log10 at row {index}.")

        temp_k.append(t_kelvin)
        log_r.append(math.log10(res))
        inv_t.append(1.0 / t_kelvin)

    return temp_k, log_r, inv_t


def compute_resistance_from_temperature(temp_c: float) -> float:
    """Compute thermistor resistance using fixed model constants."""

    temp_k = temp_c + CELSIUS_TO_KELVIN_OFFSET

    if temp_k <= 0:
        raise ValueError("Invalid temperature (Kelvin <= 0) for resistance computation.")

    resistance = THERMISTOR_R0 * math.exp(THERMISTOR_B * ((1.0 / temp_k) - (1.0 / THERMISTOR_T0_K)))

    if resistance <= 0 or not math.isfinite(resistance):
        raise ValueError("Computed resistance is invalid.")

    return resistance


def calculate_slope(x_values: List[float], y_values: List[float]) -> float:
    """Calculate slope using least-squares linear regression."""

    if len(x_values) != len(y_values):
        raise ValueError("x_values and y_values must have the same length.")

    if len(x_values) < 2:
        raise ValueError("At least two points are required to calculate slope.")

    n = len(x_values)
    sum_x = sum(x_values)
    sum_y = sum(y_values)
    sum_xy = sum(x * y for x, y in zip(x_values, y_values))
    sum_x2 = sum(x * x for x in x_values)

    denominator = (n * sum_x2) - (sum_x * sum_x)

    if abs(denominator) < 1e-20:
        raise ValueError("Cannot calculate slope because all 1/T values are identical.")

    slope = ((n * sum_xy) - (sum_x * sum_y)) / denominator

    return slope


def compute_energygap_response(temp_c=None, resistance=None, **kwargs) -> Dict[str, Any]:
    """API handler for energy gap calculation."""

    if temp_c is None:
        temp_c = kwargs.get("temp_c")

    if resistance is None:
        resistance = kwargs.get("resistance")

    validated_temp_c, validated_resistance = validate_input(temp_c, resistance)

    # Use measured resistance values from the simulation (with controlled noise)
    # so each run reflects realistic experimental variation.
    temp_k, log_r, inv_t = compute_values(validated_temp_c, validated_resistance)

    slope = calculate_slope(inv_t, log_r)

    # Use absolute value since slope is typically negative for thermistor
    slope_abs = abs(slope)

    # Energy gap in eV
    eg_ev = (2.303 * 2.0 * BOLTZMANN_CONSTANT * slope_abs) / EV_DENOMINATOR

    return {
        "temp_K": temp_k,
        "resistance": validated_resistance,
        "logR": log_r,
        "invT": inv_t,
        "slope": slope,
        "Eg": eg_ev
    }