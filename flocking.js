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
	 * Produce a new vector with a different heading, rotated by the given angle
	 *
	 * @param angleOfRotation
	 * @returns {Vector}
	 */
	Vector.prototype.rotate = function (angleOfRotation) {
		// Adding 360° then modulus 360° clears out negative values
		var newAngle = (this.getBearing() + angleOfRotation + 2 * Math.PI) % (2 * Math.PI);
		return Vector.newFromPolar(this.getMagnitude(), newAngle);
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
		this.color = 'white';
		this.width = 10;
		this.closeness = 200;
		this.influence = 400;
		this.maxVelocity = 100;
		this.maxVelocityJitter = 0.2;
		this.fieldOfVision = Math.PI;
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

	Bird.inFieldOfVision = function (sourceBird, destinationBird) {
		var headingOne = sourceBird.velocity.getBearing();
		var headingTwo = destinationBird.position.subtract(sourceBird.position).getBearing();
		var difference = headingTwo - headingOne;
		if (difference > Math.PI) {
			difference = Math.min(headingOne, headingTwo) + 2 * Math.PI - Math.max(headingOne, headingTwo);
		}
		return difference < sourceBird.fieldOfVision;
	};

	/**
	 * These are the set of rules by which the birds determine in which direction to accelerate. The rules compete for
	 * control of the bird's acceleration. The membership function is used to determine to what degree the rule should
	 * be applied. The result function determines what action should be take (i.e. direction, magnitude of accel.).
	 * heh. bird brain.
	 *
	 * @type {*[]}
	 */
	Bird.prototype.INTRA_BIRD_FUZZY_RULES = [
		// TOO CLOSE: birds are really close, need to be pushed apart
		{
			membershipFunction: function (bird, destinationBird) {
				if (!Bird.inFieldOfVision(bird, destinationBird)) {
					return 0;
				}
				var nearestLattice = env.findClosestLatticeLocation(bird.position, destinationBird.position);
				var distance = bird.position.subtract(nearestLattice).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, 0, 0, bird.closeness);
			},
			resultFunction: function (bird, destinationBird) {
				var nearestLattice = env.findClosestLatticeLocation(bird.position, destinationBird.position);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				var difference = bird.position.subtract(nearestLattice);
				return Vector.newFromPolar(1000 / difference.getMagnitude(), difference.getBearing());
			}
		},
		// CLOSE, PUSH TOGETHER: close enough to be influenced, bringing them closer together
		{
			membershipFunction: function (bird, destinationBird) {
				if (!Bird.inFieldOfVision(bird, destinationBird)) {
					return 0;
				}
				var nearestLattice = env.findClosestLatticeLocation(bird.position, destinationBird.position);
				var distance = bird.position.subtract(nearestLattice).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, bird.closeness, 2 * bird.closeness, 3 * bird.closeness);
			},
			resultFunction: function (bird, destinationBird) {
				var nearestLattice = env.findClosestLatticeLocation(bird.position, destinationBird.position);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				var difference = nearestLattice.subtract(bird.position);
				return Vector.newFromPolar(10, difference.getBearing());
			}
		},
		// CLOSE, CHANGE DIRECTION: close enough to be influenced, push their directions towards parallel
		{
			membershipFunction: function (bird, destinationBird) {
				if (!Bird.inFieldOfVision(bird, destinationBird)) {
					return 0;
				}
				var nearestLattice = env.findClosestLatticeLocation(bird.position, destinationBird.position);
				var distance = bird.position.subtract(nearestLattice).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, bird.closeness, (bird.closeness + bird.influence) / 2, bird.influence);
			},
			resultFunction: function (bird, destinationBird) {
				//var nearestLattice = env.findClosestLatticeLocation(bird, destinationBird);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				return Vector.newFromPolar(10, destinationBird.velocity.getBearing());
			}
		}
	];

	Bird.prototype.PREDATOR_FUZZY_RULES = [
		{
			membershipFunction: function (bird, predator) {
				var nearestLattice = env.findClosestLatticeLocation(bird.position, predator);
				var distance = bird.position.subtract(nearestLattice).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, 0, 0, bird.closeness * 3);
			},
			resultFunction: function (bird, predator) {
				var nearestLattice = env.findClosestLatticeLocation(bird.position, predator);
				var bearing = bird.position.subtract(nearestLattice).getBearing();
				return Vector.newFromPolar(100, bearing);
			}
		}
	];

	/**
	 * On every iteration, the bird's acceleration is reconsidered from scratch. This method 'zeros' the acceleration.
	 */
	Bird.prototype.resetBrain = function () {
		this.acceleration = new Vector(0, 0);
	};

	/**
	 * Have one bird consider the influence of another bird
	 *
	 * @param bird
	 */
	Bird.prototype.considerBird = function (bird) {
		// Check each rule against each fuzzy rule
		var memberships = [];
		this.INTRA_BIRD_FUZZY_RULES.forEach(function (rule) {
			var membership = rule.membershipFunction(this, bird);
			memberships.push(membership);
			if (membership > 0) {
				// the rule applies to some degree
				var result = rule.resultFunction(this, bird);
				this.acceleration = this.acceleration.add(result.scale(membership));
			}
		}, this);
		this.PREDATOR_FUZZY_RULES.forEach(function (rule) {
			var membership = rule.membershipFunction(this, new Vector(300, 300));
			memberships.push(membership);
			if (membership > 0) {
				var result = rule.resultFunction(this, new Vector(300, 300));
				this.acceleration = this.acceleration.add(result.scale(membership));
			}
		}, this);
		var color = memberships
			.slice(0, 3)
			.map(function (membership) {
				return Math.floor(255 * (1 - membership));
			})
			.join(',');
		bird.color = 'rgb(' + color + ')';
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
		bird.maxVelocity = bird.maxVelocity * (1 + (Math.random() * 2 - 1) * bird.maxVelocityJitter);
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
		this.context.fillStyle = bird.color;
		this.context.fillRect(Math.round(bird.position.x), Math.round(bird.position.y), bird.width, bird.width);
	};

	/**
	 * Trigger each bird to consider all other birds. By creating arrays of birds sorted by a dimension of their
	 * position, birds need only consider a small set of the nearby birds, rather than a complete set
	 */
	Environment.prototype.processBirds = function () {
		env.birds.forEach(function (bird) {
			bird.resetBrain();
		});

		// Reusable callback to sort an array of birds
		var sortParam = 'x';
		var sort = function (a, b) {
			return a.position[sortParam] - b.position[sortParam];
		};

		// create copies of the birds, sort by 'x' dimension
		var sortedBirds = this.birds.slice(0).sort(sort);
		var consideredPairs = this.processOrderedSet(sortedBirds, 'x', {});
		// re-sort by 'y' dimension
		sortParam = 'y';
		sortedBirds.sort(sort);
		this.processOrderedSet(sortedBirds, 'y', consideredPairs);
	};

	/**
	 * Given an array of birds that have been sorted in a particular dimension of their position, have each bird
	 * consider each other bird within a certain maximum distance
	 *
	 * @param {Bird[]}    orderedSet        Array of birds sorted by a particular dimension of their position (i.e. x/y)
	 * @param {string}    dimension        The dimension by which they are sorted
	 * @param {*}        consideredPairs    A 'hash set' of pairs of ids which have already been considered
	 * @returns {*}
	 */
	Environment.prototype.processOrderedSet = function (orderedSet, dimension, consideredPairs) {
		var MAX_COMPARABLE_DISTANCE = 300;
		var count = orderedSet.length;
		for (var i = 0; i < count; i++) {
			var isOutOfRange = false;
			var iBirdid = orderedSet[i].id;

			// Cycle through subsequent birds until loop complete or birds too far apart in sorted dimension
			for (var j = (i + 1) % count; i != j && !isOutOfRange; j = (j + 1) % count) {
				var jBirdid = orderedSet[j].id;

				// Check if this pair of ids has already been looked at (from a previous call to this method)
				var pairHashKey = '' + Math.min(iBirdid, jBirdid) + 'x' + Math.max(iBirdid, jBirdid);
				if (consideredPairs.hasOwnProperty(pairHashKey)) {
					continue;
				}
				consideredPairs[pairHashKey] = true;

				// In sorted dimension, are birds too far to influence each other?
				var dimensionSeparation = Math.abs(this.birds[iBirdid].position[dimension]
					- this.birds[jBirdid].position[dimension]);
				if (dimensionSeparation > MAX_COMPARABLE_DISTANCE && dimensionSeparation < this.canvas.height - MAX_COMPARABLE_DISTANCE) {
					isOutOfRange = true;
					continue;
				}

				// Are birds close enough to affect each other
				var distance = this.birds[i].position.subtract(this.birds[j].position).getMagnitude();
				if (distance < MAX_COMPARABLE_DISTANCE) {
					this.birds[iBirdid].considerBird(this.birds[jBirdid]);
					this.birds[jBirdid].considerBird(this.birds[iBirdid]);
				}
			}
		}
		return consideredPairs;
	};

	/**
	 * Since the canvas "wraps", birds on opposite sides of the canvas should be influenced across the canvas edge,
	 * rather than directly
	 *
	 * @param {Vector} origin
	 * @param {Vector} destination
	 * @returns {Vector}
	 */
	Environment.prototype.findClosestLatticeLocation = function (origin, destination) {
		var closestLatticeNode = function (originPosition, destinationPosition, latticePeriod) {
			if (Math.abs(originPosition - destinationPosition) > Math.abs(originPosition - (destinationPosition - latticePeriod))) {
				return destinationPosition - latticePeriod;
			} else if (Math.abs(originPosition - destinationPosition) > Math.abs(originPosition - (destinationPosition + latticePeriod))) {
				return destinationPosition + latticePeriod;
			}
			return destinationPosition;
		};
		return new Vector(
			closestLatticeNode(origin.x, destination.x, this.canvas.width),
			closestLatticeNode(origin.y, destination.y, this.canvas.height)
		);
	};

	/**
	 * Big time sequence moving the birds, having them interact with each other
	 */
	Environment.prototype.run = function () {
		var env = this;
		var frameRate = this.frameRate;
		setInterval(function () {
			env.processBirds();
			env.birds.forEach(function (bird) {
				env.eraseBird(bird);
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

}(document, window, 'canvas', 100));
