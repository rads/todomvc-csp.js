var app = app || {};

;(function() {
  'use strict';

  function createTodoApp(filters, ui) {
    var globalEvents = {
      clearMult: CSP.mult(ui.out.clearCompleted),
      toggleAllMult: CSP.mult(ui.out.toggleAll),
      filterMult: CSP.mult(filters)
    };

    var filterStatusUpdates = CSP.chan();
    CSP.tap(globalEvents.filterMult, filterStatusUpdates);

    var currentFilter = {value: ''};
    var currentStats = {remaining: 0, completed: 0};
    var statsUpdates = CSP.chan();

    _.each(app.storage.getItems(), function(item) {
      newTodo(item, true);
    });

    CSP.goLoop(function*() {
      var result = yield CSP.alts([ui.out.newTodo, filterStatusUpdates,
                                   statsUpdates]);
      var sc = result.chan;
      var val = result.value;

      if (ui.out.newTodo === sc) {
        var attrs = {
          id: app.helpers.uuid(),
          title: val,
          completed: false
        };
        newTodo(attrs, false);
      } else if (statsUpdates === sc) {
        applyStatsUpdate(result.value);
        ui.updateStats(currentStats);
      } else if (filterStatusUpdates === sc) {
        currentFilter.value = val;
        ui.setFilter(val);
      }
    });

    function newTodo(attrs, alreadyStored) {
      attrs.completed ? currentStats.completed++ : currentStats.remaining++;

      var itemUI = ui.createItem(attrs);
      var item = createTodoItem(attrs, currentFilter, globalEvents, itemUI);
      CSP.pipe(item.out.stats, statsUpdates, false);

      CSP.goLoop(function*() {
        var result = yield CSP.alts([item.out.remove, item.out.update]);
        var sc = result.chan;

        if (item.out.remove === sc) {
          app.storage.remove(attrs.id);
          return true;
        } else if (item.out.update === sc) {
          app.storage.update(attrs.id, result.value);
        }
      });

      if (!alreadyStored) app.storage.add(attrs.id, attrs);
      ui.updateStats(currentStats);
    }

    function applyStatsUpdate(val) {
      if (val.action === 'toggled') {
        if (val.completed) {
          currentStats.completed++;
          currentStats.remaining--;
        } else {
          currentStats.completed--;
          currentStats.remaining++;
        }
      } else if (val.action === 'removed') {
        val.completed ? currentStats.completed-- : currentStats.remaining--;
      }
    }
  }

  function createTodoItem(attrs, currentFilter, globalEvents, ui) {
    ui.toggleChecked(attrs.completed);

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
      return _.isEmpty(filter) ||
             (filter === 'completed' && attrs.completed) ||
             (filter === 'active' && !attrs.completed);
    }));

    CSP.putAsync(filterTap, currentFilter.value);

    var out = {
      remove: CSP.chan(),
      update: CSP.chan(),
      stats: CSP.chan()
    };

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

        yield CSP.put(out.stats, {
          action: 'removed',
          completed: attrs.completed
        });
        CSP.close(out.stats);
        CSP.close(out.remove);
        CSP.close(out.update);

        ui.remove();
        return true;
      } else if (isToggle) {
        attrs.completed = !attrs.completed;
        yield CSP.put(out.update, attrs);
        yield CSP.put(out.stats, {
          action: 'toggled',
          completed: attrs.completed
        });

        ui.toggleChecked(attrs.completed);
        yield CSP.put(filterTap, currentFilter.value);
      } else if (ui.out.edits === sc) {
        ui.startEditing();
        yield CSP.take(result.value);
        attrs.title = ui.stopEditing();
        yield CSP.put(out.update, attrs);
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

    CSP.putAsync(filters, '');
    router.init();
  }

  init();
})();
