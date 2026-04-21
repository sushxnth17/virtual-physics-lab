"""Backend computations for the black box experiment."""

from math import pi


def _validate_vector(name, values, expected_len):
	if not isinstance(values, list):
		raise ValueError(f"{name} must be a list.")
	if len(values) != expected_len:
		raise ValueError(f"{name} must have {expected_len} values.")
	for value in values:
		if value is None:
			raise ValueError(f"{name} contains empty value.")
		if float(value) <= 0:
			raise ValueError(f"{name} must contain positive values only.")


def _impedance(voltage_values, current_values):
	result = []
	for v, i in zip(voltage_values, current_values):
		current = float(i)
		if abs(current) < 1e-12:
			raise ValueError("Current value too small, division by zero risk.")
		result.append(float(v) / current)
	return result


def _classify_component(freq_values, impedance_values):
	first = impedance_values[0]
	last = impedance_values[-1]
	relative_change = abs(last - first) / max(abs(first), 1e-9)

	if relative_change <= 0.15:
		component_type = "Resistor"
		component_values = impedance_values
		unit = "ohm"
		value = sum(component_values) / len(component_values)
	elif last > first:
		component_type = "Inductor"
		component_values = [z / (2 * pi * f) for f, z in zip(freq_values, impedance_values)]
		unit = "H"
		value = sum(component_values) / len(component_values)
	else:
		component_type = "Capacitor"
		component_values = []
		for f, z in zip(freq_values, impedance_values):
			if f <= 0 or abs(z) < 1e-12:
				raise ValueError("Invalid frequency or impedance for capacitor calculation.")
			component_values.append(1.0 / (2 * pi * f * z))
		unit = "F"
		value = sum(component_values) / len(component_values)

	trend = "constant" if component_type == "Resistor" else (
		"increasing with frequency" if component_type == "Inductor" else "decreasing with frequency"
	)

	return {
		"type": component_type,
		"trend": trend,
		"value": value,
		"unit": unit,
		"values_per_frequency": component_values,
	}


def compute_blackbox_response(freq, V1, I1, V2, I2, V3, I3):
	"""
	Compute impedance trends and identify Z1, Z2, Z3 as R/L/C.

	Inputs:
	- freq: list of frequencies in Hz
	- V1, V2, V3: voltages in V
	- I1, I2, I3: currents in A
	"""

	expected_len = 5
	_validate_vector("freq", freq, expected_len)
	_validate_vector("V1", V1, expected_len)
	_validate_vector("I1", I1, expected_len)
	_validate_vector("V2", V2, expected_len)
	_validate_vector("I2", I2, expected_len)
	_validate_vector("V3", V3, expected_len)
	_validate_vector("I3", I3, expected_len)

	freq_values = [float(f) for f in freq]
	if freq_values != sorted(freq_values):
		raise ValueError("freq values must be in ascending order.")

	z1_impedance = _impedance(V1, I1)
	z2_impedance = _impedance(V2, I2)
	z3_impedance = _impedance(V3, I3)

	z1_info = _classify_component(freq_values, z1_impedance)
	z2_info = _classify_component(freq_values, z2_impedance)
	z3_info = _classify_component(freq_values, z3_impedance)

	return {
		"freq": freq_values,
		"X1": z1_impedance,
		"X2": z2_impedance,
		"X3": z3_impedance,
		"Z1": z1_info,
		"Z2": z2_info,
		"Z3": z3_info,
	}
