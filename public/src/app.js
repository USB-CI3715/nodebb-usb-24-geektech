'use strict';

window.$ = require('jquery');

window.jQuery = window.$;
require('bootstrap');
window.bootbox = require('bootbox');
require('jquery-form');
window.utils = require('./utils');
require('timeago');

const Benchpress = require('benchpressjs');

Benchpress.setGlobal('config', config);

require('./sockets');
require('./overrides');
require('./ajaxify');

app = window.app || {};

const select = document.querySelectorAll('.urgency-select');
if (select && select.length) {
	select.forEach((el) => {
		el.addEventListener('change', async (e) => {
			const pid = parseInt(e.target.getAttribute('data-pid'), 10);
			const uid = parseInt(e.target.getAttribute('data-uid'), 10);
			const { content } = (await fetch(`/api/v3/posts/${pid}`).then(res => res.json())).response;
			const urg_id = e.target.value;

			const { csrf_token } = await fetch('/api/config').then(res => res.json());

			const data = {
				urg_id,
				content: content,
				uid,
				pid,
			};

			await fetch(`/api/v3/posts/${pid}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'x-csrf-token': csrf_token,
				},
				body: JSON.stringify(data),
			});
		});
	});
}

Object.defineProperty(app, 'isFocused', {
	get() {
		return document.visibilityState === 'visible';
	},
});
app.currentRoom = null;
app.widgets = {};
app.flags = {};
app.onDomReady = function () {
	$(document).ready(async function () {
		if (app.user.timeagoCode && app.user.timeagoCode !== 'en') {
			await import(/* webpackChunkName: "timeago/[request]" */ 'timeago/locales/jquery.timeago.' + app.user.timeagoCode);
		}
		app.load();
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', ajaxify.parseData);
} else {
	ajaxify.parseData();
}

(function () {
	let appLoaded = false;
	const isTouchDevice = utils.isTouchDevice();

	app.cacheBuster = config['cache-buster'];

	app.coldLoad = function () {
		if (appLoaded) {
			ajaxify.coldLoad();
		} else {
			$(window).one('action:app.load', ajaxify.coldLoad);
		}
	};

	app.handleEarlyClicks = function () {
		/**
		 * Occasionally, a button or anchor (not meant to be ajaxified) is clicked before
		 * ajaxify is ready. Capture that event and re-click it once NodeBB is ready.
		 *
		 * e.g. New Topic/Reply, post tools
		 */
		if (document.body) {
			let earlyQueue = []; // once we can ES6, use Set instead
			const earlyClick = function (ev) {
				let btnEl = ev.target.closest('button');
				const anchorEl = ev.target.closest('a');
				if (!btnEl && anchorEl && (anchorEl.getAttribute('data-ajaxify') === 'false' || anchorEl.href === '#')) {
					btnEl = anchorEl;
				}
				if (btnEl && !earlyQueue.includes(btnEl)) {
					earlyQueue.push(btnEl);
					ev.stopImmediatePropagation();
					ev.preventDefault();
				}
			};
			document.body.addEventListener('click', earlyClick);
			require(['hooks'], function (hooks) {
				hooks.on('action:ajaxify.end', function () {
					document.body.removeEventListener('click', earlyClick);
					earlyQueue.forEach(function (el) {
						el.click();
					});
					earlyQueue = [];
				});
			});
		} else {
			setTimeout(app.handleEarlyClicks, 50);
		}
	};
	app.handleEarlyClicks();

	// Función que se ejecuta cuando se detectan cambios en el DOM
	const observer = new MutationObserver(function (mutations) {
		mutations.forEach(async function () {

			// En las vistas de categorías y de inicio, ocultar categorías de orden 1 si el usuario no es profesor
			if (window.location.pathname === '/' || window.location.pathname.endsWith('/categories')) {
				const userRole = app.user.rol;

				// Ocultar categorías de orden 1 si el usuario no es profesor
				const categories = document.querySelectorAll('[data-order]');
				categories.forEach((category) => {
					if (category.getAttribute('data-order') === '1' && userRole !== 'professor') {
						category.remove();
					}
					if (category.getAttribute('data-order') === '1') {
						const lastPostDiv = category.querySelector('.lastpost.border-start.border-2.lh-sm.h-100');
						if (lastPostDiv) {
							lastPostDiv.style.display = 'none';
						}
					}
				});
			}
			// En la vista de preguntas urgentes
			if (window.location.pathname.endsWith('/urgent-questions')) {

				// Ocultar badges de estadísticas que no hacen falta en la vista de preguntas urgentes
				const badges = document.querySelectorAll('.badge.text-body.border.border-gray-300.stats.text-xs');
				badges.forEach(badge => {
					badge.style.display = 'none';
				});

				// Ocultar herramientas fijas
				const stickyTools = document.querySelector('div.sticky-tools.mb-3');
				if (stickyTools) {
					stickyTools.style.display = 'none';
				}
			}
		});
	});
	// Observar cambios en el DOM
	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});

	// Función que renderiza las preguntas urgentes en la vista de preguntas urgentes
	function renderPosts(posts) {
		const container = document.getElementById('category-no-topics');	
		if (posts && container) {
			// Si no hay preguntas urgentes, mostrar mensaje
			if (posts.length === 0) {
				container.className = 'bg-light p-4 rounded text-center text-muted mt-4 mb-4 border';
				container.innerHTML = `
					<strong>\nNo urgent questions found!\n</strong>
					<p>There are no urgent questions at the moment. Please stay tuned and check back later.</p>
				`;
				return;
			// Si hay preguntas urgentes, mostrarlas
			} else {
				// Limpiar el contenedor de preguntas del template
				container.innerHTML = ''; 
				container.className = '';
				// Renderizar cada pregunta
				posts.forEach(post => {
					console.log(post);
					const postElement = document.createElement('div');
					postElement.className = `post p-4 mb-3 border border-3 rounded text-break ${post.urgency.bgColor}`;
					postElement.style = '--bs-bg-opacity: .10;'

					// Determinar la cantidad de iconos a mostrar segun el tipo de urgencia
					let icons = '';
					if (post.urgency.urg_id === '2') {
						icons = '<i class="fa fa-fw fa-fire" data-content="" ></i>'.repeat(3);
					} else if (post.urgency.urg_id === '3') {
						icons = '<i class="fa fa-fw fa-fire" data-content=""></i>'.repeat(2);
					} else if (post.urgency.urg_id === '4') {
						icons = '<i class="fa fa-fw fa-fire" data-content=""></i>';
					}

					// Renderizar el contenido de la pregunta
					postElement.innerHTML = `
						<div class="d-flex justify-content-between align-items-center">
							<p class="text-break mb-0">
								<strong>Urgency:</strong> ${post.urgency.name}
								${icons}
							</p>
							<button class="btn btn-primary ${post.urgency.bgColor}" onclick="window.location.href='${post.url}'">View post on thread &#8680;</button>
						</div>
						<hr class="my-2 ${post.urgency.bgColor}"> <!-- Divider de Bootstrap -->
						<p class="text-break">${post.content}</p>
						<div class="d-flex justify-content-end">
                        	<small class="text-muted p-2"><strong>Posted by:</strong> @${post.user.username}, <strong>role:</strong> ${post.user.rol}</small>
                    	</div>
					`;
					container.appendChild(postElement);
				});
			}
		}
	}

	// Función que se ejecuta al cargar la vista de preguntas urgentes para obtener las preguntas urgentes
	(async function () {
		if (window.location.pathname.endsWith('/urgent-questions')) {
			const { csrf_token, uid } = await fetch('/api/config').then(res => res.json());

			const { response: posts }= await fetch(`/api/v3/posts/${uid}/unanswered/0`, { 
				method: 'GET', 
				headers: {
					'x-csrf-token': csrf_token,
				}
			}).then(res => res.json());
			renderPosts(posts);
		}
	})();

	app.load = function () {
		$('body').on('click', '#new_topic', function (e) {
			e.preventDefault();
			app.newTopic();
		});

		registerServiceWorker();

		require([
			'taskbar',
			'helpers',
			'forum/pagination',
			'messages',
			'search',
			'forum/header',
			'hooks',
		], function (taskbar, helpers, pagination, messages, search, header, hooks) {
			header.prepareDOM();
			taskbar.init();
			helpers.register();
			pagination.init();
			search.init();
			overrides.overrideTimeago();
			hooks.fire('action:app.load');
			messages.show();
			appLoaded = true;
		});
	};

	app.require = async function (modules) {
		const single = !Array.isArray(modules);
		if (single) {
			modules = [modules];
		}
		async function requireModule(moduleName) {
			let _module;
			try {
				switch (moduleName) {
					case 'bootbox': return require('bootbox');
					case 'benchpressjs': return require('benchpressjs');
					case 'clipboard': return require('clipboard');
				}
				if (moduleName.startsWith('admin')) {
					_module = await import(/* webpackChunkName: "admin/[request]" */ 'admin/' + moduleName.replace(/^admin\//, ''));
				} else if (moduleName.startsWith('forum')) {
					_module = await import(/* webpackChunkName: "forum/[request]" */ 'forum/' + moduleName.replace(/^forum\//, ''));
				} else {
					_module = await import(/* webpackChunkName: "modules/[request]" */ 'modules/' + moduleName);
				}
			} catch (err) {
				console.warn(`error loading ${moduleName}\n${err.stack}`);
			}
			return _module && _module.default ? _module.default : _module;
		}
		const result = await Promise.all(modules.map(requireModule));
		return single ? result.pop() : result;
	};

	app.enterRoom = function (room, callback) {
		callback = callback || function () { };
		if (socket && app.user.uid && app.currentRoom !== room) {
			const previousRoom = app.currentRoom;
			app.currentRoom = room;
			socket.emit('meta.rooms.enter', {
				enter: room,
			}, function (err) {
				if (err) {
					app.currentRoom = previousRoom;
					require(['alerts'], function (alerts) {
						alerts.error(err);
					});
					return;
				}

				callback();
			});
		}
	};

	app.leaveCurrentRoom = function () {
		if (!socket || config.maintenanceMode) {
			return;
		}
		const previousRoom = app.currentRoom;
		app.currentRoom = '';
		socket.emit('meta.rooms.leaveCurrent', function (err) {
			if (err) {
				app.currentRoom = previousRoom;
				require(['alerts'], function (alerts) {
					alerts.error(err);
				});
			}
		});
	};

	function highlightNavigationLink() {
		const pageParams = utils.params();
		function queryMatch(search) {
			const mySearchParams = new URLSearchParams(search);
			// eslint-disable-next-line no-restricted-syntax
			for (const [key, value] of mySearchParams) {
				if (pageParams[key] === value) {
					return true;
				}
			}
			return false;
		}
		$('#main-nav li')
			.find('a')
			.removeClass('active')
			.filter(function (i, a) {
				const hasHref = $(a).attr('href') !== '#';
				const removeByQueryString = a.search && hasHref && !queryMatch(a.search);
				return hasHref && window.location.hostname === a.hostname &&
					!removeByQueryString &&
					(
						window.location.pathname === a.pathname ||
						window.location.pathname.startsWith(a.pathname + '/')
					);
			})
			.addClass('active');
	}

	app.createUserTooltips = function (els, placement) {
		if (!isTouchDevice) {
			els = els || $('body');
			els.tooltip({
				selector: '.avatar.avatar-tooltip',
				placement: placement || 'top',
				container: '#content',
				animation: false,
			});
		}
	};

	app.createStatusTooltips = function () {
		if (!isTouchDevice) {
			$('body').tooltip({
				selector: '.fa-circle.status',
				placement: 'top',
				container: '#content',
				animation: false,
			});

			$('#content').on('inserted.bs.tooltip', function (ev) {
				const target = $(ev.target);
				if (target.attr('component') === 'user/status') {
					const newTitle = target.attr('data-new-title');
					if (newTitle) {
						$('.tooltip .tooltip-inner').text(newTitle);
					}
				}
			});
		}
	};

	app.processPage = function () {
		highlightNavigationLink();
		overrides.overrideTimeagoCutoff();
		$('.timeago').timeago();
		app.createUserTooltips($('#content'));
		app.createStatusTooltips();
	};

	app.toggleNavbar = function (state) {
		require(['components'], (components) => {
			const navbarEl = components.get('navbar');
			navbarEl[state ? 'show' : 'hide']();
		});
	};

	app.updateUserStatus = function (el, status) {
		if (!el.length) {
			return;
		}

		require(['translator'], function (translator) {
			translator.translate('[[global:' + status + ']]', function (translated) {
				el.removeClass('online offline dnd away')
					.addClass(status)
					.attr('data-new-title', translated);
			});
		});
	};

	app.newTopic = function (params) {
		// backwards compatibilty for old signature (cid, tags)
		if (typeof params !== 'object') {
			if (params) {
				console.warn('[deprecated] app.newTopic(cid, tags) please pass in an object');
			}
			params = {
				cid: params,
				tags: arguments[1] || (ajaxify.data.tag ? [ajaxify.data.tag] : []),
			};
		}

		require(['hooks'], function (hooks) {
			params.cid = params.cid || ajaxify.data.cid || 0;
			params.tags = params.tags || (ajaxify.data.tag ? [ajaxify.data.tag] : []);
			hooks.fire('action:composer.topic.new', params);
		});
	};

	app.newReply = async function (params) {
		// backwards compatibilty for old signature (tid)
		if (typeof params !== 'object') {
			console.warn('[deprecated] app.newReply(tid) please pass in an object');
			params = {
				tid: params,
			};
		}

		const [hooks, api] = await app.require(['hooks', 'api']);
		params.title = (ajaxify.data.template.topic ?
			ajaxify.data.titleRaw :
			(await api.get(`/topics/${params.tid}`)).titleRaw);

		hooks.fire('action:composer.post.new', params);
	};

	app.loadJQueryUI = function (callback) {
		if (typeof $().autocomplete === 'function') {
			return callback();
		}
		require([
			'jquery-ui/widgets/datepicker',
			'jquery-ui/widgets/autocomplete',
			'jquery-ui/widgets/sortable',
			'jquery-ui/widgets/resizable',
			'jquery-ui/widgets/draggable',
		], function () {
			callback();
		});
	};

	app.parseAndTranslate = function (template, blockName, data, callback) {
		if (typeof blockName !== 'string') {
			callback = data;
			data = blockName;
			blockName = undefined;
		}

		return new Promise((resolve, reject) => {
			require(['translator', 'benchpress'], function (translator, Benchpress) {
				Benchpress.render(template, data, blockName)
					.then(rendered => translator.translate(rendered))
					.then(translated => translator.unescape(translated))
					.then(resolve, reject);
			});
		}).then((html) => {
			html = $(html);
			if (callback && typeof callback === 'function') {
				setTimeout(callback, 0, html);
			}

			return html;
		});
	};

	function registerServiceWorker() {
		// Do not register for Safari browsers
		if (!config.useragent.isSafari && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register(config.relative_path + '/service-worker.js', { scope: config.relative_path + '/' })
				.then(function () {
					console.info('ServiceWorker registration succeeded.');
				}).catch(function (err) {
					console.info('ServiceWorker registration failed: ', err);
				});
		}
	}
}());
