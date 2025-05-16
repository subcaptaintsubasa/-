// js/modules/utils.js
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
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Throttles a function, ensuring it's only called at most once
 * within a specified time window.
 * @param {Function} func - The function to throttle.
 * @param {number} limit - The throttle limit in milliseconds.
 * @returns {Function} - The throttled function.
 */
export function throttle(func, limit) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastFunc) {
                    lastFunc.apply(context, args); // Re-trigger with latest args if called during throttle
                    lastFunc = null; // Clear
                }
            }, limit);
        } else {
            // Store the last call to execute it after throttle period
            lastFunc = () => func.apply(context, args);
        }
    };
}


/**
 * Sanitizes HTML string to prevent XSS.
 * A very basic sanitizer, consider a robust library for production.
 * @param {string} str - The string to sanitize.
 * @returns {string} - The sanitized string.
 */
export function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * Generates a simple unique ID.
 * Not cryptographically secure, just for basic unique element IDs if needed.
 * @param {string} prefix - Optional prefix for the ID.
 * @returns {string} - A unique ID string.
 */
export function simpleUID(prefix = 'uid-') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Scrolls to a specific element smoothly.
 * @param {HTMLElement|string} target - The target element or its selector.
 * @param {number} offset - Vertical offset from the top.
 * @param {ScrollBehavior} behavior - 'auto' or 'smooth'.
 */
export function scrollToElement(target, offset = 0, behavior = 'smooth') {
    let element;
    if (typeof target === 'string') {
        element = document.querySelector(target);
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


// Add more utility functions as needed.
// For example:
// - formatDate(date, formatString)
// - isEmptyObject(obj)
// - deepClone(obj)
