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
    var currentFilter;

    var filterOut = CSP.chan();
    var items = {};

    var events = {
      newTodo: listenForNewTodo($input),
      toggleAll: listenForToggleAll($toggleAll),
      clearCompleted: footer.clearCompleted,
      filter: filterOut
    };

    var ui = {
      createItem: _createItem,
      deleteItem: _deleteItem,
      setFilter: _setFilter,
      hideFooter: _hideFooter,
      updateFooterStats: _updateFooterStats,
      filter: filterOut
    };

    controlFn(events, ui);

    function _createItem(newItem) {
      var item = items[newItem.id] = createTodoItemUI(newItem);
      CSP.pipe(item.events.toggle, newItem.toggle);
      CSP.pipe(item.events.remove, newItem.remove);
      CSP.pipe(item.events.update, newItem.update);
      CSP.pipe(newItem.visible, item.events.visible);
      CSP.pipe(newItem.checked, item.events.checked);

      $list.prepend(item.el);
      $toggleAll.prop('checked', false);
      $input.val('');
    }

    function _deleteItem(id) {
      var item = items[id];
      if (item) {
        delete items[id];
        item.el.remove();
      }
    }

    function _setFilter(filter) {
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
    el.addClass('hidden');

    if (item.completed) $(el).addClass('completed');

    var edits = editEvents(el);
    var removeChan = app.helpers.domEvents(el, 'click', '.destroy');
    var events = {
      update: CSP.chan(),
      toggle: app.helpers.domEvents(el, 'click', '.toggle'),
      remove: CSP.chan(),
      visible: CSP.chan(),
      checked: CSP.chan()
    };

    CSP.goLoop(function*() {
      var result = yield CSP.alts([
        edits, removeChan, events.visible, events.checked
      ]);

      if (removeChan === result.chan) {
        el.remove();
        yield CSP.put(events.remove, true);
        return true;
      } else if (edits === result.chan) {
        el.addClass('editing');
        el.find('.edit').select();

        yield CSP.take(result.value);

        var title = el.find('.edit').val();
        el.removeClass('editing');
        el.find('label').text(title);

        yield CSP.put(events.update, title);
      } else if (events.visible === result.chan) {
        el.toggleClass('hidden', result.value);
      } else if (events.checked === result.chan) {
        var completed = result.value;
        el.find('.toggle').prop('checked', completed);
        el.toggleClass('completed', completed);
      }
    });

    return {el: el, events: events};
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
    var currentFilter = null;
    var clearCompleted = app.helpers.domEvents(el, 'click',
      '#clear-completed');

    function _updateStats(stats) {
      $el.html(statsTemplate(stats)).show();
      setSelectedFilterLink($el, currentFilter);
    }

    function _setFilter(filter) {
      currentFilter = filter;
      setSelectedFilterLink($el, currentFilter);
    }

    function _hide() {
      return $el.hide();
    }

    return {
      updateStats: _updateStats,
      setFilter: _setFilter,
      hide: _hide,
      clearCompleted: clearCompleted
    };
  }

  function setSelectedFilterLink(footerEl, filter) {
    var filtersEl = footerEl.find('#filters');
    filtersEl.find('a').removeClass('selected');
    filtersEl.find('a[href="#/' + (filter || '') + '"]').addClass('selected');
  }

  app.ui = {
    createTodoAppUI: createTodoAppUI
  };
})();
