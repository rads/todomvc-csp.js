var app = app || {};

;(function() {
  'use strict';

  function createTodoApp(filters, ui) {
    return new TodoApp(filters, ui);
  }

  function TodoApp(filters, ui) {
    var self = this;
    this._ui = ui;
    this._filter = {value: null};
    this._stats = new Stats;
    this._globalEvents = {
      clearMult: CSP.mult(ui.out.clearCompleted),
      toggleAllMult: CSP.mult(ui.out.toggleAll),
      filterMult: CSP.mult(filters)
    };

    var newFilter = CSP.chan();
    CSP.tap(this._globalEvents.filterMult, newFilter);

    this._uiUpdates = CSP.chan(CSP.droppingBuffer(0));
    CSP.pipe(this._stats.changes, this._uiUpdates);

    CSP.goLoop(function*() {
      yield CSP.take(self._uiUpdates);
      self._ui.update(self._stats, self._filter.value);
    });

    CSP.goLoop(function*() {
      var result = yield CSP.alts([ui.out.newTodo, newFilter]);
      var sc = result.chan;
      var val = result.value;

      if (ui.out.newTodo === sc) {
        var attrs = {
          id: app.helpers.uuid(),
          title: val,
          completed: false
        };
        self._addOne(attrs, false);
      } else if (newFilter === sc) {
        var old = self._filter.value;
        self._filter.value = val;

        if (old === null) self._addStored();
        yield CSP.put(self._uiUpdates, true);
      }
    });
  }

  _.extend(TodoApp.prototype, {
    _addStored: function() {
      var self = this;
      _.each(app.storage.getItems(), function(attrs) {
        self._addOne(attrs, true);
      });
    },

    _addOne: function(attrs, alreadyStored) {
      var self = this;
      var item = createTodoItemProcess({
        attrs: attrs,
        ui: this._ui.createItem(attrs),
        filter: this._filter,
        globalEvents: this._globalEvents,
      });

      if (!alreadyStored) app.storage.add(attrs.id, attrs);
      this._stats.add(attrs.completed);

      CSP.goLoop(function*() {
        var result = yield CSP.alts([item.out.remove, item.out.edit,
                                     item.out.toggle]);
        var sc = result.chan;

        if (result.value === null) return true;

        if (item.out.remove === sc) {
          app.storage.remove(attrs.id);
          self._stats.remove(attrs.completed);
        } else if (item.out.toggle === sc) {
          app.storage.update(attrs.id, result.value);
          self._stats.toggle(attrs.completed);
        } else if (item.out.edit === sc) {
          app.storage.update(attrs.id, result.value);
        }
      });

    }
  });

  function isVisible(attrs, filter) {
    return _.isEmpty(filter) ||
      (filter === 'completed' && attrs.completed) ||
      (filter === 'active' && !attrs.completed);
  }

  function Stats() {
    this.completed = 0;
    this.remaining = 0;
    this.changes = CSP.chan();
  }

  _.extend(Stats.prototype, {
    toggle: function(completed) {
      if (completed) {
        this.completed++;
        this.remaining--;
      } else {
        this.completed--;
        this.remaining++;
      }
      CSP.putAsync(this.changes, true);
    },

    remove: function(completed) {
      completed ? this.completed-- : this.remaining--;
      CSP.putAsync(this.changes, true);
    },

    add: function(completed) {
      completed ? this.completed++ : this.remaining++;
      CSP.putAsync(this.changes, true);
    }
  });

  function createTodoItemProcess(options) {
    var attrs = options.attrs;
    var filter = options.filter;
    var globalEvents = options.globalEvents;
    var ui = options.ui;
    var out = {
      remove: CSP.chan(),
      edit: CSP.chan(),
      toggle: CSP.chan()
    };

    var clearTap = CSP.chan();
    CSP.tap(globalEvents.clearMult, clearTap);
    var clear = CSP.filterPull(clearTap, function() {
      return attrs.completed;
    });

    var toggleAllTap = CSP.chan();
    CSP.tap(globalEvents.toggleAllMult, toggleAllTap);
    var toggleAll = CSP.filterPull(toggleAllTap, function(val) {
      return (val !== attrs.completed);
    });

    var filterTap = CSP.chan();
    CSP.tap(globalEvents.filterMult, filterTap);
    var visible = CSP.unique(CSP.mapPull(filterTap, function(filter) {
      return isVisible(attrs, filter);
    }));

    ui.toggleChecked(attrs.completed);
    ui.toggleVisible(isVisible(attrs, filter.value));
    ui.append();

    CSP.goLoop(function*() {
      var result = yield CSP.alts([ui.out.remove, ui.out.toggle,
                                   ui.out.edits, toggleAll, clear,
                                   visible]);
      var sc = result.chan;

      var isRemove = (ui.out.remove === sc || clear === sc);
      var isToggle = (ui.out.toggle === sc || toggleAll === sc);

      if (isRemove) {
        CSP.untap(globalEvents.clearMult, clearTap);
        CSP.untap(globalEvents.toggleAllMult, toggleAllTap);
        CSP.untap(globalEvents.filterMult, filterTap);

        yield CSP.put(out.remove, true);
        CSP.close(out.remove);
        CSP.close(out.toggle);
        CSP.close(out.edit);

        ui.remove();
        return true;
      } else if (isToggle) {
        attrs.completed = !attrs.completed;
        ui.toggleChecked(attrs.completed);
        ui.toggleVisible(isVisible(attrs, filter.value));

        yield CSP.put(out.toggle, attrs);
      } else if (ui.out.edits === sc) {
        attrs.title = yield CSP.take(result.value);
        yield CSP.put(out.edit, attrs);
      } else if (visible === sc) {
        ui.toggleVisible(result.value);
      }
    });

    return {out: out};
  }

  function init() {
    var filters = CSP.chan();
    var ui = app.ui.createTodoAppUI($('#todoapp'));
    createTodoApp(filters, ui);

    var router = Router({
      '': function() { CSP.putAsync(filters, ''); },
      '/:filter': function(filter) { CSP.putAsync(filters, filter); }
    });

    if (!location.hash) CSP.putAsync(filters, '');

    router.init();
  }

  init();
})();
