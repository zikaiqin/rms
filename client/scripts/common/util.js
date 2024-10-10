import $ from 'jquery';

function isInputTypeSupported(type, testValue) {
    const jq = $(`<input type="${type}" required />`);
    jq.val(testValue);
    return !jq.get(0).validity.valid;
}

/**
 * @typedef {JQuery | string} Target
 * 
 * @param {Target} target
 * @param {() => void} callback
 * @param {number} longInterval
 * @param {number} shortInterval
 */
function spamOnHold(target, callback, longInterval = 500, shortInterval = 50) {
    if (typeof target !== 'string' && !(target instanceof $)) {
        throw new TypeError('Target must be a selector or a JQuery');
    }
    const el = $(target).on('click', callback);
    let holding = false;
    let timeOut = undefined;
    el.on('mousedown', () => {
        el.one('mouseup mouseleave', () => {
            el.off('mouseup mouseleave');
            clearTimeout(timeOut);
            holding = false;
        });
        holding = true;
        timeOut = setTimeout(() => {
            el.off('click');
            const i = setInterval(() => {
                if (holding) {
                    callback();
                } else {
                    clearInterval(i);
                    el.on('click', callback);
                }
            }, shortInterval)
        }, longInterval);
    });
}

export { isInputTypeSupported, spamOnHold };
