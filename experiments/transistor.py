"""Backend computations for the transistor characteristics experiment.

The module supports the common-emitter lab workflow shown in the manual:
- input characteristic sweep: I_B vs V_BE at constant V_CE
- output characteristic sweep: I_C vs V_CE for several fixed I_B values
- calculation helpers for beta, alpha, knee voltage, and input resistance
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Sequence

from flask import Blueprint, jsonify, request


transistor_bp = Blueprint("transistor", __name__)


THERMAL_VOLTAGE = 0.026
BASE_EMITTER_KNEE_VOLTAGE = 0.55
COLLECTOR_SATURATION_VCE = 0.2
NOMINAL_BETA = 100.0
EARLY_VOLTAGE = 50.0
REVERSE_LEAKAGE_CURRENT = 1e-12
BASE_SCALE_CURRENT = 2.5e-8
MAX_EXPONENT = 60.0


def _to_float(value: Any, field_name: str) -> float:
	"""Convert a request value to float with a helpful validation error."""
	try:
		return float(value)
	except (TypeError, ValueError):
		raise ValueError(f"{field_name} must be a numeric value")


def _convert_current_to_amps(value: Any, unit: str = "A") -> float:
	"""Convert a current value to amperes."""
	current = _to_float(value, "current")
	unit_normalized = str(unit or "A").strip().lower()

	if unit_normalized in {"a", "amp", "amps", "ampere", "amperes"}:
		return current
	if unit_normalized in {"ma", "milliamps", "milliamp", "milliampere", "milliamperes"}:
		return current * 1e-3
	if unit_normalized in {"ua", "µa", "microamps", "microamp", "microampere", "microamperes"}:
		return current * 1e-6
	if unit_normalized in {"na", "nanoamps", "nanoamp", "nanoampere", "nanoamperes"}:
		return current * 1e-9

	raise ValueError(f"Unsupported current unit: {unit}")


def _safe_exponential(exponent: float) -> float:
	"""Prevent overflow while preserving the exponential shape."""
	return math.exp(max(min(exponent, MAX_EXPONENT), -MAX_EXPONENT))


def _base_emitter_current(v_be: float, v_ce: float = 2.0) -> float:
	"""Model the base-emitter junction like a diode with a visible knee."""
	if v_be <= 0:
		return REVERSE_LEAKAGE_CURRENT

	if v_be < BASE_EMITTER_KNEE_VOLTAGE:
		# Leakage remains tiny below the knee, but still rises slightly with voltage.
		return REVERSE_LEAKAGE_CURRENT * _safe_exponential(v_be / 0.05)

	exponent = (v_be - BASE_EMITTER_KNEE_VOLTAGE) / THERMAL_VOLTAGE
	i_b = BASE_SCALE_CURRENT * _safe_exponential(exponent)

	# Slight collector-voltage dependence to keep the curve realistic without
	# overwhelming the diode shape.
	if v_ce > 0:
		i_b *= 1.0 + min(v_ce, 20.0) / EARLY_VOLTAGE * 0.02

	return max(i_b, REVERSE_LEAKAGE_CURRENT)


def _collector_current(i_b_amps: float, v_ce: float) -> tuple[float, str, float]:
	"""Model output characteristics with cutoff, saturation, and active regions."""
	if i_b_amps <= 0:
		return 0.0, "cutoff", NOMINAL_BETA

	beta_effective = NOMINAL_BETA * (1.0 + max(v_ce, 0.0) / EARLY_VOLTAGE * 0.03)

	if v_ce < COLLECTOR_SATURATION_VCE:
		collector_current = beta_effective * i_b_amps * (v_ce / COLLECTOR_SATURATION_VCE)
		return collector_current, "saturation", beta_effective

	collector_current = beta_effective * i_b_amps * (1.0 + max(v_ce, 0.0) / EARLY_VOLTAGE * 0.03)
	return collector_current, "active", beta_effective


def calculate_input_characteristics(v_be: float, v_ce: float = 2.0) -> Dict[str, Any]:
	"""Simulate the input characteristic of the transistor in common-emitter mode."""
	v_be_value = _to_float(v_be, "v_be")
	v_ce_value = _to_float(v_ce, "v_ce")
	i_b_amps = _base_emitter_current(v_be_value, v_ce_value)
	i_b_microamps = i_b_amps * 1e6

	if v_be_value >= BASE_EMITTER_KNEE_VOLTAGE:
		region = "forward-bias"
	else:
		region = "cutoff"

	input_resistance = calculate_input_resistance(v_be_value, i_b_microamps)

	return {
		"v_be": v_be_value,
		"v_ce": v_ce_value,
		"i_b_microamp": i_b_microamps,
		"input_resistance_ohm": input_resistance,
		"region": region,
		"knee_voltage": BASE_EMITTER_KNEE_VOLTAGE,
	}


def calculate_output_characteristics(i_b_microamp: float, v_ce: float) -> Dict[str, Any]:
	"""Simulate the transistor output characteristic for a fixed base current."""
	i_b_value = _to_float(i_b_microamp, "i_b_microamp")
	v_ce_value = _to_float(v_ce, "v_ce")
	i_b_amps = i_b_value * 1e-6
	i_c_amps, region, beta_effective = _collector_current(i_b_amps, v_ce_value)

	return {
		"i_b_microamp": i_b_value,
		"v_ce": v_ce_value,
		"i_c_milliamp": i_c_amps * 1e3,
		"i_c_amp": i_c_amps,
		"region": region,
		"beta_effective": beta_effective,
	}


def calculate_beta(
	i_c1: float,
	i_c2: float,
	i_b1: float,
	i_b2: float,
	i_c_unit: str = "A",
	i_b_unit: str = "A",
) -> float:
	"""Calculate beta as ΔI_C / ΔI_B.

	The optional unit arguments keep the function usable for the lab tables,
	where collector current is typically reported in mA and base current in µA.
	"""
	i_c_1_amps = _convert_current_to_amps(i_c1, i_c_unit)
	i_c_2_amps = _convert_current_to_amps(i_c2, i_c_unit)
	i_b_1_amps = _convert_current_to_amps(i_b1, i_b_unit)
	i_b_2_amps = _convert_current_to_amps(i_b2, i_b_unit)

	delta_i_b = i_b_2_amps - i_b_1_amps
	if delta_i_b == 0:
		raise ValueError("i_b2 and i_b1 must be different to compute beta")

	return (i_c_2_amps - i_c_1_amps) / delta_i_b


def calculate_alpha(beta: float) -> float:
	"""Calculate alpha from beta using α = β / (1 + β)."""
	beta_value = _to_float(beta, "beta")
	if beta_value == -1:
		raise ValueError("beta cannot be -1 when calculating alpha")
	return beta_value / (1.0 + beta_value)


def calculate_input_resistance(v_be: float, i_b_microamp: float) -> float:
	"""Calculate input resistance from V_BE and I_B."""
	v_be_value = _to_float(v_be, "v_be")
	i_b_value = _to_float(i_b_microamp, "i_b_microamp")
	i_b_amps = i_b_value * 1e-6
	return v_be_value / i_b_amps if i_b_amps != 0 else 0.0


def calculate_knee_voltage(input_points: Sequence[Dict[str, Any]] | None) -> float:
	"""Estimate the input knee voltage from a sweep of V_BE/I_B points."""
	if not input_points:
		return BASE_EMITTER_KNEE_VOLTAGE

	valid_points: List[Dict[str, float]] = []
	for point in input_points:
		if not isinstance(point, dict):
			continue
		try:
			v_be = float(point.get("v_be"))
			i_b = float(point.get("i_b_microamp"))
		except (TypeError, ValueError):
			continue
		valid_points.append({"v_be": v_be, "i_b_microamp": i_b})

	if len(valid_points) < 3:
		return BASE_EMITTER_KNEE_VOLTAGE

	valid_points.sort(key=lambda item: item["v_be"])
	currents = [max(point["i_b_microamp"], 0.0) for point in valid_points]
	v_be_values = [point["v_be"] for point in valid_points]

	slopes: List[float] = []
	for index in range(1, len(valid_points)):
		delta_v = v_be_values[index] - v_be_values[index - 1]
		delta_i = currents[index] - currents[index - 1]
		if delta_v > 0:
			slopes.append(delta_i / delta_v)

	if not slopes:
		return BASE_EMITTER_KNEE_VOLTAGE

	baseline = max(slopes[0], 1e-12)
	threshold = baseline * 5.0
	max_current = max(currents)

	for index, slope in enumerate(slopes, start=1):
		if slope >= threshold and currents[index] >= 0.1:
			return v_be_values[index]

	# Fallback: choose the point where the curve first leaves the leakage region.
	for index, current in enumerate(currents):
		if current >= 0.1:
			return v_be_values[index]

	return BASE_EMITTER_KNEE_VOLTAGE


def build_input_sweep(v_be_values: Sequence[Any], v_ce: float = 2.0) -> List[Dict[str, Any]]:
	"""Build a sweep for the input characteristic graph."""
	points: List[Dict[str, Any]] = []
	for raw_v_be in v_be_values:
		point = calculate_input_characteristics(raw_v_be, v_ce)
		points.append(point)
	return points


def build_output_sweep(
	i_b_values_microamp: Sequence[Any],
	v_ce_values: Sequence[Any],
) -> List[Dict[str, Any]]:
	"""Build a family of output-characteristic curves for fixed base currents."""
	curves: List[Dict[str, Any]] = []
	for raw_i_b in i_b_values_microamp:
		i_b_value = _to_float(raw_i_b, "i_b_microamp")
		points: List[Dict[str, Any]] = []
		for raw_v_ce in v_ce_values:
			v_ce_value = _to_float(raw_v_ce, "v_ce")
			point = calculate_output_characteristics(i_b_value, v_ce_value)
			points.append(point)
		curves.append({
			"i_b_microamp": i_b_value,
			"points": points,
		})
	return curves


def _calculate_beta_from_output_points(output_points: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
	"""Estimate beta from successive output characteristic readings."""
	valid_points: List[Dict[str, float]] = []
	for point in output_points:
		if not isinstance(point, dict):
			continue
		try:
			i_b = float(point.get("i_b_microamp"))
			i_c = float(point.get("i_c_milliamp"))
		except (TypeError, ValueError):
			continue
		valid_points.append({"i_b_microamp": i_b, "i_c_milliamp": i_c})

	if len(valid_points) < 2:
		raise ValueError("At least two output points are required to calculate beta")

	valid_points.sort(key=lambda item: item["i_b_microamp"])
	beta_values: List[float] = []
	for index in range(1, len(valid_points)):
		i_c_1 = valid_points[index - 1]["i_c_milliamp"]
		i_c_2 = valid_points[index]["i_c_milliamp"]
		i_b_1 = valid_points[index - 1]["i_b_microamp"]
		i_b_2 = valid_points[index]["i_b_microamp"]
		delta_i_b = (i_b_2 - i_b_1) * 1e-6
		if delta_i_b == 0:
			continue
		beta_values.append(((i_c_2 - i_c_1) * 1e-3) / delta_i_b)

	if not beta_values:
		raise ValueError("Unable to compute beta from the provided output points")

	beta_average = sum(beta_values) / len(beta_values)
	return {
		"beta": beta_average,
		"beta_values": beta_values,
	}


def calculate_transistor_summary(**kwargs: Any) -> Dict[str, Any]:
	"""Produce a complete lab-style summary from the supplied measurements."""
	input_points = kwargs.get("input_points") or kwargs.get("input_data") or kwargs.get("vbe_data")
	output_points = kwargs.get("output_points") or kwargs.get("output_data") or kwargs.get("ib_ic_data")
	v_be_values = kwargs.get("v_be_values") or kwargs.get("vbe_values")
	i_b_values = kwargs.get("i_b_values") or kwargs.get("i_b_list")
	v_ce_values = kwargs.get("v_ce_values") or kwargs.get("vce_values")

	summary: Dict[str, Any] = {}

	if input_points:
		knee_voltage = calculate_knee_voltage(input_points)
		input_results = build_input_sweep([point.get("v_be") for point in input_points if isinstance(point, dict) and point.get("v_be") is not None], kwargs.get("v_ce", 2.0))
		summary["input_characteristics"] = input_results
		summary["knee_voltage"] = knee_voltage
		valid_resistances = [point["input_resistance_ohm"] for point in input_results if point.get("input_resistance_ohm")]
		if valid_resistances:
			summary["input_resistance_ohm"] = sum(valid_resistances) / len(valid_resistances)
	elif v_be_values:
		v_ce_value = kwargs.get("v_ce", 2.0)
		input_results = build_input_sweep(v_be_values, v_ce_value)
		summary["input_characteristics"] = input_results
		summary["knee_voltage"] = calculate_knee_voltage(input_results)
		valid_resistances = [point["input_resistance_ohm"] for point in input_results if point.get("input_resistance_ohm")]
		if valid_resistances:
			summary["input_resistance_ohm"] = sum(valid_resistances) / len(valid_resistances)

	if output_points:
		beta_results = _calculate_beta_from_output_points(output_points)
		beta_value = beta_results["beta"]
		summary["output_beta_values"] = beta_results["beta_values"]
		summary["beta"] = beta_value
		summary["alpha"] = calculate_alpha(beta_value)
	elif i_b_values and v_ce_values:
		summary["output_characteristics"] = build_output_sweep(i_b_values, v_ce_values)

	if not summary:
		# Fall back to direct scalar values so the generic API route can still work.
		if "v_be" in kwargs:
			summary["input_characteristics"] = calculate_input_characteristics(kwargs["v_be"], kwargs.get("v_ce", 2.0))
		if "i_b" in kwargs and "v_ce" in kwargs:
			summary["output_characteristics"] = calculate_output_characteristics(kwargs["i_b"], kwargs["v_ce"])
		if {"i_c1", "i_c2", "i_b1", "i_b2"}.issubset(kwargs.keys()):
			beta = calculate_beta(
				kwargs["i_c1"],
				kwargs["i_c2"],
				kwargs["i_b1"],
				kwargs["i_b2"],
				kwargs.get("i_c_unit", "A"),
				kwargs.get("i_b_unit", "A"),
			)
			summary["beta"] = beta
			summary["alpha"] = calculate_alpha(beta)
		if "v_be" in kwargs and "i_b" in kwargs:
			summary["input_resistance_ohm"] = calculate_input_resistance(kwargs["v_be"], kwargs["i_b"])

	return summary


def compute_transistor_response(**kwargs: Any) -> Dict[str, Any]:
	"""Compatibility wrapper used by the generic /api/<experiment_name> route."""
	return calculate_transistor_summary(**kwargs)


@transistor_bp.route("/transistor/input", methods=["POST"])
def input_characteristics() -> Any:
	"""API endpoint for the input characteristic sweep."""
	data = request.get_json(silent=True) or {}

	if "v_be_values" in data or "input_points" in data:
		v_be_values = data.get("v_be_values")
		if v_be_values is None and data.get("input_points"):
			v_be_values = [point.get("v_be") for point in data.get("input_points", []) if isinstance(point, dict)]
		result = {
			"v_ce": _to_float(data.get("v_ce", 2.0), "v_ce"),
			"points": build_input_sweep(v_be_values or [], data.get("v_ce", 2.0)),
		}
		result["knee_voltage"] = calculate_knee_voltage(result["points"])
		return jsonify(result)

	return jsonify(calculate_input_characteristics(data["v_be"], data.get("v_ce", 2.0)))


@transistor_bp.route("/transistor/output", methods=["POST"])
def output_characteristics() -> Any:
	"""API endpoint for the output characteristic sweep."""
	data = request.get_json(silent=True) or {}

	if "i_b_values" in data or "v_ce_values" in data:
		i_b_values = data.get("i_b_values") or data.get("i_b_list") or []
		v_ce_values = data.get("v_ce_values") or data.get("vce_values") or []
		return jsonify({
			"curves": build_output_sweep(i_b_values, v_ce_values),
		})

	return jsonify(calculate_output_characteristics(data["i_b"], data["v_ce"]))


@transistor_bp.route("/transistor/calculate", methods=["POST"])
def calculate_all() -> Any:
	"""API endpoint for beta, alpha, knee voltage, and input resistance."""
	data = request.get_json(silent=True) or {}

	if "output_points" in data or "input_points" in data:
		return jsonify(calculate_transistor_summary(**data))

	if {"i_c1", "i_c2", "i_b1", "i_b2"}.issubset(data.keys()):
		beta = calculate_beta(
			data["i_c1"],
			data["i_c2"],
			data["i_b1"],
			data["i_b2"],
			data.get("i_c_unit", "A"),
			data.get("i_b_unit", "A"),
		)
		alpha = calculate_alpha(beta)
		rin = calculate_input_resistance(data["v_be"], data["i_b"])
		return jsonify({
			"beta": beta,
			"alpha": alpha,
			"input_resistance": rin,
			"knee_voltage": data.get("knee_voltage", BASE_EMITTER_KNEE_VOLTAGE),
		})

	if "v_be" in data and "i_b" in data:
		return jsonify({
			"input_resistance": calculate_input_resistance(data["v_be"], data["i_b"]),
			"knee_voltage": data.get("knee_voltage", BASE_EMITTER_KNEE_VOLTAGE),
		})

	raise ValueError("Provide either input/output measurement arrays or beta calculation values")


if __name__ == "__main__":
	sample_input = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]
	sample_output_ib = [40, 60, 80]
	sample_output_vce = [0.0, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0]

	from pprint import pprint

	pprint(build_input_sweep(sample_input))
	pprint(build_output_sweep(sample_output_ib, sample_output_vce))
	pprint(calculate_transistor_summary(v_be=0.7, i_b=60, i_c1=4.0, i_c2=6.2, i_b1=40, i_b2=60, i_c_unit="mA", i_b_unit="uA"))
