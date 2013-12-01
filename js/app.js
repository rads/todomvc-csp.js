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

    var counter = 0;
    var currentFilter = {value: ''};
    var currentStats = {remaining: 0, completed: 0};
    var statsUpdates = CSP.chan();

    CSP.putAsync(filters, currentFilter.value);

    var items;
    var storedItems = localStorage.getItem('items');
    if (storedItems) {
      items = JSON.parse(storedItems);
    } else {
      items = [];
      localStorage.setItem('items', '[]');
    }

    _.each(items, function(id) {
      var item = JSON.parse(localStorage.getItem(id));
      newTodo(id, item.title, item.completed, true);
    });

    CSP.goLoop(function*() {
      var result = yield CSP.alts([ui.events.newTodo, filterStatusUpdates,
                                   statsUpdates]);
      var sc = result.chan;
      var val = result.value;

      if (ui.events.newTodo === sc) {
        newTodo(app.helpers.uuid(), val, false, false);
      } else if (statsUpdates === sc) {
        applyStatsUpdate(result.value);
        ui.updateStats(currentStats);
      } else if (filterStatusUpdates === sc) {
        currentFilter.value = val;
        ui.setFilter(val);
      }
    });

    function newTodo(id, title, completed, alreadyStored) {
      completed ? currentStats.completed++ : currentStats.remaining++;

      var uiFn = _.bind(ui.createItem, ui);
      var item = createTodoItem(id, title, completed, currentFilter,
                                globalEvents, uiFn);
      CSP.pipe(item.stats, statsUpdates, false);

      CSP.goLoop(function*() {
        var result = yield CSP.alts([item.remove, item.update]);
        var sc = result.chan;

        if (item.remove === sc) {
          localStorage.removeItem(id);
          items = _.without(items, id);
          localStorage.setItem('items', JSON.stringify(items));
          return true;
        } else if (item.update === sc) {
          localStorage.setItem(id, JSON.stringify(result.value));
        }
      });

      if (!alreadyStored) {
        items.push(id);
        localStorage.setItem('items', JSON.stringify(items))
        localStorage.setItem(id, JSON.stringify(item.todo));
      }

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

  function createTodoItem(id, title, completed, currentFilter, globalEvents, uiFn) {
    var todo = {
      title: title,
      completed: completed
    };

    var stats = CSP.chan();
    var ui = uiFn(todo);
    ui.toggleChecked(todo.completed);

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

    var remove = CSP.chan();
    var update = CSP.chan();

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
        CSP.close(remove);
        CSP.close(update);

        ui.remove();
        return true;
      } else if (isToggle) {
        todo.completed = !todo.completed;
        yield CSP.put(update, todo);
        yield CSP.put(stats, {action: 'toggled', completed: todo.completed});

        ui.toggleChecked(todo.completed);
        yield CSP.put(filterTap, currentFilter.value);
      } else if (ui.events.edits === sc) {
        ui.startEditing();
        yield CSP.take(result.value);
        todo.title = ui.stopEditing();
        yield CSP.put(update, todo);
      } else if (visible === sc) {
        ui.toggleVisible(result.value);
      }
    });

    return {
      stats: stats,
      remove: remove,
      update: update,
      todo: todo
    };
  }

  function init() {
    var filters = CSP.chan();
    var ui = app.ui.createTodoAppUI($('#todoapp'));
    createTodoApp(filters, ui);

    var router = Router({
      '': function() { CSP.putAsync(filters, ''); },
      '/:filter': function(filter) { CSP.putAsync(filters, filter); }
    });

    router.init();
  }

  init();
})();
