"""Backend computations for the diffraction grating experiment."""

from math import atan, sin


def compute_diffraction_response(N, S, orders, x_values):
	"""
	Formulas For diffraction grating experiment:

	- Grating constant: d = 1 / N
	- Diffraction angle: theta = atan(xm / S)
	- sin_theta = sin(theta)
	- Wavelength: lambda = d * sin(theta) / m
	- Average wavelength: mean of all lambda values
	"""

    
	if N is None or S is None:
		raise ValueError("N and S must be provided.")
	if N <= 0 or S <= 0:        
		raise ValueError("N and S must be positive.")
	if not isinstance(orders, list) or not isinstance(x_values, list):
		raise ValueError("orders and x_values must be lists.")
	if len(orders) != len(x_values):
		raise ValueError("orders and x_values must have the same length.")
	if len(orders) == 0:
		raise ValueError("orders and x_values must not be empty.")

	for m in orders:
		if m is None or m <= 0:
			raise ValueError("All diffraction orders must be positive.")

	for xm in x_values:
		if xm is None or xm <= 0:
			raise ValueError("All x_values must be positive.")

	grating_constant = 1.0 / float(N)

	theta = [atan(float(xm) / float(S)) for xm in x_values]
	sin_theta = [sin(t) for t in theta]
	wavelength = [grating_constant * st / float(m) for st, m in zip(sin_theta, orders)]

	average_wavelength = sum(wavelength) / float(len(wavelength))

	return {
		"grating_constant": grating_constant,
		"orders": list(orders),
		"theta": theta,
		"sin_theta": sin_theta,
		"wavelength": wavelength,
		"average_wavelength": average_wavelength,
	}


# DEBUG / LOCAL TEST ONLY
# if __name__ == "__main__":
#     result = compute_diffraction_response(
#     N=300000,        # common grating
#     S=1.0,
#     orders=[1,2,3],
#     x_values=[0.1,0.2,0.3]
# )

#     print(result)

#Invalid Inputs Tests
# if __name__ == "__main__":
#     result = compute_diffraction_response(
#     N=0,        # common grating
#     S=1,
#     orders=[1],
#     x_values=[0.01]
# )

#     print(result)
