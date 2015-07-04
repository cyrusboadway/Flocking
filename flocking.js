(function (document, window, canvasElementId, initialBirdCount) {

// Vector class

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

// Bird class

	/**
	 * The bird has basic newtonian properties (position, velocity, acceleration). The only parameter directly affected
	 * is the acceleration, which is applied to influence velocity and in turn position.
	 *
	 * @constructor
	 */
	var Bird = function () {
		this.id = null;
		this.position = null;
		this.velocity = null;
		this.acceleration = null;
		this.env = null;

		// config
		this.width = 10;
		this.closeness = 200;
		this.influence = 400;
		this.maxVelocity = 100;
	};

	/**
	 * Fuzzy membership functions are used to determine how much influence a particular rule should have at the instant
	 * of evaluation
	 *
	 * @type {{Trapezoid: Function, Triangle: Function, Square: Function}}
	 */
	Bird.FUZZY_MEMBERSHIP_FUNCTIONS = {
		'Trapezoid': function (x, a, b, c, d) {
			return Math.max(0, Math.min((x - a) / (b - a), 1, (c - x) / (d - c)));
		},
		'Triangle': function (x, a, b, c) {
			return Math.max(0, Math.min((x - a) / (b - a), (c - x) / (c - b)));
		},
		'Square': function (x, a, b) {
			return (a < x && x < b) ? 1.0 : 0.0;
		}
	};

	/**
	 * These are the set of rules by which the birds determine in which direction to accelerate. The rules compete for
	 * control of the bird's acceleration. The membership function is used to determine to what degree the rule should
	 * be applied. The result function determines what action should be take (i.e. direction, magnitude of accel.).
	 * heh. bird brain.
	 *
	 * @type {*[]}
	 */
	Bird.prototype.FUZZY_RULES = [
		// TOO CLOSE: birds are really close, need to be pushed apart
		{
			'membershipFunction': function (bird, destinationBird) {
				var distance = bird.position.subtract(destinationBird.position).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, 0, 0, this.closeness);
			},
			'resultFunction': function (bird, destinationBird) {
				var nearestLattice = env.findClosestLatticeLocation(bird, destinationBird);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				var difference = bird.position.subtract(nearestLattice);
				return Vector.newFromPolar(1000 / difference.getMagnitude(), difference.getBearing());
			}
		},
		// CLOSE, PUSH TOGETHER: close enough to be influenced, bringing them closer together
		{
			'membershipFunction': function (bird, destinationBird) {
				var distance = bird.position.subtract(destinationBird.position).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, bird.closeness, 2 * bird.closeness, 3 * bird.closeness);
			},
			'resultFunction': function (bird, destinationBird) {
				var nearestLattice = env.findClosestLatticeLocation(bird, destinationBird);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				var difference = nearestLattice.subtract(bird.position);
				return Vector.newFromPolar(10, difference.getBearing());
			}
		},
		// CLOSE, CHANGE DIRECTION: close enough to be influenced, push their directions towards parallel
		{
			'membershipFunction': function (bird, destinationBird) {
				var distance = bird.position.subtract(destinationBird.position).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, bird.closeness, (bird.closeness + bird.influence) / 2, bird.influence);
			},
			'resultFunction': function (bird, destinationBird) {
				//var nearestLattice = env.findClosestLatticeLocation(bird, destinationBird);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				return Vector.newFromPolar(10, destinationBird.velocity.getBearing());
			}
		}
	];

	/**
	 * Recalculate the acceleration to be applied to the object (i.e. apply fuzzy logic rules).
	 *
	 * @param {Environment} env
	 */
	Bird.prototype.updateAcceleration = function (env) {
		this.acceleration = new Vector(0, 0);
		// Check rules for this bird to all other birds
		env.birds.forEach(function (bird) {
			if (this.id == bird.id) {
				// Bird does not influence itself
				return;
			}
			// Check each rule against each fuzzy rule
			this.FUZZY_RULES.forEach(function (rule) {
				var membership = rule.membershipFunction(this, bird);
				if (membership > 0) {
					// the rule applies to some degree
					var result = rule.resultFunction(this, bird);
					this.acceleration = this.acceleration.add(result.scale(membership));
				}
			}, this);
		}, this);
	};

	/**
	 * Apply acceleration to velocity and position
	 */
	Bird.prototype.move = function (stepSize) {
		// change velocity
		this.velocity = this.velocity.add(this.acceleration.scale(stepSize));
		// scale velocity back to max
		this.velocity = this.velocity.scale(Math.min(1, this.maxVelocity / this.velocity.getMagnitude()));
		// update position
		this.position = this.position.add(this.velocity.scale(stepSize));
		// wrap around canvas edges
		this.position.x = (this.position.x + this.env.canvas.width) % this.env.canvas.width;
		this.position.y = (this.position.y + this.env.canvas.height) % this.env.canvas.height;
	};

