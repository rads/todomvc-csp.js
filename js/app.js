var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function createTodoApp() {
    var todoList = CSP.chan();
    var footer = CSP.chan();
    var newTodos = CSP.chan();
    var deleteTodos = CSP.chan();

    var remaining = 0;
    var completed = 0;

    CSP.go(function*() {
      while (true) {
        var selected = yield CSP.alts([newTodos, deleteTodos]);

        if (newTodos === selected.chan) {
          remaining++;

          yield CSP.put(todoList, {
            action: 'createItem',
            item: selected.value
          });

          yield CSP.put(footer, {
            action: 'updateStats',
            remaining: remaining,
            completed: completed
          });
        } else if (deleteTodos === selected.chan) {
          remaining--;

          yield CSP.put(todoList, {
            action: 'deleteItem',
            el: selected.value
          });

          yield CSP.put(footer, {
            action: 'updateStats',
            remaining: remaining,
            completed: completed
          });
        }
      }
    });

    return {
      todoListControl: todoList,
      footerControl: footer,
      newTodos: newTodos,
      deleteTodos: deleteTodos
    };
  }

  function createTodoListUI(els) {
    var control = CSP.chan();
    var newTodos = listenForNewTodos(els.newTodos);
    var deleteTodos = listenForDeleteTodos(els.todoList);

    CSP.go(function*() {
      while (true) {
        var val = yield CSP.take(control);

        switch(val.action) {
          case 'createItem':
            var item = itemTemplate({
              completed: false,
              title: val.item
            });
            els.todoList.append(item);
            els.newTodos.val('');
            break;

          case 'deleteItem':
            $(val.el).remove();
            break;
        }
      }
    });

    return {
      control: control,
      newTodos: newTodos,
      deleteTodos: deleteTodos
    };
  }

  function listenForNewTodos(newTodosEl) {
    var events = app.helpers.domEvents(newTodosEl, 'keypress');

    events = CSP.filterPull(events, function(event) {
      return (event.keyCode === ENTER_KEY);
    });

    events = CSP.mapPull(events, function(event) {
      return $(event.currentTarget).val();
    });

    return events;
  }

  function listenForDeleteTodos(todoListEl) {
    var events = app.helpers.domEvents(todoListEl, 'click', '.destroy');

    events = CSP.mapPull(events, function(event) {
      return $(event.currentTarget).closest('li');
    });

    return events;
  }

  function createFooterUI(els) {
    var control = CSP.chan();

    CSP.go(function*() {
      while (true) {
        var val = yield CSP.take(control);

        switch(val.action) {
          case 'updateStats':
            var stats = _.pick(val, 'completed', 'remaining');
            els.footer.html('');
            els.footer.append(statsTemplate(stats));
        }
      }
    });

    return {control: control};
  }

  function showFiltered() {}

  function init() {
    var els = {
      newTodos: $('#new-todo'),
      todoList: $('#todo-list'),
      footer: $('#footer')
    };

    var todoApp = createTodoApp();
    var todoListUI = createTodoListUI(els);
    var footerUI = createFooterUI(els);

    CSP.pipe(todoListUI.newTodos, todoApp.newTodos);
    CSP.pipe(todoListUI.deleteTodos, todoApp.deleteTodos);

    CSP.pipe(todoApp.todoListControl, todoListUI.control);
    CSP.pipe(todoApp.footerControl, footerUI.control);

    Router({'/:filter': showFiltered}).init();
  }

  init();
})();
