var app = app || {};

;(function() {
  'use strict';

  var TodoApp = {
    newTodo: function(title, state, todoListUI) {
      var id = state.counter++;

      var todo = state.todos[id] = {
        id: id,
        title: title,
        completed: false
      };

      todoListUI.createItems([todo], true);
    }
  };

  function createTodoApp(todoListUI, footerUI) {
    var uiEvents = CSP.chan();

    var todos = {};
    var state = {todos: todos, counter: 0};

    CSP.goLoop(function*() {
      var event = yield CSP.take(uiEvents);

      switch (event.action) {
        case 'newTodo':
          TodoApp.newTodo(event.title, state, todoListUI);
          break;

        case 'deleteTodo':
          delete todos[event.id];
          todoListUI.deleteItems([event.id]);
          break;

        case 'toggleOne':
          var todo = todos[event.id];
          todo.completed = !todo.completed;

          todoListUI.setItemsStatus([todo], todo.completed);
          break;

        case 'toggleAll':
          var selected = _.where(_.values(todos), {completed: !event.completed});

          _.each(selected, function(todo) {
            todos[todo.id].completed = event.completed;
          });

          todoListUI.setItemsStatus(selected, event.completed);
          break;

        case 'clearCompleted':
          var completed = _.where(_.values(todos), {completed: true});

          _.each(completed, function(todo) {
            delete todos[todo.id];
          });

          todoListUI.deleteItems(_.pluck(completed, 'id'));
          break;

        case 'updateTodo':
          todos[event.id].title = event.title;
          break;

        case 'filter':
          var selected = _.values(todos);

          if (event.filter === 'completed' || event.filter === 'active') {
            selected = _.where(selected, {
              completed: (event.filter === 'completed')
            });
          }

          todoListUI.setFilter(selected, event.filter);
          footerUI.setFilter(event.filter);
          break;
      }

      if (_.isEmpty(todos)) {
        footerUI.hide();
      } else {
        var completed = _.where(_.values(todos), {completed: true});

        footerUI.updateStats({
          remaining: _.size(todos) - _.size(completed),
          completed: _.size(completed)
        });
      }
    });

    return {
      uiEvents: uiEvents
    };
  }

  function init() {
    var els = {
      newTodos: $('#new-todo'),
      todoList: $('#todo-list'),
      footer: $('#footer'),
      toggleAll: $('#toggle-all')
    };

    var todoListUI = app.ui.createTodoListUI(els);
    var footerUI = app.ui.createFooterUI(els);
    var todoApp = createTodoApp(todoListUI, footerUI);

    CSP.pipe(todoListUI.events, todoApp.uiEvents);
    CSP.pipe(footerUI.events, todoApp.uiEvents);

    var router = Router({
      '': function() {
        CSP.putAsync(todoApp.uiEvents, {
          action: 'filter',
          filter: null
        });
      },

      '/:filter': function(filter) {
        CSP.putAsync(todoApp.uiEvents, {
          action: 'filter',
          filter: filter
        });
      }
    });

    router.init();
  }

  init();
})();
