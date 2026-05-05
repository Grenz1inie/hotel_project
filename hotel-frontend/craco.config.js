const path = require('path');

module.exports = {
	webpack: {
		configure: (config) => {
			const matcher = (warning) => {
				if (!warning || !warning.message) return false;
				if (!warning.module || !warning.module.resource) return false;
				return warning.message.includes('Failed to parse source map')
					&& warning.module.resource.includes(`${path.sep}node_modules${path.sep}@antv${path.sep}g2${path.sep}`);
			};
			config.ignoreWarnings = [...(config.ignoreWarnings || []), matcher];
			return config;
		},
	},
};
