"""Backend computations for Planck's constant experiment using LEDs."""

from typing import Any, Dict, List


ELECTRON_CHARGE = 1.602e-19
SPEED_OF_LIGHT = 3.0e8
CREST_FACTOR = 1.11
ANGSTROM_TO_METER = 1e-10


def calculate_slope(x: List[float], y: List[float]) -> float:
	"""Calculate slope of y vs x using simple linear regression."""
	if not isinstance(x, list) or not isinstance(y, list):
		raise ValueError("x and y must be lists")
	if len(x) != len(y):
		raise ValueError("x and y must have the same length")
	if len(x) < 2:
		raise ValueError("At least two data points are required to compute slope")

	n = len(x)
	sum_x = sum(x)
	sum_y = sum(y)
	sum_xy = sum(xi * yi for xi, yi in zip(x, y))
	sum_x2 = sum(xi * xi for xi in x)

	denominator = (n * sum_x2) - (sum_x * sum_x)
	if denominator == 0:
		raise ValueError("Cannot compute slope because all x values are identical")

	return ((n * sum_xy) - (sum_x * sum_y)) / denominator


def calculate_planck_constant(slope: float) -> float:
	"""Calculate Planck's constant from slope using h = (e / c) * slope."""
	return (ELECTRON_CHARGE / SPEED_OF_LIGHT) * slope


def process_data(data: List[Dict[str, Any]]) -> Dict[str, Any]:
	"""Process LED measurements and compute slope and Planck's constant."""
	if not isinstance(data, list) or len(data) < 2:
		raise ValueError("data must be a list containing at least two LED records")

	processed_data: List[Dict[str, float]] = []
	inverse_lambda_values: List[float] = []
	corrected_voltage_values: List[float] = []

	for index, led in enumerate(data, start=1):
		if not isinstance(led, dict):
			raise ValueError(f"Each LED record must be a dictionary (record {index})")

		if "wavelength" not in led or "knee_voltage" not in led:
			raise ValueError(
				"Each LED record must include 'wavelength' (Angstrom) and 'knee_voltage'"
			)

		wavelength_angstrom = float(led["wavelength"])
		knee_voltage = float(led["knee_voltage"])

		if wavelength_angstrom <= 0:
			raise ValueError(f"wavelength must be positive (record {index})")

		wavelength_m = wavelength_angstrom * ANGSTROM_TO_METER
		corrected_voltage = CREST_FACTOR * knee_voltage
		inverse_lambda = 1.0 / wavelength_m

		processed_row = {
			"wavelength_angstrom": wavelength_angstrom,
			"wavelength_m": wavelength_m,
			"knee_voltage": knee_voltage,
			"corrected_voltage": corrected_voltage,
			"inverse_lambda": inverse_lambda,
		}

		processed_data.append(processed_row)
		inverse_lambda_values.append(inverse_lambda)
		corrected_voltage_values.append(corrected_voltage)

	slope = calculate_slope(inverse_lambda_values, corrected_voltage_values)
	planck_constant = calculate_planck_constant(slope)

	return {
		"constants": {
			"electron_charge": ELECTRON_CHARGE,
			"speed_of_light": SPEED_OF_LIGHT,
			"crest_factor": CREST_FACTOR,
			"angstrom_to_meter": ANGSTROM_TO_METER,
		},
		"processed_data": processed_data,
		"x_inverse_wavelength": inverse_lambda_values,
		"y_corrected_voltage": corrected_voltage_values,
		"slope": slope,
		"planck_constant": planck_constant,
	}


def compute_planck_response(data: List[Dict[str, Any]] = None, **kwargs: Any) -> Dict[str, Any]:
	"""API wrapper for the Planck experiment backend."""
	led_data = data
	if led_data is None:
		led_data = kwargs.get("data")
	if led_data is None:
		led_data = kwargs.get("led_data")

	if led_data is None:
		raise ValueError("Provide LED measurements under 'data' or 'led_data'")

	return process_data(led_data)
if __name__ == "__main__":
    sample_data = [
        {"wavelength": 6500, "knee_voltage": 1.8},
        {"wavelength": 5900, "knee_voltage": 2.0},
        {"wavelength": 5100, "knee_voltage": 2.2},
        {"wavelength": 4700, "knee_voltage": 2.5}
    ]

    result = process_data(sample_data)

    from pprint import pprint
    pprint(result)