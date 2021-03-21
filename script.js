window.addEventListener("load", function () {
	(function () {
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
		safeList: $('#safe-domains'),
		log: $('#log code'),
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

				this.data = {
					...this.data,
					accessToken: this.domNodes.accessToken.val(),
					pageId: this.domNodes.pageId.val(),
					postIds: this.domNodes.postIds.val()?.split(','),
					safeList: this.domNodes.safeList.val()?.split(','),
				}
				console.log('App data: ', this.data)
				this.saveDataToStorage()
				this.run()
			})
		} catch (err) {
			this.showLog('Failed to init app. ', err)
		}
	}

	run = async () => {
		await this.getFacebookPageAccessToken()
		const fetchCommentsPromises = this.data.postIds.map(this.fetchPostComments);
		await Promise.all(fetchCommentsPromises)

		const scanCommentsPromises = this.data.postIds.map(this.scanPostComments);
		await Promise.all(scanCommentsPromises)
	}

	showLog = (log) => {
		this.domNodes?.log?.append(`\n ${log}`)
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
		this.domNodes.safeList.val(this.data?.safeList?.join?.(','))
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

					this.data.posts[postId].comments = this.data.posts[postId].comments?.concat(res?.data)
					this.showLog(`Fetched ${this.data.posts?.[postId]?.comments?.length} comments of post ${postId}.`)
					return resolve(true)
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

	scanPostComments = (postId) => {
		this.showLog('=====================================')
		this.showLog('Scan comments')
		return new Promise((resolve, reject) => {
			const comments = this.data.posts?.[postId]?.comments || []
			const promises = comments.map(async cmt => {
				// this.showLog('Checking comment: ', cmt.id)
				debugger
				if (!cmt.is_hidden && cmt.can_hide) {
					if (this.isCommentSpam(cmt)) {
						await this.hideComment(cmt)
					} else if (cmt.comments) {
						cmt.comments?.data?.map(async subCmt => {
							if (!subCmt.is_hidden && subCmt.can_hide) {
								if (this.isCommentSpam(subCmt)) {
									await this.hideComment(subCmt)
								}
							}
						})
					}
				}
			})

			resolve(Promise.all(promises))
			this.showLog('===================================== Done')
		})
	}

	isCommentSpam = (cmt) => {
		const urls = cmt?.message?.match(/\bhttps?:\/\/\S+/gi)
		if (urls && Array.isArray(urls)) {
			console.log(`Comment ${cmt.id} -- has URLs`, urls, cmt)
			let areURLsSafe = true
			urls.forEach(url => {
				const { origin } = new URL(url)
				if (this.data.safeList.indexOf(origin) === -1) {
					this.showLog(`Comment ${cmt.id} -- ${origin} is not in safelist`)
					return areURLsSafe = false
				}
			})
			if (!areURLsSafe) {
				return true
			}
			return false
		}
	}

	hideComment = (cmt) => {
		this.showLog('========> Comment marked as spam. Hide it')
		return new Promise((resolve, reject) => {
			FB.api(
				`/${cmt.id}`,
				'POST',
				{ "is_hidden": "true", 'access_token': this.data.pageToken },
				function (response) {
					if (response.error) {
						return reject(response.error)
					}
					this.showLog('========> Hide comment cmt.id')
					return resolve(response)
				}
			);
		})
	}

	// fetchCommentData = (cmtId) => {
	// 	return new Promise((resolve, reject) => {
	// 		FB.api(
	// 			`/${cmtId}`,
	// 			"GET",
	// 			{ fields: "id, message, comment_count, like_count, from { id, name }", access_token: this.data.accessToken },
	// 			(res) => {
	// 				if (res.error) {
	// 					return reject(res.error)
	// 				}
	// 				resolve()
	// 			}
	// 		);
	// 	})
	// }
}

