(function (document, window, canvasElementId) {
	var BIRD_COUNT = 2;
	var BIRD_WIDTH = 10;
	var FRAME_RATE = 24;
	var BIRD_MAX_VELOCITY = 100;
	var CANVAS_WIDTH = window.innerWidth;
	var CANVAS_HEIGHT = window.innerHeight;
	var CLOSENESS = 100;

// Vector class
	var Vector = function (x, y) {
		this.x = x;
		this.y = y;
	};
	/**
	 * Get the vector 'length'
	 * @returns {number}
	 */
	Vector.prototype.getMagnitude = function () {
		return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
	};
	/**
	 * Get the angle in rad. of the vector
	 * @returns {number}
	 */
	Vector.prototype.getBearing = function () {
		return Math.atan2(this.y, this.x);
	};
	/**
	 * Produce a vector whose magnitude is scaled
	 * @param {number} scale
	 * @returns {Vector}
	 */
	Vector.prototype.scale = function (scale) {
		return new Vector(this.x * scale, this.y * scale);
	};
	/**
	 * Produce a new vector as the sum of this and the given vector (i.e. v¹ + v²)
	 * @param {Vector} vector
	 * @returns {Vector}
	 */
	Vector.prototype.add = function (vector) {
		return new Vector(this.x + vector.x, this.y + vector.y);
	};
	/**
	 * Produce a new vector as this vector less the given vector (i.e. v¹ - v², v¹ is `this`)
	 * @param {Vector} vector
	 * @returns {Vector}
	 */
	Vector.prototype.subtract = function (vector) {
		return new Vector(this.x - vector.x, this.y - vector.y);
	};
	/**
	 * Create a new vector from a magnitude (i.e. radius) and an bearing (i.e. angle)
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
	 * @constructor
	 */
	var Bird = function () {
		this.id = null;
		this.position = null;
		this.velocity = new Vector(
			Math.random() * 2 * BIRD_MAX_VELOCITY - BIRD_MAX_VELOCITY,
			Math.random() * 2 * BIRD_MAX_VELOCITY - BIRD_MAX_VELOCITY
		);
		this.acceleration = new Vector(0, 0);
	};
	Bird.prototype.FUZZY_RULES = [	// heh. bird brain.
		{
			'membershipFunction': function (bird, destinationBird) {
				var distance = bird.position.subtract(destinationBird.position).getMagnitude();
				return distance < CLOSENESS;
			},
			'resultFunction': function (bird, destinationBird) {
				var nearestLattice = env.findClosestLatticeLocation(bird, destinationBird);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				var difference = bird.position.subtract(nearestLattice);
				return Vector.newFromPolar(100 / difference.getMagnitude(), difference.getBearing());
			}
		},
		// Kinda close. Attract x^2
		{
			'membershipFunction': function (bird, destinationBird) {
				var distance = bird.position.subtract(destinationBird.position).getMagnitude();
				return distance > CLOSENESS && distance < CLOSENESS * 5;
			},
			'resultFunction': function (bird, destinationBird) {
				var nearestLattice = env.findClosestLatticeLocation(bird, destinationBird);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				var difference = nearestLattice.subtract(bird.position);
				return Vector.newFromPolar(Math.pow(CLOSENESS - difference.getMagnitude(), 2), difference.getBearing());
			}
		}
	];
	/**
	 * Recalculate the acceleration to be applied to the object (i.e. apply fuzzy logic rules).
	 * @param {Environment} env
	 */
	Bird.prototype.updateAcceleration = function (env) {
		this.acceleration = new Vector(0, 0);
		env.birds.forEach(function (bird) {
			if (this.id == bird.id) {
				return;
			}
			this.FUZZY_RULES.forEach(function (rule) {
				var membership = rule.membershipFunction(this, bird);
				if (membership > 0) {
					// rule must be considered
					var result = rule.resultFunction(this, bird);
					this.acceleration = this.acceleration.add(result.scale(membership));
				}
			}, this);
		}, this);
	};
	/**
	 * Apply acceleration to velocity and position
	 */
	Bird.prototype.move = function () {
		// change velocity
		this.velocity = this.velocity.add(this.acceleration.scale(1 / FRAME_RATE));
		// scale velocity back to max
		this.velocity = this.velocity.scale(Math.min(1, BIRD_MAX_VELOCITY / this.velocity.getMagnitude()));
		// update position
		this.position = this.position.add(this.velocity.scale(1 / FRAME_RATE));
		// wrap around canvas edges
		this.position.x %= CANVAS_WIDTH;
		this.position.y %= CANVAS_HEIGHT;
	};

// Environment

	/**
	 * The environment maintains the collection of birds and orchestrates their movements and their expression on the
	 * canvas UI
	 * @constructor
	 */
	var Environment = function () {
		this.birds = [];
		this.canvas = document.getElementById(canvasElementId);
		this.canvas.width = CANVAS_WIDTH;
		this.canvas.height = CANVAS_HEIGHT;
		this.context = this.canvas.getContext('2d');
		this.context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
	};
	/**
	 * Add a bird to the system. It will be assigned a random position and initial velocity
	 * @param {Bird} bird
	 */
	Environment.prototype.addBird = function (bird) {
		// Provide bird with initial random position & velocity
		bird.position = new Vector(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT);
		bird.velocity = new Vector(
			Math.random() * 2 * BIRD_MAX_VELOCITY - BIRD_MAX_VELOCITY,
			Math.random() * 2 * BIRD_MAX_VELOCITY - BIRD_MAX_VELOCITY
		);
		bird.id = this.birds.length;
		this.birds.push(bird);
		this.drawBird(bird);
	};
	/**
	 * Black out the bird's current position
	 * @param {Bird} bird
	 */
	Environment.prototype.eraseBird = function (bird) {
		this.context.fillStyle = 'black';
		this.context.fillRect(Math.round(bird.position.x), Math.round(bird.position.y), BIRD_WIDTH, BIRD_WIDTH);
	};
	/**
	 * Draw the bird; it will be assigned a colour based on its id
	 * @param {Bird} bird
	 */
	Environment.prototype.drawBird = function (bird) {
		var colors = ['white', 'red', 'blue', 'green'];
		this.context.fillStyle = colors[bird.id % colors.length];
		this.context.fillRect(Math.round(bird.position.x), Math.round(bird.position.y), BIRD_WIDTH, BIRD_WIDTH);
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
		setInterval(function () {
			birds.forEach(function (bird) {
				env.eraseBird(bird);
				bird.updateAcceleration(env);
				bird.move();
				env.drawBird(bird);
			});
		}, 1000 / FRAME_RATE);
	};

// Runtime

	// Create the environment
	var env = new Environment();
	// Add birds
	for (var i = 0; i < BIRD_COUNT; i++) {
		var bird = new Bird();
		env.addBird(bird);
	}
	env.run();

}(document, window, 'canvas'));
