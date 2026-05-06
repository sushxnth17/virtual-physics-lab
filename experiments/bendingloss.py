"""
Bending Loss in Optical Fibers Experiment Module.

Simulates voltage attenuation through an optical fiber using exponential decay
and computes the attenuation constant from two measured fiber lengths.
"""

import math
import random


RECORDED_READINGS = []


def simulate_voltage(L, V0=5.0, k=0.12):
	"""
	Simulate the output voltage at a given optical fiber length.

	The model uses exponential decay to represent attenuation of light intensity
	along the fiber with small random noise:

		V = V0 * exp(-k * L) + noise

	Parameters:
		L (float): Fiber length in km.
		V0 (float, optional): Initial voltage / light level. Must be positive.
		k (float, optional): Attenuation coefficient (0.12 for realistic 0.5-1.2 dB/km attenuation).

	Returns:
		float: Simulated voltage rounded to 3 decimal places.

	Raises:
		ValueError: If L is not positive or if V0 / k are not positive.
	"""
	if not isinstance(L, (int, float)):
		raise ValueError("L must be a numeric value")
	if L <= 0:
		raise ValueError("L must be positive")
	if not isinstance(V0, (int, float)):
		raise ValueError("V0 must be a numeric value")
	if V0 <= 0:
		raise ValueError("V0 must be greater than 0")
	if not isinstance(k, (int, float)):
		raise ValueError("k must be a numeric value")
	if k <= 0:
		raise ValueError("k must be greater than 0")

	voltage = V0 * math.exp(-k * L)
	# Add small random noise (±0.002 V) for realistic sensor variance
	noise = random.uniform(-0.002, 0.002)
	voltage_with_noise = voltage + noise
	return round(voltage_with_noise, 3)


def compute_attenuation(L1, L2, V1, V2):
	"""
	Calculate the attenuation constant for two fiber measurements.

	Formula:
		alpha = (10 / abs(L1 - L2)) * log10(V1 / V2)

	Parameters:
		L1 (float): First fiber length in km.
		L2 (float): Second fiber length in km.
		V1 (float): Measured voltage at L1.
		V2 (float): Measured voltage at L2.

	Returns:
		float: Attenuation constant rounded to 4 decimal places.

	Raises:
		ValueError: If inputs are invalid or the calculation is not defined.
	"""
	for name, value in (("L1", L1), ("L2", L2), ("V1", V1), ("V2", V2)):
		if not isinstance(value, (int, float)):
			raise ValueError(f"{name} must be numeric")

	if L1 == L2:
		raise ValueError("L1 and L2 must be different")
	if V1 <= 0 or V2 <= 0:
		raise ValueError("V1 and V2 must be greater than 0")

	try:
		alpha = (10.0 / abs(L1 - L2)) * math.log10(V1 / V2)
	except (ValueError, ZeroDivisionError, OverflowError) as exc:
		raise ValueError(f"Unable to compute attenuation: {exc}") from exc

	if not math.isfinite(alpha):
		raise ValueError("Attenuation calculation produced a non-finite result")

	return round(alpha, 4)


def compute_experiment(L1, L2, V0=5.0, k=0.12):
	"""
	Run the full bending-loss experiment simulation.

	Parameters:
		L1 (float): First fiber length in km.
		L2 (float): Second fiber length in km.
		V0 (float, optional): Initial voltage / light level. Defaults to 5.0.
		k (float, optional): Attenuation coefficient. Defaults to 0.8.

	Returns:
		dict: Experiment result containing L1, L2, V1, V2 and attenuation.

	Raises:
		ValueError: If any input is invalid.
	"""
	V1 = simulate_voltage(L1, V0=V0, k=k)
	V2 = simulate_voltage(L2, V0=V0, k=k)
	attenuation = compute_attenuation(L1, L2, V1, V2)

	return {
		"L1": L1,
		"L2": L2,
		"V1": V1,
		"V2": V2,
		"attenuation": attenuation,
	}


def compute_api(**kwargs):
	"""
	Flask API wrapper for the bending-loss experiment.

	Required keyword arguments:
		L1 (float): First fiber length in km.
		L2 (float): Second fiber length in km.

	Optional keyword arguments:
		V0 (float): Initial voltage / light level. Defaults to 5.0.
		k (float): Attenuation coefficient. Defaults to 0.8.

	Returns:
		dict: JSON-serializable response with success flag and either data or error.
	"""
	try:
		if "L1" not in kwargs:
			raise ValueError("L1 is required")
		if "L2" not in kwargs:
			raise ValueError("L2 is required")

		L1 = kwargs.get("L1")
		L2 = kwargs.get("L2")
		V0 = kwargs.get("V0", 5.0)
		k = kwargs.get("k", 0.8)

		result = compute_experiment(L1, L2, V0=V0, k=k)
		return {
			"success": True,
			"data": result,
		}
	except (ValueError, TypeError) as exc:
		return {
			"success": False,
			"error": str(exc),
		}


def compute_bendingloss_response(**kwargs):
	"""
	Flask compatibility wrapper for the dynamic /api/bendingloss route.

	The app expects a function named compute_<experiment>_response.
	"""
	# For the interactive simulation we accept a single fiber length (meters)
	# and return the simulated output voltage plus a running attenuation value
	# computed from the most recent pair of readings.
	try:
		if kwargs.get('reset'):
			RECORDED_READINGS.clear()
			return {
				'success': True,
				'data': {
					'length_m': None,
					'length_km': None,
					'voltage': None,
					'attenuation_constant': None,
					'reset': True,
				},
			}

		length_m = kwargs.get('length_m')
		if length_m is None:
			raise ValueError('length_m is required')
		# Convert to float and to kilometers for the internal model
		length_m = float(length_m)
		if length_m <= 0:
			raise ValueError('length_m must be positive')
		# Optional parameters
		V0 = float(kwargs.get('V0', 5.0))
		k = float(kwargs.get('k', 0.8))
		# Use existing simulate_voltage which expects length in km
		L_km = length_m / 1000.0
		voltage = simulate_voltage(L_km, V0=V0, k=k)

		current_reading = {
			'length_m': length_m,
			'length_km': L_km,
			'voltage': voltage,
		}

		attenuation_constant = None
		if RECORDED_READINGS:
			previous_reading = RECORDED_READINGS[-1]
			try:
				attenuation_constant = compute_attenuation(
					previous_reading['length_km'],
					current_reading['length_km'],
					previous_reading['voltage'],
					current_reading['voltage'],
				)
			except ValueError:
				attenuation_constant = None

		RECORDED_READINGS.append(current_reading)
		return {
			'success': True,
			'data': {
				'length_m': length_m,
				'length_km': L_km,
				'voltage': voltage,
				'attenuation_constant': attenuation_constant,
			}
		}
	except (ValueError, TypeError) as exc:
		return {'success': False, 'error': str(exc)}



