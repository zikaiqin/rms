import $ from 'jquery';

function isInputTypeSupported(type, testValue) {
    const jq = $(`<input type="${type}" required />`);
    jq.val(testValue);
    return !jq.get(0).validity.valid;
}

function spamOnHold(id, cb, longInterval = 500, shortInterval = 50) {
    const el = $(id).on('click', cb);
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
                    cb();
                } else {
                    clearInterval(i);
                    el.on('click', cb);
                }
            }, shortInterval)
        }, longInterval);
    });
}

export { isInputTypeSupported, spamOnHold };
