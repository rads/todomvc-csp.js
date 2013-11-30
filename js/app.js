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
      var filter = CSP.mapPull(filterTap, _.partial(isFiltered, todo));
      filter = CSP.unique(filter);
      CSP.pipe(filter, todo.visible);

      CSP.putAsync(filterTap, currentFilter);
      var removeUI = ui.createItem(todo);

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

          CSP.close(removeUI);
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
