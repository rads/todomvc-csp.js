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

  function uuid(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x7|0x8)).toString(16);
    });
    return uuid;
  };

  app.helpers = {
    domEvents: domEvents,
    uuid: uuid
  };
})();
