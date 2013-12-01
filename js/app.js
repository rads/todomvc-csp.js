var app = app || {};

;(function() {
  'use strict';

  function isFiltered(item, filter) {
    return (filter === 'completed' && !item.completed) ||
           (filter === 'active' && item.completed);
  }

  function createTodoApp(events, ui) {
    var clearMult = CSP.mult(events.clearCompleted);
    var toggleAllMult = CSP.mult(events.toggleAll);
    var filterMult = CSP.mult(events.filter);
    var filterStatusUpdates = CSP.chan();
    CSP.tap(filterMult, filterStatusUpdates);

    var currentFilter;
    var total = 0;
    var completed = 0;

    CSP.goLoop(function*() {
      var result = yield CSP.alts([events.newTodo, filterStatusUpdates]);

      if (events.newTodo === result.chan) {
        newTodo(result.value);
      } else if (filterStatusUpdates === result.chan) {
        currentFilter = result.value;
        ui.setFilter(result.value);
      }

      updateStats();
    });

    function newTodo(title) {
      total++;

      var todo = {
        title: title,
        completed: false,
      };

      var clearTap = CSP.chan();
      CSP.tap(clearMult, clearTap);
      var clear = CSP.filterPull(clearTap, function() {
        return todo.completed;
      });

      var toggleAllTap = CSP.chan();
      CSP.tap(toggleAllMult, toggleAllTap);
      var toggleAll = CSP.filterPull(toggleAllTap, function(val) {
        return (val !== todo.completed);
      });

      var filterTap = CSP.chan();
      CSP.tap(filterMult, filterTap);
      var filter = CSP.unique(CSP.mapPull(filterTap, function(val) {
        return !isFiltered(todo, val);
      }));

      var uiItem = ui.createItem(todo);
      var uiItemPush = uiItem.events.push;
      var uiItemPull = uiItem.events.pull;

      CSP.putAsync(filterTap, currentFilter);

      CSP.goLoop(function*() {
        var result = yield CSP.alts([
          uiItemPush.remove, uiItemPush.toggle, uiItemPush.update,
          toggleAll, clear, filter
        ]);
        var sc = result.chan;

        var isRemove = (uiItemPush.remove === sc || clear === sc);
        var isToggle = (uiItemPush.toggle === sc || toggleAll === sc);

        if (isRemove) {
          CSP.untap(clearMult, clearTap);
          CSP.untap(toggleAllMult, toggleAllTap);
          CSP.untap(filterMult, filterTap);

          uiItem.remove();
          total--;
          if (todo.completed) completed--;
        } else if (isToggle) {
          todo.completed = !todo.completed;
          todo.completed ? completed++ : completed--;
          uiItem.toggleChecked(todo.completed);
          yield CSP.put(filterTap, currentFilter);
        } else if (uiItemPush.update === sc) {
          todo.title = result.value;
        } else if (filter === sc) {
          uiItem.toggleVisible(result.value);
        }

        updateStats();

        if (isRemove) return true;
      });
    }

    function updateStats() {
      ui.updateStats({
        remaining: (total - completed),
        completed: completed
      });
    }

    return {itemControl: createTodoItem};
  }

  function createTodoItem(events, ui) {
    var pull = events.pull;
    var push = events.push;

    CSP.goLoop(function*() {
      var result = yield CSP.alts([pull.edits]);
      var sc = result.chan;

      if (pull.edits === sc) {
        ui.startEditing();
        yield CSP.take(result.value);
        yield CSP.put(push.update, ui.stopEditing());
      }
    });
  }

  function init() {
    var filters = CSP.chan();
    var ui = app.ui.createTodoAppUI({
      el: $('#todoapp'),
      controlFn: createTodoApp,
      filters: filters
    });

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
