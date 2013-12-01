var app = app || {};

;(function() {
  'use strict';

  function createTodoApp(filters, ui) {
    var globalEvents = {
      clearMult: CSP.mult(ui.events.clearCompleted),
      toggleAllMult: CSP.mult(ui.events.toggleAll),
      filterMult: CSP.mult(filters)
    };

    var filterStatusUpdates = CSP.chan();
    CSP.tap(globalEvents.filterMult, filterStatusUpdates);

    var currentFilter = {value: ''};
    var currentStats = {remaining: 0, completed: 0};
    var statsUpdates = CSP.chan();

    CSP.goLoop(function*() {
      var result = yield CSP.alts([ui.events.newTodo, filterStatusUpdates,
                                   statsUpdates]);
      var sc = result.chan;
      var val = result.value;

      if (ui.events.newTodo === sc) {
        currentStats.remaining++;

        var uiFn = _.bind(ui.createItem, ui);
        var item = createTodoItem(val, currentFilter, globalEvents, uiFn);
        CSP.pipe(item.stats, statsUpdates, false);

        ui.updateStats(currentStats);
      } else if (statsUpdates === sc) {
        applyStatsUpdate(result.value);
        ui.updateStats(currentStats);
      } else if (filterStatusUpdates === sc) {
        currentFilter.value = val;
        ui.setFilter(val);
      }
    });

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

  function createTodoItem(title, currentFilter, globalEvents, uiFn) {
    var todo = {
      title: title,
      completed: false,
    };

    var stats = CSP.chan();
    var ui = uiFn(todo);

    var clearTap = CSP.chan();
    CSP.tap(globalEvents.clearMult, clearTap);
    var clear = CSP.filterPull(clearTap, function() {
      return todo.completed;
    });

    var toggleAllTap = CSP.chan();
    CSP.tap(globalEvents.toggleAllMult, toggleAllTap);
    var toggleAll = CSP.filterPull(toggleAllTap, function(val) {
      return (val !== todo.completed);
    });

    var filterTap = CSP.chan();
    CSP.tap(globalEvents.filterMult, filterTap);
    var visible = CSP.unique(CSP.mapPull(filterTap, function(filter) {
      return _.isEmpty(filter) ||
             (filter === 'completed' && todo.completed) ||
             (filter === 'active' && !todo.completed);
    }));

    CSP.putAsync(filterTap, currentFilter.value);

    CSP.goLoop(function*() {
      var result = yield CSP.alts([ui.events.remove, ui.events.toggle,
                                   ui.events.edits, toggleAll, clear,
                                   visible]);
      var sc = result.chan;

      var isRemove = (ui.events.remove === sc || clear === sc);
      var isToggle = (ui.events.toggle === sc || toggleAll === sc);

      if (isRemove) {
        CSP.untap(globalEvents.clearMult, clearTap);
        CSP.untap(globalEvents.toggleAllMult, toggleAllTap);
        CSP.untap(globalEvents.filterMult, filterTap);

        yield CSP.put(stats, {action: 'removed', completed: todo.completed});
        CSP.close(stats);

        ui.remove();
        return true;
      } else if (isToggle) {
        todo.completed = !todo.completed;
        yield CSP.put(stats, {action: 'toggled', completed: todo.completed});
        ui.toggleChecked(todo.completed);
        yield CSP.put(filterTap, currentFilter.value);
      } else if (ui.events.edits === sc) {
        ui.startEditing();
        yield CSP.take(result.value);
        todo.title = ui.stopEditing();
      } else if (visible === sc) {
        ui.toggleVisible(result.value);
      }
    });

    return {stats: stats};
  }

  function init() {
    var filters = CSP.chan();
    var ui = app.ui.createTodoAppUI($('#todoapp'));
    createTodoApp(filters, ui);

    var router = Router({
      '': function() {
        CSP.putAsync(filters, '');
      },

      '/:filter': function(filter) {
        CSP.putAsync(filters, filter);
      }
    });

    router.init();
  }

  init();
})();
