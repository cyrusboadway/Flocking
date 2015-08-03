requirejs(['lib/Environment'], function(Environment){
	var canvasElementId = 'canvas';
	var initialBirdCount = 100;

	// Create the environment
	var env = new Environment(canvasElementId);

	// Add birds
	for (var i = 0; i < initialBirdCount; i++) {
		env.addBird();
	}
	env.run();
});
