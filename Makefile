all: build/app.js build/helpers.js build/ui.js build/storage.js

build/%.js: js/%.js
	regenerator $< > $@
