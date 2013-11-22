var app = app || {};

;(function() {
  'use strict';

  function domEvents(el, eventType, selector) {
    var out = CSP.chan();

    function putEvent(event) {
      CSP.putAsync(out, event);
    }

    if (selector) {
      $(el).on(eventType, selector, putEvent);
    } else {
      $(el).on(eventType, putEvent);
    }

    return out;
  }

  app.helpers = {
    domEvents: domEvents
  };
})();
