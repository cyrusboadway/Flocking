define(['./Vector', './Bird', './Predator'], function(Vector, Bird, Predator){
	/**
	 * The environment maintains the collection of birds and orchestrates their movements and their expression on the
	 * canvas UI
	 *
	 * @constructor
	 */
	var Environment = function (canvasElementId) {
		this.birds = [];
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

	return Environment;
});
