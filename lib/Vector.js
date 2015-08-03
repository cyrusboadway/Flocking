define(function () {
	/**
	 * Simple representation of a vector (magnitude, direction), with a few helper methods for adding/subtracting, etc.
	 *
	 * @param {number} x
	 * @param {number} y
	 * @constructor
	 */
	var Vector = function (x, y) {
		this.x = x;
		this.y = y;
	};

	/**
	 * Get the vector 'length'
	 *
	 * @returns {number}
	 */
	Vector.prototype.getMagnitude = function () {
		return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
	};

	/**
	 * Get the angle in rad. of the vector
	 *
	 * @returns {number}
	 */
	Vector.prototype.getBearing = function () {
		return Math.atan2(this.y, this.x);
	};

	/**
	 * Produce a vector whose magnitude is scaled
	 *
	 * @param {number} scale
	 * @returns {Vector}
	 */
	Vector.prototype.scale = function (scale) {
		return new Vector(this.x * scale, this.y * scale);
	};

	/**
	 * Produce a new vector as the sum of this and the given vector (i.e. v¹ + v²)
	 *
	 * @param {Vector} vector
	 * @returns {Vector}
	 */
	Vector.prototype.add = function (vector) {
		return new Vector(this.x + vector.x, this.y + vector.y);
	};

	/**
	 * Produce a new vector as this vector less the given vector (i.e. v¹ - v², v¹ is `this`)
	 *
	 * @param {Vector} vector
	 * @returns {Vector}
	 */
	Vector.prototype.subtract = function (vector) {
		return new Vector(this.x - vector.x, this.y - vector.y);
	};

	/**
	 * Create a new vector from a magnitude (i.e. radius) and an bearing (i.e. angle)
	 *
	 * @param {number} magnitude of the vector
	 * @param {number} bearing of the vector, in rad.
	 * @returns {Vector}
	 */
	Vector.newFromPolar = function (magnitude, bearing) {
		return new Vector(
			Math.cos(bearing) * magnitude,
			Math.sin(bearing) * magnitude
		);
	};

	return Vector;
});