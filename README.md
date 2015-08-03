Flocking
========

A Fuzzy Logic powered bird flocking simulation, including predator influence from the mouse.

Birds accelerate in a given direction using the following rules:

1. "Flock Together": when a bird is near enough, the bird will try to move towards that bird.
2. "Flock Apart": when a bird is too near, push apart.
3. "Direction": when a bird is close enough, adjust one's direction to match that of the other.

The birds also have a "field of vision", which restricts the influence of other birds to those in front of it.

//TODO
------

- [x] Better encapsulate Fuzzy Logic
- [ ] Rewrite Environment as solely responsible for spacial geometry, move app code (like 'ticks') to app 
- [ ] Address leaky abstractions
- [ ] Improve performance with web workers
- [ ] Play around with Jasmine
