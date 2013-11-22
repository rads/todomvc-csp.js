var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function createTodoApp() {
    var todoListUI = CSP.chan();
    var footerUI = CSP.chan();
    var uiEvents = CSP.chan();

    CSP.go(function*() {
      var todos = {};
      var counter = 0;
      var event, id, todo, selected, completed, i, len, ids;

      while (true) {
        event = yield CSP.take(uiEvents);

        switch (event.action) {
          case 'newTodo':
            id = counter++;
            todo = todos[id] = {
              id: id,
              title: event.title,
              completed: false
            };
            yield CSP.put(todoListUI, {action: 'createItem', item: todo});
            break;

          case 'deleteTodo':
            delete todo[event.id];
            yield CSP.put(todoListUI, {
              action: 'deleteItems',
              ids: [event.id]
            });
            break;

          case 'toggleOne':
            var todo = todos[event.id];
            todo.completed = !todo.completed;

            yield CSP.put(todoListUI, {
              action: 'setItemsStatus',
              ids: [todo.id],
              completed: todo.completed
            });
            break;

          case 'toggleAll':
            selected = _.where(_.values(todos), {completed: !event.completed});

            _.each(selected, function(todo) {
              todos[todo.id].completed = event.completed;
            });

            yield CSP.put(todoListUI, {
              action: 'setItemsStatus',
              ids: _.pluck(selected, 'id'),
              completed: event.completed
            });
            break;

          case 'clearCompleted':
            completed = _.where(_.values(todos), {completed: true});

            _.each(completed, function(todo) {
              delete todos[todo.id];
            });

            yield CSP.put(todoListUI, {
              action: 'deleteItems',
              ids: _.pluck(completed, 'id')
            });
            break;
        }

        completed = _.where(_.values(todos), {completed: true});

        yield CSP.put(footerUI, {
          action: 'updateStats',
          remaining: _.size(todos) - _.size(completed),
          completed: _.size(completed)
        });
      }
    });

    return {
      todoListControl: todoListUI,
      footerControl: footerUI,
      uiEvents: uiEvents
    };
  }

  function createTodoListUI(els) {
    var control = CSP.chan();
    var events = CSP.merge([
      listenForNewTodo(els.newTodos),
      listenForDeleteTodo(els.todoList),
      listenForToggleAll(els.toggleAll),
      listenForClearCompleted(els.todoList)
    ]);

    CSP.go(function*() {
      var items = {};
      var val, item, i, len;

      while (true) {
        val = yield CSP.take(control);

        switch (val.action) {
          case 'createItem':
            item = items[val.item.id] = createTodoItemUI(val.item);
            CSP.pipe(item.events, events);
            els.todoList.prepend(item.el);
            els.newTodos.val('');
            break;

          case 'deleteItems':
            for (i = 0, len = val.ids.length; i < len; i++) {
              item = items[val.ids[i]];
              delete items[val.ids[i]];
              yield CSP.put(item.control, {action: 'delete'});
            }
            break;

          case 'setItemsStatus':
            for (i = 0, len = val.ids.length; i < len; i++) {
              item = items[val.ids[i]];
              yield CSP.put(item.control, {
                action: 'setStatus',
                completed: val.completed
              });
            }
            break;
        }
      }
    });

    return {control: control, events: events};
  }

  function listenForNewTodo(newTodosEl) {
    var events = app.helpers.domEvents(newTodosEl, 'keypress');

    events = CSP.filterPull(events, function(event) {
      return (event.keyCode === ENTER_KEY);
    });

    return CSP.mapPull(events, function(event) {
      return {
        action: 'newTodo',
        title: $(event.currentTarget).val()
      };
    });
  }

  function listenForToggleAll(toggleAllEl) {
    var events = app.helpers.domEvents(toggleAllEl, 'click');

    return CSP.mapPull(events, function(event) {
      return {
        action: 'toggleAll',
        completed: $(event.currentTarget).prop('checked')
      };
    });
  }

  function createTodoItemUI(item) {
    var el = $(itemTemplate(item));
    var control = CSP.chan();
    var events = CSP.merge([
      listenForToggleOne(el),
      listenForDeleteTodo(el)
    ]);

    CSP.go(function*() {
      var val;

      while (true) {
        val = yield CSP.take(control);

        switch(val.action) {
          case 'delete':
            el.remove();
            break;

          case 'setStatus':
            el.find('.toggle').prop('checked', val.completed);
            el.toggleClass('completed', val.completed);
            break;
        }
      }
    });

    return {control: control, events: events, el: el};
  }

  function listenForToggleOne(todoItemEl) {
    var events = app.helpers.domEvents(todoItemEl, 'click', '.toggle');

    return CSP.mapPull(events, function(event) {

      return {
        action: 'toggleOne',
        id: todoItemEl.data('id')
      };
    });
  }

  function listenForDeleteTodo(todoItemEl) {
    var events = app.helpers.domEvents(todoItemEl, 'click', '.destroy');

    return CSP.mapPull(events, function(event) {
      return {
        action: 'deleteTodo',
        id: todoItemEl.data('id')
      };
    });
  }

  function createFooterUI(els) {
    var control = CSP.chan();
    var events = CSP.merge([
      listenForClearCompleted(els.footer)
    ]);

    CSP.go(function*() {
      while (true) {
        var val = yield CSP.take(control);

        switch (val.action) {
          case 'updateStats':
            var stats = _.pick(val, 'completed', 'remaining');
            els.footer.html('');
            els.footer.append(statsTemplate(stats));
        }
      }
    });

    return {control: control, events: events};
  }

  function listenForClearCompleted(footerEl) {
    var events = app.helpers.domEvents(footerEl, 'click', '#clear-completed');

    return CSP.mapPull(events, function(event) {
      return {action: 'clearCompleted'};
    });
  }

  function showFiltered() {}

  function init() {
    var els = {
      newTodos: $('#new-todo'),
      todoList: $('#todo-list'),
      footer: $('#footer'),
      toggleAll: $('#toggle-all')
    };

    var todoApp = createTodoApp();
    var todoListUI = createTodoListUI(els);
    var footerUI = createFooterUI(els);

    CSP.pipe(todoListUI.events, todoApp.uiEvents);
    CSP.pipe(footerUI.events, todoApp.uiEvents);

    CSP.pipe(todoApp.todoListControl, todoListUI.control);
    CSP.pipe(todoApp.footerControl, footerUI.control);

    Router({'/:filter': showFiltered}).init();
  }

  init();
})();
