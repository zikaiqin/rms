import $ from 'jquery';
import { addMonths, addWeeks, constructNow, format, parseISO } from 'date-fns';
import { memoize } from 'lodash-es';
import { dateFormatStrings } from './constants';
import { isInputTypeSupported, spamOnHold } from '@scripts/common/util';

const formatMap = {
    week: dateFormatStrings.ISOWeek,
    month: dateFormatStrings.ISOMonth,
};
const funMap = {
    week: addWeeks,
    month: addMonths,
};
const unsupportedMsg = 'Input type not supported by this browser';
const isSupported = memoize((type) => isInputTypeSupported(type, 'nonsense'));

class DatePicker {

    /**@type {boolean}*/ #supported;

    /**@type {JQuery<HTMLElement>}*/ #root;
    /**@type {JQuery<HTMLInputElement>}*/ #input;
    /**@type {JQuery<HTMLButtonElement>}*/ #prev;
    /**@type {JQuery<HTMLButtonElement>}*/ #next;

    get val() {
        return this.#input.val();
    }
    get valid() {
        return this.#input.get(0).validity.valid;
    }

    /**
     * @param {Partial<{prev: boolean, next: boolean, input: boolean}>} options
     */
    lock(options = {}) {
        [
            [this.#prev, 'prev'],
            [this.#next, 'next'],
            [this.#input, 'input'],
        ]
        .forEach(([jq, name]) => {
            if (options[name] ?? true) {
                jq.prop('inert', true);
            }
        });
        return this;
    }
    unlock() {
        [this.#prev, this.#next, this.#input].forEach((jq) => jq.prop('inert', false));
        return this;
    }

    /**
     * @param {boolean} [valid]
     */
    showValidity(valid) {
        this.#input.attr('aria-invalid', !(valid ?? this.valid));
        return this;
    }
    hideValidity() {
        this.#input.removeAttr('aria-invalid');
        return this;
    }

    setFocus(focus = true) {
        if (focus) {
            this.#input.trigger('focus');
        } else {
            this.#input.trigger('blur');
        }
        return this;
    }

    /**
     * @typedef {JQuery | string} Target
     * @typedef {'week' | 'month'} InputType
     * @typedef {Partial<{min: string, max: string, init: string}>} Values
     * @typedef {Partial<{prev: string, next: string, input: string}>} Title
     * @typedef {Partial<{values: Values, title: Title, interval: int, required: boolean}>} Settings
     * 
     * @param {Target} target
     * @param {InputType} type
     * @param {Settings} settings
     */
    constructor(target, type, settings = {}) {
        if (!type || (type !== 'week' && type !== 'month')) {
            throw new SyntaxError('Missing or invalid input type');
        }
        this.#supported = isSupported(type);
        this.#prepareRoot(target);
        this.#buildInput(type, settings);
        this.#buildArrows(settings);
        this.#attachListeners(type, settings);
        this.#root.prop('hidden', false);
    }

    /**
     * @param {Target} target
     */
    #prepareRoot(target) {
        if (typeof target !== 'string' && !(target instanceof $)) {
            throw new TypeError('Target must be a selector or a JQuery');
        }
        this.#root = $(target);
        this.#root.prop('hidden', true).addClass('date-picker').attr('role', 'group').empty();
    }

    /**
     * @param {InputType} type
     * @param {Settings} settings
     */
    #buildInput(type, settings) {
        const title = this.#supported ? settings.title?.input : unsupportedMsg;
        const {min, max} = settings.values ?? {};
        let val = settings.values?.init;

        const comp = val ? parseISO(val) : constructNow();
        if (min && comp <= parseISO(min)) {
            val = min;
        }
        else if (max && comp >= parseISO(max)) {
            val = max;
        }
        else {
            val = val ?? format(comp, formatMap[type]);
        }

        this.#input = $(`<input\
            type="${type}" \
            ${title ? `title="${title}" ` : ''}\
            ${min ? `min="${min}" ` : ''}\
            ${max ? `max="${max}" ` : ''}\
            value="${val}" \
            ${settings.required ? 'required ' : ''}
            ${this.#supported ? '' : 'readonly '}/>`
        );
        this.#root.append(this.#input);
    }

    /**
     * @param {Settings} settings
     */
    #buildArrows(settings) {
        const {prev, next} = settings.title ?? {};
        const classStr = 'class="icon-button outline secondary material-symbols-outlined"';
        this.#prev = $(
            `<button ${classStr} ${prev ? `title="${prev}"` : ''} data-action="prev" ${this.#input.val() === this.#input.attr('min') ? 'disabled' : ''}>\
                keyboard_arrow_left\
            </button>`
        );
        this.#next = $(
            `<button ${classStr} ${next ? `title="${next}"` : ''} data-action="next" ${this.#input.val() === this.#input.attr('max') ? 'disabled' : ''}>\
                keyboard_arrow_right\
            </button>`
        );
        this.#root.prepend(this.#prev).append(this.#next);
    }

    /**
     * @param {InputType} type
     * @param {Settings} settings
     */
    #attachListeners(type, settings) {
        if (this.#supported) {
            this.#attachInputListeners(settings);
        }
        const {min, max} = settings.values ?? {};
        const interval = settings.interval ?? 1;
        [[this.#prev, -interval, min], [this.#next, interval, max]].forEach(([jq, offset, limit]) => {
            spamOnHold(jq, () => {
                const curDate = parseISO(this.val);
                const newDate = funMap[type](curDate, offset);
                const newVal = format(newDate, formatMap[type]);
                if (newVal === limit) {
                    jq.prop('disabled', true);
                }
                this.#input.val(newVal).trigger({ type: 'picker.change', picker: this });
                jq.siblings('button').prop('disabled', false);
            });
        });
    }

    /**
     * @param {Settings} settings
     */
    #attachInputListeners(settings) {
        this.#input.on('input', () => {
            this.lock({ input: false });
        });

        const {min, max} = settings.values ?? {};
        this.#input.on('change', () => {
            if (!this.valid) {
                [this.#prev, this.#next].forEach((jq) => jq.prop('disabled', true));
            } else {
                this.unlock();
                const newVal = this.val;

                this.#next.prop('disabled', newVal === max);
                this.#prev.prop('disabled', newVal === min);
            }
            this.#input.trigger({ type: 'picker.input', picker: this });
        });
    }
}

export default DatePicker;