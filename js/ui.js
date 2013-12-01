var app = app || {};

;(function() {
  'use strict';

  var domEvents = app.helpers.domEvents;

  var ENTER_KEY = 13;

  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function createTodoAppUI(options) {
    return new TodoAppUI(options);
  }

  function TodoAppUI(options) {
    var $el = $(options.el);
    var filters = options.filters;
    var controlFn = options.controlFn;

    this.$input = $el.find('#new-todo');
    this.$toggleAll = $el.find('#toggle-all');
    this.$list = $el.find('#todo-list');
    this._footer = new FooterUI($el.find('#footer'));

    var events = {
      newTodo: this._newTodoEvents(),
      toggleAll: this._toggleAllEvents(),
      clearCompleted: this._footer.clearCompleted,
      filter: filters
    };

    var controls = controlFn(events, this);
    this._itemControl = controls.itemControl;
  }

  _.extend(TodoAppUI.prototype, {
    _newTodoEvents: function() {
      var events = domEvents(this.$input, 'keypress');

      events = CSP.filterPull(events, function(event) {
        return (event.keyCode === ENTER_KEY);
      });

      return CSP.mapPull(events, function(event) {
        return $(event.currentTarget).val();
      });
    },

    _toggleAllEvents: function() {
      var events = domEvents(this.$toggleAll, 'click');

      return CSP.mapPull(events, function(event) {
        return $(event.currentTarget).prop('checked');
      });
    },

    createItem: function(newItem) {
      var item = new TodoItemUI({
        $list: this.$list,
        item: newItem,
        controlFn: this._itemControl
      });

      this.$toggleAll.prop('checked', false);
      this.$input.val('');

      return item;
    },

    setFilter: function(filter) {
      this._footer.setFilter(filter);
    },

    updateStats: function(stats) {
      if (stats.completed === 0 && stats.remaining == 0) {
        this._footer.hide();
      } else {
        this._footer.updateStats(stats);
      }
    },
  });

  function TodoItemUI(options) {
    var self = this;
    var item = options.item;
    var controlFn = options.controlFn;
    var $list = options.$list;

    this.$el = $(itemTemplate(item));
    this.$el.addClass('hidden');

    if (item.completed) this.$el.addClass('completed');

    $list.prepend(this.$el);

    this.events = {
      pull: {
        edits: this._editEvents()
      },
      push: {
        remove: domEvents(this.$el, 'click', '.destroy'),
        update: CSP.chan(),
        toggle: domEvents(this.$el, 'click', '.toggle')
      }
    };

    controlFn(this.events, this);
  }

  _.extend(TodoItemUI.prototype, {
    _editEvents: function() {
      var self = this;
      var edits = CSP.chan();
      var labelClicks = domEvents(this.$el, 'dblclick', 'label');

      var outsideClicks = domEvents($('html'), 'click');
      outsideClicks = CSP.removePull(outsideClicks, function(event) {
        return $(event.target).closest(self.$el).length;
      });

      var enterPresses = domEvents(this.$el, 'keypress', '.edit');
      enterPresses = CSP.filterPull(enterPresses, function(event) {
        return (event.keyCode === ENTER_KEY);
      });

      var stops = CSP.chan(CSP.droppingBuffer(0));
      CSP.pipe(CSP.merge([outsideClicks, enterPresses]), stops);

      CSP.goLoop(function*() {
        yield CSP.take(labelClicks);

        var done = CSP.go(function*() {
          yield CSP.take(stops);
        });

        yield CSP.put(edits, done);
      });

      return edits;
    },

    remove: function() {
      this.$el.remove();
    },

    startEditing: function() {
      this.$el.addClass('editing');
      this.$el.find('.edit').select();
    },

    stopEditing: function() {
      var title = this.$el.find('.edit').val();
      this.$el.removeClass('editing');
      this.$el.find('label').text(title);
      return title;
    },

    toggleVisible: function(visible) {
      this.$el.toggleClass('hidden', !visible);
    },

    toggleChecked: function(completed) {
      this.$el.find('.toggle').prop('checked', completed);
      this.$el.toggleClass('completed', completed);
    }
  });

  function FooterUI(el) {
    this.$el = $(el);
    this.$filters = this.$el.find('#filters');
    this.clearCompleted = domEvents(el, 'click', '#clear-completed');

    this._currentFilter = null;
  }

  _.extend(FooterUI.prototype, {
    updateStats: function(stats) {
      this.$el.html(statsTemplate(stats)).show();
      this._updateLinks();
    },

    setFilter: function(filter) {
      this._currentFilter = filter;
      this._updateLinks();
    },

    hide: function() {
      this.$el.hide();
    },

    _updateLinks: function() {
      this.$filters.find('a').removeClass('selected');
      this.$filters.find('a[href="#/' + this._currentFilter + '"]').
        addClass('selected');
    }
  });


  app.ui = {
    createTodoAppUI: createTodoAppUI
  };
})();
