define(['./Vector', './FuzzyLogicEngine'], function (Vector, FuzzyLogicEngine) {
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

		this.intraBirdEngine = new FuzzyLogicEngine(
			Bird.INTRA_BIRD_FUZZY_RULES,
			Bird.fuzzyResultCombiner,
			Bird.intraBirdConditionPreprocessor
		);
		this.predatorEngine = new FuzzyLogicEngine(
			Bird.PREDATOR_FUZZY_RULES,
			Bird.fuzzyResultCombiner,
			Bird.predatorConditionPreprocessor
		);
	};

	/**
	 * These are the set of rules by which the birds determine in which direction to accelerate. The rules compete for
	 * control of the bird's acceleration. The membership function is used to determine to what degree the rule should
	 * be applied. The result function determines what action should be take (i.e. direction, magnitude of accel.).
	 * heh. bird brain.
	 *
	 * @type {Array.<{membershipFunction: function, resultFunction: function}>}
	 */
	Bird.INTRA_BIRD_FUZZY_RULES = [
		// TOO CLOSE: birds are really close, need to be pushed apart
		{
			membershipFunction: function (conditions, preprocessedConditions) {
				return FuzzyLogicEngine.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](
					preprocessedConditions.distance,
					0,
					0,
					conditions.bird.closeness
				);
			},
			resultFunction: function (conditions, preprocessedConditions) {
				return Vector.newFromPolar(5000 / preprocessedConditions.distance, preprocessedConditions.bearing);
			}
		},
		// CLOSE, PUSH TOGETHER: close enough to be influenced, bringing them closer together
		{
			membershipFunction: function (conditions, preprocessedConditions) {
				return FuzzyLogicEngine.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](
					preprocessedConditions.distance,
					conditions.bird.closeness, 2 * conditions.bird.closeness,
					3 * conditions.bird.closeness
				);
			},
			resultFunction: function (conditions, preprocessedConditions) {
				var attractiveBearing = preprocessedConditions.difference.rotate(Math.PI).getBearing();
				return Vector.newFromPolar(conditions.bird.maxAcceleration / 2, attractiveBearing);
			}
		},
		// CLOSE, CHANGE DIRECTION: close enough to be influenced, push their directions towards parallel
		{
			membershipFunction: function (conditions, preprocessedConditions) {
				return FuzzyLogicEngine.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](
					preprocessedConditions.distance,
					conditions.bird.closeness,
					(conditions.bird.closeness + conditions.bird.influence) / 2,
					conditions.bird.influence
				);
			},
			resultFunction: function (conditions) {
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				return Vector.newFromPolar(conditions.bird.maxAcceleration, conditions.destinationBird.velocity.getBearing());
			}
		}
	];

	/**
	 * Rules to guide Birds away from the predator
	 *
	 * @type {Array.<{membershipFunction: function, resultFunction: function}>}
	 */
	Bird.PREDATOR_FUZZY_RULES = [
		// RUN AWAY FROM THE PREDATOR
		{
			membershipFunction: function (conditions, preprocessedConditions) {
				return FuzzyLogicEngine.FUZZY_MEMBERSHIP_FUNCTIONS['Triangle'](
					preprocessedConditions.distance,
					0,
					0,
					conditions.bird.influence * 2
				);
			},
			resultFunction: function (conditions, preprocessedConditions) {
				return Vector.newFromPolar(conditions.bird.maxAcceleration * 50, preprocessedConditions.bearing);
			}
		}
	];

	/**
	 * Combine the results of the fuzzy logic engine
	 *
	 * @param {Vector[]} results
	 * @returns {Vector}
	 */
	Bird.fuzzyResultCombiner = function (results) {
		var combined = new Vector(0, 0);
		results.forEach(function (result) {
			if (result !== null) {
				combined = combined.add(result);
			}
		});
		return combined;
	};

	/**
	 * Cache the results of a lot of the commonly calculated math between the intra-bird fuzzy rules
	 *
	 * @param {Object} conditions
	 * @returns {{difference: Vector, distance: number, bearing: number}}
	 */
	Bird.intraBirdConditionPreprocessor = function (conditions) {
		var difference = conditions.env.shortestPathBetweenPoints(conditions.destinationBird.position, conditions.bird.position);
		return {
			difference: difference,
			distance: difference.getMagnitude(),
			bearing: difference.getBearing()
		};
	};

	/**
	 * Cache the results of a lot of the commonly calculated math between the predator fuzzy rules
	 *
	 * @param {Object} conditions
	 * @returns {{difference: Vector, distance: number, bearing: number}}
	 */
	Bird.predatorConditionPreprocessor = function (conditions) {
		var difference = conditions.env.shortestPathBetweenPoints(conditions.destinationBird.position, conditions.bird.position);
		return {
			difference: difference,
			distance: difference.getMagnitude(),
			bearing: difference.getBearing()
		};
	};

	/**
	 * Is the destination bird in the field of vision of the source bird?
	 *
	 * @param {Bird} sourceBird
	 * @param {Bird} destinationBird
	 * @returns {boolean}
	 */
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
		var conditions = {
			env: this.env,
			bird: this,
			destinationBird: bird
		};
		var additionalAcceleration = this.intraBirdEngine.run(conditions);
		this.acceleration = this.acceleration.add(additionalAcceleration);
	};

	/**
	 * Apply fuzzy logic rules related to the predator
	 *
	 * @param {Predator} predator
	 */
	Bird.prototype.considerPredator = function (predator) {
		if (predator.active) {
			var conditions = {
				env: this.env,
				bird: this,
				predator: predator
			};
			this.acceleration = this.acceleration.add(this.predatorEngine.run(conditions));
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
