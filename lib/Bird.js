define(['./Vector'], function (Vector) {
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
		this.width = 5;
		this.closeness = 75;
		this.influence = 150;
		this.maxVelocity = 100;
		this.maxAcceleration = 100;
		this.maxVelocityJitter = 0.3;
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
	Bird.INTRA_BIRD_FUZZY_RULES = [
		// TOO CLOSE: birds are really close, need to be pushed apart
		{
			membershipFunction: function (bird, destinationBird) {
				var nearestLattice = bird.env.findClosestLatticeLocation(bird.position, destinationBird.position);
				var distance = bird.position.subtract(nearestLattice).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, 0, 0, bird.closeness);
			},
			resultFunction: function (bird, destinationBird) {
				var nearestLattice = bird.env.findClosestLatticeLocation(bird.position, destinationBird.position);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				var difference = bird.position.subtract(nearestLattice);
				return Vector.newFromPolar(5000 / difference.getMagnitude(), difference.getBearing());
			}
		},
		// CLOSE, PUSH TOGETHER: close enough to be influenced, bringing them closer together
		{
			membershipFunction: function (bird, destinationBird) {
				var nearestLattice = bird.env.findClosestLatticeLocation(bird.position, destinationBird.position);
				var distance = bird.position.subtract(nearestLattice).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, bird.closeness, 2 * bird.closeness, 3 * bird.closeness);
			},
			resultFunction: function (bird, destinationBird) {
				var nearestLattice = bird.env.findClosestLatticeLocation(bird.position, destinationBird.position);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				var difference = nearestLattice.subtract(bird.position);
				return Vector.newFromPolar(bird.maxAcceleration / 2, difference.getBearing());
			}
		},
		// CLOSE, CHANGE DIRECTION: close enough to be influenced, push their directions towards parallel
		{
			membershipFunction: function (bird, destinationBird) {
				var nearestLattice = bird.env.findClosestLatticeLocation(bird.position, destinationBird.position);
				var distance = bird.position.subtract(nearestLattice).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, bird.closeness, (bird.closeness + bird.influence) / 2, bird.influence);
			},
			resultFunction: function (bird, destinationBird) {
				//var nearestLattice = env.findClosestLatticeLocation(bird, destinationBird);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				return Vector.newFromPolar(bird.maxAcceleration, destinationBird.velocity.getBearing());
			}
		}
	];

	Bird.PREDATOR_FUZZY_RULES = [
		// RUN AWAY FROM THE PREDATOR
		{
			membershipFunction: function (bird, predator) {
				var nearestLattice = bird.env.findClosestLatticeLocation(bird.position, predator.position);
				var distance = bird.position.subtract(nearestLattice).getMagnitude();
				return Bird.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](distance, 0, 0, bird.influence * 2);
			},
			resultFunction: function (bird, predator) {
				var nearestLattice = bird.env.findClosestLatticeLocation(bird.position, predator.position);
				var bearing = bird.position.subtract(nearestLattice).getBearing();
				return Vector.newFromPolar(bird.maxAcceleration * 50, bearing);
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
		Bird.INTRA_BIRD_FUZZY_RULES.forEach(function (rule) {
			var membership = 0;
			if (Bird.inFieldOfVision(this, bird)) {
				membership = rule.membershipFunction(this, bird);
			}
			memberships.push(membership);
			if (membership > 0) {
				// the rule applies to some degree
				var result = rule.resultFunction(this, bird);
				this.acceleration = this.acceleration.add(result.scale(membership));
			}
		}, this);
		var color = memberships
			.slice(0, 3)// make sure only the first three rules contribute to the color.
			.map(function (membership) {
				return Math.floor(255 * (1 - membership));
			})
			.join(',');
		bird.color = 'rgb(' + color + ')';
	};

	Bird.prototype.considerPredator = function (predator) {
		if (predator.active) {
			Bird.PREDATOR_FUZZY_RULES.forEach(function (rule) {
				var membership = rule.membershipFunction(this, predator);
				if (membership > 0) {
					var result = rule.resultFunction(this, predator);
					this.acceleration = this.acceleration.add(result.scale(membership));
				}
			}, this);
		}
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

	return Bird;
});