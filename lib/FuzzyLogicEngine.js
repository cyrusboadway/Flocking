define(function () {
	/**
	 * A fuzzy logic engine takes a set of rules, each defined as a membership and a result function, and for a given set
	 * of conditions, determines an output.
	 *
	 * @param {Array.<{membershipFunction: function, resultFunction: function}>} rules
	 * @param {function} combineResults
	 * @param {function=} conditionPreprocessor The output of this function (with the given conditions as a parameter) is
	 *                                            passed to each rule. This saves on repeating certain calculations.
	 * @constructor
	 */
	var FuzzyLogicEngine = function (rules, combineResults, conditionPreprocessor) {
		this.rules = rules;
		this.combineResults = combineResults;
		this.conditionPreprocessor = conditionPreprocessor;
	};

	/**
	 * Methods which describe various fuzzy logic membership function shapes
	 *
	 * @type {{Trapezoid: function, Triangle: function, Square: function}}
	 */
	FuzzyLogicEngine.FUZZY_MEMBERSHIP_FUNCTIONS = {
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

	/**
	 * Apply the rules for the given conditions, combining the results
	 *
	 * @param conditions
	 * @returns {*}
	 */
	FuzzyLogicEngine.prototype.run = function (conditions) {
		var results = [];

		// If a preprocessor was provided, pre-process the conditions (underscore's implementation of 'isFunction')
		var preprocessedConditions = null;
		if (this.conditionPreprocessor && this.conditionPreprocessor.constructor
			&& this.conditionPreprocessor.call && this.conditionPreprocessor.apply) {
			preprocessedConditions = this.conditionPreprocessor(conditions);
		}

		// Process the rules
		this.rules.forEach(function (rule) {
			var membership = rule.membershipFunction(conditions, preprocessedConditions);
			if (membership > 0) {
				results.push(rule.resultFunction(conditions, preprocessedConditions));
			} else {
				results.push(null);
			}
		});

		return this.combineResults(results);
	};

	return FuzzyLogicEngine;
});
