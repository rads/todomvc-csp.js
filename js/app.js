var app = app || {};

;(function() {
  'use strict';

  function isFiltered(filter, item) {
    return (filter === 'completed' && !item.completed) ||
           (filter === 'active' && item.completed);
  }

  function createTodoApp(events, ui) {
    var e = events;
    var todos = {};
    var state = {todos: todos, counter: 0};
    var clearMult = CSP.mult(events.clearCompleted);
    var toggleAllMult = CSP.mult(events.toggleAll);
    var filterMult = CSP.mult(events.filter);

    var currentFilter;
    var total = 0;
    var completed = 0;

    var filterStatusUpdates = CSP.chan();
    CSP.tap(filterMult, filterStatusUpdates);

    CSP.goLoop(function*() {
      var result = yield CSP.alts([events.newTodo, filterStatusUpdates]);

      if (events.newTodo === result.chan) {
        newTodo(result.value);
      } else if (filterStatusUpdates === result.chan) {
        currentFilter = result.value;
        ui.setFilter(result.value);
      }

      updateFooter();
    });

    function newTodo(title) {
      var id = state.counter++;
      total++;
      var todo = todos[id] = {
        id: id,
        title: title,
        completed: false,
        remove: CSP.chan(),
        toggle: CSP.chan(),
        update: CSP.chan(),
        visible: CSP.chan(),
        checked: CSP.chan()
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
        return isFiltered(val, todo);
      }));
      CSP.pipe(filter, todo.visible);

      CSP.goLoop(function*() {
        var result = yield CSP.alts([
          todo.remove, todo.toggle, toggleAll, todo.update, clear
        ]);
        var sc = result.chan;

        var isRemove = (todo.remove === sc || clear === sc);
        var isToggle = (todo.toggle === sc || toggleAll === sc);

        if (isRemove) {
          CSP.untap(clearMult, clearTap);
          CSP.untap(toggleAllMult, toggleAllTap);
          CSP.untap(filterMult, filterTap);

          delete todos[id];
          ui.deleteItem(id);
          total--;
          if (todo.completed) completed--;
        } else if (isToggle) {
          todo.completed = !todo.completed;
          todo.completed ? completed++ : completed--;
          yield CSP.put(todo.checked, todo.completed);
          yield CSP.put(filterTap, currentFilter);
        } else if (events.update === sc) {
          todo.title = result.value;
        }

        updateFooter();

        if (isRemove) return true;
      });

      CSP.putAsync(filterTap, currentFilter);
      ui.createItem(todo);
    }

    function updateFooter() {
      if (_.isEmpty(todos)) {
        ui.hideFooter();
      } else {
        ui.updateFooterStats({
          remaining: (total - completed),
          completed: completed
        });
      }
    }
  }

  function init() {
    var ui = app.ui.createTodoAppUI($('#todoapp'), createTodoApp);

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
