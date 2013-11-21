var app = app || {};

;(function() {
  'use strict';

  function domEvents(el /* , [ selector,] eventType */) {
    var selector, eventType;
    var out = CSP.chan();

    function putEvent(event) {
      CSP.putAsync(out, event);
    }

    if (arguments.length === 2) {
      eventType = arguments[1];
      $(el).on(eventType, putEvent);
    } else {
      selector = arguments[1];
      eventType = arguments[2];
      $(el).on(selector, eventType, putEvent);
    }

    return out;
  }

  app.helpers = {
    domEvents: domEvents
  };
})();
