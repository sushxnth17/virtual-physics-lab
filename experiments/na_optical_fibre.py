"""Backend computations for the numerical aperture optical fiber experiment."""

from math import atan, degrees, sin


def compute_na_optical_fibre_response(**kwargs):
	"""
	Formulas from lab manual:

	- theta_A (radians) = atan(D / (2L))
	- theta_A (degrees) = degrees(theta_A)
	- NA = sin(theta_A in radians)
	"""

	L = kwargs.get('L')
	D = kwargs.get('D')

	if L is None or D is None:
		raise ValueError("L and D must be provided.")

	try:
		L = float(L)
		D = float(D)
	except (TypeError, ValueError):
		raise ValueError("L and D must be numeric values.")

	if L == 0:
		raise ValueError("L must be non-zero to avoid division by zero.")
	if L < 0:
		raise ValueError("L must be positive.")
	if D < 0:
		raise ValueError("D must be non-negative.")

	theta_radians = atan(D / (2.0 * L))
	theta_degrees = degrees(theta_radians)
	na_value = sin(theta_radians)

	return {
		"theta": round(theta_degrees, 3),
		"NA": round(na_value, 4),
	}
