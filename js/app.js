var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function listenForNewTodos(els, todoApp) {
    var events = app.helpers.domEvents(els.newTodos, 'keypress');

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

  function createTodoApp(newTodos) {
    var todoList = CSP.chan();
    var footer = CSP.chan();

    var remaining = 0;
    var completed = 0;

    CSP.go(function*() {
      while (true) {
        var todo = yield CSP.take(newTodos);
        remaining++;

        yield CSP.put(todoList, {action: 'createItem', item: todo});
        yield CSP.put(footer, {
          action: 'updateStats',
          remaining: remaining,
          completed: completed
        });
      }
    });

    return {
      todoListControl: todoList,
      footerControl: footer
    };
  }

  function createTodoListUI(els, control) {
    var pub = CSP.pub(control, function(val) { return val.action; });
    var items = CSP.mapPush(CSP.chan(), function(val) { return val.item; });
    CSP.sub(pub, 'createItem', items);

    CSP.go(function*() {
      while (true) {
        var item = yield CSP.take(items);
        els.todoList.append(itemTemplate(item));
        els.newTodos.val('');
      }
    });
  }

  function createFooterUI(els, control) {
    var pub = CSP.pub(control, function(val) { return val.action; });
    var updates = CSP.mapPush(CSP.chan(), function(val) {
      return _.pick(val, 'completed', 'remaining');
    });
    CSP.sub(pub, 'updateStats', updates);

    CSP.go(function*() {
      while (true) {
        var stats = yield CSP.take(updates);
        els.footer.html('');
        els.footer.append(statsTemplate(stats));
      }
    });
  }

  function showFiltered() {}

  function init() {
    var els = {
      newTodos: $('#new-todo'),
      todoList: $('#todo-list'),
      footer: $('#footer')
    };

    var newTodos = listenForNewTodos(els);
    var todoApp = createTodoApp(newTodos);

    createTodoListUI(els, todoApp.todoListControl);
    createFooterUI(els, todoApp.footerControl);

    Router({'/:filter': showFiltered}).init();
  }

  init();
})();
