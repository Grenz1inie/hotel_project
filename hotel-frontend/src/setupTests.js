// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

jest.mock('react-photo-sphere-viewer', () => {
	const React = require('react');
	return {
		ReactPhotoSphereViewer: React.forwardRef((props, ref) => {
			const { children, ...rest } = props || {};
			return React.createElement('div', { 'data-testid': 'mock-photo-sphere-viewer', ref, ...rest }, children || null);
		}),
	};
}, { virtual: true });

if (!window.matchMedia) {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: jest.fn().mockImplementation((query) => {
			const listeners = new Set();
			const mql = {
				matches: false,
				media: query,
				onchange: null,
				addListener: jest.fn((cb) => {
					listeners.add(cb);
					cb(mql);
				}),
				removeListener: jest.fn((cb) => {
					listeners.delete(cb);
				}),
				addEventListener: jest.fn((_, cb) => {
					listeners.add(cb);
					cb(mql);
				}),
				removeEventListener: jest.fn((_, cb) => {
					listeners.delete(cb);
				}),
				dispatchEvent: jest.fn(() => true),
			};
			return mql;
		}),
	});
}
