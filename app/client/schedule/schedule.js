$(() => {
    if (!window.location.hash) {
        window.history.replaceState(null, '', '/schedule/#staff');
    }

    setHeaderText(window.location.hash);
    setNavSelected(window.location.hash);

    $(window).on('hashchange', () => {
        setHeaderText(window.location.hash);
        setNavSelected(window.location.hash);
    });

    // Close dropdown when clicked
    $('nav details li').on('click', function() {
        $(this).closest('details').removeAttr('open');
    });
});

const setHeaderText = (hash) => {
    $('nav h1').text(`Horaires ${hash === '#staff' ? 'Employé' : hash === '#sector' ? 'Secteur' : ''}`)
}

const setNavSelected = (hash) => {
    $(`#nav-schedule-${hash.slice(1)}`).attr('aria-current', 'page')
        .parent().siblings().children('a').removeAttr('aria-current');
}
