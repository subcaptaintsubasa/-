// js/common/utils.js
// General utility functions that can be used across different modules.

/**
 * Debounces a function, ensuring it's only called after a certain delay
 * since the last time it was invoked.
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
export function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(context, args);
        }, delay);
    };
}

/**
 * Throttles a function, ensuring it's only called at most once
 * within a specified time window.
 * Handles trailing call if invoked multiple times during the limit.
 * @param {Function} func - The function to throttle.
 * @param {number} limit - The throttle limit in milliseconds.
 * @returns {Function} - The throttled function.
 */
export function throttle(func, limit) {
    let inThrottle;
    let lastFuncArgs; // Store arguments of the last call during throttle
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastFuncArgs) { // If there was a call during the throttle period
                    func.apply(context, lastFuncArgs);
                    lastFuncArgs = null; // Reset
                }
            }, limit);
        } else {
            lastFuncArgs = args; // Save the latest arguments
        }
    };
}


/**
 * Sanitizes HTML string to prevent XSS by converting special characters to HTML entities.
 * This is a very basic sanitizer. For robust security, consider a dedicated library
 * like DOMPurify if user-generated HTML needs to be rendered.
 * For simply displaying text content, setting `element.textContent` is safer.
 * @param {string} str - The string to sanitize.
 * @returns {string} - The sanitized string.
 */
export function sanitizeTextForHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function (match) {
        return {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": ''' // or '
        }[match];
    });
}
// If you intend to insert HTML and need more robust sanitization:
// export function sanitizeHTML(str, config) { /* Use DOMPurify or similar */ }


/**
 * Generates a simple unique ID.
 * Useful for creating unique IDs for DOM elements if needed dynamically.
 * Not cryptographically secure.
 * @param {string} [prefix='uid-'] - Optional prefix for the ID.
 * @returns {string} - A unique ID string.
 */
export function simpleUID(prefix = 'uid-') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Scrolls to a specific element smoothly.
 * @param {HTMLElement|string} target - The target element or its CSS selector.
 * @param {number} [offset=0] - Vertical offset from the top (e.g., for sticky header).
 * @param {'auto'|'smooth'} [behavior='smooth'] - Scroll behavior.
 */
export function scrollToElement(target, offset = 0, behavior = 'smooth') {
    let element;
    if (typeof target === 'string') {
        try {
            element = document.querySelector(target);
        } catch (e) {
            console.error("Invalid selector for scrollToElement:", target, e);
            return;
        }
    } else if (target instanceof HTMLElement) {
        element = target;
    }

    if (element) {
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: behavior
        });
    } else {
        console.warn("Scroll target element not found:", target);
    }
}

/**
 * Checks if a value is an empty object.
 * @param {any} value - The value to check.
 * @returns {boolean} - True if the value is an empty object, false otherwise.
 */
export function isEmptyObject(value) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    return Object.keys(value).length === 0;
}

/**
 * Performs a deep clone of an object or array.
 * Handles basic data types, objects, and arrays. Does not handle functions, Dates, RegExps, Maps, Sets correctly.
 * For more complex scenarios, consider a library like lodash.cloneDeep.
 * @param {T} source - The object or array to clone.
 * @returns {T} - A deep clone of the source.
 * @template T
 */
export function deepClone(source) {
    if (typeof source !== 'object' || source === null) {
        return source; // Primitive types or null
    }

    const clone = Array.isArray(source) ? [] : {};

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            clone[key] = deepClone(source[key]);
        }
    }
    return clone;
}
