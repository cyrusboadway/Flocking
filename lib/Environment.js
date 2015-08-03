define(['./Vector', './Bird', './Predator'], function(Vector, Bird, Predator){
	/**
	 * The environment maintains the collection of birds and orchestrates their movements and their expression on the
	 * canvas UI
	 *
	 * @constructor
	 */
	var Environment = function (canvasElementId) {
		this.birds = [];
		this.frameRate = 24;
		this.canvas = document.getElementById(canvasElementId);
		this.canvas.width = this.canvas.offsetWidth;
		this.canvas.height = this.canvas.offsetHeight;
		this.context = this.canvas.getContext('2d');
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

		// Prepare predator
		var self = this;
		this.predator = new Predator(0, 0);
		this.canvas.addEventListener('mousemove', function(event){
			var rect = self.canvas.getBoundingClientRect();
			self.predator.position = new Vector(event.clientX - rect.left, event.clientY - rect.top);
		}, false);
		this.canvas.addEventListener('mousedown', function(){
			var rect = self.canvas.getBoundingClientRect();
			self.predator.position = new Vector(event.clientX - rect.left, event.clientY - rect.top);
			self.predator.active = true;
		}, false);
		this.canvas.addEventListener('mouseup', function(){
			self.predator.active = false;
		}, false);
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
		this.birds.forEach(function (bird) {
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
				bird.considerPredator(env.predator);
				env.eraseBird(bird);
				bird.move(1 / frameRate);
				env.drawBird(bird);
			});
		}, 1000 / this.frameRate);
	};

	return Environment;
});
