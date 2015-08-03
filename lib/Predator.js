define(['./Vector'], function (Vector) {
	var Predator = function (env, x, y) {
		this.position = new Vector(x, y);
		this.active = false;
	};

	return Predator;
});
