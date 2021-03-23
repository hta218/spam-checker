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
		stop: $('#stop'),
		accessToken: $('#token'),
		pageId: $('#page-id'),
		postIds: $('#post-ids'),
		safeList: $('#safe-domains'),
		log: $('#log code'),
		restartTime: $('#restart-time'),
		spamsFound: $('#spams-found'),
	}
	data = {
		pageToken: '',
		posts: {},
		spamFound: 0,
	}

	restartTimeout = -1

	constructor() {
		this.data.postIds = Array.from(new Set(this.data?.postIds?.split(',')))
	}

	init = () => {
		try {
			this.getDataFromLocalStorage()
			this.domNodes.start.click(() => {
				this.domNodes.start.attr('disabled', true)
				clearTimeout(this.restartTimeout)

				this.data = {
					...this.data,
					accessToken: this.domNodes.accessToken.val(),
					pageId: this.domNodes.pageId.val(),
					postIds: this.domNodes.postIds.val()?.split(','),
					safeList: this.domNodes.safeList.val()?.split(','),
					restartTime: Number(this.domNodes.restartTime.val()),
				}
				console.log('App data: ', this.data)
				this.saveDataToStorage()
				this.run()
			})
			this.domNodes.stop.click(() => {
				clearTimeout(this.restartTimeout)
				this.domNodes.start.attr('disabled', false)
			})
		} catch (err) {
			this.showLog('Failed to init app. ', err)
		}
	}

	run = async () => {
		this.domNodes.log.text('')
		this.showLog('=======> App starting.......')
		await this.getFacebookPageAccessToken()
		const fetchCommentsPromises = this.data.postIds.map(this.fetchPostComments);
		await Promise.all(fetchCommentsPromises)

		const scanCommentsPromises = this.data.postIds.map(this.scanPostComments);
		await Promise.all(scanCommentsPromises)
		this.showLog('=======> DONE -- FISHNISH ALL CHECKING')
		this.restartTimeout = setTimeout(this.run, this.data.restartTime * 1000)
	}

	showLog = (log) => {
		const $log = this.domNodes?.log
		$log.append(`\n ${log}`)
		$log?.parent?.().animate({ scrollTop: $log[0]?.scrollHeight || 0 }, 1);
	}

	saveDataToStorage = () => {
		localStorage.setItem(this.storageKey, JSON.stringify(this.data))
	}

	getDataFromLocalStorage = () => {
		const { accessToken, pageId, postIds, safeList, restartTime } = JSON.parse(localStorage.getItem(this.storageKey)) || {}
		this.data = {
			...this.data,
			accessToken, pageId, postIds, safeList, restartTime
		}

		this.domNodes.accessToken.val(this.data.accessToken || "")
		this.domNodes.pageId.val(this.data.pageId || "")
		this.domNodes.postIds.val(this.data?.postIds?.join?.(','))
		this.domNodes.safeList.val(this.data?.safeList?.join?.(','))
		this.domNodes.restartTime.val(this.data?.restartTime || 30)
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
		// this.showLog(`Fetching comments of post: ${postId} ..........`)
		return new Promise((resolve, reject) => {
			FB.api(
				`/${this.data.pageId}_${postId}/comments`,
				"GET",
				{
					fields: "can_hide, is_hidden, message, comments { comments, message, can_hide, is_hidden, from }",
					after: this?.data?.posts?.[postId]?.after || '',
					access_token: this.data.pageToken
				},
				(res) => {
					if (res.error) {
						return reject(res.error)
					}
					this.data.posts[postId] = this.data.posts[postId] || {
						id: postId,
						comments: [],
						after: ''
					}

					this.data.posts[postId].comments = this.data.posts[postId].comments?.concat(res?.data)
					this.data.posts[postId].after = res?.data?.length ? res?.paging?.cursors?.after : ''

					if (!this.data.posts[postId].after) {
						this.showLog(`Fetched ${this.data.posts?.[postId]?.comments?.length} comments of post ${postId}.`)
						return resolve(true)
					} else {
						resolve(this.fetchPostComments(postId))
					}
				}
			);
		})
	}

	scanPostComments = (postId) => {
		this.showLog(`===================================== Start scan comments of post ${postId}`)
		return new Promise((resolve, reject) => {
			const comments = this.data.posts?.[postId]?.comments || []
			const promises = comments.map(async cmt => {
				console.log('======> checking comment: ', cmt.id, cmt.message)
				console.count('NUMBER OF TOTAL COMMENTS: ')
				if (!cmt.is_hidden && cmt.can_hide) {
					if (this.isCommentSpam(cmt)) {
						await this.hideComment(cmt)
					} else if (cmt.comments) {
						this.showLogCommentOK(cmt)
						cmt.comments?.data?.map(async subCmt => {
							console.log('======> checking comment: ', subCmt.id, subCmt.message)
							console.count('NUMBER OF TOTAL COMMENTS: ')
							if (!subCmt.is_hidden && subCmt.can_hide) {
								if (this.isCommentSpam(subCmt)) {
									await this.hideComment(subCmt)
								} else {
									this.showLog(`
										Comment --------- ${subCmt.id}-- OK
										\n Message: ${subCmt.message}`)
								}
							} else {
								this.showLogCommentOK(subCmt)
							}
						})
					} else {
						this.showLogCommentOK(cmt)
					}
				} else {
					this.showLogCommentOK(cmt)
				}
			})

			resolve(Promise.all(promises))
			this.showLog(`============================ Finish checking comments of post ${postId} \n\n\n\n\n`)
		})
	}

	showLogCommentOK = (cmt) => {
		this.showLog(`Comment ------------ ${cmt.id} -- PASS
			\n [Message]: ${cmt.message}
			\n [Comment IS HIDDEN]: ${cmt.is_hidden}
			\n [Comment CAN HIDE]: ${cmt.can_hide}
		`)
	}

	isCommentSpam = (cmt) => {
		// const urls = cmt?.message?.match(/\bhttps?:\/\/\S+/gi)
		const urls = cmt?.message?.match(/((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)/gi)
		if (urls && Array.isArray(urls)) {
			console.log(`Comment ${cmt.id} -- has URLs`, urls, cmt)
			let areURLsSafe = true
			urls.forEach(url => {
				const { origin } = new URL(`https://${url.replace(/https?\:\/\//g, '')}`)
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
		return new Promise((resolve, reject) => {
			FB.api(
				`/${cmt.id}`,
				'POST',
				{ "is_hidden": "true", 'access_token': this.data.pageToken },
				(response) => {
					if (response.error) {
						return reject(response.error)
					}
					this.showLog(`
						\n ****************************************************************************************
						\n ========> SPAM FOUND!!!. Hide comment ${cmt.id}
						\n Comment: ${cmt.message}
						\n Comment has been hidden
						\n *****************************************************************************************
					`)
					this.data.spamFound += 1
					this.domNodes.spamsFound.text(this.data.spamFound)
					return resolve(response)
				}
			);
		})
	}
}

