window.addEventListener("load", function () {
	console.log('Load script')

	var comments = [];
	var access_token = '';
	var page_access_token = ''
	var postIDs = [];
	var pageIDs = [];
	var pageID = '';
	var pageName = '';
	var postID = '';
	var after = '';
	var page = 1;
	var noti_checked = [];
	myStorage = window.localStorage;

	function Llog(message = '') {
		$('#log code').append(message + '\n');
		var objDiv = document.getElementById("log");
		objDiv.scrollTop = objDiv.scrollHeight;
	}

	$(function () {
		$('form').submit(function (e) { e.preventDefault() })

		if (!myStorage.getItem('noti_checked')) myStorage.setItem('noti_checked', [0]);
		noti_checked = myStorage.getItem('noti_checked').split(',');

		console.log(noti_checked);


		$('#txtToken').change(function () {
			if ($(this).val() != '') myStorage.setItem('accessToken', $(this).val());


		});
		$('#txtToken').val(myStorage.getItem('accessToken'));

		$('#txtPageID').change(function () {
			if ($(this).val() != '') myStorage.setItem('postIDs', $(this).val());


		});
		$('#txtPageID').val(myStorage.getItem('postIDs'));

		// hljs.initHighlightingOnLoad();

		$('#btn_start').click(function (e) {
			access_token = $('#txtToken').val();

			if (pageIDs.length == 0) {
				$('#pageList').html('');
				pageIDs = $('#txtPageID').val().split(',');
				pageIDs = pageIDs.filter(function (item, pos) {
					return pageIDs.indexOf(item) == pos;
				})

			}
			pageID = pageIDs.shift().trim();
			if (access_token == '' || pageID == '') return;
			FB.api(
				'/' + `473234653202897`,
				'GET',
				{ "fields": "access_token,name", "access_token": access_token },
				function (response) {
					if (response.error) { Llog('Error :' + response.error.message); return; }

					//get Page Token
					Llog('Page ' + response.name + ' loaded.');

					$('#pageList').append(response.name + '>' + pageID + ',');
					pageName = response.name;
					access_token = response.access_token;
					FB.api(
						'/' + pageID + '/notifications',
						'GET',
						{ "fields": "object", 'limit': 100, "access_token": access_token },
						function (e) {
							if (e.error) { 'Error : ' + pageID + ' ' + Llog(e.error.message); return; }

							Llog('Scanning comments...');

							for (let noti of e.data) {
								if (noti.object.id != pageID && postIDs.indexOf(noti.object.id) == -1 && noti_checked.indexOf(noti.id) == -1) {

									let objectID = (noti.object.id.indexOf('_') != -1) ? noti.object.id.split('_')[1] : noti.object.id;
									postIDs.push(objectID); noti_checked.push(noti.id); myStorage.setItem('noti_checked', noti_checked);
								}
							}



							Llog(JSON.stringify(postIDs));
							processComments();
							//access_token= e.access_token;
							//loadcomments();


						}
					);
				}
			);

		});
	})


	function processComments() {
		if (postIDs.length == 0) {
			if (pageIDs.length > 0) { $('#btn_start').click(); return }
			if ($('#autohide:checkbox:checked').length == 1) {

				let intTime = parseInt($('#txtTime').val());
				let date = new Date();
				Llog(date.getHours() + ':' + date.getMinutes() + '| Recheck in ' + intTime + ' seconds...')
				intTime = (intTime < 60) ? 60 * 1000 : intTime * 1000;

				setTimeout(function () { $('#btn_start').click() }, intTime);
			}

			return
		};
		postID = postIDs.shift();
		postID = (postID.indexOf(pageID) != -1) ? postID : pageID + '_' + postID;
		Llog('Page:' + pageName + ' | Post:' + postID);
		Llog('Scanning comments...');
		loadcomments();
	}

	function loadcomments() {
		FB.api(
			`/473234653202897_${pageID}/comments`,
			'GET',
			{ "fields": "can_hide,is_hidden,message,comments{comments,message,can_hide,is_hidden,from}", 'limit': 100, 'after': after, "access_token": access_token },
			function (response) {

				for (let cmt of response.data) {
					if (!cmt.is_hidden && cmt.can_hide) comments.push([cmt.id, 'hide', cmt.message]);
					if (cmt.comments) {
						for (let subcmt of cmt.comments.data) {
							if (subcmt.can_hide && subcmt.message.match(/\w{1,63}\.\w{1,5}\//)) comments.push([subcmt.id, 'delete', subcmt.message]);
						}
					}
				}

				Llog('Page ' + page + ' has ' + response.data.length + ' comments. Processing ' + comments.length);
				after = (response.paging && response.paging.cursors.after && response.data.length > 98) ? response.paging.cursors.after : '';
				hide_comments();
			}
		);
	}



	function hide_comments() {
		if (comments.length == 0) {
			if (after != '') {
				console.log('next page..');
				page++;
				loadcomments(); return;
			}
			else
				// alert('done');
				Llog('done');
			//reset
			page = 1;
			after = '';

			processComments(); return

		}

		let cID = comments.shift();
		if (cID[1] == 'hide')
			FB.api(
				'/' + cID[0],
				'POST',
				{ "is_hidden": "true", 'access_token': access_token },
				function (response) {
					Llog('Comment: ' + cID[2] + ' - Hide:' + response.success);
					hide_comments();
				}
			);
		else
			FB.api(
				'/' + cID[0],
				'DELETE',
				{ 'access_token': access_token },
				function (response) {
					Llog('Comment: ' + cID[2] + ' - Delete:' + response.success);
					hide_comments();
				}
			);
	}
})
