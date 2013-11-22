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
            delete todos[event.id];
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

          case 'updateTodo':
            todos[event.id].title = event.title;
            break;
        }

        if (_.isEmpty(todos)) {
          yield CSP.put(footerUI, {action: 'hide'});
        } else {
          completed = _.where(_.values(todos), {completed: true});

          yield CSP.put(footerUI, {
            action: 'updateStats',
            remaining: _.size(todos) - _.size(completed),
            completed: _.size(completed)
          });
        }
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
    var id = item.id;
    var el = $(itemTemplate(item));
    var isEditing = false;

    var control = CSP.chan();
    var events = CSP.merge([
      listenForToggleOne(el, id),
      listenForDeleteTodo(el, id)
    ]);

    CSP.pipe(listenForEditEvents(el), control);

    CSP.go(function*() {
      var val, title;

      while (true) {
        val = yield CSP.take(control);

        switch(val.action) {
          case 'delete':
            isEditing = false;
            el.remove();
            break;

          case 'setStatus':
            el.find('.toggle').prop('checked', val.completed);
            el.toggleClass('completed', val.completed);
            break;

          case 'startEditing':
            el.addClass('editing');
            el.find('.edit').select();
            isEditing = true;
            break;

          case 'stopEditing':
            if (!isEditing) break;

            title = el.find('.edit').val();
            el.removeClass('editing');
            el.find('label').text(title);

            yield CSP.put(events, {
              action: 'updateTodo',
              id: id,
              title: title
            });
            break;
        }
      }
    });

    return {control: control, events: events, el: el};
  }

  function listenForToggleOne(todoItemEl, id) {
    var events = app.helpers.domEvents(todoItemEl, 'click', '.toggle');

    return CSP.mapPull(events, function(event) {
      return {action: 'toggleOne', id: id};
    });
  }

  function listenForDeleteTodo(todoItemEl, id) {
    var events = app.helpers.domEvents(todoItemEl, 'click', '.destroy');

    return CSP.mapPull(events, function(event) {
      return {action: 'deleteTodo', id: id};
    });
  }

  function listenForEditEvents(todoItemEl) {
    var start = app.helpers.domEvents(todoItemEl, 'dblclick');
    start = CSP.mapPull(start, function(event) {
      return {action: 'startEditing'};
    });

    var bodyClicks = app.helpers.domEvents($('html'), 'click');
    bodyClicks = CSP.removePull(bodyClicks, function(event) {
      return $(event.target).closest(todoItemEl).length;
    });

    var enterPresses = app.helpers.domEvents(todoItemEl, 'keypress', '.edit');
    enterPresses = CSP.filterPull(enterPresses, function(event) {
      return (event.keyCode === ENTER_KEY);
    });

    var stop = CSP.merge([bodyClicks, enterPresses]);
    stop = CSP.mapPull(stop, function(event) {
      return {action: 'stopEditing'}
    });

    return CSP.merge([start, stop]);
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
            els.footer.
              show().
              html('').
              append(statsTemplate(stats));
            break;

          case 'hide':
            els.footer.hide();
            break;
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
