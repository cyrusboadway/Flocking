requirejs(['lib/Environment'], function (Environment) {
	var canvasElementId = 'canvas';
	var initialBirdCount = 100;
	var frameRate = 24;

	/**
	 * Main application logic for orchestrating clock, intra-bird interactions, etc
	 *
	 * @param {string} canvasElementId
	 * @param {number} birdCount
	 * @param {number} frameRate
	 * @constructor
	 */
	var App = function (canvasElementId, birdCount, frameRate) {
		this.env = new Environment(canvasElementId);
		this.frameRate = frameRate;

		for (var i = 0; i < birdCount; i++) {
 	 		this.env.addBird();
		}
	};

	/**
	 * Trigger each bird to consider all other birds. By creating arrays of birds sorted by a dimension of their
	 * position, birds need only consider a small set of the nearby birds, rather than a complete set
	 */
	App.prototype.processBirds = function () {
		this.env.birds.forEach(function (bird) {
			bird.resetBrain();
		});

		// Reusable callback to sort an array of birds
		var sortParam = 'x';
		var sort = function (a, b) {
			return a.position[sortParam] - b.position[sortParam];
		};

		// create copies of the birds, sort by 'x' dimension
		var sortedBirds = this.env.birds.slice(0).sort(sort);
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
	App.prototype.processOrderedSet = function (orderedSet, dimension, consideredPairs) {
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
				var dimensionSeparation = Math.abs(this.env.birds[iBirdid].position[dimension]
					- this.env.birds[jBirdid].position[dimension]);
				if (dimensionSeparation > MAX_COMPARABLE_DISTANCE && dimensionSeparation < this.env.canvas.height - MAX_COMPARABLE_DISTANCE) {
					isOutOfRange = true;
					continue;
				}

				// Are birds close enough to affect each other
				var distance = this.env.birds[i].position.subtract(this.env.birds[j].position).getMagnitude();
				if (distance < MAX_COMPARABLE_DISTANCE) {
					this.env.birds[iBirdid].considerBird(this.env.birds[jBirdid]);
					this.env.birds[jBirdid].considerBird(this.env.birds[iBirdid]);
				}
			}
		}
		return consideredPairs;
	};

	/**
	 * Big time sequence moving the birds, having them interact with each other
	 */
	App.prototype.run = function () {
		var self = this;
		var frameRate = this.frameRate;
		setInterval(function () {
			self.processBirds();
			self.env.birds.forEach(function (bird) {
				bird.considerPredator(self.env.predator);
				self.env.eraseBird(bird);
				bird.move(1 / frameRate);
				self.env.drawBird(bird);
			});
		}, 1000 / this.frameRate);
	};

	// Begin application
	(new App(canvasElementId, initialBirdCount, frameRate)).run();
});
