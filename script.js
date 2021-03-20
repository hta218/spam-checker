window.addEventListener("load", function () {
	(function () {
		console.log('App script loaded')
		const app = new App()
		app.init()
		window.__spamChecker = app
	})();
})

class App {
	storageKey = '__spam-checker-data'

	domNodes = {
		start: $('#start'),
		accessToken: $('#token'),
		pageId: $('#page-id'),
		postIds: $('#post-ids'),
	}
	data = {
		pageToken: '',
		posts: {}
	}

	constructor() {
		this.data.postIds = Array.from(new Set(this.data?.postIds?.split(',')))
	}

	init = () => {
		try {
			this.getDataFromLocalStorage()
			this.domNodes.start.click(() => {
				console.log('====> click')
				this.data = {
					...this.data,
					accessToken: this.domNodes.accessToken.val(),
					pageId: this.domNodes.pageId.val(),
					postIds: this.domNodes.postIds.val()?.split(','),
				}
				console.log('App data: ', this.data)
				this.saveDataToStorage()
				this.run()
			})
		} catch (err) {
			console.log('Failed to init app. ', err)
		}
	}

	run = async () => {
		await this.getFacebookPageAccessToken()
		this.data.postIds.forEach(this.fetchPostComments);
	}

	saveDataToStorage = () => {
		localStorage.setItem(this.storageKey, JSON.stringify(this.data))
	}

	getDataFromLocalStorage = () => {
		this.data = {
			...this.data,
			...JSON.parse(localStorage.getItem(this.storageKey)) || {}
		}
		this.domNodes.accessToken.val(this.data.accessToken || "")
		this.domNodes.pageId.val(this.data.pageId || "")
		this.domNodes.postIds.val(this.data?.postIds?.join?.(','))
	}

	getFacebookPageAccessToken = () => {
		return new Promise((resolve, reject) => {
			FB.api(
				`/${this.data.pageId}`,
				"GET",
				{ fields: "access_token", access_token: this.data.accessToken },
				(res) => {
					if (res.error) {
						return reject(res.error)
					}
					this.data.pageToken = res.access_token;
					resolve()
				}
			);
		})
	}

	fetchPostComments = (postId) => {
		console.log('Fetching comments of post: ', postId)
		return new Promise((resolve, reject) => {
			FB.api(
				`/${this.data.pageId}_${postId}/comments`,
				"GET",
				{
					fields: "can_hide, is_hidden, message, comments { comments, message, can_hide, is_hidden, from }",
					// after: after,
					access_token: this.data.pageToken
				},
				(res) => {
					if (res.error) {
						return reject(res.error)
					}
					this.data.posts[postId] = this.data.posts[postId] || {
						id: postId,
						comments: []
					}

					this.data.posts?.[postId]?.comments?.push(res?.data)
					console.log(`Fetched ${this.data.posts?.[postId]?.comments?.length} comments of post ${postId}.`)
					for (let cmt of res.data) {
						// if (!cmt.is_hidden && cmt.can_hide)
						// 	comments.push([cmt.id, "hide", cmt.message]);
						// if (cmt.comments) {
						// 	for (let subcmt of cmt.comments.data) {
						// 		if (
						// 			subcmt.can_hide &&
						// 			subcmt.message.match(/\w{1,63}\.\w{1,5}\//)
						// 		)
						// 			comments.push([subcmt.id, "delete", subcmt.message]);
						// 	}
						// }
					}

					// after =
					// 	res.paging &&
					// 		res.paging.cursors.after &&
					// 		res.data.length > 98
					// 		? res.paging.cursors.after
					// 		: "";
					// hide_comments();
				}
			);
		})
	}
}

