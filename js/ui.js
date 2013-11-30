var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function createTodoApp(events, ui) {
    var e = events;
    var todos = {};
    var state = {todos: todos, counter: 0};

    CSP.goLoop(function*() {
      var result = yield CSP.alts([
        e.newTodo, e.toggleOne, e.toggleAll, e.clearCompleted,
        e.updateTodo, e.filter
      ]);
      var sc = result.chan;
      var val = result.value;

      if (e.newTodo === sc) {
        newTodo(val, state);
      } else if (e.toggleOne === sc) {
        toggleOne(val);
      } else if (e.toggleAll === sc) {
        toggleAll(val);
      } else if (e.clearCompleted === sc) {
        clearCompleted();
      } else if (e.updateTodo === sc) {
        updateTodo(val.id, val.title);
      } else if (e.filter === sc) {
        filterTodos(val);
      }

      updateFooter();
    });

    function newTodo(title, state) {
      var id = state.counter++;
      var remove = CSP.chan();

      var todo = state.todos[id] = {
        id: id,
        title: title,
        completed: false,
        remove: remove
      };

      CSP.go(function*() {
        yield CSP.take(remove);
        deleteTodo(id);
      });

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
  }

  function createTodoAppUI(el) {
    var $el = $(el);
    var $input = $el.find('#new-todo');
    var $toggleAll = $el.find('#toggle-all');
    var $list = $el.find('#todo-list');
    var footer = createFooterUI($el.find('#footer'));

    var toggleOne = CSP.chan();
    var deleteTodo = CSP.chan();
    var clearCompleted = CSP.merge([
      footer.clearCompleted,
      listenForClearCompleted($list)
    ]);
    var filterChan = CSP.chan();
    var updateTodo = CSP.chan();

    var filter = null;
    var items = {};

    var events = {
      newTodo: listenForNewTodo($input),
      toggleAll: listenForToggleAll($toggleAll),
      clearCompleted: clearCompleted,
      toggleOne: toggleOne,
      deleteTodo: deleteTodo,
      updateTodo: updateTodo,
      filter: filterChan
    };

    var ui = {
      createItems: _createItems,
      deleteItems: _deleteItems,
      setItemsStatus: _setItemsStatus,
      setFilter: _setFilter,
      hideFooter: _hideFooter,
      updateFooterStats: _updateFooterStats,
      filter: filterChan
    };

    createTodoApp(events, ui);

    function _createItems(newItems, clearInput) {
      if (typeof clearInput === 'undefined') clearInput = false;

      createItems(items, newItems, $list, filter, events);

      if (clearInput) {
        $toggleAll.prop('checked', false);
        $input.val('');
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
          createItems(items, [itms[i]], $list, filter, events);
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
      createItems(items, itms, $list, filter, events);
      footer.setFilter(filter);
    }

    function _hideFooter() {
      footer.hide();
    }

    function _updateFooterStats(stats) {
      footer.updateStats(stats);
    }

    return ui;
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
      CSP.pipe(item.toggleOne, events.toggleOne);
      CSP.pipe(item.deleteTodo, newItems[i].remove);
      CSP.pipe(item.updateTodo, events.updateTodo);

      todoListEl.prepend(item.el);
    }
  }

  function listenForNewTodo(newTodosEl) {
    var events = app.helpers.domEvents(newTodosEl, 'keypress');

    events = CSP.filterPull(events, function(event) {
      return (event.keyCode === ENTER_KEY);
    });

    return CSP.mapPull(events, function(event) {
      return $(event.currentTarget).val();
    });
  }

  function listenForToggleAll(toggleAllEl) {
    var events = app.helpers.domEvents(toggleAllEl, 'click');

    return CSP.mapPull(events, function(event) {
      return $(event.currentTarget).prop('checked');
    });
  }

  function createTodoItemUI(item) {
    var id = item.id;
    var el = $(itemTemplate(item));
    var done = CSP.chan();

    if (item.completed) $(el).addClass('completed');

    var editing = editingEvents(el);
    var isEditing = false;
    var updateTodo = CSP.chan();

    CSP.goLoop(function*() {
      var result = yield CSP.alts([editing, done]);

      if (result.val) {
        _startEditing();
        isEditing = true;
      } else {
        if (!isEditing) return;
        _stopEditing();
        isEditing = false;
      }
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

      CSP.putAsync(updateTodo, {
        id: id,
        title: title
      });
    }

    return {
      el: el,
      delete: _delete,
      setStatus: _setStatus,
      toggleOne: listenForToggleOne(el, id),
      deleteTodo: listenForDeleteTodo(el, id),
      updateTodo: updateTodo
    };
  }

  function listenForToggleOne(todoItemEl, id) {
    var events = app.helpers.domEvents(todoItemEl, 'click', '.toggle');

    return CSP.mapPull(events, constantly(id));
  }

  function listenForDeleteTodo(todoItemEl, id) {
    var events = app.helpers.domEvents(todoItemEl, 'click', '.destroy');
    return CSP.mapPull(events, constantly(id));
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

  function createFooterUI(el) {
    var $el = $(el);

    var filter = null;

    function _updateStats(stats) {
      $el.
        show().
        html('').
        append(statsTemplate(stats));
      setSelectedFilterLink($el, filter);
    }

    function _setFilter(filtr) {
      filter = filtr;
      setSelectedFilterLink($el, filter);
    }

    function _hide() {
      return $el.hide();
    }

    return {
      updateStats: _updateStats,
      setFilter: _setFilter,
      hide: _hide,
      clearCompleted: listenForClearCompleted($el)
    };
  }

  function setSelectedFilterLink(footerEl, filter) {
    var filtersEl = footerEl.find('#filters');
    filtersEl.find('a').removeClass('selected');
    filtersEl.find('a[href="#/' + (filter || '') + '"]').addClass('selected');
  }

  function listenForClearCompleted(footerEl) {
    return app.helpers.domEvents(footerEl, 'click', '#clear-completed');
  }

  app.ui = {
    createTodoAppUI: createTodoAppUI,
  };
})();
