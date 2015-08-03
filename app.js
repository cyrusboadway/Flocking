requirejs(['lib/Environment'], function(Environment){
	var canvasElementId = 'canvas';
	var initialBirdCount = 100;

	// Create the environment
	var env = new Environment('canvas');

	// Add birds
	for (var i = 0; i < 100; i++) {
		env.addBird();
	}
	env.run();
});
