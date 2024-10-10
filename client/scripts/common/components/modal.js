import $ from 'jquery';

class Modal {
    static instances = {};
    static visible = [];
    static escListener;

    static register(id, modal) {
        if (!Modal.escListener) {
            Modal.escListener = ({key}) => {
                if (key === 'Escape' && Modal.visible.length)
                    Modal.visible.slice(-1)[0].close();
            };
            $(document).on('keydown', Modal.escListener)
        }
        Modal.instances[id] = modal
    }

    /**
     * @param {string} id 
     * @returns {Modal}
     */
    static get(id) {
        return Modal.instances[id]
    }

    /**
     * @param {String} id
     */
    constructor(
        id,
        {onOpen = () => {}, onClose = () => {}, transitionTime = 200} =
        {onOpen: () => {}, onClose: () => {}, transitionTime: 200},
    ) {
        this.getElement = () => $(id).get(0);
        this.onOpen = onOpen;
        this.onClose = onClose;
        this.transitionTime = transitionTime;
        $(`${id} button[aria-label="close"]`).on('click', () => { this.close() });
        Modal.register(id, this);
    }

    open = async (cb = this.onOpen) => {
        const html = $(document.documentElement);
        html.addClass('modal-is-open modal-is-opening');
        const promise = new Promise((resolve) => {
            setTimeout(() => {
                html.removeClass('modal-is-opening');
                resolve();
            }, this.transitionTime);
        });
        cb.call(this);
        Modal.visible.push(this);
        this.getElement().showModal();
        return promise;
    }

    close = async (cb = this.onClose) => {
        const html = $(document.documentElement);
        html.addClass('modal-is-closing');
        return new Promise((resolve) => {
            setTimeout(() => {
                html.removeClass('modal-is-closing');
                this.getElement().close();
                Modal.visible.pop();
                if (Modal.visible.length === 0) {
                    $(document.documentElement).removeClass('modal-is-open modal-is-opening modal-is-closing');
                }
                cb.call(this);
                resolve();
            }, this.transitionTime);
        });
    }
}

export default Modal;
