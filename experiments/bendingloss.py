"""
Bending Loss in Optical Fibers Experiment Module.

Simulates voltage attenuation through an optical fiber using exponential decay
and computes the attenuation constant from two measured fiber lengths.
"""

import math


def simulate_voltage(L, V0=5.0, k=0.8):
	"""
	Simulate the output voltage at a given optical fiber length.

	The model uses exponential decay to represent attenuation of light intensity
	along the fiber:

		V = V0 * exp(-k * L)

	Parameters:
		L (float): Fiber length in km.
		V0 (float, optional): Initial voltage / light level. Must be positive.
		k (float, optional): Attenuation coefficient. Must be positive.

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
	return round(voltage, 3)


def compute_attenuation(L1, L2, V1, V2):
	"""
	Calculate the attenuation constant for two fiber measurements.

	Formula:
		alpha = (10 / (L1 - L2)) * log10(V2 / V1)

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
		alpha = (10.0 / (L1 - L2)) * math.log10(V2 / V1)
	except (ValueError, ZeroDivisionError, OverflowError) as exc:
		raise ValueError(f"Unable to compute attenuation: {exc}") from exc

	if not math.isfinite(alpha):
		raise ValueError("Attenuation calculation produced a non-finite result")

	return round(alpha, 4)


def compute_experiment(L1, L2, V0=5.0, k=0.8):
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
	return compute_api(**kwargs)



