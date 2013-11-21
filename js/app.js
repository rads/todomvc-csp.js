var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function listenForNewTodos(todoApp) {
    var events = app.helpers.domEvents(todoApp.$newTodos, 'keypress');

    events = CSP.filterPull(events, function(event) {
      return (event.keyCode === ENTER_KEY);
    });

    events = CSP.mapPull(events, function(event) {
      return {
        title: $(event.currentTarget).val(),
        completed: false
      };
    });

    return events;
  }

  function processNewTodos(todoApp, newTodos) {
    CSP.go(function*() {
      while (true) {
        var todo = yield CSP.take(newTodos);
        var item = itemTemplate(todo);
        todoApp.$todoList.append(item);
        todoApp.$newTodos.val('');
      }
    });
  }

  function showFiltered() {}

  function init() {
    var todoApp = {
      $newTodos: $('#new-todo'),
      $todoList: $('#todo-list')
    };

    var newTodos = listenForNewTodos(todoApp);
    processNewTodos(todoApp, newTodos);

    Router({'/:filter': showFiltered}).init();
  }

  init();
})();
