var app = app || {};

;(function() {
  'use strict';

  function init() {
    var ui = app.ui.createTodoAppUI($('#todoapp'));

    var router = Router({
      '': function() {
        CSP.putAsync(ui.filter, '');
      },

      '/:filter': function(filter) {
        CSP.putAsync(ui.filter, filter);
      }
    });

    router.init();
  }

  init();
})();
