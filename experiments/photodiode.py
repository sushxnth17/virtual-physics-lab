"""Backend computations for the photodiode characteristics experiment using lab manual methods."""


def microamps_to_amps(microamps):
	"""Convert microamperes to amperes."""
	if not isinstance(microamps, (int, float)):
		return None
	return microamps * 1e-6


def to_scientific_notation(value, decimals=2):
	"""Convert value to scientific notation string."""
	if not isinstance(value, (int, float)) or value == 0:
		return "0.00e+0"
	return f"{value:.{decimals}e}"


def get_iv_manual_point_pair(data_iv):
	"""
	Get strict lab-manual I-V point pair from linear region:
	V1 = 0.3V and V2 = 0.4V.

	Args:
		data_iv: list of {"voltage": V, "current_ua": I_µA}

	Returns:
		(dict, dict) as (p1, p2) or (None, None)
	"""
	if not data_iv or not isinstance(data_iv, list):
		return None, None

	linear_rows = []
	for row in data_iv:
		try:
			v = float(row.get("voltage", 0))
			i_ua = float(row.get("current_ua", 0))
			if 0.2 <= v <= 0.5 and i_ua > 0:
				linear_rows.append({"voltage": v, "current_ua": i_ua})
		except (TypeError, ValueError, AttributeError):
			continue

	if len(linear_rows) < 2:
		return None, None

	linear_rows.sort(key=lambda item: item["voltage"])
	p1 = next((row for row in linear_rows if round(row["voltage"], 1) == 0.3), None)
	p2 = next((row for row in linear_rows if round(row["voltage"], 1) == 0.4), None)

	if not p1 or not p2:
		return None, None

	return p1, p2


def compute_direct_results(data_iv, data_lux):
	"""
	Direct calculation from tabular data (lab manual method).
	
	Args:
		data_iv: list of {"voltage": V, "current_ua": I_µA}
		data_lux: list of {"distance": d, "lux": L, "current_ua": I_µA}
	
	Returns:
		{"resistance_ohms": float, "responsivity_A_per_lux": float}
	"""
	resistance = None
	responsivity = None
	
	# Calculate Resistance from I vs V data using strict lab-manual points:
	# V1 = 0.3V, V2 = 0.4V, then R = ΔV / ΔI (I in amperes)
	p1, p2 = get_iv_manual_point_pair(data_iv)
	if p1 and p2:
		delta_v = p2["voltage"] - p1["voltage"]
		delta_i = microamps_to_amps(p2["current_ua"] - p1["current_ua"])
		if delta_v > 0 and delta_i > 0:
			resistance = delta_v / delta_i
	
	# Calculate Responsivity from I vs Lux data
	# Use average of valid rows
	if data_lux and isinstance(data_lux, list):
		valid_responsivities = []
		for row in data_lux:
			try:
				lux = float(row.get("lux", 0))
				i_ua = float(row.get("current_ua", 0))
				
				if lux > 0 and i_ua > 0:
					i_a = microamps_to_amps(i_ua)
					resp = i_a / lux  # Responsivity = I / Lux (I in amperes)
					valid_responsivities.append(resp)
			except (TypeError, ValueError, AttributeError):
				continue
		
		if valid_responsivities:
			responsivity = sum(valid_responsivities) / len(valid_responsivities)
	
	return {
		"resistance_ohms": resistance,
		"responsivity_A_per_lux": responsivity
	}


