import $ from 'jquery';

class TagPicker {
    /**
     * @typedef {[tag: string, label: string][]} TagList 
     * @typedef {JQuery | string} Anchor
     * @typedef {{callback?: (tag: string) => void, title?: string, name?: string, initial?: int}} Settings
     */

    /** @type ((tag: string) => void)[] */
    #listeners = [];

    /**
     * @param {TagList} tagList 
     * @param {Anchor} element
     * @param {Settings} [settings={}]
     */
    constructor(tagList, element, settings = {}) {
        if (new Set(tagList.map(([tag]) => tag)).size < tagList.length) {
            throw new SyntaxError('All tags must be unique');
        }
        const jq = this.#prepareRoot(element);
        this.#buildDropdown(jq, tagList, settings);
        this.#attachListeners(jq, settings);
        jq.prop('hidden', false);
    }

    /**
     * @param {Anchor} anchor
     */
    #prepareRoot(anchor) {
        if (typeof anchor !== 'string' && !(anchor instanceof $)) {
            throw new TypeError('Element must be a selector or a JQuery');
        }
        /** @type JQuery */
        const jq = $(anchor);
        if (!jq.is('details')) {
            throw new TypeError('Root element must be <details>');
        }
        jq.prop('hidden', true).off('change').addClass('dropdown tag-picker').empty().data('picker', this);
        return jq;
    }

    /**
     * @param {JQuery} jq 
     * @param {TagList} tagList 
     * @param {Settings} settings 
     */
    #buildDropdown(jq, tagList, settings) {
        const select = this.#buildSelect(tagList, settings);
        const list = this.#buildList(tagList, settings);
        const [tag] = tagList[settings.initial ?? 0];
        const {title} = settings;
        const display = $(`<summary class="tag-cell" ${title ? `title="${title}"` : ''}><kbd>${tag}</kbd></summary>`);
        display.append(select);
        jq.append(display, list);
    }

    /**
     * @param {TagList} tagList 
     * @param {Settings} settings 
     */
    #buildSelect(tagList, settings) {
        const index = settings.initial ?? 0;
        const options = tagList.map(([tag, label]) => `<option value="${tag}">${label}</option>`);
        const select = $(`<select readonly>${options.join('')}</select>`);
        select.val(tagList[index][0]);
        return select;
    }

    /**
     * @param {TagList} tagList 
     * @param {Settings} settings 
     */
    #buildList(tagList, settings) {
        const index = settings.initial ?? 0;
        const name = settings.name || window.crypto.randomUUID();
        const listItems = tagList.map(([tag, label], idx) => {
            let title = '';
            let checked = '';
            if (idx === index) {
                if (Number.isInteger(settings.initial)) {
                    title = 'title="Valeur initiale"';
                    checked = 'checked data-initial';
                } else {
                    checked = 'checked';
                }
            }
            return `\
                <li ${title}>\
                    <label class="tag-cell">\
                        <input type="radio" name="${name}" value="${tag}" ${checked} hidden />\
                        <kbd>${tag}</kbd>\
                        ${label}\
                    </label>\
                </li>`;
        });
        const list = $(`<ul>${listItems.join('')}</ul>`);
        list.find(`input`).eq(index).prop('checked', true).closest('li').attr('hidden', '');
        return list;
    }

    #attachListeners(jq, settings) {
        if (settings.callback) {
            this.#listeners.push(settings.callback);
        }
        jq.on('change', (e) => {
            e.stopImmediatePropagation();
            jq.prop('open', false);
            jq.removeAttr('open');
            jq.find('li[hidden]').removeAttr('hidden');
            jq.find('li:has(:checked)').attr('hidden', '');
            const tag = jq.find('input:checked').val();
            jq.find('select').val(tag);
            jq.find('summary kbd').empty().text(tag);

            this.#listeners.forEach((cb) => cb(tag));
            jq.trigger('picker.change');
        });
    }
}

export default TagPicker;