// Environment

	/**
	 * The environment maintains the collection of birds and orchestrates their movements and their expression on the
	 * canvas UI
	 *
	 * @constructor
	 */
	var Environment = function () {
		this.birds = [];
		this.frameRate = 24;
		this.canvas = document.getElementById(canvasElementId);
		this.canvas.width = this.canvas.offsetWidth;
		this.canvas.height = this.canvas.offsetHeight;
		this.context = this.canvas.getContext('2d');
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
	};

	/**
	 * Add a bird to the system. It will be assigned a random position and initial velocity
	 */
	Environment.prototype.addBird = function () {
		var bird = new Bird();

		// Provide bird with initial random position & velocity
		bird.position = new Vector(Math.random() * this.canvas.width, Math.random() * this.canvas.height);
		bird.velocity = new Vector(200 * (Math.random() * 2 - 1), 200 * (Math.random() * 2 - 1));
		bird.acceleration = new Vector(0, 0);

		// Give bird's max velocity a ±30% jitter
		bird.maxVelocity = bird.maxVelocity * (1 + (Math.random() * 2 - 1) * 0.3);
		bird.id = this.birds.length;
		bird.env = this;
		this.birds.push(bird);
		this.drawBird(bird);
	};

	/**
	 * Black out the bird's current position
	 *
	 * @param {Bird} bird
	 */
	Environment.prototype.eraseBird = function (bird) {
		this.context.fillStyle = 'black';
		this.context.fillRect(Math.round(bird.position.x), Math.round(bird.position.y), bird.width, bird.width);
	};

	/**
	 * Draw the bird; it will be assigned a colour based on its ID
	 *
	 * @param {Bird} bird
	 */
	Environment.prototype.drawBird = function (bird) {
		var colors = ['white', 'red', 'blue', 'green'];
		this.context.fillStyle = colors[bird.id % colors.length];
		this.context.fillRect(Math.round(bird.position.x), Math.round(bird.position.y), bird.width, bird.width);
	};

	/**
	 * Since the canvas "wraps", birds on opposite sides of the canvas should be influenced across the canvas edge,
	 * rather than directly
	 *
	 * @param {Bird} originBird
	 * @param {Bird} destinationBird
	 * @returns {Vector}
	 */
	Environment.prototype.findClosestLatticeLocation = function (originBird, destinationBird) {
		var closestLatticeNode = function (originPosition, destinationPosition, latticePeriod) {
			if (Math.abs(originPosition - destinationPosition) > Math.abs(originPosition - (destinationPosition - latticePeriod))) {
				return destinationPosition - latticePeriod;
			} else if (Math.abs(originPosition - destinationPosition) > Math.abs(originPosition - (destinationPosition + latticePeriod))) {
				return destinationPosition + latticePeriod;
			}
			return destinationPosition;
		};
		return new Vector(
			closestLatticeNode(originBird.position.x, destinationBird.position.x, this.canvas.width),
			closestLatticeNode(originBird.position.y, destinationBird.position.y, this.canvas.height)
		);
	};

	/**
	 * Big time sequence moving the birds, having them interact with each other
	 */
	Environment.prototype.run = function () {
		var birds = this.birds;
		var env = this;
		var frameRate = this.frameRate;
		setInterval(function () {
			birds.forEach(function (bird) {
				env.eraseBird(bird);
				bird.updateAcceleration(env);
				bird.move(1 / frameRate);
				env.drawBird(bird);
			});
		}, 1000 / this.frameRate);
	};

// Runtime

	// Create the environment
	var env = new Environment();
	// Add birds
	for (var i = 0; i < initialBirdCount; i++) {
		env.addBird();
	}
	env.run();

}(document, window, 'canvas', 200));