def compute_graph_results(data_iv, data_lux):
	"""
	Graph-based calculation using two-point method (lab manual method).
	
	For I vs V: Select two points from linear region, calculate slope = ΔI / ΔV
			   Then Resistance = 1 / slope
	
	For I vs Lux: Select two points, calculate slope = ΔI / ΔLux
				  Then Responsivity = slope
	
	Args:
		data_iv: list of {"voltage": V, "current_ua": I_µA}
		data_lux: list of {"distance": d, "lux": L, "current_ua": I_µA}
	
	Returns:
		{"resistance_ohms": float, "responsivity_A_per_lux": float}
	"""
	resistance = None
	responsivity = None
	
	# Calculate Resistance from I vs V graph using strict lab-manual points:
	# V1 = 0.3V, V2 = 0.4V.
	p1, p2 = get_iv_manual_point_pair(data_iv)
	if p1 and p2:
		dv = p2["voltage"] - p1["voltage"]
		di = microamps_to_amps(p2["current_ua"] - p1["current_ua"])
		if dv > 0 and di > 0:
			slope = di / dv  # slope = ΔI / ΔV (I in amperes)
			resistance = 1.0 / slope  # R = 1 / slope == ΔV / ΔI
	
	# Calculate Responsivity from I vs Lux graph
	# Use first two valid points
	if data_lux and isinstance(data_lux, list) and len(data_lux) >= 2:
		valid_points_lux = []
		for row in data_lux:
			try:
				lux = float(row.get("lux", 0))
				i_ua = float(row.get("current_ua", 0))
				if lux > 0 and i_ua > 0:
					valid_points_lux.append({"lux": lux, "i_a": microamps_to_amps(i_ua)})
			except (TypeError, ValueError, AttributeError):
				continue
		
		if len(valid_points_lux) >= 2:
			# Use first two points
			point_a = valid_points_lux[0]
			point_b = valid_points_lux[1]
			
			dlux = abs(point_b["lux"] - point_a["lux"])
			di = abs(point_b["i_a"] - point_a["i_a"])
			
			if dlux > 0 and di > 0:
				responsivity = di / dlux  # Responsivity = ΔI / ΔLux (I in amperes)
	
	return {
		"resistance_ohms": resistance,
		"responsivity_A_per_lux": responsivity
	}


def compute_error_percentage(graph_value, direct_value):
	"""
	Calculate percentage error.
	
	% Error = |Graph - Direct| / Direct × 100
	
	Returns float or None if direct is zero/invalid.
	"""
	if direct_value is None or direct_value == 0 or not isinstance(direct_value, (int, float)):
		return None
	
	try:
		error = abs((graph_value - direct_value) / direct_value) * 100
		return round(error, 2)
	except (TypeError, ZeroDivisionError):
		return None


def compute_results(data_iv, data_lux):
	"""
	Complete photodiode experiment analysis following lab manual style.
	
	Args:
		data_iv: list of voltage-current readings
		data_lux: list of distance-lux-current readings
	
	Returns:
		{
			"direct": {
				"resistance": float (Ohms),
				"responsivity": float (A/Lux)
			},
			"graph": {
				"resistance": float (Ohms),
				"responsivity": float (A/Lux)
			},
			"error": {
				"resistance": float (%),
				"responsivity": float (%)
			},
			"direct_formatted": {
				"resistance": str (scientific notation),
				"responsivity": str (scientific notation)
			},
			"graph_formatted": {
				"resistance": str (scientific notation),
				"responsivity": str (scientific notation)
			}
		}
	"""
	# Calculate direct method
	direct_results = compute_direct_results(data_iv, data_lux)
	
	# Calculate graph-based method
	graph_results = compute_graph_results(data_iv, data_lux)
	
	# Calculate errors
	r_error = compute_error_percentage(graph_results.get("resistance_ohms"), direct_results.get("resistance_ohms"))
	resp_error = compute_error_percentage(graph_results.get("responsivity_A_per_lux"), direct_results.get("responsivity_A_per_lux"))
	
	return {
		"direct": {
			"resistance": direct_results.get("resistance_ohms"),
			"responsivity": direct_results.get("responsivity_A_per_lux")
		},
		"graph": {
			"resistance": graph_results.get("resistance_ohms"),
			"responsivity": graph_results.get("responsivity_A_per_lux")
		},
		"error": {
			"resistance": r_error,
			"responsivity": resp_error
		},
		"direct_formatted": {
			"resistance": to_scientific_notation(direct_results.get("resistance_ohms")),
			"responsivity": to_scientific_notation(direct_results.get("responsivity_A_per_lux"))
		},
		"graph_formatted": {
			"resistance": to_scientific_notation(graph_results.get("resistance_ohms")),
			"responsivity": to_scientific_notation(graph_results.get("responsivity_A_per_lux"))
		}
	}


def compute_photodiode_response(mode=None, voltage=None, lightIntensity=None, distance=None, data_iv=None, data_lux=None):
	"""
	Compatibility wrapper supporting both old API and new lab manual API.
	
	Prefer using compute_results() with data_iv and data_lux for proper lab manual calculations.
	"""
	if data_iv is not None and data_lux is not None:
		# New lab manual method
		return compute_results(data_iv, data_lux)
	else:
		# Fallback (legacy) - raise error to force frontend to use new method
		raise ValueError("Backend requires data_iv and data_lux for proper lab manual calculations. Use compute_results() directly.")




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