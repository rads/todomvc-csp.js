var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

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

  // ==========================================================================
  // Event stream processing

  function createTodoApp(todoListUIObj, footerUIObj) {
    var todoListUI = CSP.chan();
    var footerUI = CSP.chan();
    var uiEvents = CSP.chan();

    var todos = {};
    var state = {todos: todos, counter: 0};

    CSP.goLoop(function*() {
      var event = yield CSP.take(uiEvents);

      switch (event.action) {
        case 'newTodo':
          TodoApp.newTodo(event.title, state, todoListUIObj);
          break;

        case 'deleteTodo':
          delete todos[event.id];
          todoListUIObj.deleteItems([event.id]);
          break;

        case 'toggleOne':
          var todo = todos[event.id];
          todo.completed = !todo.completed;

          todoListUIObj.setItemsStatus([todo], todo.completed);
          break;

        case 'toggleAll':
          var selected = _.where(_.values(todos), {completed: !event.completed});

          _.each(selected, function(todo) {
            todos[todo.id].completed = event.completed;
          });

          todoListUIObj.setItemsStatus(selected, event.completed);
          break;

        case 'clearCompleted':
          var completed = _.where(_.values(todos), {completed: true});

          _.each(completed, function(todo) {
            delete todos[todo.id];
          });

          todoListUIObj.deleteItems(_.pluck(completed, 'id'));
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

          todoListUIObj.setFilter(selected, event.filter);
          footerUIObj.setFilter(event.filter);
          break;
      }

      if (_.isEmpty(todos)) {
        footerUIObj.hide();
      } else {
        var completed = _.where(_.values(todos), {completed: true});

        footerUIObj.updateStats({
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

  // ==========================================================================
  // Interface representation

  function createTodoListUI(els) {
    var control = CSP.chan();
    var events = CSP.merge([
      listenForNewTodo(els.newTodos),
      listenForToggleAll(els.toggleAll),
      listenForClearCompleted(els.todoList)
    ]);

    var filter = null;
    var items = {};

    function _createItems(newItems, clearInput) {
      if (typeof clearInput === 'undefined') clearInput = false;

      createItems(items, newItems, els.todoList, filter, events);

      if (clearInput) {
        els.toggleAll.prop('checked', false);
        els.newTodos.val('');
      }
    }

    function _deleteItems(ids) {
      deleteItems(items, ids);
    }

    function _setItemsStatus(itms, completed) {
      var item;

      for (var i = 0, len = itms.length; i < len; i++) {
        item = items[itms[i].id];

        if (!item) {
          createItems(items, [itms[i]], els.todoList, filter, events);
        } else if (isIgnoredItem(filter, itms[i])) {
          deleteItems(items, [itms[i].id]);
        } else {
          item.setStatus(completed);
        }
      }
    }

    function _setFilter(itms, filtr) {
      filter = filtr;
      deleteItems(items, _.keys(items));
      createItems(items, itms, els.todoList, filter, events);
    }

    return {
      control: control,
      events: events,
      createItems: _createItems,
      deleteItems: _deleteItems,
      setItemsStatus: _setItemsStatus,
      setFilter: _setFilter
    };
  }


  function deleteItems(itemsStore, ids) {
    var item, i, len;
    for (i = 0, len = ids.length; i < len; i++) {
      item = itemsStore[ids[i]];
      if (item) {
        delete itemsStore[ids[i]];
        $(item.el).remove();
      }
    }
  }

  function isIgnoredItem(filter, item) {
    return (filter === 'completed' && !item.completed) ||
           (filter === 'active' && item.completed);
  }

  function createItems(itemsStore, newItems, todoListEl, filter, events) {
    var i, len, item;
    for (i = 0, len = newItems.length; i < len; i++) {
      if (isIgnoredItem(filter, newItems[i])) continue;

      item = itemsStore[newItems[i].id] = createTodoItemUI(newItems[i]);
      CSP.pipe(item.events, events);
      todoListEl.prepend(item.el);
    }
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

    var control = CSP.chan();
    var events = CSP.merge([
      listenForToggleOne(el, id),
      listenForDeleteTodo(el, id)
    ]);

    if (item.completed) $(el).addClass('completed');

    var editing = editingEvents(el);

    CSP.goLoop(function*() {
      var val = yield CSP.take(editing);
      val ? _startEditing() : _stopEditing();
    });

    function _delete() {
      el.remove();
    }

    function _setStatus(completed) {
      el.find('.toggle').prop('checked', completed);
      el.toggleClass('completed', completed);
    }

    function _startEditing() {
      el.addClass('editing');
      el.find('.edit').select();
    }

    function _stopEditing() {
      var title = el.find('.edit').val();
      el.removeClass('editing');
      el.find('label').text(title);

      CSP.putAsync(events, {
        action: 'updateTodo',
        id: id,
        title: title
      });
    }

    return {
      control: control,
      events: events,
      el: el,
      delete: _delete,
      setStatus: _setStatus
    };
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

  function constantly(val) {
    return function() {
      return val;
    };
  }

  function editingEvents(todoItemEl) {
    var start = app.helpers.domEvents(todoItemEl, 'dblclick');

    var bodyClicks = app.helpers.domEvents($('html'), 'click');
    bodyClicks = CSP.removePull(bodyClicks, function(event) {
      return $(event.target).closest(todoItemEl).length;
    });

    var enterPresses = app.helpers.domEvents(todoItemEl, 'keypress', '.edit');
    enterPresses = CSP.filterPull(enterPresses, function(event) {
      return (event.keyCode === ENTER_KEY);
    });

    var stop = CSP.merge([bodyClicks, enterPresses]);

    var out = CSP.merge([
      CSP.mapPull(start, constantly(true)),
      CSP.mapPull(stop, constantly(false))
    ]);

    return CSP.unique(out);
  }

  function createFooterUI(els) {
    var control = CSP.chan();
    var events = CSP.merge([
      listenForClearCompleted(els.footer)
    ]);

    var filter = null;

    function _updateStats(stats) {
      els.footer.
        show().
        html('').
        append(statsTemplate(stats));
      setSelectedFilterLink(els.footer, filter);
    }

    function _setFilter(filtr) {
      filter = filtr;
      setSelectedFilterLink(els.footer, filter);
    }

    function _hide() {
      return els.footer.hide();
    }

    return {
      control: control,
      events: events,
      updateStats: _updateStats,
      setFilter: _setFilter,
      hide: _hide
    };
  }

  function setSelectedFilterLink(footerEl, filter) {
    var filtersEl = footerEl.find('#filters');
    filtersEl.find('a').removeClass('selected');
    filtersEl.find('a[href="#/' + (filter || '') + '"]').addClass('selected');
  }

  function listenForClearCompleted(footerEl) {
    var events = app.helpers.domEvents(footerEl, 'click', '#clear-completed');

    return CSP.mapPull(events, function(event) {
      return {action: 'clearCompleted'};
    });
  }

  function init() {
    var els = {
      newTodos: $('#new-todo'),
      todoList: $('#todo-list'),
      footer: $('#footer'),
      toggleAll: $('#toggle-all')
    };

    var todoListUI = createTodoListUI(els);
    var footerUI = createFooterUI(els);
    var todoApp = createTodoApp(todoListUI, footerUI);

    CSP.pipe(todoListUI.events, todoApp.uiEvents);
    CSP.pipe(footerUI.events, todoApp.uiEvents);

    CSP.pipe(todoApp.todoListControl, todoListUI.control);
    CSP.pipe(todoApp.footerControl, footerUI.control);

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
