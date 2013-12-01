var app = app || {};

;(function() {
  'use strict';

  function TodoStorage() {
    this.IDS_KEY = 'ids';

    var storedItems = localStorage.getItem(this.IDS_KEY);
    if (storedItems) {
      this._ids = JSON.parse(storedItems);
    } else {
      this._ids = [];
      localStorage.setItem(this.IDS_KEY, '[]');
    }
  }

  _.extend(TodoStorage.prototype, {
    getItems: function() {
      return _.map(this._ids, function(id) {
        return _.extend(JSON.parse(localStorage.getItem(id)), {id: id});
      });
    },

    remove: function(id) {
      localStorage.removeItem(id);
      this._ids = _.without(this._ids, id);
      localStorage.setItem(this.IDS_KEY, JSON.stringify(this._ids));
    },

    update: function(id, attrs) {
      localStorage.setItem(id, JSON.stringify(attrs));
    },

    add: function(id, attrs) {
      this._ids.push(id);
      localStorage.setItem(this.IDS_KEY, JSON.stringify(this._ids))
      localStorage.setItem(id, JSON.stringify(attrs));
    }
  });

  app.storage = new TodoStorage;
})();
