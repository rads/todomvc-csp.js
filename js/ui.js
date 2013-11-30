var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function createTodoAppUI(el, controlFn) {
    var $el = $(el);
    var $input = $el.find('#new-todo');
    var $toggleAll = $el.find('#toggle-all');
    var $list = $el.find('#todo-list');
    var footer = createFooterUI($el.find('#footer'));

    var filterChan = CSP.chan();

    var filter = null;
    var items = {};

    var events = {
      newTodo: listenForNewTodo($input),
      toggleAll: listenForToggleAll($toggleAll),
      clearCompleted: footer.clearCompleted,
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

    controlFn(events, ui);

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
        item.forceRemove();
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
      CSP.pipe(item.toggle, newItems[i].toggle);
      CSP.pipe(item.remove, newItems[i].remove);
      CSP.pipe(item.update, newItems[i].update);

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
    var el = $(itemTemplate(item));

    if (item.completed) $(el).addClass('completed');

    var edits = editEvents(el);
    var update = CSP.chan();
    var toggle = app.helpers.domEvents(el, 'click', '.toggle');
    var remove = app.helpers.domEvents(el, 'click', '.destroy');
    var removeOut = CSP.chan();

    CSP.goLoop(function*() {
      var result = yield CSP.alts([edits, remove]);

      if (remove === result.chan) {
        el.remove();
        yield CSP.put(removeOut, result.value);
        return;
      } else if (edits === result.chan) {
        _startEditing();
        yield CSP.take(result.value);
        debugger;
        _stopEditing();
      }
    });

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

      CSP.putAsync(update, title);
    }

    function forceRemove() {
      CSP.putAsync(remove, true);
    }

    return {
      el: el,
      setStatus: _setStatus,
      toggle: toggle,
      remove: removeOut,
      update: update,
      forceRemove: forceRemove
    };
  }

  function editEvents(todoItemEl) {
    var edits = CSP.chan();
    var itemClicks = app.helpers.domEvents(todoItemEl, 'dblclick');
    itemClicks = CSP.removePull(itemClicks, function(event) {
      return $(event.target).is('.destroy');
    });

    var bodyClicks = app.helpers.domEvents($('html'), 'click');
    bodyClicks = CSP.removePull(bodyClicks, function(event) {
      return $(event.target).closest(todoItemEl).length;
    });

    var enterPresses = app.helpers.domEvents(todoItemEl, 'keypress', '.edit');
    enterPresses = CSP.filterPull(enterPresses, function(event) {
      return (event.keyCode === ENTER_KEY);
    });

    CSP.goLoop(function*() {
      yield CSP.take(itemClicks);

      var done = CSP.go(function*() {
        yield CSP.alts([bodyClicks, enterPresses]);
      });

      yield CSP.put(edits, done);
    });

    return edits;
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
    createTodoAppUI: createTodoAppUI
  };
})();
