var app = app || {};

;(function() {
  'use strict';

  function createTodoApp(events, ui) {
    var e = events;
    var todos = {};
    var state = {todos: todos, counter: 0};

    CSP.goLoop(function*() {
      var result = yield CSP.alts([e.newTodo, e.toggleAll, e.clearCompleted,
                                   e.filter]);
      var sc = result.chan;
      var val = result.value;

      if (e.newTodo === sc) {
        newTodo(val, state);
      } else if (e.toggleAll === sc) {
        toggleAll(val);
      } else if (e.clearCompleted === sc) {
        clearCompleted();
      } else if (e.filter === sc) {
        filterTodos(val);
      }

      updateFooter();
    });

    function newTodo(title, state) {
      var id = state.counter++;
      var remove = CSP.chan();
      var toggle = CSP.chan();
      var update = CSP.chan();

      var todo = state.todos[id] = {
        id: id,
        title: title,
        completed: false,
        remove: remove,
        toggle: toggle,
        update: update
      };

      CSP.goLoop(function*() {
        var result = yield CSP.alts([remove, toggle, update]);
        var todo;

        if (remove === result.chan) {
          delete todos[id];
          ui.deleteItems([id]);
        } else if (toggle === result.chan) {
          todo = todos[id];
          todo.completed = !todo.completed;
          ui.setItemsStatus([todo], todo.completed);
        } else if (update === result.chan) {
          todos[id].title = result.value;
        }

        updateFooter();
        if (remove === result.chan) return;
      });

      ui.createItems([todo], true);
    }

    function findTodos(params) {
      var vals = _.values(todos);
      if (!_.isEmpty(params)) vals = _.where(vals, params);
      return vals;
    }

    function toggleAll(completed) {
      var selected = findTodos({completed: !completed});

      _.each(selected, function(todo) {
        todos[todo.id].completed = completed;
      });

      ui.setItemsStatus(selected, completed);
    }

    function clearCompleted() {
      var completed = findTodos({completed: true});

      _.each(completed, function(todo) {
        delete todos[todo.id];
      });

      ui.deleteItems(_.pluck(completed, 'id'));
    }

    function filterTodos(filter) {
      var params;
      if (_.contains(['completed', 'active'], filter)) {
        params = {completed: (filter === 'completed')};
      } else {
        params = {};
      }

      ui.setFilter(findTodos(params), filter);
    }

    function updateFooter() {
      if (_.isEmpty(todos)) {
        ui.hideFooter();
      } else {
        var completed = findTodos({completed: true});

        ui.updateFooterStats({
          remaining: _.size(todos) - _.size(completed),
          completed: _.size(completed)
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
