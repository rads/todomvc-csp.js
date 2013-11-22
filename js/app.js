var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function createTodoApp() {
    var todoList = CSP.chan();
    var footer = CSP.chan();
    var uiEvents = CSP.chan();

    CSP.go(function*() {
      var todos = {};
      var counter = 0;
      var event, id, todo, selected, completed, i, len;

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
            yield CSP.put(todoList, {action: 'createItem', item: todo});
            break;

          case 'deleteTodo':
            delete todo[event.id];
            yield CSP.put(todoList, {action: 'deleteItem', id: event.id});
            break;

          case 'toggleAll':
            selected = _.where(_.values(todos), {completed: !event.completed});

            for (i = 0, len = selected.length; i < len; i++) {
              selected[i].completed = event.completed;

              yield CSP.put(todoList, {
                action: 'setItemStatus',
                id: selected[i].id,
                completed: event.completed
              });
            }
            break;
        }

        completed = _.where(_.values(todos), {completed: true});

        yield CSP.put(footer, {
          action: 'updateStats',
          remaining: _.size(todos) - _.size(completed),
          completed: _.size(completed)
        });
      }
    });

    return {
      todoListControl: todoList,
      footerControl: footer,
      uiEvents: uiEvents
    };
  }

  function createTodoListUI(els) {
    var control = CSP.chan();
    var events = CSP.merge([
      listenForNewTodos(els.newTodos),
      listenForDeleteTodos(els.todoList),
      listenForToggleAllEvents(els.toggleAll)
    ]);

    CSP.go(function*() {
      var items = {};
      var val, item;

      while (true) {
        val = yield CSP.take(control);

        switch (val.action) {
          case 'createItem':
            item = items[val.item.id] = $(itemTemplate(val.item));
            els.todoList.prepend(item);
            els.newTodos.val('');
            break;

          case 'deleteItem':
            $(items[val.id]).remove();
            break;

          case 'setItemStatus':
            $(items[val.id]).
              find('.toggle').
              prop('checked', val.completed);
            break;
        }
      }
    });

    return {control: control, events: events};
  }

  function listenForNewTodos(newTodosEl) {
    var events = app.helpers.domEvents(newTodosEl, 'keypress');

    events = CSP.filterPull(events, function(event) {
      return (event.keyCode === ENTER_KEY);
    });

    events = CSP.mapPull(events, function(event) {
      return {
        action: 'newTodo',
        title: $(event.currentTarget).val()
      };
    });

    return events;
  }

  function listenForDeleteTodos(todoListEl) {
    var events = app.helpers.domEvents(todoListEl, 'click', '.destroy');

    events = CSP.mapPull(events, function(event) {
      return {
        action: 'deleteTodo',
        id: $(event.currentTarget).closest('li').data('id')
      };
    });

    return events;
  }

  function listenForToggleAllEvents(toggleAllEl) {
    var events = app.helpers.domEvents(toggleAllEl, 'click');

    events = CSP.mapPull(events, function(event) {
      return {
        action: 'toggleAll',
        completed: $(event.currentTarget).prop('checked')
      };
    });

    return events;
  }

  function createFooterUI(els) {
    var control = CSP.chan();

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

    return {control: control};
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

    CSP.pipe(todoApp.todoListControl, todoListUI.control);
    CSP.pipe(todoApp.footerControl, footerUI.control);

    Router({'/:filter': showFiltered}).init();
  }

  init();
})();
