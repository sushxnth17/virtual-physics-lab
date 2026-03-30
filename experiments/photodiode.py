"""Backend computations for the photodiode characteristics experiment."""


def calculate_photodiode(mode, voltage, lightIntensity, distance):
	"""Compute photodiode current, resistance, intensity and responsivity."""
	if mode is None:
		raise ValueError("mode must be provided")

	mode_normalized = str(mode).strip().lower()
	if mode_normalized not in {"reverse", "responsivity"}:
		raise ValueError("mode must be 'reverse' or 'responsivity'")

	try:
		voltage_value = float(voltage)
		light_intensity_value = float(lightIntensity)
		distance_value = float(distance)
	except (TypeError, ValueError):
		raise ValueError("voltage, lightIntensity, and distance must be numeric")

	if mode_normalized == "reverse":
		if light_intensity_value < 0:
			raise ValueError("lightIntensity must be non-negative")
		current = (0.02 * light_intensity_value) + (0.005 * voltage_value)
		intensity = light_intensity_value
	else:
		if distance_value <= 0:
			raise ValueError("distance must be positive")
		intensity = 1000.0 / (distance_value * distance_value)
		current = 0.02 * intensity

	if voltage_value > 0:
		slope = current / voltage_value
		resistance = 1.0 / slope if slope != 0 else 0.0
	else:
		resistance = 0.0

	if intensity <= 0:
		raise ValueError("intensity must be positive")

	responsivity = current / intensity

	return {
		"current": round(current, 4),
		"resistance": round(resistance, 4),
		"intensity": round(intensity, 4),
		"responsivity": round(responsivity, 6),
	}


def compute_photodiode_response(mode, voltage, lightIntensity, distance):
	"""Compatibility wrapper for app-wide compute_<experiment>_response pattern."""
	return calculate_photodiode(mode, voltage, lightIntensity, distance)




# Example test cases (uncomment to run)
# if __name__ == "__main__":
#     print("---- NORMAL TESTS ----")
#     print(calculate_photodiode("reverse", 2, 500, 2))
#     print(calculate_photodiode("responsivity", 5, 0, 2))

#     print("\n---- ERROR TESTS ----")

#     # 1. Invalid mode
#     try:
#         print(calculate_photodiode("abc", 2, 500, 2))
#     except Exception as e:
#         print("Invalid mode error:", e)

#     # 2. Negative distance
#     try:
#         print(calculate_photodiode("responsivity", 2, 0, -1))
#     except Exception as e:
#         print("Negative distance error:", e)

#     # 3. String input
#     try:
#         print(calculate_photodiode("reverse", "abc", 500, 2))
#     except Exception as e:
#         print("String input error:", e)

#     # 4. Negative light intensity
#     try:
#         print(calculate_photodiode("reverse", 2, -100, 2))
#     except Exception as e:
#         print("Negative light error:", e)

#     # 5. Zero intensity case
#     try:
#         print(calculate_photodiode("reverse", 2, 0, 2))
#     except Exception as e:
#         print("Zero intensity error:", e)