var app = app || {};

;(function() {
  'use strict';

  var ENTER_KEY = 13;

  var domEvents = app.helpers.domEvents;
  var itemTemplate = _.template($('#item-template').html());
  var statsTemplate = _.template($('#stats-template').html());

  function createTodoAppUI(el) {
    return new TodoAppUI(el);
  }

  function TodoAppUI(el) {
    var $el = $(el);
    this.$main = $el.find('#main');
    this.$input = $el.find('#new-todo');
    this.$toggleAll = $el.find('#toggle-all');
    this.$list = $el.find('#todo-list');
    this._footer = new FooterUI($el.find('#footer'));

    this.out = {
      newTodo: this._newTodoEvents(),
      toggleAll: this._toggleAllEvents(),
      clearCompleted: this._footer.clearCompleted,
    };
  }

  _.extend(TodoAppUI.prototype, {
    _newTodoEvents: function() {
      var events = domEvents(this.$input, 'keypress');

      events = CSP.filterPull(events, function(event) {
        return (event.keyCode === ENTER_KEY);
      });

      events = CSP.mapPull(events, function(event) {
        return $(event.currentTarget).val().trim();
      });

      return CSP.removePull(events, _.isEmpty);
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
        item: newItem
      });

      this.$toggleAll.prop('checked', false);
      this.$input.val('');

      return item;
    },

    setFilter: function(filter) {
    },

    update: function(stats, filter) {
      if (stats.completed === 0 && stats.remaining == 0) {
        this._footer.hide();
        this.$main.hide();
      } else {
        this._footer.update(stats, filter);
        this.$main.show();
      }

      this.$toggleAll.prop('checked', (stats.remaining === 0));
    },
  });

  function TodoItemUI(options) {
    var self = this;
    var item = options.item;
    this.$list = options.$list;
    this.$el = $(itemTemplate(item));

    if (item.completed) this.$el.addClass('completed');

    this.out = {
      remove: domEvents(this.$el, 'click', '.destroy'),
      edits: this._editEvents(),
      toggle: domEvents(this.$el, 'click', '.toggle')
    };
  }

  _.extend(TodoItemUI.prototype, {
    append: function() {
      this.$list.append(this.$el);
    },

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
        self._startEditing();

        var done = CSP.go(function*() {
          yield CSP.take(stops);
          return self._stopEditing();
        });

        yield CSP.put(edits, done);
      });

      return edits;
    },

    remove: function() {
      this.$el.remove();
    },

    _startEditing: function() {
      this.$el.addClass('editing');
      this.$el.find('.edit').select();
    },

    _stopEditing: function() {
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
    this.clearCompleted = domEvents(el, 'click', '#clear-completed');
    this._filter = null;
    this._stats = null;
  }

  _.extend(FooterUI.prototype, {
    update: function(stats, filter) {
      this._stats = stats;
      this._filter = filter;
      this.$el.html(statsTemplate(stats));
      this._updateLinks();
      this.$el.show();
    },

    hide: function() {
      this.$el.hide();
    },

    _updateLinks: function() {
      this.$el.find('#filters li a')
        .removeClass('selected')
        .filter('[href="#/' + this._filter + '"]')
        .addClass('selected');
    }
  });

  app.ui = {
    createTodoAppUI: createTodoAppUI
  };
})();
