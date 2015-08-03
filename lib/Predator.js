define(['./Vector'], function (Vector) {
	/**
	 * The predator, which is in effect when the mouse is down, is a feature to which Birds react.
	 *
	 * @param env
	 * @param x
	 * @param y
	 * @constructor
	 */
	var Predator = function (env, x, y) {
		this.position = new Vector(x, y);
		this.active = false;
	};

	return Predator;
});
