var app = app || {};

;(function() {
  'use strict';

  function createTodoApp(ui) {
    var todos = {};
    var state = {todos: todos, counter: 0};

    CSP.goLoop(function*() {
      var event = yield CSP.take(ui.events);

      switch (event.action) {
        case 'newTodo':
          newTodo(event.title, state);
          break;

        case 'deleteTodo':
          deleteTodo(event.id);
          break;

        case 'toggleOne':
          toggleOne(event.id);
          break;

        case 'toggleAll':
          toggleAll(event.completed);
          break;

        case 'clearCompleted':
          clearCompleted();
          break;

        case 'updateTodo':
          updateTodo(event.id, event.title);
          break;

        case 'filter':
          filterTodos(event.filter);
          break;
      }

      updateFooter();
    });

    function newTodo(title, state) {
      var id = state.counter++;

      var todo = state.todos[id] = {
        id: id,
        title: title,
        completed: false
      };

      ui.createItems([todo], true);
    }

    function deleteTodo(id) {
      delete todos[id];
      ui.deleteItems([id]);
    }

    function toggleOne(id) {
      var todo = todos[id];
      todo.completed = !todo.completed;

      ui.setItemsStatus([todo], todo.completed);
    }

    function toggleAll(completed) {
      var selected = _.where(_.values(todos), {completed: !completed});

      _.each(selected, function(todo) {
        todos[todo.id].completed = completed;
      });

      ui.setItemsStatus(selected, completed);
    }

    function clearCompleted() {
      var completed = _.where(_.values(todos), {completed: true});

      _.each(completed, function(todo) {
        delete todos[todo.id];
      });

      ui.deleteItems(_.pluck(completed, 'id'));
    }

    function updateTodo(id, title) {
      todos[id].title = title;
    }

    function filterTodos(filter) {
      var selected = _.values(todos);

      if (filter === 'completed' || filter === 'active') {
        selected = _.where(selected, {
          completed: (filter === 'completed')
        });
      }

      ui.setFilter(selected, filter);
    }

    function updateFooter() {
      if (_.isEmpty(todos)) {
        ui.hideFooter();
      } else {
        var completed = _.where(_.values(todos), {completed: true});

        ui.updateFooterStats({
          remaining: _.size(todos) - _.size(completed),
          completed: _.size(completed)
        });
      }
    }

    return {
      setFilter: filterTodos
    };
  }

  function init() {
    var ui = app.ui.createTodoAppUI($('#todoapp'));
    var todoApp = createTodoApp(ui);

    var router = Router({
      '': function() {
        todoApp.setFilter(null);
      },

      '/:filter': function(filter) {
        todoApp.setFilter(filter);
      }
    });

    router.init();
  }

  init();
})();
