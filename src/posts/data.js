'use strict';

const db = require('../database');
const plugins = require('../plugins');
const { getUrgencyById } = require('../urgencies');
const utils = require('../utils');

const intFields = [
	'uid', 'pid', 'tid', 'deleted', 'timestamp',
	'upvotes', 'downvotes', 'deleterUid', 'edited',
	'replies', 'bookmarks', 'answered',
];

module.exports = function (Posts) {
	Posts.getPostsFields = async function (pids, fields) {
		if (!Array.isArray(pids) || !pids.length) {
			return [];
		}
		const keys = pids.map(pid => `post:${pid}`);
		const postData = await db.getObjects(keys, fields);
		const result = await plugins.hooks.fire('filter:post.getFields', {
			pids: pids,
			posts: postData,
			fields: fields,
		});
		result.posts.forEach(post => modifyPost(post, fields));
		return result.posts;
	};

	Posts.getPostData = async function (pid) {
		const posts = await Posts.getPostsFields([pid], []);
		const urgency = posts && posts.length ? (await getUrgencyById({ urg_id: posts[0].urg_id })) : null;

		const { uid } = posts[0];

		const user = await db.getObjectFields(`user:${uid}`, ['uid', 'username', 'userslug', 'picture', 'rol', 'status', 'fullname']);

		return urgency ? { ...posts[0], urgency, user, url: `/post/${pid}` } : null;
	};

	Posts.getAnsweredStatus = async function (pid) {
		/**
		 * Retrieves the answered status of a post.
		 *
		 * @param {number} pid - The ID of the post to retrieve.
		 * @returns {string} True if the post has been answered, false otherwise.
		 */
		const post = await Posts.getPostFields(pid, ['answered']);
		return post ? post.answered : 0;
	};

	Posts.getPostsData = async function (pids) {
		const posts = await Posts.getPostsFields(pids, []);
		const urgencies = await Promise.all(posts.map(post => getUrgencyById({ urg_id: post.urg_id })));
		const users = await db.getObjectsFields(posts.map(post => `user:${post.uid}`), ['uid', 'username', 'userslug', 'picture', 'rol', 'status', 'fullname']);
		return posts.map((post, index) => ({ ...post, urgency: urgencies[index], user: users[index], url: `/post/${post.pid}` }));
	};

	Posts.getPostField = async function (pid, field) {
		const post = await Posts.getPostFields(pid, [field]);
		return post ? post[field] : null;
	};

	Posts.getPostFields = async function (pid, fields) {
		const posts = await Posts.getPostsFields([pid], fields);
		return posts ? posts[0] : null;
	};

	Posts.setPostField = async function (pid, field, value) {
		await Posts.setPostFields(pid, { [field]: value });
	};

	Posts.setPostFields = async function (pid, data) {
		await db.setObject(`post:${pid}`, data);
		plugins.hooks.fire('action:post.setFields', { data: { ...data, pid } });
	};
};

function modifyPost(post, fields) {
	if (post) {
		db.parseIntFields(post, intFields, fields);
		if (post.hasOwnProperty('upvotes') && post.hasOwnProperty('downvotes')) {
			post.votes = post.upvotes - post.downvotes;
		}
		if (post.hasOwnProperty('timestamp')) {
			post.timestampISO = utils.toISOString(post.timestamp);
		}
		if (post.hasOwnProperty('edited')) {
			post.editedISO = post.edited !== 0 ? utils.toISOString(post.edited) : '';
		}
	}
}
