(function(document, window, canvasElementId){
	var BIRD_COUNT = 200;
	var FRAME_RATE = 24;
	var BIRD_MAX_VELOCITY = 100;
	var CANVAS_WIDTH = document.getElementById(canvasElementId).offsetWidth;
	var CANVAS_HEIGHT = document.getElementById(canvasElementId).offsetHeight;
	var CLOSENESS = 10;

// Vector class
	var Vector = function(x, y){
		this.x = x;
		this.y = y;
	};
	Vector.prototype.scale = function(scale){
		return new Vector(this.x * scale, this.y * scale);
	};
	Vector.prototype.magnitude = function(){
		return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
	};
	Vector.prototype.bearing = function(){
		return Math.atan(this.y / this.x);
	};
	Vector.prototype.add = function(vector){
		return new Vector(this.x + vector.x, this.y + vector.y);
	};
	Vector.prototype.subtract = function(vector){
		return new Vector(this.x - vector.x, this.y - vector.y);
	};
	Vector.newFromPolar = function(magnitude, bearing){
		return new Vector(
			Math.cos(bearing) * magnitude,
			Math.sin(bearing) * magnitude
		);
	};

// Bird class

	var Bird = function(){
		this.MAX_VELOCITY = BIRD_MAX_VELOCITY;

		this.id = null;
		this.position = null;
		this.velocity = new Vector(0, 0);
		this.acceleration = new Vector(0, 0);
	};
	Bird.prototype.FUZZY_RULES = [
		{
			'membershipFunction' : function(distance){
				return distance < CLOSENESS;
			},
			'resultFunction' : function(originBird, destinationBird){
				var test = env.findClosestLatticeLocation(originBird, destinationBird);
				// Get the bearing pointing from the destination to the origin (i.e. away from the other bird)
				var difference = originBird.position.subtract(test);
				return Vector.newFromPolar(1 / difference.magnitude(), difference.bearing());
			}
		}
	];
	Bird.prototype.updateAcceleration = function(env){
		this.acceleration = new Vector(0, 0);
		env.birds.forEach(function(bird){
			if(this.id == bird.id){
				return;
			}
			this.FUZZY_RULES.forEach(function(rule){
				var membership = rule.membershipFunction(this.position.subtract(bird.position).magnitude());
				var result = rule.resultFunction(this, bird);
				// apply fuzzy logic influence on acceleration
				this.acceleration = this.acceleration.add(result.scale(membership));
			}, this);
		}, this);
	};
	Bird.prototype.move = function(){
		// change velocity
		this.velocity = this.velocity.add(this.acceleration.scale(1/FRAME_RATE));
		// scale velocity back to max
		this.velocity = this.velocity.scale(Math.min(1, this.MAX_VELOCITY / this.velocity.magnitude()));
		// update position
		this.position = this.position.add(this.velocity.scale(1 / FRAME_RATE));
		// wrap around canvas edges
		this.position.x %= CANVAS_WIDTH;
		this.position.y %= CANVAS_HEIGHT;
	};

	var Environment = function(){
		this.canvas = document.getElementById(canvasElementId);
		this.canvas.width = CANVAS_WIDTH;
		this.canvas.height = CANVAS_HEIGHT;
		this.context = this.canvas.getContext('2d');
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.birds = [];
	};
	Environment.prototype.addBird = function(bird){
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
	Environment.prototype.eraseBird = function(bird){
		this.context.fillStyle = 'black';
		this.context.fillRect(Math.round(bird.position.x), Math.round(bird.position.y), 1, 1);
	};
	Environment.prototype.drawBird = function(bird){
		//TODO Better color picking needed
		var colors = ['white', 'red', 'blue', 'green'];
		this.context.fillStyle = colors[bird.id % colors.length];
		this.context.fillRect(Math.round(bird.position.x), Math.round(bird.position.y), 1, 1);
	};
	/**
	 * Since the canvas "wraps", birds on opposite sides of the canvas should be influenced across the canvas edge,
	 * rather than directly
	 *
	 * @param originBird
	 * @param destinationBird
	 * @returns {Vector}
	 */
	Environment.prototype.findClosestLatticeLocation = function(originBird, destinationBird){
		var closestLatticeNode = function(originPosition, destinationPosition, latticePeriod) {
			if(Math.abs(originPosition - destinationPosition) > Math.abs(originPosition - (destinationPosition - latticePeriod))){
				return destinationPosition - latticePeriod;
			} else if(Math.abs(originPosition - destinationPosition) > Math.abs(originPosition - (destinationPosition + latticePeriod))){
				return destinationPosition + latticePeriod;
			}
			return destinationPosition;
		};
		return new Vector(
			closestLatticeNode(originBird.position.x, destinationBird.position.x, this.canvas.width),
			closestLatticeNode(originBird.position.y, destinationBird.position.y, this.canvas.height)
		);
	};

	Environment.prototype.run = function(){
		var birds = this.birds;
		var env = this;
		setInterval(function(){
			birds.forEach(function(bird){
				env.eraseBird(bird);
				bird.updateAcceleration(env);
				bird.move();
				env.drawBird(bird);
			});
		}, 1000 / FRAME_RATE);
	};

	// Create the environment
	var env = new Environment();
	// Add birds
	for(var i=0; i<BIRD_COUNT; i++){
		var bird = new Bird();
		env.addBird(bird);
	}
	env.run();

}(document, window, 'canvas'));
