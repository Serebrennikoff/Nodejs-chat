window.onload = () => {
		setTimeout( () => $("#loginModal").modal('toggle'), 1);
		loginForm.addEventListener('change', (e) => {
			e.target.classList.remove('login-form__input_invalid');
		});

		window.addEventListener("dragover", (e) => {
			e.preventDefault();
		});
		window.addEventListener("drop", (e) => {
			e.preventDefault();
		});
};

// Авторизация и инициализация websocket соединения
function authorize() {
	// Проверка полей и формирование тела post запроса с данными пользователя
	let loginInputs = loginForm.elements;
	let userData = {};
	for(let i = 0; i < loginInputs.length; i++) {
		if(loginInputs[i].value.trim()) {
			userData[loginInputs[i].name] = loginInputs[i].value.trim();
		} else {
			loginInputs[i].classList.add('login-form__input_invalid');
		}
	}
	// Формирование AJAX запроса с данными пользователя
	if(Object.keys(userData).length === loginInputs.length) {
		new Promise( (resolve, reject) => {
			let xhr = new XMLHttpRequest();
			// В теле запроса передается объект с именем и ником авторизовавшегося пользователя
			let body = JSON.stringify(userData);

			xhr.open('POST', '/ws');
			xhr.setRequestHeader('Content-Type', 'application/json');

			xhr.onload = function() {
				if(xhr.status === 200) {
					resolve(xhr.response);
				} 
				else {
					reject(xhr.response);
				}
			};

			xhr.send(body);
		}).then( response => {
			response = JSON.parse(response);
			// Вывод списка участников
			let docFrag = document.createDocumentFragment();
			response.otherUsersOnline.forEach( user => {
				let li = document.createElement("li");
				li.className = "users-online__item";
				li.textContent = user.name;
				li.user = user.nick;
				docFrag.appendChild(li);
			});
			usersOnlineList.appendChild(docFrag);
			// Отображение данных авторизованного пользователя
			let userData = response.user;
			userName.textContent = userData.realname;
			userPhoto.firstElementChild.src = userData.photo || userPhoto.firstElementChild.src;
			userPhoto.firstElementChild.user = userData.nickname;
			// Вывод истории сообщений, если имеется для данного пользователя
			if(userData.messageHistory) {
				let messagesContainer = document.querySelector('#messages');
				for(let message of userData.messageHistory) {
					let source = messageTemplate.innerHTML,
							template = Handlebars.compile(source),
							messageOutput = template(message);
					messagesContainer.innerHTML += messageOutput;
				}
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}

			loginForm.reset();
			$("#loginModal").modal('hide');
			// Инициализация вебсокет соединения
			let ws = new WebSocket('ws://localhost:3000', 'echo-protocol');

			// Отправка данных авторизованного пользователя другим участникам
			ws.onopen = function() {
				let msg = {
					type: "user",
					data: userData
				};
				ws.send(JSON.stringify(msg)); 
			};
			// Рассылка сообщения в чате
			publish.onsubmit = function(e) {
				e.preventDefault();
				let messageText = this.elements.message.value.trim();
				if(messageText) {
					let time = new Date().toLocaleString("ru", {
						hour: 'numeric',
						minute: 'numeric'
					});
					let msg = {
						type: "message",
						authorName: userData.realname,
						authorNick: userData.nickname,
						time: time,
						text: messageText
					};
					ws.send(JSON.stringify(msg));
					publish.reset();	
				}
			};
			// Открытия окна загрузки фотографии
			userPhoto.addEventListener("click", () => {
				$("#photoUploadModal").modal('toggle');
			});
			// Загрузка фотографии пользователя, drag'n'drop
			(function() {
				function drop(e) {
					e.stopPropagation();
					e.preventDefault();
					let photo = e.dataTransfer.files[0];
					displayPhoto(photo);
				}

				function dragOver(e) {
					e.stopPropagation();
					e.preventDefault();
				}

				function displayPhoto(photo) {
					if(photo.type === "image/jpeg" && photo.size <= 512000) {
						let reader = new FileReader();
						reader.onload = function(e) {
							photoForUpload = e.target.result;
							dropZone.innerHTML = `<img src="${photoForUpload}" alt="Выбранное фото">`;
						};
						reader.readAsDataURL(photo);
					} else {
						alert("Можно загрузить только JPEG-файл, размером не более 512кб");
					}
				}

				function uploadPhoto() {
					if(photoForUpload) {
						let msg = {
							type: "photo",
							photoOwner: userData.nickname,
							photo: photoForUpload
						};
						ws.send(JSON.stringify(msg));
						$("#photoUploadModal").modal('hide');
						dropZone.textContent = "Перетащите сюда фото";
					}
				}

				let photoForUpload,
						dropZone = document.getElementById("dropZone");
				dropZone.addEventListener("dragover", dragOver);
				dropZone.addEventListener("drop", drop);
				uploadBtn.addEventListener("click", uploadPhoto)
			})();	
			// Получение сообщений от сервера
			ws.addEventListener("message", function(e) {
				let message = JSON.parse(e.data),
						messageType = message.type;

				switch(messageType) {
					// Авторизация нового участника
					case "user":
						infoTitle.textContent = `Участники (${message.usersOnline})`;
						let li = document.createElement("li");
						li.className = "users-online__item";
						li.user = message.data.nickname;
						li.textContent = message.data.realname;
						usersOnlineList.appendChild(li);
						break;
					// Новое сообщение в чате
					case "message":
						let messagesContainer = document.querySelector('#messages');
						message.authorPhoto = message.authorPhoto || 'images/default.png';
						let source = messageTemplate.innerHTML,
								template = Handlebars.compile(source),
								messageOutput = template(message);
						messagesContainer.innerHTML += messageOutput;
						messagesContainer.scrollTop = messagesContainer.scrollHeight;
						break;
					// Выход участника из чата
					case "onlogout":
						infoTitle.textContent = `Участники (${message.usersOnline})`;
						let usersList = usersOnlineList.children;
						for(let item of usersList) {
							if(item.user === message.userLeft) {
								item.remove();
								break;
							}
						}
						break;
					// Обновление фото участника
					case "photo":
						if(userPhoto.firstElementChild.user === message.owner) {
							userPhoto.firstElementChild.src = `${message.path}?${Date.now()}`;
						}
						let messagesList = document.querySelector('#messages').children;
						for(let item of messagesList) {
							if(item.getAttribute('data-author') === message.owner) {
								item.firstElementChild.firstElementChild.src = `${message.path}?${Date.now()}`;
							}
						}
						break;
				}
			});
		}, 
		error => {
			console.log(error);
			alert(error);
		});
	}
}