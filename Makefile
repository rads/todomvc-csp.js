all: build/app.js build/helpers.js build/ui.js

build/app.js: js/app.js
	regenerator js/app.js > build/app.js

build/helpers.js: js/helpers.js
	regenerator js/helpers.js > build/helpers.js

build/ui.js: js/ui.js
	regenerator js/ui.js > build/ui.js
