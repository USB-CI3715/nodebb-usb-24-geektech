'use strict';

const querystring = require('querystring');

const posts = require('../posts');
const privileges = require('../privileges');
const helpers = require('./helpers');

const postsController = module.exports;

postsController.redirectToPost = async function (req, res, next) {
	const pid = parseInt(req.params.pid, 10);
	if (!pid) {
		return next();
	}

	const [canRead, path] = await Promise.all([
		privileges.posts.can('topics:read', pid, req.uid),
		posts.generatePostPath(pid, req.uid),
	]);
	if (!path) {
		return next();
	}
	if (!canRead) {
		return helpers.notAllowed(req, res);
	}

	const qs = querystring.stringify(req.query);
	helpers.redirect(res, qs ? `${path}?${qs}` : path, true);
};

postsController.getRecentPosts = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;
	const start = Math.max(0, (page - 1) * postsPerPage);
	const stop = start + postsPerPage - 1;
	const data = await posts.getRecentPosts(req.uid, start, stop, req.params.term);
	res.json(data);
};

postsController.updateAnsweredStatus = async function (req, res) {
    try {
        const { pid } = req.params;
        const { answered } = req.body;
        const uid = req.uid;

        const post = await posts.getPostData(pid);
        if (!post) {
            return res.status(404).json({ error: 'Post no encontrado' });
        }

        const canEdit = await privileges.posts.canEdit(pid, uid);
        if (!canEdit.flag) {
            return res.status(403).json({ error: 'No tienes permiso para modificar este post' });
        }

        await posts.setAnsweredStatus(pid, answered);

        res.status(200).json({ message: 'Estado de respuesta actualizado', answered });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};