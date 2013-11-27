var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function createTodoAppUI(el) {
    var $el = $(el);
    var $input = $el.find('#new-todo');
    var $toggleAll = $el.find('#toggle-all');
    var $list = $el.find('#todo-list');
    var footer = createFooterUI($el.find('#footer'));

    var events = CSP.merge([
      footer.events,
      listenForNewTodo($input),
      listenForToggleAll($toggleAll),
      listenForClearCompleted($list)
    ]);

    var filter = null;
    var items = {};

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

    return {
      events: events,
      createItems: _createItems,
      deleteItems: _deleteItems,
      setItemsStatus: _setItemsStatus,
      setFilter: _setFilter,
      hideFooter: _hideFooter,
      updateFooterStats: _updateFooterStats
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
    var done = CSP.chan();

    var events = CSP.merge([
      listenForToggleOne(el, id),
      listenForDeleteTodo(el, id)
    ]);

    if (item.completed) $(el).addClass('completed');

    var editing = editingEvents(el);
    var isEditing = false;

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

      CSP.putAsync(events, {
        action: 'updateTodo',
        id: id,
        title: title
      });
    }

    return {
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

  function createFooterUI(el) {
    var $el = $(el);

    var events = CSP.merge([
      listenForClearCompleted($el)
    ]);

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

  app.ui = {
    createTodoAppUI: createTodoAppUI,
  };
})();
