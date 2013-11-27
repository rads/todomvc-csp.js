var app = app || {};

;(function() {
  'use strict';

  function createTodoApp(todoListUI, footerUI) {
    var uiEvents = CSP.chan();

    var todos = {};
    var state = {todos: todos, counter: 0};

    CSP.goLoop(function*() {
      var event = yield CSP.take(uiEvents);

      switch (event.action) {
        case 'newTodo':
          newTodo(event.title, state, todoListUI);
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

    function newTodo(title, state, todoListUI) {
      var id = state.counter++;

      var todo = state.todos[id] = {
        id: id,
        title: title,
        completed: false
      };

      todoListUI.createItems([todo], true);
    }

    function deleteTodo(id) {
      delete todos[id];
      todoListUI.deleteItems([id]);
    }

    function toggleOne(id) {
      var todo = todos[id];
      todo.completed = !todo.completed;

      todoListUI.setItemsStatus([todo], todo.completed);
    }

    function toggleAll(completed) {
      var selected = _.where(_.values(todos), {completed: !completed});

      _.each(selected, function(todo) {
        todos[todo.id].completed = completed;
      });

      todoListUI.setItemsStatus(selected, completed);
    }

    function clearCompleted() {
      var completed = _.where(_.values(todos), {completed: true});

      _.each(completed, function(todo) {
        delete todos[todo.id];
      });

      todoListUI.deleteItems(_.pluck(completed, 'id'));
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

      todoListUI.setFilter(selected, filter);
      footerUI.setFilter(filter);
    }

    function updateFooter() {
      if (_.isEmpty(todos)) {
        footerUI.hide();
      } else {
        var completed = _.where(_.values(todos), {completed: true});

        footerUI.updateStats({
          remaining: _.size(todos) - _.size(completed),
          completed: _.size(completed)
        });
      }
    }

    return {
      uiEvents: uiEvents
    };
  }

  function init() {
    var todoListUI = app.ui.createTodoListUI($('#todoapp'));
    var footerUI = app.ui.createFooterUI($('#footer'));
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
